import { TrailerSize } from '../types';

export interface LegendItem {
  id: string;
  name: string;
  desc: string;
  colorClass: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
  tooltipAlign: string;
  maintenance?: {
    schedule: string;
    lastService: string;
    nextService: string;
    technician: string;
    status: string;
    statusClass: string;
    note: string;
  };
  info?: {
    metric: string;
    action: string;
    technician: string;
    status: string;
    statusClass: string;
    note: string;
  };
}

export const machineLegendItems: LegendItem[] = [
  {
    id: 'gantry-cranes',
    name: 'Gantry Cranes',
    desc: 'Northwest, NE & SE overhead heavy material hoist lifters',
    colorClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
    borderClass: 'border-sky-500/30',
    bgClass: 'bg-sky-950/20',
    tooltipAlign: 'left-0 sm:left-1/2 sm:-translate-x-1/2',
    maintenance: {
      schedule: 'Monthly / 30 Days',
      lastService: 'May 10, 2026',
      nextService: 'Jun 10, 2026',
      technician: 'Marcus Vance (Senior Mech)',
      status: 'Operational',
      statusClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      note: 'Overhead rails lubricated, secondary hoist brakes tested.'
    }
  },
  {
    id: 'robotic-benders',
    name: 'Robotic Benders',
    desc: 'High-speed CNC, manual lever, and circle radius benders',
    colorClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
    borderClass: 'border-orange-500/35',
    bgClass: 'bg-orange-950/20',
    tooltipAlign: 'left-0 sm:left-1/2 sm:-translate-x-1/2',
    maintenance: {
      schedule: 'Bi-Weekly / 14 Days',
      lastService: 'May 22, 2026',
      nextService: 'Jun 05, 2026',
      technician: 'Sarah Jenkins (Automation)',
      status: 'Calibration OK',
      statusClass: 'bg-sky-500/10 text-sky-450 border border-sky-500/20',
      note: 'CNC micro-controllers synced with central CAD interface.'
    }
  },
  {
    id: 'sizing-shears',
    name: 'Sizing Shears',
    desc: 'North, Center, and South shear sizing stations and cut beds',
    colorClass: 'text-purple-400',
    dotClass: 'bg-purple-400',
    borderClass: 'border-purple-500/25',
    bgClass: 'bg-purple-950/25',
    tooltipAlign: 'left-1/2 -translate-x-1/2',
    maintenance: {
      schedule: 'Weekly / 7 Days',
      lastService: 'May 18, 2026',
      nextService: 'May 25, 2026',
      technician: 'David K. (Hydraulic Tech)',
      status: 'Blade Cleaned',
      statusClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      note: 'Blade hydraulic fluid flushed, cutting rotation certified.'
    }
  },
  {
    id: 'coating-line',
    name: 'Coating Line',
    desc: 'Powder coat line tunnel station for epoxy coating rebar',
    colorClass: 'text-teal-400',
    dotClass: 'bg-teal-455',
    borderClass: 'border-teal-500/35',
    bgClass: 'bg-teal-950/20',
    tooltipAlign: 'right-1/2 translate-x-1/2 sm:left-1/2 sm:-translate-x-1/2',
    maintenance: {
      schedule: 'Quarterly / 90 Days',
      lastService: 'Apr 02, 2026',
      nextService: 'Jul 02, 2026',
      technician: 'Yuki Tanaka (Epoxy Spec)',
      status: 'Thermal OK',
      statusClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      note: 'Powder nozzles cleaned, oven thermal distribution checked.'
    }
  },
  {
    id: 'buffer-racks',
    name: 'Buffer Racks',
    desc: 'Temporary heavy storage racks for staged/racked bundles',
    colorClass: 'text-indigo-400',
    dotClass: 'bg-indigo-455',
    borderClass: 'border-slate-800',
    bgClass: 'bg-slate-900/20',
    tooltipAlign: 'right-0 sm:left-1/2 sm:-translate-x-1/2',
    maintenance: {
      schedule: 'Semi-Annual / 180 Days',
      lastService: 'Jan 15, 2026',
      nextService: 'Jul 15, 2026',
      technician: 'Robert Miller (Structural)',
      status: 'Load Certified',
      statusClass: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      note: 'Weld integrity load-test certified for heavy bundles.'
    }
  },
  {
    id: 'shipping-bays',
    name: 'Shipping Bays',
    desc: 'NW Flatbed, NE gates, and SW trailers loading door docks',
    colorClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    borderClass: 'border-emerald-550',
    bgClass: 'bg-emerald-950/15',
    tooltipAlign: 'right-0 sm:right-6',
    maintenance: {
      schedule: 'Quarterly / 90 Days',
      lastService: 'Mar 10, 2026',
      nextService: 'Jun 10, 2026',
      technician: 'Industrial Doors Inc.',
      status: 'Operational',
      statusClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      note: 'Pneumatic dock leveler seals and roll-up gates serviced.'
    }
  }
];

export const heatmapLegendItems: LegendItem[] = [
  {
    id: 'empty',
    name: '0 LBS (Empty)',
    desc: 'Vacancy detected; no active stocks resides',
    colorClass: 'text-emerald-405',
    dotClass: 'bg-emerald-400',
    borderClass: 'border-emerald-500/30',
    bgClass: 'bg-emerald-950/20',
    tooltipAlign: 'left-0 sm:left-1/2 sm:-translate-x-1/2',
    info: {
      metric: '0% Capacity Used',
      action: 'Open for Stocking',
      technician: 'Automated Coordinator',
      status: 'Vacancy Check',
      statusClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      note: 'Enables quick crane placement of incoming raw rebar stock.'
    }
  },
  {
    id: 'low-load',
    name: 'Low Load',
    desc: 'Under 25% of gantry or rack capacity',
    colorClass: 'text-yellow-500',
    dotClass: 'bg-yellow-400',
    borderClass: 'border-yellow-500/30',
    bgClass: 'bg-yellow-950/20',
    tooltipAlign: 'left-0 sm:left-1/2 sm:-translate-x-1/2',
    info: {
      metric: '1% to 25% Capacity',
      action: 'Optimal Storage Buffer',
      technician: 'Staging Logistics Mgr',
      status: 'Normal Flow',
      statusClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      note: 'Ideal yard density. Minimal wait times for bender staging.'
    }
  },
  {
    id: 'medium-load',
    name: 'Medium Load',
    desc: 'Between 25% and 55% buffer space usage',
    colorClass: 'text-orange-400',
    dotClass: 'bg-orange-450',
    borderClass: 'border-orange-500/30',
    bgClass: 'bg-orange-950/20',
    tooltipAlign: 'left-1/2 -translate-x-1/2',
    info: {
      metric: '25% to 55% Capacity',
      action: 'Active Flow Monitoring',
      technician: 'Staging Logistics Mgr',
      status: 'Moderately Busy',
      statusClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
      note: 'Minor staging backlog risk; track cranes to prevent bottlenecks.'
    }
  },
  {
    id: 'high-load',
    name: 'High Load',
    desc: 'Between 55% and 85% zone footprint limit',
    colorClass: 'text-red-400',
    dotClass: 'bg-red-400',
    borderClass: 'border-red-500/30',
    bgClass: 'bg-red-950/20',
    tooltipAlign: 'right-1/2 translate-x-1/2 sm:left-1/2 sm:-translate-x-1/2',
    info: {
      metric: '55% to 85% Capacity',
      action: 'Prioritize Dispatching',
      technician: 'Crane Coordinator',
      status: 'Heavily Burdened',
      statusClass: 'bg-red-500/10 text-red-405 border border-red-500/20',
      note: 'Redirect incoming rebar bundles if crane staging space shrinks.'
    }
  },
  {
    id: 'extreme-load',
    name: 'Extreme Load',
    desc: 'Exceeding 85% standard staging threshold',
    colorClass: 'text-rose-500',
    dotClass: 'bg-rose-550 animate-pulse',
    borderClass: 'border-rose-600/30',
    bgClass: 'bg-rose-950/20',
    tooltipAlign: 'right-0 sm:right-6',
    info: {
      metric: '85%+ Capacity Limit',
      action: 'CRITICAL LOADING',
      technician: 'Logistics Supervisor',
      status: 'Gridlock Risk',
      statusClass: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
      note: 'Emergency load levels. Blocks crane paths unless bundles exit.'
    }
  }
];

export const zoneCoords: Record<string, { cx: number; cy: number; cw: number; ch: number; label: string }> = {
  'Crane-NW': { cx: 32, cy: 52, cw: 135, ch: 60, label: 'GANTRY NW' },
  'Rack J-04': { cx: 180, cy: 52, cw: 135, ch: 60, label: 'RACK J-04' },
  'Rack J-12': { cx: 328, cy: 52, cw: 135, ch: 60, label: 'RACK J-12' },
  'Door-1': { cx: 106, cy: 125, cw: 135, ch: 65, label: 'DOOR-1 BAY' },
  'Door-2': { cx: 254, cy: 125, cw: 135, ch: 65, label: 'DOOR-2 BAY' },
  'Crane-NE': { cx: 833, cy: 52, cw: 135, ch: 60, label: 'GANTRY NE' },
  'Rack K-1': { cx: 685, cy: 52, cw: 135, ch: 60, label: 'RACK K-1' },
  'Rack K-2': { cx: 537, cy: 52, cw: 135, ch: 60, label: 'RACK K-2' },
  'Door-3': { cx: 611, cy: 125, cw: 135, ch: 65, label: 'DOOR-3 BAY' },
  'North-End': { cx: 759, cy: 125, cw: 135, ch: 65, label: 'NORTH-END' },
  'Coat-Station': { cx: 32, cy: 242, cw: 215, ch: 50, label: 'COAT TUNNEL' },
  'Shear-North': { cx: 267, cy: 242, cw: 220, ch: 50, label: 'SHEAR NORTH' },
  'Shear-Center': { cx: 512, cy: 242, cw: 220, ch: 50, label: 'SHEAR CENTER' },
  'Shear-South': { cx: 757, cy: 242, cw: 215, ch: 50, label: 'SHEAR SOUTH' },
  'Raw-SW': { cx: 32, cy: 345, cw: 135, ch: 65, label: 'STOCK SW' },
  'Crane-SW': { cx: 180, cy: 345, cw: 135, ch: 65, label: 'CRANE SW' },
  'Rack J-19': { cx: 328, cy: 345, cw: 135, ch: 65, label: 'RACK J-19' },
  'Rack L-8': { cx: 32, cy: 422, cw: 135, ch: 65, label: 'RACK L-8' },
  'Door-7': { cx: 180, cy: 422, cw: 135, ch: 65, label: 'DOOR-7 BAY' },
  'Door-8': { cx: 328, cy: 422, cw: 135, ch: 65, label: 'DOOR-8 BAY' },
  'Crane-SE': { cx: 527, cy: 345, cw: 135, ch: 65, label: 'GANTRY SE' },
  'Rack J-15': { cx: 675, cy: 345, cw: 135, ch: 65, label: 'RACK J-15' },
  'Rack L-1': { cx: 823, cy: 345, cw: 135, ch: 65, label: 'RACK L-1' },
  'Bender-New-Robo': { cx: 601, cy: 422, cw: 135, ch: 65, label: 'NEW-ROBO CNC' },
  'Bender-11-Bender': { cx: 749, cy: 422, cw: 135, ch: 65, label: '11-BENDER' }
};

export const zoneQuadrants: Record<string, 'NW' | 'NE' | 'SW' | 'SE'> = {
  'Crane-NW': 'NW',
  'Rack J-04': 'NW',
  'Rack J-12': 'NW',
  'Door-1': 'NW',
  'Door-2': 'NW',
  'Coat-Station': 'NW',

  'Crane-NE': 'NE',
  'Rack K-1': 'NE',
  'Rack K-2': 'NE',
  'Door-3': 'NE',
  'North-End': 'NE',
  'Shear-North': 'NE',

  'Raw-SW': 'SW',
  'Crane-SW': 'SW',
  'Rack J-19': 'SW',
  'Rack L-8': 'SW',
  'Door-7': 'SW',
  'Door-8': 'SW',

  'Crane-SE': 'SE',
  'Rack J-15': 'SE',
  'Rack L-1': 'SE',
  'Bender-New-Robo': 'SE',
  'Bender-11-Bender': 'SE',
  'Shear-Center': 'SE',
  'Shear-South': 'SE'
};
