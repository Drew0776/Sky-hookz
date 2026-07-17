export interface BundleWeight {
  bundleId: string;
  weight: number;
  zone: string;
}

export const calculateZoneCapacity = (
  bundles: any[],
  zoneId: string,
  maxCapacity: number = 75000
): { weight: number; percentage: number; status: 'CRITICAL' | 'WARNING' | 'OK' } => {
  const zoneWeight = bundles
    .filter(b => b.location === zoneId)
    .reduce((sum, b) => sum + (b.weight || 0), 0);

  const percentage = (zoneWeight / maxCapacity) * 100;
  const status =
    percentage >= 85 ? 'CRITICAL' : percentage >= 60 ? 'WARNING' : 'OK';

  return { weight: zoneWeight, percentage, status };
};

export const getBundleProcessingTime = (
  status: string,
  barSize: string
): number => {
  const baseTime: Record<string, number> = {
    RAW: 0,
    STAGED: 15,
    BENDING: 45,
    LOADED: 10,
    RACKED: 20,
    COATED: 30,
  };

  const sizeMultiplier: Record<string, number> = {
    '#3': 0.8,
    '#4': 0.9,
    '#5': 1.0,
    '#6': 1.1,
    '#7': 1.2,
    '#8': 1.3,
    '#9': 1.4,
    '#10': 1.5,
    '#11': 1.6,
  };

  return (baseTime[status] || 0) * (sizeMultiplier[barSize] || 1);
};

export const estimateJobCompletion = (
  job: any,
  bundles: any[]
): { percentComplete: number; estimatedMinutes: number } => {
  const jobBundles = bundles.filter(b => b.jobId === job.id);
  const totalTime = jobBundles.reduce(
    (sum, b) => sum + getBundleProcessingTime(b.status, b.barSize),
    0
  );
  const completedTime = jobBundles
    .filter(b => b.status === 'LOADED')
    .reduce((sum, b) => sum + getBundleProcessingTime(b.status, b.barSize), 0);

  return {
    percentComplete: (job.completedBundles / job.totalBundles) * 100,
    estimatedMinutes: Math.ceil((totalTime - completedTime) / 6), // Assume 6x speedup for deployed system
  };
};

export const validateMaterialConstraints = (
  bundle: any,
  destinationZone: string
): { valid: boolean; reason?: string } => {
  // Black rebar (non-epoxy) constraints
  if (bundle.grade === 'Black') {
    const swZones = [
      'Raw-SW', 'Coat-Station', 'Shear-South', 'Door-7', 'Door-8',
      'Rack J-19', 'Rack J-20', 'Rack J-21', 'Rack L-6', 'Rack L-7', 'Rack L-8'
    ];
    if (!swZones.includes(destinationZone)) {
      return {
        valid: false,
        reason: 'Black rebar cannot be moved to non-SW zones',
      };
    }
  }

  // Epoxy rebar constraints
  if (bundle.grade === 'Epoxy') {
    const blackRacks = /Rack\s+J-(19|20|21|22|23|24|25)|Rack\s+L-(6|7|8|9|10)/.test(
      destinationZone
    );
    if (blackRacks) {
      return {
        valid: false,
        reason: 'Epoxy rebar cannot be stored in Black-only racks',
      };
    }
  }

  return { valid: true };
};
