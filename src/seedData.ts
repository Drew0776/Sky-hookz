import { Bundle, Job, Operator, Exception, ShiftMessage, ActivityEvent } from './types';

export const INITIAL_JOBS: Job[] = [
  { id: 'JOB-01', customerName: 'Kraus-Anderson', projectName: 'St. Paul Sewer Expansion', orderNumber: 'KA-9021-B', totalBundles: 6, completedBundles: 2, createdAt: '2026-05-24T06:00:00Z', plantLocation: 'St. Paul, MN' },
  { id: 'JOB-02', customerName: 'McGough Construction', projectName: 'Saint Paul Academy Gym', orderNumber: 'MCG-4451-A', totalBundles: 5, completedBundles: 1, createdAt: '2026-05-24T06:30:00Z', plantLocation: 'St. Paul, MN' },
  { id: 'JOB-03', customerName: 'PCL Construction', projectName: 'Twin Cities LRT Transit Hub', orderNumber: 'PCL-1109-X', totalBundles: 6, completedBundles: 1, createdAt: '2026-05-24T07:00:00Z', plantLocation: 'Marion, OH' },
  { id: 'JOB-04', customerName: 'Adolfson & Peterson', projectName: 'Ramsey County Medical Center', orderNumber: 'AP-2830-E', totalBundles: 5, completedBundles: 0, createdAt: '2026-05-24T07:15:00Z', plantLocation: 'Marion, OH' },
  { id: 'JOB-05', customerName: 'M.A. Mortenson', projectName: 'Minneapolis Arena Parking Deck', orderNumber: 'MORT-7712-F', totalBundles: 5, completedBundles: 3, createdAt: '2026-05-24T07:45:00Z', plantLocation: 'Sedalia, MO' },
  { id: 'JOB-06', customerName: 'Ryan Companies', projectName: 'Lowertown Loft Foundation', orderNumber: 'RYN-8821-C', totalBundles: 4, completedBundles: 0, createdAt: '2026-05-24T08:00:00Z', plantLocation: 'Sedalia, MO' },
  { id: 'JOB-07', customerName: 'Knutson Construction', projectName: 'Capitol Parking Garage Stairs', orderNumber: 'KN-3051-M', totalBundles: 5, completedBundles: 2, createdAt: '2026-05-24T08:30:00Z', plantLocation: 'St. Paul, MN' }
];

const RAW_INITIAL_BUNDLES: any[] = [
  // JOB-01: Kraus-Anderson (6 bundles) - Epoxy Rebar
  {
    id: 'TG-101', tagId: 'TG-101', jobId: 'JOB-01', mark: 'MK-11', grade: 'Epoxy', barSize: '#8', length: 30, weight: 2670, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-11-Bender -> Rack J-04 -> Door-1',
    status: 'COATED', location: 'Rack J-04', updatedAt: '2026-05-24T12:00:00Z'
  },
  {
    id: 'TG-102', tagId: 'TG-102', jobId: 'JOB-01', mark: 'MK-12', grade: 'Epoxy', barSize: '#11', length: 40, weight: 5310, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack K-1 -> Door-1',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T10:15:00Z'
  },
  {
    id: 'TG-103', tagId: 'TG-103', jobId: 'JOB-01', mark: 'MK-13', grade: 'Epoxy', barSize: '#5', length: 20, weight: 1040, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-New-Robo -> Rack J-08 -> Door-2',
    status: 'LOADED', location: 'Door-2', door: 'Door-2', trailerSize: 'Flatbed', updatedAt: '2026-05-24T14:30:00Z'
  },
  {
    id: 'TG-104', tagId: 'TG-104', jobId: 'JOB-01', mark: 'MK-14', grade: 'Epoxy', barSize: '#9', length: 35, weight: 3400, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Old-Robo -> Rack J-12 -> Door-2',
    status: 'STAGED', location: 'Shear-North', updatedAt: '2026-05-24T14:45:00Z'
  },
  {
    id: 'TG-105', tagId: 'TG-105', jobId: 'JOB-01', mark: 'MK-15', grade: 'Epoxy', barSize: '#4', length: 15, weight: 668, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-SE-Bender -> Rack L-1 -> Door-3',
    status: 'LOADED', location: 'Door-3', door: 'Door-3', trailerSize: 'Step Deck', updatedAt: '2026-05-24T15:00:00Z'
  },
  {
    id: 'TG-106', tagId: 'TG-106', jobId: 'JOB-01', mark: 'MK-16', grade: 'Epoxy', barSize: '#7', length: 28, weight: 2044, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-11-Bender -> Rack K-2 -> Door-3',
    status: 'BENDING', location: 'Bender-11-Bender', updatedAt: '2026-05-24T15:10:00Z'
  },

  // JOB-02: McGough Gym (5 bundles) - Black Rebar (SW Rules apply!)
  {
    id: 'TG-201', tagId: 'TG-201', jobId: 'JOB-02', mark: 'MK-21', grade: 'Black', barSize: '#6', length: 24, weight: 1502, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-New-Robo -> Rack J-22 -> Door-7',
    status: 'LOADED', location: 'Door-7', door: 'Door-7', trailerSize: 'Flatbed', updatedAt: '2026-05-24T14:10:00Z'
  },
  {
    id: 'TG-202', tagId: 'TG-202', jobId: 'JOB-02', mark: 'MK-22', grade: 'Black', barSize: '#8', length: 32, weight: 2848, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-SE-Bender -> Rack J-25 -> Door-7',
    status: 'STAGED', location: 'Raw-SW', updatedAt: '2026-05-24T11:00:00Z'
  },
  {
    id: 'TG-203', tagId: 'TG-203', jobId: 'JOB-02', mark: 'MK-23', grade: 'Black', barSize: '#5', length: 18, weight: 936, isEpoxy: false,
    route: 'Raw-SW -> Shear-Center -> Bender-Old-Robo -> Rack L-8 -> Door-8',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T11:15:00Z'
  },
  {
    id: 'TG-204', tagId: 'TG-204', jobId: 'JOB-02', mark: 'MK-24', grade: 'Black', barSize: '#4', length: 12, weight: 534, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-SE-Bender -> Rack L-10 -> Door-8',
    status: 'BENDING', location: 'Bender-SE-Bender', updatedAt: '2026-05-24T15:20:00Z'
  },
  {
    id: 'TG-205', tagId: 'TG-205', jobId: 'JOB-02', mark: 'MK-25', grade: 'Black', barSize: '#10', length: 36, weight: 4300, isEpoxy: false,
    route: 'Raw-SW -> Shear-Center -> Bender-New-Robo -> Rack J-19 -> Door-7',
    status: 'RACKED', location: 'Rack J-19', updatedAt: '2026-05-24T14:55:00Z'
  },

  // JOB-03: PCL Construction (6 bundles) - Epoxy Rebar
  {
    id: 'TG-301', tagId: 'TG-301', jobId: 'JOB-03', mark: 'MK-31', grade: 'Epoxy', barSize: '#9', length: 30, weight: 3012, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack J-02 -> Door-2',
    status: 'LOADED', location: 'Door-2', door: 'Door-2', trailerSize: 'Flatbed', updatedAt: '2026-05-24T13:40:00Z'
  },
  {
    id: 'TG-302', tagId: 'TG-302', jobId: 'JOB-03', mark: 'MK-32', grade: 'Epoxy', barSize: '#11', length: 42, weight: 5576, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-11-Bender -> Rack J-05 -> Door-2',
    status: 'STAGED', location: 'Coat-Station', updatedAt: '2026-05-24T13:10:00Z'
  },
  {
    id: 'TG-303', tagId: 'TG-303', jobId: 'JOB-03', mark: 'MK-33', grade: 'Epoxy', barSize: '#5', length: 22, weight: 1144, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-Old-Robo -> Rack L-3 -> Door-1',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T12:00:00Z'
  },
  {
    id: 'TG-304', tagId: 'TG-304', jobId: 'JOB-03', mark: 'MK-34', grade: 'Epoxy', barSize: '#6', length: 25, weight: 1565, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-Old-Robo -> Rack J-15 -> Door-3',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T12:15:00Z'
  },
  {
    id: 'TG-305', tagId: 'TG-305', jobId: 'JOB-03', mark: 'MK-35', grade: 'Epoxy', barSize: '#8', length: 26, weight: 2314, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-SE-Bender -> Rack K-1 -> Door-3',
    status: 'RACKED', location: 'Rack K-1', updatedAt: '2026-05-24T15:15:00Z'
  },
  {
    id: 'TG-306', tagId: 'TG-306', jobId: 'JOB-03', mark: 'MK-36', grade: 'Epoxy', barSize: '#3', length: 10, weight: 376, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-New-Robo -> Rack J-10 -> Door-2',
    status: 'BENDING', location: 'Bender-New-Robo', updatedAt: '2026-05-24T15:22:00Z'
  },

  // JOB-04: Adolfson & Peterson (5 bundles) - Epoxy Rebar
  {
    id: 'TG-401', tagId: 'TG-401', jobId: 'JOB-04', mark: 'MK-41', grade: 'Epoxy', barSize: '#10', length: 32, weight: 3824, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack J-16 -> Door-8',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T13:00:00Z'
  },
  {
    id: 'TG-402', tagId: 'TG-402', jobId: 'JOB-04', mark: 'MK-42', grade: 'Epoxy', barSize: '#7', length: 24, weight: 1752, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-11-Bender -> Rack J-03 -> Door-1',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T13:10:00Z'
  },
  {
    id: 'TG-403', tagId: 'TG-403', jobId: 'JOB-04', mark: 'MK-43', grade: 'Epoxy', barSize: '#5', length: 16, weight: 832, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-Old-Robo -> Rack L-4 -> Door-1',
    status: 'STAGED', location: 'Coat-Station', updatedAt: '2026-05-24T14:40:00Z'
  },
  {
    id: 'TG-404', tagId: 'TG-404', jobId: 'JOB-04', mark: 'MK-44', grade: 'Epoxy', barSize: '#4', length: 14, weight: 624, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-SE-Bender -> Rack J-11 -> Door-2',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T15:00:00Z'
  },
  {
    id: 'TG-405', tagId: 'TG-405', jobId: 'JOB-04', mark: 'MK-45', grade: 'Epoxy', barSize: '#8', length: 20, weight: 1780, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack K-2 -> Door-3',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T15:10:00Z'
  },

  // JOB-05: M.A. Mortenson (5 bundles) - Black Rebar (SW Rules apply!)
  {
    id: 'TG-501', tagId: 'TG-501', jobId: 'JOB-05', mark: 'MK-51', grade: 'Black', barSize: '#11', length: 40, weight: 5310, isEpoxy: false,
    route: 'Raw-SW -> Shear-North -> Bender-Radius-Bender -> Rack J-20 -> Door-8',
    status: 'LOADED', location: 'Door-8', door: 'Door-8', trailerSize: 'Flatbed', updatedAt: '2026-05-24T13:20:00Z'
  },
  {
    id: 'TG-502', tagId: 'TG-502', jobId: 'JOB-05', mark: 'MK-52', grade: 'Black', barSize: '#8', length: 30, weight: 2670, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-11-Bender -> Rack J-24 -> Door-8',
    status: 'LOADED', location: 'Door-8', door: 'Door-8', trailerSize: 'Step Deck', updatedAt: '2026-05-24T14:15:00Z'
  },
  {
    id: 'TG-503', tagId: 'TG-503', jobId: 'JOB-05', mark: 'MK-53', grade: 'Black', barSize: '#5', length: 18, weight: 936, isEpoxy: false,
    route: 'Raw-SW -> Shear-Center -> Bender-Old-Robo -> Rack L-7 -> Door-7',
    status: 'LOADED', location: 'Door-7', door: 'Door-7', trailerSize: 'Flatbed', updatedAt: '2026-05-24T14:45:00Z'
  },
  {
    id: 'TG-504', tagId: 'TG-504', jobId: 'JOB-05', mark: 'MK-54', grade: 'Black', barSize: '#6', length: 22, weight: 1377, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-New-Robo -> Rack L-9 -> Door-7',
    status: 'STAGED', location: 'Shear-South', updatedAt: '2026-05-24T15:05:00Z'
  },
  {
    id: 'TG-505', tagId: 'TG-505', jobId: 'JOB-05', mark: 'MK-55', grade: 'Black', barSize: '#9', length: 36, weight: 3500, isEpoxy: false,
    route: 'Raw-SW -> Shear-North -> Bender-11-Bender -> Rack J-21 -> Door-8',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T15:15:00Z'
  },

  // JOB-06: Ryan Companies (4 bundles) - Epoxy Rebar
  {
    id: 'TG-601', tagId: 'TG-601', jobId: 'JOB-06', mark: 'MK-61', grade: 'Epoxy', barSize: '#8', length: 28, weight: 2492, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack J-06 -> Door-3',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T14:00:00Z'
  },
  {
    id: 'TG-602', tagId: 'TG-602', jobId: 'JOB-06', mark: 'MK-62', grade: 'Epoxy', barSize: '#6', length: 20, weight: 1252, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-South -> Bender-Old-Robo -> Rack J-17 -> Door-1',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T14:15:00Z'
  },
  {
    id: 'TG-603', tagId: 'TG-603', jobId: 'JOB-06', mark: 'MK-63', grade: 'Epoxy', barSize: '#5', length: 14, weight: 728, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-Center -> Bender-SE-Bender -> Rack L-2 -> Door-2',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T14:30:00Z'
  },
  {
    id: 'TG-604', tagId: 'TG-604', jobId: 'JOB-06', mark: 'MK-64', grade: 'Epoxy', barSize: '#10', length: 35, weight: 4180, isEpoxy: true,
    route: 'Raw-SW -> Coat-Station -> Shear-North -> Bender-Radius-Bender -> Rack K-1 -> Door-1',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T14:45:00Z'
  },

  // JOB-07: Knutson Construction (5 bundles) - Black Rebar (SW Rules apply!)
  {
    id: 'TG-701', tagId: 'TG-701', jobId: 'JOB-07', mark: 'MK-71', grade: 'Black', barSize: '#7', length: 24, weight: 1752, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-New-Robo -> Rack J-23 -> Door-8',
    status: 'LOADED', location: 'Door-8', door: 'Door-8', trailerSize: 'Flatbed', updatedAt: '2026-05-24T11:20:00Z'
  },
  {
    id: 'TG-702', tagId: 'TG-702', jobId: 'JOB-07', mark: 'MK-72', grade: 'Black', barSize: '#5', length: 16, weight: 832, isEpoxy: false,
    route: 'Raw-SW -> Shear-South -> Bender-New-Robo -> Rack L-6 -> Door-8',
    status: 'LOADED', location: 'Door-8', door: 'Door-8', trailerSize: 'Step Deck', updatedAt: '2026-05-24T12:00:00Z'
  },
  {
    id: 'TG-703', tagId: 'TG-703', jobId: 'JOB-07', mark: 'MK-73', grade: 'Black', barSize: '#4', length: 12, weight: 534, isEpoxy: false,
    route: 'Raw-SW -> Shear-Center -> Bender-New-Robo -> Rack J-20 -> Door-7',
    status: 'STAGED', location: 'Raw-SW', updatedAt: '2026-05-24T15:00:00Z'
  },
  {
    id: 'TG-704', tagId: 'TG-704', jobId: 'JOB-07', mark: 'MK-74', grade: 'Black', barSize: '#11', length: 36, weight: 4780, isEpoxy: false,
    route: 'Raw-SW -> Shear-North -> Bender-Radius-Bender -> Rack L-8 -> Door-7',
    status: 'BENDING', location: 'Bender-Radius-Bender', updatedAt: '2026-05-24T15:24:00Z'
  },
  {
    id: 'TG-705', tagId: 'TG-705', jobId: 'JOB-07', mark: 'MK-75', grade: 'Black', barSize: '#9', length: 32, weight: 3110, isEpoxy: false,
    route: 'Raw-SW -> Shear-North -> Bender-11-Bender -> Rack J-22 -> Door-8',
    status: 'RAW', location: 'Raw-SW', updatedAt: '2026-05-24T15:25:00Z'
  }
];

export const INITIAL_BUNDLES: Bundle[] = RAW_INITIAL_BUNDLES.map((b, idx) => {
  const job = INITIAL_JOBS.find(j => j.id === b.jobId);
  const plantLocation = job ? job.plantLocation : 'St. Paul, MN';
  const heatNumber = `HT-2026-${3410 + idx}`;
  const millCertUrl = `https://certificates.simcote.com/mill-cert-${3410 + idx}.pdf`;
  
  // ASTM A934 is purple coating, A775 is green coating.
  const specification = b.isEpoxy 
    ? (idx % 2 === 1 ? 'ASTM_A934' : 'ASTM_A775') 
    : 'ASTM_A775';
    
  // Tomorrow is 1 day. Let's make some tomorrow, some next week, some next month.
  // We offset shipping by some days.
  let daysOffset = 2; // default 2 days (tomorrow/soon)
  if (idx % 4 === 1) daysOffset = 1; // tomorrow!
  if (idx % 4 === 2) daysOffset = 7; // next week
  if (idx % 4 === 3) daysOffset = 35; // next month! (August/September)
  
  const shippingDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
  
  // UV Exposure testing: let's set stagedAt to 26 days ago for certain epoxy bundles sitting in outdoor areas (racks/raw stock)
  let stagedAt = b.stagedAt;
  const isOutdoor = b.location.startsWith('Rack') || b.location.startsWith('Door') || b.location === 'Raw-SW' || b.location === 'North-End';
  if (b.isEpoxy && isOutdoor && idx % 3 === 0) {
    stagedAt = new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString();
  } else if (!stagedAt && isOutdoor) {
    stagedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  }

  return {
    ...b,
    plantLocation,
    heatNumber,
    millCertUrl,
    specification,
    shippingDate,
    stagedAt
  };
});

export const INITIAL_OPERATORS: Operator[] = [
  { id: 'OP-1', name: 'John Doe', role: 'CRANE_OPERATOR', isActive: true, currentStation: 'Crane-NE' },
  { id: 'OP-2', name: 'Bill Smith', role: 'CRANE_OPERATOR', isActive: true, currentStation: 'Crane-SW' },
  { id: 'OP-3', name: 'Steve Miller', role: 'SHEAR_OPERATOR', isActive: true, currentStation: 'Shear-North' },
  { id: 'OP-4', name: 'Dave Jones', role: 'SHEAR_OPERATOR', isActive: true, currentStation: 'Shear-South' },
  { id: 'OP-5', name: 'Mike Johnson', role: 'BENDER', isActive: true, currentStation: 'Bender-New-Robo' },
  { id: 'OP-6', name: 'Bob Carpenter', role: 'BENDER', isActive: true, currentStation: 'Bender-11-Bender' },
  { id: 'OP-7', name: 'Alice Young', role: 'ADMIN', isActive: true }
];

export const INITIAL_EXCEPTIONS: Exception[] = [
  {
    id: 'EX-01',
    timestamp: '2026-05-24T10:30:00Z',
    tagId: 'TG-104',
    operatorName: 'Steve Miller',
    type: 'Misplaced Bar',
    description: 'Found a misplaced rebar pack near Shear-North with epoxy coating damaged.',
    status: 'OPEN'
  },
  {
    id: 'EX-02',
    timestamp: '2026-05-24T11:45:00Z',
    tagId: 'TG-203',
    operatorName: 'Bill Smith',
    type: 'Fabrication Error',
    description: 'Length measurement error for bundle tag TG-203. Cut is 18ft instead of 19ft.',
    status: 'OPEN'
  },
  {
    id: 'EX-03',
    timestamp: '2026-05-24T09:15:00Z',
    tagId: 'TG-301',
    operatorName: 'Dave Jones',
    type: 'Coating Issue',
    description: 'Minor epoxy scratch corrected during staging.',
    status: 'RESOLVED',
    resolvedAt: '2026-05-24T09:30:00Z',
    resolvedBy: 'Alice Young'
  }
];

export const INITIAL_SHIFT_MESSAGES: ShiftMessage[] = [
  { id: 'SM-1', sender: 'John Doe', content: 'Crane NW cable inspector is coming at 3:00 PM today.', timestamp: '2026-05-24T11:30:00Z', shift: 'First Shift' },
  { id: 'SM-2', sender: 'Steve Miller', content: 'Shear-South blade is getting dull, might need a rotate before second shift starts.', timestamp: '2026-05-24T12:45:00Z', shift: 'First Shift' },
  { id: 'SM-3', sender: 'Bob Carpenter', content: 'New-Robo bender oil level is topped off.', timestamp: '2026-05-24T13:20:00Z', shift: 'First Shift' }
];

export const INITIAL_ACTIVITY: ActivityEvent[] = [
  { id: 'AC-1', timestamp: '2026-05-24T09:00:00Z', tagId: 'TG-101', operatorName: 'John Doe', action: 'STAGED', fromLocation: 'Raw-SW', toLocation: 'Coat-Station', details: 'Staged for powder coating' },
  { id: 'AC-2', timestamp: '2026-05-24T10:30:00Z', tagId: 'TG-101', operatorName: 'Steve Miller', action: 'SHEARED', fromLocation: 'Coat-Station', toLocation: 'Shear-Center', details: 'Sheared to 30ft' },
  { id: 'AC-3', timestamp: '2026-05-24T12:00:00Z', tagId: 'TG-101', operatorName: 'Bob Carpenter', action: 'BENT', fromLocation: 'Shear-Center', toLocation: 'Bender-11-Bender', details: 'Fabricated bend markup MK-11' },
  { id: 'AC-4', timestamp: '2026-05-24T14:30:00Z', tagId: 'TG-103', operatorName: 'Alice Young', action: 'LOADED', fromLocation: 'Rack J-08', toLocation: 'Door-2', details: 'Loaded onto Flatbed trailer for Kraus-Anderson' }
];
