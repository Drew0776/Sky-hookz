import { Bundle, Obstruction } from '../types';
import { zoneCoords } from '../pages/yardMapData';

export const getRouteAnalysisByZones = (
  originId: string,
  destinationId: string,
  materialClass: 'ALL' | 'Epoxy' | 'Black',
  bundlesData: Bundle[],
  zoneCapacities: Record<string, number>,
  windSpeed: number = 8,
  ropeSway: number = 3,
  bundleLength: number = 30
) => {
  const origin = zoneCoords[originId];
  const dest = zoneCoords[destinationId];
  if (!origin || !dest) return {
    pathD: '',
    dX: 0,
    dY: 0,
    obstructions: [] as Obstruction[],
    crossedZonesCount: 0,
    crossedZonesSummary: [] as { id: string; name: string; weight: number; ratio: number; delay: number }[],
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

  // Track is orthogonal: gantry runs along main horizontal rails, then bridge sleeve moves vertically
  const pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
  const dX = Math.abs(x1 - x2);
  const dY = Math.abs(y1 - y2);

  const overlap = (minA: number, maxA: number, minB: number, maxB: number) => {
    return Math.max(minA, minB) <= Math.min(maxA, maxB);
  };

  const obstructions: Obstruction[] = [];
  const crossedZonesSummary: { id: string; name: string; weight: number; ratio: number; delay: number }[] = [];
  let crossedZonesCount = 0;
  let densitySlewPenalty = 0;
  let hasCriticalInterlock = false;

  // Simple static thresholds for stacking capacity
  const hazardThreshold = 0.85; // 85% capacity is a critical overload
  const warningThreshold = 0.60; // 60% capacity is elevated

  Object.keys(zoneCoords).forEach((zoneId) => {
    if (zoneId === originId || zoneId === destinationId) return;

    const zone = zoneCoords[zoneId];
    const zLeft = zone.cx;
    const zRight = zone.cx + zone.cw;
    const zTop = zone.cy;
    const zBottom = zone.cy + zone.ch;

    // Horiz segment (x1, y1) to (x2, y1)
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const intersectsHoriz = y1 >= zTop && y1 <= zBottom && overlap(minX, maxX, zLeft, zRight);

    // Vert segment (x2, y1) to (x2, y2)
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const intersectsVert = x2 >= zLeft && x2 <= zRight && overlap(minY, maxY, zTop, zBottom);

    if (intersectsHoriz || intersectsVert) {
      crossedZonesCount++;
      const bInZone = bundlesData.filter(b => b.location === zoneId);
      const weight = bInZone.reduce((sum, b) => sum + (b.weight || 0), 0);
      const limit = zoneCapacities[zoneId] || 75000;
      const ratio = weight / limit;

      // Base safe-hover slew delay checking overhead cargo clearances
      let zoneSlewDelay = 0.5 + (weight / 50000); // realistic movement buffer

      // 1. Shared Rail Crane obstruction
      const isCraneType = zoneId.toLowerCase().includes('crane');
      if (isCraneType) {
        hasCriticalInterlock = true;
        zoneSlewDelay += 5.0; // Standard crane coordination slowdown
        obstructions.push({
          zoneId,
          name: zone.label,
          type: 'CRITICAL',
          reason: 'SHARED RAIL OCCUPANCY',
          desc: `Secondary handling equipment is currently located at ${zone.label}. Please confirm gantry path clearance.`
        });
      } else if (ratio >= hazardThreshold) {
        hasCriticalInterlock = true;
        zoneSlewDelay += 10.0;
        obstructions.push({
          zoneId,
          name: zone.label,
          type: 'CRITICAL',
          reason: 'MAX STORAGE CAPACITY EXCEEDED',
          desc: `Zone ${zone.label} is near maximum storage density (${weight.toLocaleString()} lbs, ${(ratio*100).toFixed(0)}% capacity). High stacks violate overhead clearance drop guidelines.`
        });
      } else if (ratio >= warningThreshold) {
        zoneSlewDelay += 3.0;
        obstructions.push({
          zoneId,
          name: zone.label,
          type: 'CONSTRAINT',
          reason: 'HIGH LOAD DENSITY',
          desc: `Elevated pile mass density (${weight.toLocaleString()} lbs, ${(ratio*100).toFixed(0)}% capacity). Gantry crane must operate in cautionary slow-speed mode.`
        });
      }

      densitySlewPenalty += zoneSlewDelay;
      crossedZonesSummary.push({
        id: zoneId,
        name: zone.label,
        weight,
        ratio,
        delay: zoneSlewDelay
      });
    }
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
