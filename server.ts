import express from 'express';
import type { Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Bundle, BundleStatus, Job, Operator, Exception, ShiftMessage, ActivityEvent, TrailerSize } from './src/types';
import { INITIAL_BUNDLES, INITIAL_JOBS, INITIAL_OPERATORS, INITIAL_EXCEPTIONS, INITIAL_SHIFT_MESSAGES, INITIAL_ACTIVITY } from './src/seedData';
import { zoneCoords } from './src/pages/yardMapData';
import { getRouteAnalysisByZones } from './src/utils/yardMath';
import {
  computeDashboardMetrics, gradePlacementViolation, isValidYardLocation, MAX_ZONE_CAPACITY_LBS, MIN_ZONE_CAPACITY_LBS, liftBlockedReason, movementBlockedReason, rawStockStatus, SHIPPING_DOORS, SW_SHIPPING_DOORS, slottingConflict, slottingViolationMessage, stagedAtAfterMove, statusAfterDrop, statusAfterStaging, isCoated
} from './src/yardRules';

// Store state in-memory so modifications persist during runtime.
// Deep copies, so runtime changes never mutate the seed data and the yard can be reset.
let bundles: Bundle[] = structuredClone(INITIAL_BUNDLES);
let jobs: Job[] = structuredClone(INITIAL_JOBS);
let operators: Operator[] = structuredClone(INITIAL_OPERATORS);
let exceptions: Exception[] = structuredClone(INITIAL_EXCEPTIONS);
let shiftMessages: ShiftMessage[] = structuredClone(INITIAL_SHIFT_MESSAGES);
let activityEvents: ActivityEvent[] = structuredClone(INITIAL_ACTIVITY);
// Per-zone storage limits set from the yard map; zones without an entry use DEFAULT_ZONE_CAPACITY_LBS
let zoneCapacities: Record<string, number> = {};

/** Restores the yard to the seed data (used by the API tests). */
export function resetYardState() {
  bundles = structuredClone(INITIAL_BUNDLES);
  jobs = structuredClone(INITIAL_JOBS);
  operators = structuredClone(INITIAL_OPERATORS);
  exceptions = structuredClone(INITIAL_EXCEPTIONS);
  shiftMessages = structuredClone(INITIAL_SHIFT_MESSAGES);
  activityEvents = structuredClone(INITIAL_ACTIVITY);
  zoneCapacities = {};
}

// Keep the in-memory lists bounded on long-running servers
const MAX_ACTIVITY_EVENTS = 500;
const MAX_EXCEPTIONS = 500;
const MAX_SHIFT_MESSAGES = 500;

/** Trims the exception list to its cap, dropping the oldest resolved exceptions first so no open one is lost to a resolved one. */
function trimExceptions() {
  while (exceptions.length > MAX_EXCEPTIONS) {
    const oldestResolved = exceptions.map(e => e.status).lastIndexOf('RESOLVED');
    exceptions.splice(oldestResolved === -1 ? exceptions.length - 1 : oldestResolved, 1);
  }
}

// Active Server-Sent Events (SSE) Client Connections
let sseClients: Response[] = [];

// Helper to push state changes in real-time to all subscribed operators
function notifyClients() {
  const payload = JSON.stringify({
    type: 'update',
    data: {
      bundles,
      jobs,
      exceptions,
      shiftMessages,
      activityEvents,
      zoneCapacities,
    }
  });
  sseClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (err) {
      // Client likely disconnected
    }
  });
}

// Unique ids even when several records are created in the same millisecond
let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++idCounter}`;

// Helper to log dynamic activity events
function logActivity(tagId: string, operatorName: string, action: string, fromLoc: string, toLoc: string, details?: string) {
  const newEvent: ActivityEvent = {
    id: nextId('AC'),
    timestamp: new Date().toISOString(),
    tagId,
    operatorName,
    action,
    fromLocation: fromLoc,
    toLocation: toLoc,
    details
  };
  activityEvents.unshift(newEvent);
  if (activityEvents.length > MAX_ACTIVITY_EVENTS) activityEvents.length = MAX_ACTIVITY_EVENTS;
  return newEvent;
}

function refreshJobProgress(jobId: string) {
  const job = jobs.find(j => j.id === jobId);
  if (!job) return;
  const completed = bundles.filter(b => b.jobId === job.id && b.status === 'LOADED').length;
  job.completedBundles = Math.min(job.totalBundles, completed);
}

/** Moves a bundle and keeps its status, door, outdoor clock and job progress consistent. */
function placeBundle(bundle: Bundle, location: string, status: BundleStatus) {
  const now = new Date().toISOString();
  bundle.stagedAt = stagedAtAfterMove(bundle, location, now);
  bundle.location = location;
  bundle.status = rawStockStatus(bundle.status, location, status);
  if (status === 'LOADED') {
    bundle.door = location;
  } else {
    bundle.door = undefined;
    bundle.trailerSize = undefined;
  }
  bundle.updatedAt = now;
  refreshJobProgress(bundle.jobId);
}

function findBundle(bundleId: string) {
  return bundles.find(b => b.id === bundleId);
}

/** A zone drawn on the yard map. An own-property check, so names like "constructor" aren't zones. */
const isMapZone = (id: string): boolean => Object.prototype.hasOwnProperty.call(zoneCoords, id);

const app = express();
app.disable('x-powered-by');
// Every response: browsers must not guess content types. API answers are live yard state, so never cached.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.path.startsWith('/api/') && req.path !== '/api/updates') res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json());

// Every text field the API reads, checked once here so no route can store an object, an array or
// a novel where the screens expect short text (one bad record can break every open screen), and the
// coating audit's damage figure, so garbage can't slip past the 2% rejection.
const TEXT_FIELDS: Record<string, number> = {
  operatorName: 80, sender: 80, resolvedBy: 80,
  tagId: 40, bundleId: 40,
  type: 60, shift: 20, action: 40, trailerSize: 20,
  location: 40, craneId: 40, benderId: 40, door: 40, originId: 40, destinationId: 40,
  description: 1000, content: 1000
};
const MAX_BULK_BUNDLES = 500;

app.use('/api', (req, res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT') return next();
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.status(400).json({ error: 'The request body must be a JSON object.' });
    return;
  }
  for (const [field, max] of Object.entries(TEXT_FIELDS)) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      res.status(400).json({ error: `${field} must be text.` });
      return;
    }
    if (value.length > max) {
      res.status(400).json({ error: `${field} is limited to ${max.toLocaleString()} characters.` });
      return;
    }
    body[field] = value.trim(); // so a blank-but-spaces value counts as missing
  }
  if (body.bundleIds !== undefined && (!Array.isArray(body.bundleIds) || body.bundleIds.length > MAX_BULK_BUNDLES ||
      body.bundleIds.some((id: unknown) => typeof id !== 'string' || id.length > 40))) {
    res.status(400).json({ error: `bundleIds must be a list of up to ${MAX_BULK_BUNDLES} bundle IDs.` });
    return;
  }
  const audit = body.qualityAudit;
  if (audit !== undefined && audit !== null && (typeof audit !== 'object' || Array.isArray(audit) ||
      (audit.damagedFootSection != null && (typeof audit.damagedFootSection !== 'string' || audit.damagedFootSection.length > 40)))) {
    res.status(400).json({ error: 'qualityAudit must be an object with a short damagedFootSection.' });
    return;
  }
  if (audit != null) {
    const pct = audit.coatingDamagePct;
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      res.status(400).json({ error: 'Coating damage must be a percentage between 0 and 100.' });
      return;
    }
  }
  next();
});

// PORT is hardcoded by platform infrastructure to 3000
const PORT = 3000;

// API routes first
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// SSE Subscription stream
app.get('/api/updates', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  // Send connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Comment lines every 25 s keep proxies and load balancers from closing an idle stream
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c !== res);
  });
});

// GET /api/zone-capacities
app.get('/api/zone-capacities', (req, res) => {
  res.json(zoneCapacities);
});

// PUT /api/zone-capacities/:zoneId  { capacity: number | null }  (null restores the default)
app.put('/api/zone-capacities/:zoneId', (req, res) => {
  const { zoneId } = req.params;
  const { capacity } = req.body;
  if (!isMapZone(zoneId) || zoneId.startsWith('Crane-')) {
    res.status(400).json({ error: `Unknown storage zone "${zoneId}".` });
    return;
  }
  if (capacity === null) {
    delete zoneCapacities[zoneId];
  } else {
    const value = Number(capacity);
    if (!Number.isFinite(value) || value < MIN_ZONE_CAPACITY_LBS || value > MAX_ZONE_CAPACITY_LBS) {
      res.status(400).json({ error: `Capacity must be between ${MIN_ZONE_CAPACITY_LBS.toLocaleString()} and ${MAX_ZONE_CAPACITY_LBS.toLocaleString()} lbs.` });
      return;
    }
    zoneCapacities = { ...zoneCapacities, [zoneId]: Math.round(value) };
  }
  notifyClients();
  res.json(zoneCapacities);
});

// POST /api/gantry/execute-route
app.post('/api/gantry/execute-route', (req, res) => {
  const { originId, destinationId, bundleId, operatorName } = req.body;
  if (!originId || !destinationId) {
    res.status(400).json({ error: 'Origin and destination sector IDs are required.' });
    return;
  }
  if (!isMapZone(originId) || !isMapZone(destinationId)) {
    res.status(400).json({ error: 'Origin and destination must be zones on the yard map.' });
    return;
  }
  if (originId === destinationId) {
    res.status(400).json({ error: 'Origin and destination are the same zone.' });
    return;
  }

  // The bundle being carried: the one the operator picked, or the first bundle resting at the origin
  let targetBundle: Bundle | undefined;
  if (bundleId) {
    targetBundle = findBundle(bundleId);
    if (!targetBundle || targetBundle.location !== originId) {
      res.status(400).json({ error: `Bundle ${bundleId} is not at ${originId}.` });
      return;
    }
  } else {
    targetBundle = bundles.find(b => b.location === originId);
  }

  if (targetBundle && destinationId.startsWith('Crane-')) {
    res.status(400).json({ error: 'A gantry position is not a place to set a bundle down.' });
    return;
  }

  // Enforce server-side security interlock validation
  const analysis = getRouteAnalysisByZones(originId, destinationId, bundles, zoneCapacities, targetBundle?.id);
  const criticalIssues = analysis.obstructions.filter(obs => obs.type === 'CRITICAL');
  if (criticalIssues.length > 0) {
    res.status(400).json({
      error: `CRITICAL INTERLOCK TRIGGERED: Safety bypass prohibited. Movement from "${originId}" to "${destinationId}" blocked due to: ${criticalIssues.map(c => c.reason).join(', ')}`
    });
    return;
  }

  if (targetBundle) {
    const blocked = liftBlockedReason(targetBundle);
    if (blocked) {
      res.status(400).json({ error: blocked });
      return;
    }
    const zoneError = gradePlacementViolation(targetBundle, destinationId, bundles);
    if (zoneError) {
      res.status(400).json({ error: zoneError });
      return;
    }
    // Evaluate Dynamic Slotting for Intelligent Crane Sequencing
    const conflict = slottingConflict(targetBundle, destinationId, bundles);
    if (conflict) {
      res.status(400).json({ error: slottingViolationMessage(targetBundle, conflict, destinationId) });
      return;
    }

    const oldLoc = targetBundle.location;
    placeBundle(targetBundle, destinationId, statusAfterDrop(destinationId));

    const slowZones = analysis.obstructions.filter(obs => obs.type === 'CONSTRAINT').map(obs => obs.name);
    logActivity(
      targetBundle.tagId,
      operatorName || 'Gantry Automations',
      'GANTRY_MOVE',
      oldLoc,
      destinationId,
      slowZones.length
        ? `Route executed in slow mode past ${slowZones.join(', ')}. Predicted ${analysis.predictedTime.toFixed(1)} s.`
        : `Operational route executed successfully. Predicted ${analysis.predictedTime.toFixed(1)} s.`
    );

    notifyClients();
    res.json({
      success: true,
      message: `Successfully executed travel command. Moved Bundle ${targetBundle.tagId} to ${destinationId}`,
      bundle: targetBundle
    });
  } else {
    // Repositioning empty trolley
    logActivity(
      'GANTRY',
      operatorName || 'Gantry Automations',
      'TROLLEY_REPOSITION',
      originId,
      destinationId,
      `Trolley transit executed from ${originId} to ${destinationId} (Idle traverse).`
    );

    notifyClients();
    res.json({
      success: true,
      message: `Gantry trolley repositioned from ${originId} to ${destinationId} (idle).`
    });
  }
});

// GET /api/jobs
app.get('/api/jobs', (req, res) => {
  res.json(jobs);
});

// GET /api/jobs/:jobId/bundles
app.get('/api/jobs/:jobId/bundles', (req, res) => {
  const jobBundles = bundles.filter(b => b.jobId === req.params.jobId);
  res.json(jobBundles);
});

// GET /api/bundles
app.get('/api/bundles', (req, res) => {
  res.json(bundles);
});

// GET /api/mill-certs/:heatNumber  (heat record behind a bundle's "View cert" link)
app.get('/api/mill-certs/:heatNumber', (req, res) => {
  const heatBundles = bundles.filter(b => b.heatNumber === req.params.heatNumber);
  if (heatBundles.length === 0) {
    res.status(404).json({ error: `No bundles from heat ${req.params.heatNumber}.` });
    return;
  }
  const first = heatBundles[0];
  res.json({
    heatNumber: first.heatNumber,
    specification: first.specification.replace('ASTM_', 'ASTM '),
    grade: first.grade,
    plantLocation: first.plantLocation,
    bundles: heatBundles.map(b => ({ tagId: b.tagId, jobId: b.jobId, barSize: b.barSize, lengthFt: b.length, weightLbs: b.weight })),
    note: 'Heat record from SkyHook yard data. Attach the mill\'s certified test report for this heat to complete the certificate.'
  });
});

// GET /api/operators
app.get('/api/operators', (req, res) => {
  res.json(operators);
});

// GET /api/activity
app.get('/api/activity', (req, res) => {
  res.json(activityEvents);
});

// GET /api/exceptions
app.get('/api/exceptions', (req, res) => {
  res.json(exceptions);
});

// POST /api/exceptions
app.post('/api/exceptions', (req, res) => {
  const { tagId, operatorName, type, description, qualityAudit } = req.body;
  if (!tagId || !operatorName || !type || !description) {
    res.status(400).json({ error: 'Missing required parameters' });
    return;
  }

  let finalDescription = description;
  const bundle = bundles.find(b => b.tagId === tagId);

  let damagePct: number | undefined;
  if (type === 'Quality Audit' && qualityAudit) {
    if (bundle && !isCoated(bundle)) {
      const what = bundle.grade === 'Black' ? 'black bar' : 'raw stock that has not been through the coat line';
      res.status(400).json({ error: `Bundle ${bundle.tagId} is ${what}, so it has no coating to audit.` });
      return;
    }
    damagePct = qualityAudit.coatingDamagePct; // a percentage, checked with the request body
    // ASTM limit: damaged coating may not exceed 2% of the surface area in any 1-foot length
    if (damagePct > 2) {
      finalDescription = `${description} [AUTOMATIC ASTM REJECTION: Visible coating damage of ${damagePct}% exceeds the 2% maximum allowable limit in the 1-foot section: ${qualityAudit.damagedFootSection}.]`;
      if (bundle) {
        bundle.status = 'REJECTED';
        bundle.updatedAt = new Date().toISOString();
        logActivity(
          tagId,
          operatorName,
          'QUALITY_REJECT',
          bundle.location,
          bundle.location,
          `REJECTED: Coating damage of ${damagePct}% exceeds 2% ASTM limit.`
        );
      }
    }
  }

  const newEx: Exception = {
    id: nextId('EX'),
    timestamp: new Date().toISOString(),
    tagId,
    operatorName,
    type,
    description: finalDescription,
    status: 'OPEN',
    qualityAudit: qualityAudit && damagePct !== undefined ? {
      coatingDamagePct: damagePct,
      damagedFootSection: qualityAudit.damagedFootSection,
      inspectorName: operatorName,
      inspectionDate: new Date().toISOString().split('T')[0]
    } : undefined
  };

  exceptions.unshift(newEx);
  trimExceptions();
  notifyClients();
  res.status(201).json(newEx);
});

// POST /api/exceptions/:exceptionId/resolve
app.post('/api/exceptions/:exceptionId/resolve', (req, res) => {
  const { exceptionId } = req.params;
  const { resolvedBy } = req.body;
  const ex = exceptions.find(e => e.id === exceptionId);
  if (!ex) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }
  ex.status = 'RESOLVED';
  ex.resolvedAt = new Date().toISOString();
  ex.resolvedBy = resolvedBy || 'ADMIN';
  notifyClients();
  res.json(ex);
});

// GET /api/shift-messages
app.get('/api/shift-messages', (req, res) => {
  res.json(shiftMessages);
});

// POST /api/shift-messages
app.post('/api/shift-messages', (req, res) => {
  const { sender, content, shift } = req.body;
  if (!sender || !content || !shift) {
    res.status(400).json({ error: 'Missing message parameters' });
    return;
  }
  if (shift !== 'First Shift' && shift !== 'Second Shift') {
    res.status(400).json({ error: 'Shift must be "First Shift" or "Second Shift".' });
    return;
  }
  const newMessage: ShiftMessage = {
    id: nextId('SM'),
    sender,
    content,
    timestamp: new Date().toISOString(),
    shift
  };
  shiftMessages.unshift(newMessage);
  if (shiftMessages.length > MAX_SHIFT_MESSAGES) shiftMessages.length = MAX_SHIFT_MESSAGES;
  notifyClients();
  res.status(201).json(newMessage);
});

// POST /api/bundles/:bundleId/stage
app.post('/api/bundles/:bundleId/stage', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName } = req.body;
  const location = req.body.location || 'Coat-Station';
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (!isValidYardLocation(location) || location.startsWith('Crane-')) {
    res.status(400).json({ error: `Unknown staging location "${location}".` });
    return;
  }
  const blocked = movementBlockedReason(bundle);
  if (blocked) {
    res.status(400).json({ error: blocked });
    return;
  }
  const zoneError = gradePlacementViolation(bundle, location, bundles);
  if (zoneError) {
    res.status(400).json({ error: zoneError });
    return;
  }

  const oldLoc = bundle.location;
  placeBundle(bundle, location, statusAfterStaging(location));

  logActivity(bundle.tagId, operatorName || 'Shear Operator', 'STAGED', oldLoc, bundle.location, `Staged at ${bundle.location}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/:bundleId/pickup
app.post('/api/bundles/:bundleId/pickup', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName } = req.body;
  const craneId = req.body.craneId || 'Crane-SW'; // e.g., Crane-NE, Crane-SW
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (!/^Crane-(NW|NE|SW|SE)$/.test(craneId)) {
    res.status(400).json({ error: `Unknown crane "${craneId}".` });
    return;
  }
  const blocked = liftBlockedReason(bundle);
  if (blocked) {
    res.status(400).json({ error: blocked });
    return;
  }

  // SW verification: Black bar can only be carried by SW Crane or handled in SW
  if (bundle.grade === 'Black' && craneId !== 'Crane-SW') {
    res.status(400).json({ error: 'CRITICAL: Black (non-epoxy) bar can only be moved in the SW zone (Crane-SW).' });
    return;
  }

  const suspended = bundles.find(b => b.location === craneId && b.id !== bundle.id);
  if (suspended) {
    res.status(400).json({ error: `CRANE COLLISION HAZARD: ${craneId} already has bundle ${suspended.tagId} on the hook. Drop it first.` });
    return;
  }

  const oldLoc = bundle.location;
  bundle.stagedAt = stagedAtAfterMove(bundle, craneId, new Date().toISOString());
  bundle.location = craneId;
  bundle.door = undefined;
  bundle.updatedAt = new Date().toISOString();

  logActivity(bundle.tagId, operatorName || 'Crane Operator', 'PICKUP', oldLoc, bundle.location, `Picked up by ${craneId}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/:bundleId/drop
app.post('/api/bundles/:bundleId/drop', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName, location } = req.body; // e.g. Rack J-15
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (!isValidYardLocation(location) || location.startsWith('Crane-')) {
    res.status(400).json({ error: 'Specify a valid drop location.' });
    return;
  }
  const blocked = movementBlockedReason(bundle);
  if (blocked) {
    res.status(400).json({ error: blocked });
    return;
  }
  // Only a load on a crane hook can be set down; anything else would skip the pickup rules (the SW crane for black bar)
  if (!bundle.location.startsWith('Crane-')) {
    res.status(400).json({ error: `Bundle ${bundle.tagId} is not on a crane hook. Pick it up first.` });
    return;
  }

  // Black bar stays SW; epoxy stays out of black-bar racks and SW shipping doors
  const zoneError = gradePlacementViolation(bundle, location, bundles);
  if (zoneError) {
    res.status(400).json({ error: zoneError });
    return;
  }

  // Evaluate Dynamic Slotting for Intelligent Crane Sequencing
  const conflict = slottingConflict(bundle, location, bundles);
  if (conflict) {
    res.status(400).json({ error: slottingViolationMessage(bundle, conflict, location) });
    return;
  }

  const oldLoc = bundle.location;
  placeBundle(bundle, location, statusAfterDrop(location));

  logActivity(bundle.tagId, operatorName || 'Crane Operator', 'DROP', oldLoc, bundle.location, `Dropped at ${location}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/:bundleId/send-to-bender
app.post('/api/bundles/:bundleId/send-to-bender', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName } = req.body;
  const benderId = req.body.benderId || 'Bender-New-Robo'; // e.g. Bender-New-Robo, Bender-11-Bender
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (!isValidYardLocation(benderId) || !benderId.startsWith('Bender-')) {
    res.status(400).json({ error: `Unknown bender "${benderId}".` });
    return;
  }
  const blocked = movementBlockedReason(bundle);
  if (blocked) {
    res.status(400).json({ error: blocked });
    return;
  }

  const mixError = gradePlacementViolation(bundle, benderId, bundles);
  if (mixError) {
    res.status(400).json({ error: mixError });
    return;
  }

  const oldLoc = bundle.location;
  placeBundle(bundle, benderId, 'BENDING');

  logActivity(bundle.tagId, operatorName || 'Shear Operator', 'BENDING_START', oldLoc, bundle.location, `Sent to bender ${benderId}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/:bundleId/mark-bent
app.post('/api/bundles/:bundleId/mark-bent', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName } = req.body;
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (bundle.status !== 'BENDING') {
    res.status(400).json({ error: `Bundle ${bundle.tagId} is ${bundle.status}, not BENDING.` });
    return;
  }

  const oldLoc = bundle.location;
  bundle.status = 'STAGED'; // ready to be packed/staged for pick-up by crane
  bundle.updatedAt = new Date().toISOString();

  logActivity(bundle.tagId, operatorName || 'Bender Operator', 'BENT', oldLoc, oldLoc, `Fabrication completed at ${oldLoc}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/:bundleId/force-load
app.post('/api/bundles/:bundleId/force-load', (req, res) => {
  const { bundleId } = req.params;
  const { operatorName } = req.body;
  const door: string = req.body.door || 'Door-1';
  const trailerSize: TrailerSize = req.body.trailerSize === 'Step Deck' ? 'Step Deck' : 'Flatbed';
  const bundle = findBundle(bundleId);
  if (!bundle) {
    res.status(404).json({ error: 'Bundle not found' });
    return;
  }
  if (!SHIPPING_DOORS.includes(door)) {
    res.status(400).json({ error: `Unknown shipping door "${door}".` });
    return;
  }
  const blocked = movementBlockedReason(bundle);
  if (blocked) {
    res.status(400).json({ error: blocked });
    return;
  }

  // Material zone rules check
  const zoneError = bundle.grade === 'Black' && !SW_SHIPPING_DOORS.includes(door)
    ? 'CRITICAL: Black (non-epoxy) bar must be shipped from SW loading doors (Door-7 or Door-8).'
    : gradePlacementViolation(bundle, door, bundles);
  if (zoneError) {
    res.status(400).json({ error: zoneError });
    return;
  }

  const oldLoc = bundle.location;
  placeBundle(bundle, door, 'LOADED');
  bundle.trailerSize = trailerSize;

  logActivity(bundle.tagId, operatorName || 'Admin Operator', 'FORCED_LOAD', oldLoc, bundle.location, `Directly loaded onto ${bundle.trailerSize} at ${bundle.location}`);
  notifyClients();
  res.json(bundle);
});

// POST /api/bundles/bulk-action
app.post('/api/bundles/bulk-action', (req, res) => {
  const { bundleIds, action, operatorName } = req.body;
  if (!Array.isArray(bundleIds) || bundleIds.length === 0) {
    res.status(400).json({ error: 'Please select at least one bundle to execute bulk operations.' });
    return;
  }
  if (!['LOAD', 'STAGE', 'SEND_TO_FABRICATION'].includes(action)) {
    res.status(400).json({ error: 'Invalid bulk action.' });
    return;
  }

  const results: Bundle[] = [];
  const errors: string[] = [];

  for (const bundleId of bundleIds) {
    const bundle = findBundle(bundleId);
    if (!bundle) {
      errors.push(`Bundle ${bundleId} not found.`);
      continue;
    }
    const blocked = movementBlockedReason(bundle);
    if (blocked) {
      errors.push(blocked);
      continue;
    }

    const oldLoc = bundle.location;

    if (action === 'LOAD') {
      if (bundle.status === 'LOADED') {
        errors.push(`Bundle ${bundle.tagId} is already loaded at ${bundle.location}.`);
        continue;
      }
      // Smart default door per grade: black ships SW, epoxy ships NW
      const door = bundle.grade === 'Black' ? 'Door-7' : 'Door-1';
      const placeError = gradePlacementViolation(bundle, door, bundles);
      if (placeError) {
        errors.push(placeError);
        continue;
      }
      placeBundle(bundle, door, 'LOADED');
      bundle.trailerSize = 'Flatbed';

      logActivity(bundle.tagId, operatorName || 'Admin Operator', 'FORCED_LOAD', oldLoc, bundle.location, `Bulk loaded at ${bundle.location}`);
      results.push(bundle);
    } else if (action === 'STAGE') {
      const location = bundle.grade === 'Black' ? 'Raw-SW' : 'Coat-Station';
      const placeError = gradePlacementViolation(bundle, location, bundles);
      if (placeError) {
        errors.push(placeError);
        continue;
      }
      placeBundle(bundle, location, statusAfterStaging(location));

      logActivity(bundle.tagId, operatorName || 'Shear Operator', 'STAGED', oldLoc, bundle.location, `Bulk staged at ${bundle.location}`);
      results.push(bundle);
    } else if (action === 'SEND_TO_FABRICATION') {
      const benderId = bundle.grade === 'Black' ? 'Bender-11-Bender' : 'Bender-New-Robo';
      const placeError = gradePlacementViolation(bundle, benderId, bundles);
      if (placeError) {
        errors.push(placeError);
        continue;
      }
      placeBundle(bundle, benderId, 'BENDING');

      logActivity(bundle.tagId, operatorName || 'Shear Operator', 'BENDING_START', oldLoc, bundle.location, `Bulk sent to fabrication at ${benderId}`);
      results.push(bundle);
    }
  }

  notifyClients();

  if (errors.length > 0 && results.length === 0) {
    res.status(400).json({ error: errors.join(' ') });
  } else {
    res.json({ success: true, count: results.length, errors: errors.length > 0 ? errors : undefined });
  }
});

// GET /api/dashboard
app.get('/api/dashboard', (req, res) => {
  res.json(computeDashboardMetrics(bundles, jobs));
});

// Unknown API routes answer in JSON instead of falling through to the web app
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}.` });
});

// Malformed JSON bodies and unexpected errors answer in JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Request body is not valid JSON.' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'The request body is too large (100 KB maximum).' });
    return;
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

export { app };

// Vite dev integration or production hosting
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Tests import the app without opening a port
if (process.env.SKYHOOK_NO_LISTEN !== '1') {
  startServer();
}
