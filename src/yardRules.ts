// Shared yard rules used by both the Express server and the React screens,
// so the server's safety checks and what the screens show can't drift apart.
import type { Bundle, BundleStatus, DashboardMetrics, Job, PlantLocation, RebarGrade } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------- Zone capacity ---------- */

/** Storage limit for a yard zone with no custom capacity, in lbs. Drives the heatmap and the gantry interlocks. */
export const DEFAULT_ZONE_CAPACITY_LBS = 75000;
export const MIN_ZONE_CAPACITY_LBS = 5000;
export const MAX_ZONE_CAPACITY_LBS = 150000;
/** Crossing a zone at or above this share of its capacity puts the gantry in slow mode. */
export const SLOW_MODE_RATIO = 0.6;
/** Crossing a zone at or above this share of its capacity is a critical interlock. */
export const OVERLOAD_RATIO = 0.85;

export const getZoneCapacity = (zoneId: string, custom: Record<string, number> = {}): number =>
  custom[zoneId] || DEFAULT_ZONE_CAPACITY_LBS;

/* ---------- Locations ---------- */

const YARD_LOCATION_PATTERNS = [
  /^Rack [A-Z]-\d{1,2}$/,
  /^Door-\d$/,
  /^Shear-(North|Center|South)$/,
  /^Bender-[A-Za-z0-9-]+$/,
  /^Crane-(NW|NE|SW|SE)$/,
  /^(Raw-SW|Coat-Station|North-End)$/
];

/** True for location names the yard uses, including racks and benders not drawn on the map. */
export const isValidYardLocation = (location: unknown): location is string =>
  typeof location === 'string' && YARD_LOCATION_PATTERNS.some(p => p.test(location));

/** Why a bundle can't be moved at all right now, or null when it can. */
export function movementBlockedReason(b: Pick<Bundle, 'status' | 'tagId'>): string | null {
  if (b.status === 'REJECTED') {
    return `CRITICAL: Bundle ${b.tagId} failed its coating QC audit and is locked in REJECTED status. Crane movement is prohibited until engineering signs off.`;
  }
  return null;
}

/** Why a crane can't lift `b` right now (a QC hold, or it's still in a bender), or null when it can. */
export function liftBlockedReason(b: Pick<Bundle, 'status' | 'tagId'>): string | null {
  if (b.status === 'BENDING') return `Bundle ${b.tagId} is still in the bender. Mark it bent before a crane lifts it.`;
  return movementBlockedReason(b);
}

/* ---------- Grade zoning ---------- */

const SW_BLACK_RACK = /^Rack (J-(19|2[0-5])|L-([6-9]|10))$/;
export const SW_SHIPPING_DOORS = ['Door-7', 'Door-8'];
export const SHIPPING_DOORS = ['Door-1', 'Door-2', 'Door-3', 'North-End', ...SW_SHIPPING_DOORS];

export const isBlackBarRack = (location: string): boolean => SW_BLACK_RACK.test(location);
export const isShearOrBender = (location: string): boolean =>
  location.startsWith('Shear-') || location.startsWith('Bender-');
export const isSwBlackStorage = (location: string): boolean =>
  location === 'Raw-SW' || SW_SHIPPING_DOORS.includes(location) || isBlackBarRack(location);

/*
 * The coating lifecycle. All bar arrives black at Raw-SW as RAW stock, and about 98% of it is
 * epoxy-ordered. Epoxy-ordered bar is coated when it reaches the coat line, which sets COATED,
 * then goes on to the shears, benders, racks and trucks. Black bar never goes through the coat line.
 * So "coated" is epoxy-ordered bar in any status but RAW, and that stays true because RAW is only
 * ever left through the coat line (below) and no move sets RAW again, except moving raw stock
 * within Raw-SW (rawStockStatus).
 */

/** Whether a bundle's bar is epoxy-coated. */
export const isCoated = (b: { grade: RebarGrade; status?: string }): boolean => b.grade === 'Epoxy' && b.status !== 'RAW';

/**
 * Why a bundle of `grade` in `status` may not be placed at `location`, or null when it may.
 * Black and epoxy are never mixed: black bar stays SW and out of the coat line, coated epoxy
 * never goes back into black-bar areas, and uncoated epoxy-ordered bar goes to the coat line first.
 */
export function gradeZoneViolation(grade: RebarGrade, location: string, status: string): string | null {
  if (grade === 'Black') {
    if (isSwBlackStorage(location) || isShearOrBender(location)) return null;
    if (location === 'Coat-Station') return 'CRITICAL: Black (non-epoxy) bar never goes through the epoxy coat line.';
    return 'CRITICAL: Black (non-epoxy) bar is SW-only. Store it at Raw-SW, Door-7/8 or racks J-19 to J-25 and L-6 to L-10, or send it to a shear or bender.';
  }
  if (status === 'RAW') {
    if (location === 'Raw-SW' || location === 'Coat-Station') return null;
    return 'CRITICAL: Epoxy-ordered bar is still uncoated black steel. It goes through the coat line before shearing, bending, racking or shipping.';
  }
  if (isBlackBarRack(location)) {
    return 'CRITICAL: Epoxy bar cannot be stored in Black-bar SW racks.';
  }
  if (location === 'Raw-SW') {
    return 'CRITICAL: Coated epoxy bar must never go back into Raw-SW black-bar stock. Only uncoated bar waiting for the coat line belongs there.';
  }
  if (SW_SHIPPING_DOORS.includes(location)) {
    return 'CRITICAL: Epoxy bar must be shipped from NW/NE doors (Door-1, Door-2, Door-3, North-End).';
  }
  return null;
}

/* ---------- Black never touches coated ---------- */

type Surfaced = { id: string; tagId: string; grade: RebarGrade; status: string; location: string };

/** Whether `moving` is coated once set down at `destination`: reaching the coat line coats epoxy-ordered bar. */
const coatedAfterMove = (moving: Surfaced, destination: string): boolean =>
  isCoated(moving) || (moving.grade === 'Epoxy' && destination === 'Coat-Station');

/** A bundle at `destination` with the other surface: black steel never touches coated steel, at any stage. */
export function mixedSurfaceConflict<T extends Surfaced>(moving: T, destination: string, all: T[]): T | undefined {
  const coated = coatedAfterMove(moving, destination);
  return all.find(b => b.location === destination && b.id !== moving.id && isCoated(b) !== coated);
}

/** Every grade rule for setting `moving` down at `destination` (zoning, then black never touching coated), or null. */
export function gradePlacementViolation<T extends Surfaced>(moving: T, destination: string, all: T[]): string | null {
  const zone = gradeZoneViolation(moving.grade, destination, moving.status);
  if (zone) return zone;
  const other = mixedSurfaceConflict(moving, destination, all);
  if (!other) return null;
  const surface = coatedAfterMove(moving, destination) ? 'coated' : 'black';
  return `CRITICAL: Black and coated steel never touch. ${moving.tagId} is ${surface} bar and ${destination} holds ${surface === 'coated' ? 'black' : 'coated'} bar (${other.tagId}).`;
}

/* ---------- Dynamic slotting ---------- */

/** A bundle already at `destination` that ships before `moving`, which the move would bury. */
export function slottingConflict(moving: Bundle, destination: string, all: Bundle[]): Bundle | undefined {
  const movingShip = new Date(moving.shippingDate).getTime();
  return all
    .filter(b => b.location === destination && b.id !== moving.id && new Date(b.shippingDate).getTime() < movingShip)
    .sort((a, b) => new Date(a.shippingDate).getTime() - new Date(b.shippingDate).getTime())[0];
}

/** A bundle's ship date as its plant sees it, so the server's messages and every screen show the same day. */
export const formatShipDate = (b: Pick<Bundle, 'shippingDate' | 'plantLocation'>, options: Intl.DateTimeFormatOptions = {}): string =>
  new Date(b.shippingDate).toLocaleDateString('en-US', { ...options, timeZone: PLANT_TIME_ZONES[b.plantLocation] || 'America/Chicago' });

export function slottingViolationMessage(moving: Bundle, conflict: Bundle, destination: string): string {
  return `CRITICAL DYNAMIC SLOTTING VIOLATION: Stacking bundle ${moving.tagId} (ships ${formatShipDate(moving)}) on top of bundle ${conflict.tagId} (ships sooner: ${formatShipDate(conflict)}) at ${destination} is blocked to prevent extra crane picks and epoxy scraping.`;
}

/* ---------- Status and outdoor exposure ---------- */

/** Status a bundle takes when a crane sets it down at `location`. The coat line coats what reaches it. */
export function statusAfterDrop(location: string): BundleStatus {
  if (location.startsWith('Rack')) return 'RACKED';
  if (location.startsWith('Door')) return 'LOADED';
  return statusAfterStaging(location);
}

/** Status a bundle takes when staged at `location`. */
export const statusAfterStaging = (location: string): BundleStatus => (location === 'Coat-Station' ? 'COATED' : 'STAGED');

/** Raw stock moved within Raw-SW is still raw stock; otherwise the move's own status applies. */
export const rawStockStatus = (current: BundleStatus, location: string, next: BundleStatus): BundleStatus =>
  current === 'RAW' && location === 'Raw-SW' ? 'RAW' : next;

export const UV_WARNING_DAYS = 25;
export const UV_COVER_BY_DAYS = 30;
export const UV_GUIDANCE =
  'Industry handling guidance calls for covering coated bar stored outdoors beyond 30 days with opaque material; ASTM D3963 requires it once total exposure before embedment is expected to exceed two months.';

/** Yard areas open to sunlight: racks, shipping doors, raw stock, North-End staging and loads hanging on a gantry. */
export const isOutdoorZone = (location: string): boolean =>
  location.startsWith('Rack') ||
  location.startsWith('Door') ||
  location.startsWith('Crane-') ||
  location === 'Raw-SW' ||
  location === 'North-End';

/** Days a coated epoxy bundle has sat outdoors, or null when the UV clock doesn't apply (black and uncoated bar). */
export function daysOutdoors(b: Bundle, now: number = Date.now()): number | null {
  if (!isCoated(b) || !b.stagedAt || !isOutdoorZone(b.location)) return null;
  return (now - new Date(b.stagedAt).getTime()) / DAY_MS;
}

export function isUvHazard(b: Bundle, now: number = Date.now()): boolean {
  const days = daysOutdoors(b, now);
  return days !== null && days >= UV_WARNING_DAYS;
}

/** Outdoor clock start after a move: kept while the bundle stays outdoors, restarted when it comes out, cleared indoors. */
export function stagedAtAfterMove(b: Bundle, newLocation: string, nowIso: string): string | undefined {
  if (!isOutdoorZone(newLocation)) return undefined;
  if (isOutdoorZone(b.location) && b.stagedAt) return b.stagedAt;
  return nowIso;
}

/* ---------- Dashboard ---------- */

export const PLANT_TIME_ZONES: Record<PlantLocation, string> = {
  'St. Paul, MN': 'America/Chicago',
  'Marion, OH': 'America/New_York',
  'Sedalia, MO': 'America/Chicago'
};

/** Hour of day (e.g. 16.5 for 4:30 PM) at the plant where the event happened. */
export function plantLocalHour(iso: string, plant: PlantLocation): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PLANT_TIME_ZONES[plant] || 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
}

/** First shift runs 6:00 AM to 4:30 PM plant time; everything else is second shift. */
export const isFirstShift = (hour: number): boolean => hour >= 6 && hour < 16.5;

export function computeDashboardMetrics(bundles: Bundle[], jobs: Job[], now: number = Date.now()): DashboardMetrics {
  let firstShiftWeight = 0;
  let secondShiftWeight = 0;
  bundles
    .filter(b => b.status === 'LOADED')
    .forEach(b => {
      if (isFirstShift(plantLocalHour(b.updatedAt, b.plantLocation))) firstShiftWeight += b.weight;
      else secondShiftWeight += b.weight;
    });

  return {
    bendingCount: bundles.filter(b => b.status === 'BENDING').length,
    totalActiveJobs: jobs.filter(j => j.completedBundles < j.totalBundles).length,
    stagedCount: bundles.filter(b => b.status === 'STAGED').length,
    loadedCount: bundles.filter(b => b.status === 'LOADED').length,
    rackedCount: bundles.filter(b => b.status === 'RACKED').length,
    rejectedCount: bundles.filter(b => b.status === 'REJECTED').length,
    uvHazardsCount: bundles.filter(b => isUvHazard(b, now)).length,
    // Short tons (2,000 lb), one decimal place
    firstShiftThroughput: Math.round((firstShiftWeight / 2000) * 10) / 10,
    secondShiftThroughput: Math.round((secondShiftWeight / 2000) * 10) / 10
  };
}
