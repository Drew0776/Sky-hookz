import { Bundle, Obstruction } from '../types';
import { zoneCoords } from '../pages/yardMapData';
import { getZoneCapacity, OVERLOAD_RATIO, SLOW_MODE_RATIO } from '../yardRules';

export interface CrossedZone {
  id: string;
  name: string;
  weight: number;
  ratio: number;
  delay: number;
}

/**
 * Gantry route analysis shared by the yard map and the server's execute-route interlock.
 * The gantry runs the runway (x) first, then the bridge (y); map units are feet.
 * `movingBundleId` is the bundle being carried; when omitted, the first bundle at the origin is assumed.
 */
export const getRouteAnalysisByZones = (
  originId: string,
  destinationId: string,
  bundlesData: Bundle[],
  zoneCapacities: Record<string, number> = {},
  movingBundleId?: string
) => {
  const origin = zoneCoords[originId];
  const dest = zoneCoords[destinationId];
  if (!origin || !dest) return {
    pathD: '',
    dX: 0,
    dY: 0,
    obstructions: [] as Obstruction[],
    crossedZonesCount: 0,
    crossedZonesSummary: [] as CrossedZone[],
    idealTime: 0,
    predictedTime: 0,
    densitySlewPenalty: 0,
    windDragPenalty: 0,
    settlingTime: 0,
    rampTime: 0,
    hasCriticalInterlock: false
  };

  const x1 = origin.cx + origin.cw / 2;
  const y1 = origin.cy + origin.ch / 2;
  const x2 = dest.cx + dest.cw / 2;
  const y2 = dest.cy + dest.ch / 2;

  const pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
  const dX = Math.abs(x1 - x2);
  const dY = Math.abs(y1 - y2);

  const overlap = (minA: number, maxA: number, minB: number, maxB: number) => {
    return Math.max(minA, minB) <= Math.min(maxA, maxB);
  };

  // ASTM A934 prefab bundles are prioritized and skip the slow-mode penalty
  const movingBundle = movingBundleId
    ? bundlesData.find(b => b.id === movingBundleId)
    : bundlesData.find(b => b.location === originId);
  const isA934 = movingBundle?.specification === 'ASTM_A934';

  const obstructions: Obstruction[] = [];
  const crossedZonesSummary: CrossedZone[] = [];
  let crossedZonesCount = 0;
  let densitySlewPenalty = 0;
  let hasCriticalInterlock = false;

  Object.keys(zoneCoords).forEach((zoneId) => {
    if (zoneId === originId || zoneId === destinationId) return;

    const zone = zoneCoords[zoneId];
    const zLeft = zone.cx;
    const zRight = zone.cx + zone.cw;
    const zTop = zone.cy;
    const zBottom = zone.cy + zone.ch;

    // Runway segment (x1, y1) to (x2, y1)
    const intersectsHoriz = y1 >= zTop && y1 <= zBottom && overlap(Math.min(x1, x2), Math.max(x1, x2), zLeft, zRight);
    // Bridge segment (x2, y1) to (x2, y2)
    const intersectsVert = x2 >= zLeft && x2 <= zRight && overlap(Math.min(y1, y2), Math.max(y1, y2), zTop, zBottom);

    if (!intersectsHoriz && !intersectsVert) return;

    crossedZonesCount++;
    const weight = bundlesData
      .filter(b => b.location === zoneId)
      .reduce((sum, b) => sum + (b.weight || 0), 0);
    const ratio = weight / getZoneCapacity(zoneId, zoneCapacities);

    // Base safe-hover slew delay for overhead cargo clearance
    let zoneSlewDelay = 0.5 + weight / 50000;

    if (zoneId.startsWith('Crane-')) {
      hasCriticalInterlock = true;
      zoneSlewDelay += 5.0;
      obstructions.push({
        zoneId,
        name: zone.label,
        type: 'CRITICAL',
        reason: 'SHARED RAIL OCCUPANCY',
        desc: `Secondary handling equipment is currently located at ${zone.label}. Please confirm gantry path clearance.`
      });
    } else if (ratio >= OVERLOAD_RATIO) {
      hasCriticalInterlock = true;
      zoneSlewDelay += 10.0;
      obstructions.push({
        zoneId,
        name: zone.label,
        type: 'CRITICAL',
        reason: 'MAX STORAGE CAPACITY EXCEEDED',
        desc: `Zone ${zone.label} is near maximum storage density (${weight.toLocaleString()} lbs, ${(ratio * 100).toFixed(0)}% capacity). High stacks violate overhead clearance drop guidelines.`
      });
    } else if (ratio >= SLOW_MODE_RATIO && !isA934) {
      zoneSlewDelay += 3.0;
      obstructions.push({
        zoneId,
        name: zone.label,
        type: 'CONSTRAINT',
        reason: 'HIGH LOAD DENSITY',
        desc: `Elevated pile mass density (${weight.toLocaleString()} lbs, ${(ratio * 100).toFixed(0)}% capacity). Gantry crane must operate in cautionary slow-speed mode.`
      });
    }

    densitySlewPenalty += zoneSlewDelay;
    crossedZonesSummary.push({ id: zoneId, name: zone.label, weight, ratio, delay: zoneSlewDelay });
  });

  const runwayFps = 150 / 60; // 2.5 ft/sec
  const bridgeFps = 90 / 60;  // 1.5 ft/sec
  const idealTime = (dX / runwayFps) + (dY / bridgeFps);

  const windDragPenalty = 0;
  const settlingTime = 0.5;
  const rampTime = 2.0; // Acceleration/deceleration buffers

  const predictedTime = idealTime + densitySlewPenalty + windDragPenalty + settlingTime + rampTime;

  return {
    pathD,
    dX,
    dY,
    obstructions,
    crossedZonesCount,
    crossedZonesSummary,
    idealTime,
    predictedTime,
    densitySlewPenalty,
    windDragPenalty,
    settlingTime,
    rampTime,
    hasCriticalInterlock
  };
};
