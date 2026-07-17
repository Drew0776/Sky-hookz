import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bundle, Obstruction } from '../types';
import { INITIAL_BUNDLES, INITIAL_ACTIVITY } from '../seedData';
import PageLoader from '../components/PageLoader';
import BundleDetailModal from '../components/BundleDetailModal';
import RebarBundleIcon from '../components/RebarBundleIcon';
import YardMapLegend from '../components/YardMapLegend';
import { motion } from 'motion/react';
import { 
  Map, 
  RefreshCw, 
  Layers, 
  Compass, 
  Maximize2, 
  HelpCircle,
  HardHat,
  Info,
  X,
  Settings,
  AlertTriangle,
  History,
  Check,
  Play,
  ArrowRight,
  Search,
  MapPin,
  BarChart2
} from 'lucide-react';
import { 
  machineLegendItems, 
  heatmapLegendItems, 
  zoneCoords, 
  zoneQuadrants 
} from './yardMapData';
import { getRouteAnalysisByZones } from '../utils/yardMath';

export default function YardMapPage() {
  const { currentRole, operators } = useApp();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal inspection display
  const [selectedBundleForModal, setSelectedBundleForModal] = useState<Bundle | null>(null);

  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isHeatmapMode, setIsHeatmapMode] = useState<boolean>(false);
  const [headerSearchVal, setHeaderSearchVal] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  // High-contrast full-screen modal trigger block
  const [doubleClickedZoneId, setDoubleClickedZoneId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [zoneCustomCapacities, setZoneCustomCapacities] = useState<Record<string, number>>({});
  const [assignedZoneOperators, setAssignedZoneOperators] = useState<Record<string, string>>({});
  const [modalActiveTab, setModalActiveTab] = useState<'inventory' | 'activities' | 'configuration'>('inventory');
  const [actionError, setActionError] = useState<string | null>(null);

  // Exception Form States
  const [exFormTagId, setExFormTagId] = useState<string>('');
  const [exFormType, setExFormType] = useState<string>('Misplaced Bar');
  const [exFormDesc, setExFormDesc] = useState<string>('');
  const [exSubmitSuccess, setExSubmitSuccess] = useState<string>('');
  const [exSubmitError, setExSubmitError] = useState<string>('');

  // Gantry path-drawing and travel route planning states
  const [isRoutingActive, setIsRoutingActive] = useState<boolean>(false);
  const [routeOrigin, setRouteOrigin] = useState<string | null>(null);
  const [routeDestination, setRouteDestination] = useState<string | null>(null);
  const [routeMaterialType, setRouteMaterialType] = useState<'ALL' | 'Epoxy' | 'Black'>('ALL');

  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState<string | null>(null);

  const loadYardBundles = async () => {
    try {
      const [bRes, aRes] = await Promise.all([
        fetch('/api/bundles').catch(() => null),
        fetch('/api/activity').catch(() => null)
      ]);

      let gotBundles = false;
      let gotActivities = false;

      if (bRes && bRes.ok) {
        setBundles(await bRes.json());
        gotBundles = true;
      }
      if (aRes && aRes.ok) {
        setActivities(await aRes.json());
        gotActivities = true;
      }

      if (!gotBundles) setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      if (!gotActivities) setActivities(prev => prev.length ? prev : INITIAL_ACTIVITY);
    } catch (err) {
      console.warn('Network issue loading yard Map data, using local seed fallback:', err);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      setActivities(prev => prev.length ? prev : INITIAL_ACTIVITY);
    } finally {
      setLoading(false);
    }
  };

  const handleActionOnBundle = async (bundleId: string, actionType: string, extraData?: any) => {
    setActionError(null);
    try {
      let url = '';
      let body: any = { operatorName: 'Yard Coordinator' };
      
      if (actionType === 'mark-bent') {
        url = `/api/bundles/${bundleId}/mark-bent`;
      } else if (actionType === 'send-to-bender') {
        url = `/api/bundles/${bundleId}/send-to-bender`;
        body.benderId = extraData || 'Bender-New-Robo';
      } else if (actionType === 'stage') {
        url = `/api/bundles/${bundleId}/stage`;
        body.location = extraData || 'Coat-Station';
      } else if (actionType === 'pickup') {
        url = `/api/bundles/${bundleId}/pickup`;
        body.craneId = extraData || 'Crane-NW';
      } else if (actionType === 'drop') {
        url = `/api/bundles/${bundleId}/drop`;
        body.location = extraData || 'Rack J-15';
      } else if (actionType === 'force-load') {
        url = `/api/bundles/${bundleId}/force-load`;
        body.door = extraData || 'Door-1';
        body.trailerSize = 'Flatbed';
      }

      if (url) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (res.ok) {
          await loadYardBundles();
        } else {
          const errData = await res.json();
          setActionError(errData.error || 'Server rejected compliance checks.');
        }
      }
    } catch (err) {
      console.error('Adjustment failed:', err);
      setActionError('Floor control interface network error.');
    }
  };

  useEffect(() => {
    loadYardBundles();

    // Subscribe to real-time pub/sub synchronization stream via SSE
    const eventSource = new EventSource('/api/updates');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'update') {
          if (payload.data.bundles) {
            setBundles(payload.data.bundles);
          }
          if (payload.data.activityEvents) {
            setActivities(payload.data.activityEvents);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE updates on YardMapPage:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('Real-Time push stream disconnected. Reconnecting automatically.');
    };

    // Keep an extra 30s polling backup as an absolute fail-safe
    const interval = setInterval(loadYardBundles, 30000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return <PageLoader message="Mapping gantry crane coordinates..." />;
  }

  // Define facility layout zones with their coordinates or labels
  const zonesList = [
    // Cranes
    { id: 'Crane-NW', label: 'Crane-NW', type: 'crane', desc: 'Northwest Gantry', color: 'border-sky-500/25 bg-sky-950/20 text-sky-400' },
    { id: 'Crane-NE', label: 'Crane-NE', type: 'crane', desc: 'Northeast Gantry', color: 'border-sky-500/25 bg-sky-950/20 text-sky-400' },
    { id: 'Crane-SE', label: 'Crane-SE', type: 'crane', desc: 'Southeast Gantry', color: 'border-sky-500/25 bg-sky-950/20 text-sky-400' },
    { id: 'Crane-SW', label: 'Crane-SW', type: 'crane', desc: 'Southwest Gantry (Black Only)', color: 'border-amber-500/30 bg-amber-950/20 text-amber-500' },
    
    // Core Processing Stations
    { id: 'Raw-SW', label: 'Stockpile', type: 'processing', desc: 'Uncut Raw Stock SW Corner', color: 'border-slate-700 bg-slate-900/40 text-slate-300' },
    { id: 'Coat-Station', label: 'Power Coat Line', type: 'processing', desc: 'Epoxy Coating Tunnel', color: 'border-teal-500/30 bg-teal-950/20 text-teal-400' },
    { id: 'Shear-North', label: 'North Shear', type: 'processing', desc: 'Sizing Shear North Bed', color: 'border-purple-500/20 bg-purple-950/10 text-purple-400' },
    { id: 'Shear-Center', label: 'Center Shear', type: 'processing', desc: 'Sizing Shear Center Bed', color: 'border-purple-500/20 bg-purple-950/10 text-purple-400' },
    { id: 'Shear-South', label: 'South Shear', type: 'processing', desc: 'Sizing Shear South Bed', color: 'border-purple-500/20 bg-purple-950/10 text-purple-400' },
    
    // Benders
    { id: 'Bender-New-Robo', label: 'New-Robo CNC', type: 'bender', desc: 'High-Speed CNC Bender', color: 'border-orange-500/20 bg-orange-950/10 text-orange-400' },
    { id: 'Bender-Old-Robo', label: 'Old-Robo', type: 'bender', desc: 'Manual Lever Bender', color: 'border-orange-500/20 bg-orange-950/10 text-orange-400' },
    { id: 'Bender-11-Bender', label: '11-Bender', type: 'bender', desc: 'Heavy Duty Mandrel Bender', color: 'border-orange-500/20 bg-orange-950/10 text-orange-400' },
    { id: 'Bender-SE-Bender', label: 'SE-Bender', type: 'bender', desc: 'Southeast Auxiliary Bender', color: 'border-orange-500/20 bg-orange-950/10 text-orange-400' },
    { id: 'Bender-Radius-Bender', label: 'Radius-Bender', type: 'bender', desc: 'Circle & Arc Radial Mandrel', color: 'border-orange-500/20 bg-orange-950/10 text-orange-400' },

    // Core Buffer Racks (Grouped in logical subsets for easy layout rendering)
    { id: 'Rack J-04', label: 'Rack J-04', type: 'rack', desc: 'NW Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack J-12', label: 'Rack J-12', type: 'rack', desc: 'NW Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack J-15', label: 'Rack J-15', type: 'rack', desc: 'Center Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack J-19', label: 'Rack J-19', type: 'rack', desc: 'SW Black Bar Buffer (Black Only)', color: 'border-amber-900/40 bg-slate-950 text-amber-500/70' },
    { id: 'Rack K-1', label: 'Rack K-1', type: 'rack', desc: 'NE Double-Sided Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack K-2', label: 'Rack K-2', type: 'rack', desc: 'NE Double-Sided Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack L-1', label: 'Rack L-1', type: 'rack', desc: 'SE Epoxy Rack', color: 'border-slate-800 bg-slate-900/20 text-indigo-400' },
    { id: 'Rack L-8', label: 'Rack L-8', type: 'rack', desc: 'SW Black Rack (Black Only)', color: 'border-amber-900/40 bg-slate-950 text-amber-500/70' },

    // Shipping Doors
    { id: 'Door-1', label: 'Door-1', type: 'door', desc: 'NW Flatbed Gate (Epoxy)', color: 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400' },
    { id: 'Door-2', label: 'Door-2', type: 'door', desc: 'NW Step Deck Gate (Epoxy)', color: 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400' },
    { id: 'Door-3', label: 'Door-3', type: 'door', desc: 'NE Flatbed Gate (Epoxy)', color: 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400' },
    { id: 'Door-7', label: 'Door-7', type: 'door', desc: 'SW Loading Gate (Black Only)', color: 'border-amber-500/20 bg-amber-950/10 text-amber-400' },
    { id: 'Door-8', label: 'Door-8', type: 'door', desc: 'SW Step Deck Gate (Black Only)', color: 'border-amber-500/20 bg-amber-950/10 text-amber-400' },
    { id: 'North-End', label: 'North-End', type: 'door', desc: 'NE Auxiliary Loading Bay', color: 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400' }
  ];

  const filteredBundles = bundles.filter(b => {
    const matchGrade = gradeFilter === 'ALL' || b.grade.toLowerCase() === gradeFilter.toLowerCase();
    const matchStatus = statusFilter === 'ALL' || b.status.toUpperCase() === statusFilter.toUpperCase();
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || 
      b.tagId.toLowerCase().includes(query) || 
      b.mark.toLowerCase().includes(query) || 
      (b.jobId && b.jobId.toLowerCase().includes(query)) ||
      (b.location && b.location.toLowerCase().includes(query));
    return matchGrade && matchStatus && matchSearch;
  });

  // Map to hold count of bundles at any given location
  const getBundleCount = (zoneId: string) => {
    // Return bundles situated directly at this location
    return filteredBundles.filter(b => b.location === zoneId).length;
  };

  const getBundlesAtZone = (zoneId: string) => {
    return filteredBundles.filter(b => b.location === zoneId);
  };

  const getZoneWeight = (zoneId: string) => {
    return getBundlesAtZone(zoneId).reduce((sum, b) => sum + (b.weight || 0), 0);
  };

  const getZoneMaxCapacity = (zoneId: string) => {
    return zoneCustomCapacities[zoneId] || 25000; // Customizable with beautiful default capacity (25k LBS)
  };

  const maxZoneWeight = Math.max(...zonesList.map(z => getZoneWeight(z.id)), 10000);
  
  // Real-time Gantry Route Path & Obstruction Computation
  const routeAnalysis = routeOrigin && routeDestination 
    ? getRouteAnalysisByZones(routeOrigin, routeDestination, routeMaterialType, bundles, zoneCustomCapacities)
    : { 
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

  const getZonesForCategory = (categoryId: string) => {
    switch (categoryId) {
      case 'gantry-cranes':
        return zonesList.filter(z => z.type === 'crane');
      case 'robotic-benders':
        return zonesList.filter(z => z.type === 'bender');
      case 'sizing-shears':
        return zonesList.filter(z => z.id.startsWith('Shear'));
      case 'coating-line':
        return zonesList.filter(z => z.id === 'Coat-Station');
      case 'buffer-racks':
        return zonesList.filter(z => z.type === 'rack');
      case 'shipping-bays':
        return zonesList.filter(z => z.type === 'door');
      default:
        return [];
    }
  };

  const getMachineCategoryWeight = (categoryId: string) => {
    const categoryZones = getZonesForCategory(categoryId);
    return categoryZones.reduce((sum, z) => sum + getZoneWeight(z.id), 0);
  };

  const getHeatmapCategoryZones = (categoryId: string) => {
    return zonesList.filter(z => {
      const w = getZoneWeight(z.id);
      if (categoryId === 'empty') {
        return w === 0;
      }
      if (w === 0) return false;
      const ratio = w / getZoneMaxCapacity(z.id);
      if (categoryId === 'low-load') {
        return ratio <= 0.25;
      }
      if (categoryId === 'medium-load') {
        return ratio > 0.25 && ratio <= 0.55;
      }
      if (categoryId === 'high-load') {
        return ratio > 0.55 && ratio <= 0.85;
      }
      if (categoryId === 'extreme-load') {
        return ratio > 0.85;
      }
      return false;
    });
  };

  const getHeatmapCategoryWeight = (categoryId: string) => {
    const categoryZones = getHeatmapCategoryZones(categoryId);
    return categoryZones.reduce((sum, z) => sum + getZoneWeight(z.id), 0);
  };

  const activeZoneData = selectedZone ? zonesList.find(z => z.id === selectedZone) : null;
  const activeZoneBundles = selectedZone ? getBundlesAtZone(selectedZone) : [];

  const activeFocusZoneId = hoveredZone || selectedZone;
  const activeFocusZoneData = activeFocusZoneId ? zonesList.find(z => z.id === activeFocusZoneId) : null;
  const activeFocusZoneBundles = activeFocusZoneId ? getBundlesAtZone(activeFocusZoneId) : [];

  // Dynamic header search matches
  const searchLow = headerSearchVal.toLowerCase().trim();
  const matchingBundles = searchLow 
    ? bundles.filter(b => 
        b.tagId.toLowerCase().includes(searchLow) ||
        b.mark.toLowerCase().includes(searchLow)
      ).slice(0, 5)
    : [];

  const uniqueJobIds = Array.from(new Set(bundles.map(b => b.jobId).filter(Boolean))) as string[];
  const matchingJobs = searchLow
    ? uniqueJobIds.filter(jobId => 
        jobId.toLowerCase().includes(searchLow)
      ).slice(0, 3)
    : [];

  // Real-time quadrant load distribution calculation
  const quadrantInfoMap: Record<'NW' | 'NE' | 'SW' | 'SE', { weight: number; pkgs: number; capacity: number }> = {
    NW: { weight: 0, pkgs: 0, capacity: 0 },
    NE: { weight: 0, pkgs: 0, capacity: 0 },
    SW: { weight: 0, pkgs: 0, capacity: 0 },
    SE: { weight: 0, pkgs: 0, capacity: 0 }
  };

  // Pre-populate capacities
  Object.keys(zoneCoords).forEach((zId) => {
    const quad = zoneQuadrants[zId];
    if (quad) {
      quadrantInfoMap[quad].capacity += zoneCustomCapacities[zId] || 75000;
    }
  });

  // Populate active loads and bundle packages
  bundles.forEach((b) => {
    const quad = zoneQuadrants[b.location];
    if (quad) {
      quadrantInfoMap[quad].weight += b.weight || 0;
      quadrantInfoMap[quad].pkgs += 1;
    }
  });

  const quadrantsConfig = [
    {
      key: 'NW',
      name: 'Northwest Sector',
      activity: 'Epoxy Specialty',
      color: 'from-blue-600 via-sky-500 to-indigo-600',
      borderColor: 'border-blue-500/20',
      textColor: 'text-sky-400',
      strokeColor: '#3b82f6',
      barColor: 'bg-blue-500',
      gradientId: 'quad-nw-grad',
      glowColor: 'shadow-blue-500/10'
    },
    {
      key: 'NE',
      name: 'Northeast Sector',
      activity: 'Epoxy Storage & Bays',
      color: 'from-teal-600 via-emerald-500 to-green-600',
      borderColor: 'border-teal-500/20',
      textColor: 'text-teal-400',
      strokeColor: '#10b981',
      barColor: 'bg-emerald-500',
      gradientId: 'quad-ne-grad',
      glowColor: 'shadow-teal-500/10'
    },
    {
      key: 'SW',
      name: 'Southwest Sector',
      activity: 'Black Rebar (Restricted)',
      color: 'from-amber-600 via-orange-500 to-red-550',
      borderColor: 'border-orange-500/20',
      textColor: 'text-amber-400',
      strokeColor: '#f59e0b',
      barColor: 'bg-amber-500',
      gradientId: 'quad-sw-grad',
      glowColor: 'shadow-amber-500/10'
    },
    {
      key: 'SE',
      name: 'Southeast Sector',
      activity: 'CNC & Bending',
      color: 'from-purple-600 via-fuchsia-500 to-pink-550',
      borderColor: 'border-purple-500/20',
      textColor: 'text-purple-400',
      strokeColor: '#a855f7',
      barColor: 'bg-purple-500',
      gradientId: 'quad-se-grad',
      glowColor: 'shadow-purple-500/10'
    }
  ] as const;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="yard-map-root">
      
      {/* Page Title row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="font-sans text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="h-5 w-5 text-amber-500" />
            <span>Simcote saint Paul • plant layout Map</span>
          </h1>
          <p className="text-xxs text-slate-400 font-mono tracking-wider mt-0.5 uppercase">REAL-TIME POSITION FLAGGING • AUTO-POLLS 15s</p>
        </div>

        {/* Header Control Center with Quick Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 relative" id="header-controls">
          {/* Backdrop layer to capture close-dropdown events outside click */}
          {showDropdown && headerSearchVal.trim().length > 0 && (matchingBundles.length > 0 || matchingJobs.length > 0) && (
            <div className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setShowDropdown(false)} />
          )}

          {/* Quick Search Bar */}
          <div className="relative w-full sm:w-64 z-50" id="header-search-bar-wrapper">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              value={headerSearchVal}
              onChange={(e) => {
                setHeaderSearchVal(e.target.value);
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search Tag, Mark, Job..."
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-amber-500 focus:outline-hidden text-slate-200 font-mono text-xs pl-9 pr-8 py-2 rounded-lg transition-colors placeholder-slate-650 focus:ring-1 focus:ring-amber-500/20"
            />
            {headerSearchVal && (
              <button 
                type="button"
                onClick={() => {
                  setHeaderSearchVal('');
                  setSearchQuery('');
                  setSelectedZone(null);
                  setShowDropdown(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white font-mono font-bold hover:bg-slate-900 h-5 w-5 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                title="Clear Search"
              >
                ×
              </button>
            )}

            {/* Suggestions Dropdown Card */}
            {showDropdown && headerSearchVal.trim().length > 0 && (matchingBundles.length > 0 || matchingJobs.length > 0) && (
              <div className="absolute right-0 top-full mt-2 w-[280px] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-900 max-h-[300px] overflow-y-auto">
                {matchingBundles.length > 0 && (
                  <div className="py-2 px-3">
                    <span className="text-[8px] font-mono text-slate-550 uppercase tracking-widest font-black block mb-1.5 header-dropdown-title">Matching Bundles</span>
                    <div className="space-y-1">
                      {matchingBundles.map(b => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setHeaderSearchVal(b.tagId);
                            setSearchQuery(b.tagId);
                            setSelectedZone(b.location);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors flex items-center justify-between text-xxs font-mono cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-slate-200 block">{b.tagId}</span>
                            <span className="text-slate-500 text-[10px]">{b.mark} • {b.weight} lbs</span>
                          </div>
                          <div className="text-right">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20 text-[8px] uppercase">{b.location}</span>
                            <span className="block text-[8px] text-slate-405 mt-0.5">{b.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {matchingJobs.length > 0 && (
                  <div className="py-2 px-3">
                    <span className="text-[8px] font-mono text-slate-550 uppercase tracking-widest font-black block mb-1.5 header-dropdown-title">Matching Jobs</span>
                    <div className="space-y-1">
                      {matchingJobs.map(jobId => {
                        const jobBundles = bundles.filter(b => b.jobId === jobId);
                        const weight = jobBundles.reduce((s, b) => s + (b.weight || 0), 0);
                        const uniqueLocations = Array.from(new Set(jobBundles.map(b => b.location).filter(Boolean)));
                        return (
                          <button
                            key={jobId}
                            type="button"
                            onClick={() => {
                              setHeaderSearchVal(jobId);
                              setSearchQuery(jobId);
                              if (jobBundles.length > 0) {
                                setSelectedZone(jobBundles[0].location);
                              }
                              setShowDropdown(false);
                            }}
                            className="w-full text-left p-1.5 rounded-lg hover:bg-slate-900 hover:text-white transition-colors flex items-center justify-between text-xxs font-mono cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-amber-500 block">{jobId}</span>
                              <span className="text-slate-500 text-[10px]">{jobBundles.length} bundles • {weight.toLocaleString()} lbs</span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold text-[8px] uppercase shrink-0">
                              {uniqueLocations.slice(0, 2).join(', ')}{uniqueLocations.length > 2 ? '...' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={loadYardBundles}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-xxs font-mono tracking-wider text-slate-400 hover:text-amber-400 transition-colors cursor-pointer shrink-0 z-50 animate-fadeIn"
          >
            <RefreshCw className="h-3 w-3" />
            <span>REFRESH MAP</span>
          </button>
        </div>
      </div>

      {/* Main split: Visual Map (Left grid) and Zone Telemetry panel (Right pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Plant Map Blueprint (Grid) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5" id="saint-paul-floorplan">
            <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Facility Floor Blueprint overview</span>
              <span className="text-xxs font-mono text-slate-500 italic block">St Paul, MN Yard</span>
            </div>

            {/* Live Contextual Detail Panel */}
            <div className="mb-4 bg-slate-950/70 border border-slate-850/80 rounded-xl p-3.5 transition-all text-xs" id="blueprint-live-hover-panel">
              {activeFocusZoneData ? (
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-mono border uppercase tracking-wider font-bold ${
                        hoveredZone ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                      }`}>
                        {hoveredZone ? 'HOVERING' : 'SELECTED'}
                      </span>
                      <h4 className="font-mono font-bold text-white uppercase text-xs tracking-wide">{activeFocusZoneData.id}</h4>
                      <span className="text-[10px] text-slate-400 font-mono italic">• {activeFocusZoneData.desc}</span>
                      {activeFocusZoneBundles.some(b => {
                        const statusUpper = (b.status || '').toUpperCase();
                        return statusUpper === 'BENDING' || statusUpper === 'STAGED';
                      }) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-orange-500/15 text-orange-400 border border-orange-500/25 font-bold uppercase tracking-wider animate-pulse">
                          ⚠️ ACTIVE QUEUE
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xxs font-sans leading-relaxed">
                      Residing Stock: <span className="text-amber-450 font-mono font-bold">{activeFocusZoneBundles.length}</span> bundle(s) detected at this sector coordinate.
                    </p>
                  </div>

                  {activeFocusZoneBundles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-w-full md:max-w-md lg:max-w-xl">
                      {activeFocusZoneBundles.map((b) => (
                        <div 
                          key={b.id} 
                          className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-2.2 py-1 rounded-md text-[10px] font-mono flex items-center gap-1.5 transition-colors"
                          title={`${b.mark} | ${b.weight} lbs | Status: ${b.status}`}
                        >
                          <span className="text-slate-350 font-bold">{b.tagId}</span>
                          <span className={`text-[8px] px-1 rounded uppercase tracking-wider font-bold ${
                            b.grade === 'Epoxy' ? 'bg-teal-500/10 text-teal-400 border border-teal-555/15' : 'bg-slate-950 text-slate-500 border border-slate-900'
                          }`}>
                            {b.grade}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-550 italic uppercase tracking-widest self-start md:self-center">
                      No Active Bundle Inventory In Coords
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 text-slate-500 py-1">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <p className="text-[10px] font-mono tracking-wider uppercase">
                    Hover cursor or single-click any zone to inspect. Double-click any zone shape to expand into its dedicated full-screen Control Center.
                  </p>
                </div>
              )}
            </div>

            {/* S4. Interactive SVG Blueprint Layout representing Saint Paul Plant Floor */}
            <div className="relative overflow-x-auto overflow-y-hidden border border-slate-850/60 bg-slate-950/40 rounded-2xl p-3 md:p-4 mb-4" id="saint-paul-floorplan-blueprint-container">
              
              {/* Responsive Aspect Ratio Wrapper with Horizontal Scroll on Small Screen */}
              <div className="min-w-[850px] w-full" id="blueprint-svg-scroller">
                <svg 
                  viewBox="0 0 1000 520" 
                  className="w-full h-auto text-slate-400 select-none font-mono"
                  id="plant-layout-svg"
                >
                  <defs>
                    {/* Techno Blueprint Grid Pattern */}
                    <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148, 163, 184, 0.05)" strokeWidth="0.8" />
                    </pattern>
                    
                    {/* Glowing highlight filters for selected/hovered areas */}
                    <filter id="amber-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComponentTransfer in="blur" result="glow1">
                        <feFuncA type="linear" slope="0.6" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="glow1" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Outer Facility Background */}
                  <rect 
                    x="10" 
                    y="10" 
                    width="980" 
                    height="500" 
                    rx="12" 
                    ry="12" 
                    fill="#030712" 
                    stroke="rgba(71, 85, 105, 0.3)" 
                    strokeWidth="2"
                    id="outer-facility-wall"
                  />
                  <rect 
                    x="10" 
                    y="10" 
                    width="980" 
                    height="500" 
                    rx="12" 
                    ry="12" 
                    fill="url(#blueprint-grid)"
                    id="blueprint-grid-overlay"
                  />

                  {/* QUADRANT BOUNDARIES / VISUAL SECTORS */}
                  
                  {/* NW Sector Group */}
                  <g id="sector-nw-group">
                    <rect x="20" y="20" width="465" height="185" rx="8" fill="none" stroke="rgba(71, 85, 105, 0.15)" strokeWidth="1" />
                    <text x="32" y="38" fill="rgba(148, 163, 184, 0.45)" fontSize="9" fontWeight="bold">NW SECTOR • EPOXY SPECIALTY</text>
                  </g>

                  {/* NE Sector Group */}
                  <g id="sector-ne-group">
                    <rect x="515" y="20" width="465" height="185" rx="8" fill="none" stroke="rgba(71, 85, 105, 0.15)" strokeWidth="1" />
                    <text x="527" y="38" fill="rgba(148, 163, 184, 0.45)" fontSize="9" fontWeight="bold">NE SECTOR • EPOXY STORAGE & BAYS</text>
                  </g>

                  {/* Center Line Sector Group */}
                  <g id="sector-center-group">
                    <rect x="20" y="215" width="960" height="90" rx="8" fill="none" stroke="rgba(71, 85, 105, 0.15)" strokeWidth="1" />
                    <text x="32" y="231" fill="rgba(148, 163, 184, 0.45)" fontSize="9" fontWeight="bold">CORE PROCESS CENTERLINE • SIZING & COATING</text>
                  </g>

                  {/* SW Sector Group (Dashed warning stroke for Black Rebar Operations) */}
                  <g id="sector-sw-group">
                    <rect x="20" y="315" width="465" height="185" rx="8" fill="rgba(245, 158, 11, 0.015)" stroke="rgba(245, 158, 11, 0.25)" strokeDasharray="5,4" strokeWidth="1.5" />
                    <text x="32" y="333" fill="#f59e0b" fontSize="9" fontWeight="bold" className="animate-pulse">SW SECTOR • BLACK-REBAR SYSTEM (RESTRICTED)</text>
                  </g>

                  {/* SE Sector Group */}
                  <g id="sector-se-group">
                    <rect x="515" y="315" width="465" height="185" rx="8" fill="none" stroke="rgba(71, 85, 105, 0.15)" strokeWidth="1" />
                    <text x="527" y="333" fill="rgba(148, 163, 184, 0.45)" fontSize="9" fontWeight="bold">SE SECTOR • CNC PRODUCTION & BENDING</text>
                  </g>

                  {/* DYNAMIC PROCESSING ZONE EMBEDDED SHAPES */}
                  {[
                    // NW Quadrant Zones
                    { id: 'Crane-NW', label: 'GANTRY NW', cx: 32, cy: 52, cw: 135, ch: 60 },
                    { id: 'Rack J-04', label: 'RACK J-04', cx: 180, cy: 52, cw: 135, ch: 60 },
                    { id: 'Rack J-12', label: 'RACK J-12', cx: 328, cy: 52, cw: 135, ch: 60 },
                    { id: 'Door-1', label: 'DOOR-1 BAY', cx: 106, cy: 125, cw: 135, ch: 65 },
                    { id: 'Door-2', label: 'DOOR-2 BAY', cx: 254, cy: 125, cw: 135, ch: 65 },

                    // NE Quadrant Zones
                    { id: 'Crane-NE', label: 'GANTRY NE', cx: 833, cy: 52, cw: 135, ch: 60 },
                    { id: 'Rack K-1', label: 'RACK K-1', cx: 685, cy: 52, cw: 135, ch: 60 },
                    { id: 'Rack K-2', label: 'RACK K-2', cx: 537, cy: 52, cw: 135, ch: 60 },
                    { id: 'Door-3', label: 'DOOR-3 BAY', cx: 611, cy: 125, cw: 135, ch: 65 },
                    { id: 'North-End', label: 'NORTH-END', cx: 759, cy: 125, cw: 135, ch: 65 },

                    // Center Line Zones
                    { id: 'Coat-Station', label: 'COAT TUNNEL', cx: 32, cy: 242, cw: 215, ch: 50 },
                    { id: 'Shear-North', label: 'SHEAR NORTH', cx: 267, cy: 242, cw: 220, ch: 50 },
                    { id: 'Shear-Center', label: 'SHEAR CENTER', cx: 512, cy: 242, cw: 220, ch: 50 },
                    { id: 'Shear-South', label: 'SHEAR SOUTH', cx: 757, cy: 242, cw: 215, ch: 50 },

                    // SW Quadrant Zones (Constrained Black Rebar)
                    { id: 'Raw-SW', label: 'STOCK SW', cx: 32, cy: 345, cw: 135, ch: 65 },
                    { id: 'Crane-SW', label: 'CRANE SW', cx: 180, cy: 345, cw: 135, ch: 65 },
                    { id: 'Rack J-19', label: 'RACK J-19', cx: 328, cy: 345, cw: 135, ch: 65 },
                    { id: 'Rack L-8', label: 'RACK L-8', cx: 32, cy: 422, cw: 135, ch: 65 },
                    { id: 'Door-7', label: 'DOOR-7 BAY', cx: 180, cy: 422, cw: 135, ch: 65 },
                    { id: 'Door-8', label: 'DOOR-8 BAY', cx: 328, cy: 422, cw: 135, ch: 65 },

                    // SE Quadrant Zones (Production Operations)
                    { id: 'Crane-SE', label: 'GANTRY SE', cx: 527, cy: 345, cw: 135, ch: 65 },
                    { id: 'Rack J-15', label: 'RACK J-15', cx: 675, cy: 345, cw: 135, ch: 65 },
                    { id: 'Rack L-1', label: 'RACK L-1', cx: 823, cy: 345, cw: 135, ch: 65 },
                    { id: 'Bender-New-Robo', label: 'NEW-ROBO CNC', cx: 601, cy: 422, cw: 135, ch: 65 },
                    { id: 'Bender-11-Bender', label: '11-BENDER', cx: 749, cy: 422, cw: 135, ch: 65 }
                  ].map((zone) => {
                    const cnt = getBundleCount(zone.id);
                    const isSelected = selectedZone === zone.id;
                    const isHovered = hoveredZone === zone.id;
                    const isFocus = activeFocusZoneId === zone.id;

                    const isRouteOrigin = routeOrigin === zone.id;
                    const isRouteDest = routeDestination === zone.id;
                    const isObstruction = routeAnalysis.obstructions.some(obs => obs.zoneId === zone.id);
                    const specificObstruction = routeAnalysis.obstructions.find(obs => obs.zoneId === zone.id);

                    const totalWeight = getZoneWeight(zone.id);
                    const hasBundles = cnt > 0;

                    const zoneBundles = getBundlesAtZone(zone.id);
                    const hasActiveQueue = zoneBundles.some(b => {
                      const statusUpper = (b.status || '').toUpperCase();
                      return statusUpper === 'BENDING' || statusUpper === 'STAGED';
                    });
                    
                    // State Styling properties
                    let fill = 'rgba(16, 185, 129, 0.05)'; // Emerald Clear
                    let stroke = '#10b981';
                    let strokeWidth = '1';
                    let filter = '';
                    let beaconColor = hasBundles ? '#ef4444' : '#10b981';

                    let hasSearchQueryMatch = false;
                    if (searchQuery && searchQuery.trim().length > 0) {
                      const lowercaseSearch = searchQuery.toLowerCase();
                      hasSearchQueryMatch = getBundlesAtZone(zone.id).some(b => 
                        b.tagId.toLowerCase().includes(lowercaseSearch) ||
                        b.id.toLowerCase().includes(lowercaseSearch) ||
                        b.jobId.toLowerCase().includes(lowercaseSearch) ||
                        (b.mark || '').toLowerCase().includes(lowercaseSearch) ||
                        b.location.toLowerCase().includes(lowercaseSearch)
                      );
                    }

                    if (hasSearchQueryMatch) {
                      fill = 'rgba(234, 179, 8, 0.45)'; // High prominence amber background
                      stroke = '#f59e0b'; // Gold border
                      strokeWidth = '3';
                      filter = 'url(#amber-glow)';
                      beaconColor = '#f59e0b';
                    } else if (isFocus) {
                      fill = 'rgba(245, 158, 11, 0.20)'; // Focus Gold
                      stroke = '#f59e0b';
                      strokeWidth = '2.5';
                      filter = 'url(#amber-glow)';
                    } else if (isHeatmapMode) {
                      if (totalWeight > 0) {
                        const ratio = totalWeight / getZoneMaxCapacity(zone.id);
                        if (ratio <= 0.25) {
                          // Low load: Yellow-Amber
                          fill = 'rgba(234, 179, 8, 0.14)';
                          stroke = '#eab308';
                          strokeWidth = '1.2';
                          beaconColor = '#eab308';
                        } else if (ratio <= 0.55) {
                          // Medium load: Bright Orange
                          fill = 'rgba(249, 115, 22, 0.20)';
                          stroke = '#f97316';
                          strokeWidth = '1.5';
                          beaconColor = '#f97316';
                        } else if (ratio <= 0.85) {
                          // High load: Red-Orange
                          fill = 'rgba(239, 68, 68, 0.26)';
                          stroke = '#ef4444';
                          strokeWidth = '1.8';
                          beaconColor = '#ef4444';
                        } else {
                          // Extreme load: High Crimson-Rose
                          fill = 'rgba(225, 29, 72, 0.36)';
                          stroke = '#e11d48';
                          strokeWidth = '2.2';
                          beaconColor = '#e11d48';
                        }
                      }
                    } else if (hasBundles) {
                      fill = 'rgba(239, 68, 68, 0.14)'; // Occupied Red
                      stroke = '#ef4444';
                      strokeWidth = '1.5';
                    }

                    // Path planning style overrides
                    if (isRouteOrigin) {
                      fill = 'rgba(16, 185, 129, 0.18)'; // Green node
                      stroke = '#10b981';
                      strokeWidth = '3.5';
                      filter = 'url(#amber-glow)';
                    } else if (isRouteDest) {
                      fill = 'rgba(59, 130, 246, 0.18)'; // Blue node
                      stroke = '#3b82f6';
                      strokeWidth = '3.5';
                      filter = 'url(#amber-glow)';
                    } else if (isObstruction) {
                      if (specificObstruction?.type === 'CRITICAL') {
                        fill = 'rgba(239, 68, 68, 0.22)'; // Transparent high red danger
                        stroke = '#ef4444'; // Solid Crimson
                        strokeWidth = '2.5';
                      } else {
                        fill = 'rgba(245, 158, 11, 0.22)'; // Transparent amber warning
                        stroke = '#f59e0b'; // Solid gold
                        strokeWidth = '2';
                      }
                    }

                    return (
                      <motion.g 
                        key={zone.id}
                        id={`zone-shape-${zone.id}`}
                        onClick={() => {
                          if (isRoutingActive) {
                            if (!routeOrigin) {
                              setRouteOrigin(zone.id);
                            } else if (!routeDestination) {
                              if (zone.id === routeOrigin) {
                                setRouteOrigin(null);
                              } else {
                                setRouteDestination(zone.id);
                              }
                            } else {
                              setRouteOrigin(zone.id);
                              setRouteDestination(null);
                            }
                          } else {
                            setSelectedZone(zone.id);
                          }
                        }}
                        onDoubleClick={() => setDoubleClickedZoneId(zone.id)}
                        onMouseEnter={() => setHoveredZone(zone.id)}
                        onMouseLeave={() => setHoveredZone(null)}
                        className="cursor-pointer group select-none"
                        style={{ transformOrigin: `${zone.cx + zone.cw / 2}px ${zone.cy + zone.ch / 2}px` }}
                        whileHover={{ scale: 1.02, filter: 'brightness(1.12)' }}
                        whileTap={{ scale: 0.95 }}
                        animate={isSelected ? { 
                          scale: [1, 1.08, 0.95, 1.03, 1.02],
                        } : { 
                          scale: 1,
                        }}
                        transition={{ 
                          scale: isSelected ? {
                            type: 'keyframes',
                            duration: 0.6,
                            ease: 'easeInOut'
                          } : {
                            type: 'spring',
                            stiffness: 380,
                            damping: 14
                          }
                        }}
                      >
                        {/* Interactive Zone Shape Rect */}
                        <rect 
                           x={zone.cx}
                           y={zone.cy}
                           width={zone.cw}
                           height={zone.ch}
                           rx="6"
                           ry="6"
                           fill={fill}
                           stroke={stroke}
                           strokeWidth={strokeWidth}
                           strokeDasharray={isObstruction ? "5,3" : undefined}
                           filter={filter}
                           id={`rect-zone-${zone.id}`}
                           className="transition-all duration-300"
                        />

                        {/* High-Contrast Active Work Queue Outline */}
                        {hasActiveQueue && (
                          <rect 
                            x={zone.cx - 3.5}
                            y={zone.cy - 3.5}
                            width={zone.cw + 7}
                            height={zone.ch + 7}
                            rx="8.5"
                            ry="8.5"
                            fill="none"
                            stroke="#f97316" // Vibrant high-contrast orange-500
                            strokeWidth="2.5"
                            strokeDasharray="5,3"
                            className="pointer-events-none animate-pulse"
                            id={`active-queue-border-${zone.id}`}
                          />
                        )}

                        {/* Text Label - Header */}
                        <text 
                          x={zone.cx + 10}
                          y={zone.cy + 22}
                          fontSize="9.5"
                          fontWeight="bold"
                          className="transition-colors duration-200"
                          fill={isFocus ? '#f59e0b' : '#f8fafc'}
                          id={`text-label-${zone.id}`}
                        >
                          {zone.label}
                        </text>

                        {/* Text Label - Packet Count or Dynamic Weight */}
                        <text 
                          x={zone.cx + 10}
                          y={zone.cy + 43}
                          fontSize={isHeatmapMode && totalWeight > 0 ? "11.5" : "12.5"}
                          fontWeight="900"
                          fill={isFocus ? '#d97706' : (hasBundles ? (isHeatmapMode ? '#fca5a5' : '#f87171') : '#34d399')}
                          id={`text-count-${zone.id}`}
                        >
                          {isHeatmapMode ? (
                            totalWeight > 0 ? (
                              <>
                                {totalWeight.toLocaleString()} <tspan fontSize="8" fontWeight="400" fill="#cbd5e1">LBS</tspan>
                              </>
                            ) : (
                              <>
                                0 <tspan fontSize="8" fontWeight="400" fill="#a7f3d0">LBS</tspan>
                              </>
                            )
                          ) : (
                            <>
                              {cnt} <tspan fontSize="8.5" fontWeight="400" fill={hasBundles ? '#fca5a5' : '#a7f3d0'}>PKGS</tspan>
                            </>
                          )}
                        </text>

                        {/* Status Beacon Indicator */}
                        <circle 
                          cx={zone.cx + zone.cw - 16}
                          cy={zone.cy + 16}
                          r={hasBundles ? '4.5' : '3.5'}
                          fill={beaconColor}
                          id={`beacon-circle-${zone.id}`}
                          className={hasBundles ? 'animate-pulse' : ''}
                        />
                        {hasBundles && (
                          <circle 
                            cx={zone.cx + zone.cw - 16}
                            cy={zone.cy + 16}
                            r="8"
                            fill="none"
                            stroke={beaconColor}
                            strokeWidth="1.2"
                            className="opacity-50 animate-ping"
                          />
                        )}

                        {isRouteOrigin && (
                          <g id={`badge-origin-${zone.id}`} className="pointer-events-none">
                            <rect 
                              x={zone.cx + zone.cw - 65} 
                              y={zone.cy + zone.ch - 18} 
                              width="58" 
                              height="12" 
                              rx="3" 
                              fill="#10b981" 
                            />
                            <text 
                              x={zone.cx + zone.cw - 36} 
                              y={zone.cy + zone.ch - 9} 
                              fontSize="7" 
                              fontWeight="900" 
                              fill="#030712" 
                              textAnchor="middle" 
                              className="font-mono tracking-tight"
                            >
                              START NODE
                            </text>
                          </g>
                        )}
                        {isRouteDest && (
                          <g id={`badge-dest-${zone.id}`} className="pointer-events-none">
                            <rect 
                              x={zone.cx + zone.cw - 65} 
                              y={zone.cy + zone.ch - 18} 
                              width="58" 
                              height="12" 
                              rx="3" 
                              fill="#3b82f6" 
                            />
                            <text 
                              x={zone.cx + zone.cw - 36} 
                              y={zone.cy + zone.ch - 9} 
                              fontSize="7" 
                              fontWeight="900" 
                              fill="#030712" 
                              textAnchor="middle" 
                              className="font-mono tracking-tight"
                            >
                              TERM NODE
                            </text>
                          </g>
                        )}
                      </motion.g>
                    );
                  })}

                  {/* Dynamic Travel Route Vector Layer */}
                  {routeOrigin && routeDestination && zoneCoords[routeOrigin] && zoneCoords[routeDestination] && (
                    <g id="route-planner-layer" className="pointer-events-none">
                      {/* Inner glowing route track shadow */}
                      <path 
                        d={routeAnalysis.pathD}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#amber-glow)"
                        className="animate-pulse"
                        id="route-gantry-track-glow"
                      />
                      
                      {/* Outer dashed flow line with animated offset */}
                      <motion.path 
                        d={routeAnalysis.pathD}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="8,6"
                        animate={{ strokeDashoffset: [0, -100] }}
                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                        id="route-gantry-track-flow"
                      />

                      {/* Moving Gantry Trolley Indicator */}
                      <motion.circle 
                        cx={zoneCoords[routeOrigin].cx + zoneCoords[routeOrigin].cw / 2}
                        cy={zoneCoords[routeOrigin].cy + zoneCoords[routeOrigin].ch / 2}
                        r="7"
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        id="gantry-animated-trolley"
                        animate={{
                          cx: [
                            zoneCoords[routeOrigin].cx + zoneCoords[routeOrigin].cw / 2,
                            zoneCoords[routeDestination].cx + zoneCoords[routeDestination].cw / 2,
                            zoneCoords[routeDestination].cx + zoneCoords[routeDestination].cw / 2
                          ],
                          cy: [
                            zoneCoords[routeOrigin].cy + zoneCoords[routeOrigin].ch / 2,
                            zoneCoords[routeOrigin].cy + zoneCoords[routeOrigin].ch / 2,
                            zoneCoords[routeDestination].cy + zoneCoords[routeDestination].ch / 2
                          ]
                        }}
                        transition={{
                          duration: 5,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </g>
                  )}
                </svg>
              </div>

            </div>

            {/* Real-time Quadrant Load Weight Distribution Chart Block */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 mb-6 shadow-xl" id="quadrant-load-weights-distribution-block">
              {/* Header Title Panel */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-950 pb-3 mb-4 gap-2">
                <div className="space-y-0.5">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-indigo-400 font-extrabold flex items-center gap-1.5">
                    <BarChart2 className="h-4 w-4 text-indigo-500" />
                    REAL-TIME PLANT SECTOR LOGISTICS
                  </span>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    QUADRANT LOAD BURDEN DISTRIBUTION
                  </h3>
                  <p className="text-[10px] text-slate-450 leading-relaxed max-w-xl">
                    Aggregates rebar load weights (LBS) across Northwest, Northeast, Southwest, and Southeast plant-yard sectors in real-time.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-extrabold block">Total Active Inventory</span>
                  <span className="text-xs font-black text-slate-200 block font-mono">
                    {bundles.reduce((sum, b) => sum + (b.weight || 0), 0).toLocaleString()} <span className="text-[8px] font-normal text-indigo-400">LBS</span>
                  </span>
                </div>
              </div>

              {/* Grid Content with Interactive SVG Chart & Detailed Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* SVG Vertical Columns Bar Chart */}
                <div className="lg:col-span-5 bg-slate-950/80 border border-indigo-950/40 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-1.5">
                    <span className="text-[8.5px] uppercase tracking-wider text-slate-400 font-extrabold font-mono">
                      Sector Burden Bar Graph
                    </span>
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      *Interactive columns - hover for detail
                    </span>
                  </div>

                  <div className="relative w-full h-[180px] flex items-center justify-center font-mono">
                    {/* Render standard custom pure React SVG Bar chart */}
                    {(() => {
                      const maxWeightInQuads = Math.max(...quadrantsConfig.map(q => quadrantInfoMap[q.key].weight), 45000);
                      const chartMaxLimit = Math.ceil(maxWeightInQuads / 50000) * 50000;
                      const drawHeight = 110;
                      const yStart = 25;

                      return (
                        <svg viewBox="0 0 340 180" className="w-full h-full text-slate-400 font-mono select-none">
                          <defs>
                            {/* Gradients matching quadrant colors */}
                            {quadrantsConfig.map((q) => (
                              <linearGradient key={`grad-${q.key}`} id={q.gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={q.strokeColor} stopOpacity={0.95} />
                                <stop offset="100%" stopColor={q.strokeColor} stopOpacity={0.25} />
                              </linearGradient>
                            ))}
                          </defs>

                          {/* Grid Y-axis Guide Lines and Labels */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = chartMaxLimit * ratio;
                            const y = yStart + drawHeight * (1 - ratio);
                            return (
                              <g key={`y-guide-${ratio}`}>
                                <line 
                                  x1="65" 
                                  y1={y} 
                                  x2="320" 
                                  y2={y} 
                                  stroke="rgba(148, 163, 184, 0.08)" 
                                  strokeWidth="1" 
                                  strokeDasharray="3,3" 
                                />
                                <text 
                                  x="58" 
                                  y={y + 3.5} 
                                  textAnchor="end" 
                                  fontSize="7" 
                                  className="fill-slate-500 font-mono font-bold"
                                >
                                  {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`} LBS
                                </text>
                              </g>
                            );
                          })}

                          {/* 4 Columns (NW, NE, SW, SE) */}
                          {quadrantsConfig.map((q, idx) => {
                            const stats = quadrantInfoMap[q.key];
                            const barHeight = stats.weight > 0 ? (stats.weight / chartMaxLimit) * drawHeight : 2; // at least 2px height
                            const barWidth = 34;
                            const x = 85 + idx * 60;
                            const y = (yStart + drawHeight) - barHeight;
                            const isHovered = hoveredQuadrant === q.key;

                            return (
                              <g 
                                key={`bar-group-${q.key}`} 
                                className="cursor-pointer transition-all duration-200"
                                onMouseEnter={() => setHoveredQuadrant(q.key)}
                                onMouseLeave={() => setHoveredQuadrant(null)}
                              >
                                {/* Column glow on hover */}
                                {isHovered && (
                                  <rect
                                    x={x - 4}
                                    y={y - 4}
                                    width={barWidth + 8}
                                    height={barHeight + 8}
                                    rx="4"
                                    ry="4"
                                    fill={q.strokeColor}
                                    fillOpacity="0.08"
                                    className="transition-all"
                                  />
                                )}

                                {/* Main Bar Rect */}
                                <rect
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={barHeight}
                                  rx="3"
                                  ry="3"
                                  fill={`url(#${q.gradientId})`}
                                  stroke={isHovered ? '#ffffff' : q.strokeColor}
                                  strokeWidth={isHovered ? '1.5' : '1'}
                                  className="transition-all duration-350"
                                />

                                {/* Interactive Text details hovered directly above the bar */}
                                {isHovered && (
                                  <g className="pointer-events-none">
                                    <rect 
                                      x={x - 12} 
                                      y={y - 20} 
                                      width={barWidth + 24} 
                                      height={14} 
                                      rx="3" 
                                      fill="#030712" 
                                      stroke={q.strokeColor} 
                                      strokeWidth="1" 
                                    />
                                    <text 
                                      x={x + barWidth / 2} 
                                      y={y - 10} 
                                      textAnchor="middle" 
                                      fontSize="7" 
                                      fontWeight="bold" 
                                      fill="#ffffff"
                                    >
                                      {stats.weight.toLocaleString()} LBS
                                    </text>
                                  </g>
                                )}

                                {/* X-axis Labels */}
                                <text 
                                  x={x + barWidth / 2} 
                                  y={yStart + drawHeight + 14} 
                                  textAnchor="middle" 
                                  fontSize="9" 
                                  fontWeight="bold"
                                  className={`${isHovered ? q.textColor : 'fill-slate-400'} font-mono`}
                                >
                                  {q.key}
                                </text>
                                <text 
                                  x={x + barWidth / 2} 
                                  y={yStart + drawHeight + 22} 
                                  textAnchor="middle" 
                                  fontSize="6.5" 
                                  className="fill-slate-600 font-mono"
                                >
                                  {stats.pkgs} PKGS
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* Grid Lists / Quadrant Bento cards detailing load weights and status warnings */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {quadrantsConfig.map((q) => {
                    const stats = quadrantInfoMap[q.key];
                    const usageRatio = stats.capacity > 0 ? stats.weight / stats.capacity : 0;
                    const usagePercent = Math.min(100, usageRatio * 100);
                    const isHighBurden = usageRatio >= 0.75;
                    const isHovered = hoveredQuadrant === q.key;

                    // Get list of zones belonging to this quadrant
                    const belongsZones = Object.keys(zoneQuadrants).filter(
                      (zId) => zoneQuadrants[zId] === q.key
                    );

                    return (
                      <div 
                        key={`bento-quad-${q.key}`}
                        className={`bg-slate-950/60 p-3.5 border rounded-xl font-mono flex flex-col justify-between transition-all duration-300 ${
                          isHovered 
                            ? 'border-indigo-500 ring-1 ring-indigo-500/20 transform scale-[1.015] bg-slate-900/40XY' // wait let's use bg-slate-900/60 on hover too
                            : q.borderColor + ' bg-slate-950/60'
                        }`}
                        onMouseEnter={() => setHoveredQuadrant(q.key)}
                        onMouseLeave={() => setHoveredQuadrant(null)}
                      >
                        {/* Title Row */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-black ${q.textColor} uppercase flex items-center gap-1.5`}>
                              <span className={`h-2 w-2 rounded-full ${q.barColor} ${isHovered ? 'animate-ping' : ''}`} />
                              {q.name}
                            </span>
                            {isHighBurden && (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[6.5px] px-1 py-0.5 rounded font-black tracking-widest uppercase animate-pulse">
                                ⚠️ HIGH BURDEN
                              </span>
                            )}
                          </div>
                          <span className="text-[7.5px] text-slate-500 block uppercase font-bold tracking-wider leading-none">
                            {q.activity}
                          </span>
                        </div>

                        {/* Middle Info Stats row */}
                        <div className="my-3 flex justify-between items-end">
                          <div>
                            <span className="text-[8px] text-slate-500 uppercase leading-none block font-bold mb-0.5">LOAD WEIGHT</span>
                            <span className="text-sm font-black text-slate-100 block">
                              {stats.weight.toLocaleString()} <span className="text-[9px] font-normal text-indigo-400 font-bold">LBS</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] text-slate-500 uppercase leading-none block font-bold mb-0.5 font-bold">UTILITY RATIO</span>
                            <span className={`text-xxs font-black block ${
                              isHighBurden ? 'text-rose-400 animate-pulse' : 'text-slate-350'
                            }`}>
                              {usagePercent.toFixed(1)}% <span className="text-[7px] font-normal text-slate-500">CAP</span>
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Area */}
                        <div className="w-full bg-slate-900/80 h-1.5 rounded-full overflow-hidden mb-3 border border-slate-950">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHighBurden 
                                ? 'bg-gradient-to-r from-red-650 to-rose-455 animate-pulse' 
                                : `bg-gradient-to-r ${q.color}`
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>

                        {/* Footer Section / Zones and Package Count indicators */}
                        <div className="border-t border-slate-900/65 pt-2 flex items-center justify-between text-[8px] text-slate-450 gap-1.5 overflow-hidden">
                          <div className="truncate shrink">
                            Zones: <span className="text-slate-300 font-normal">{belongsZones.slice(0, 3).join(', ')}{belongsZones.length > 3 ? '...' : ''}</span>
                          </div>
                          <div className="text-right font-black shrink-0 uppercase text-slate-350">
                            {stats.pkgs} {stats.pkgs === 1 ? 'PKG' : 'PKGS'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gantry Path-Drawing & travel Route Planner Panel */}
            <div className="bg-slate-900/60 p-5 border border-slate-805 rounded-2xl mb-6 shadow-2xl" id="gantry-route-planner-panel">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-950 pb-3.5 mb-4.5 gap-3">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-indigo-400 font-extrabold flex items-center gap-1.5">
                    <Compass className="h-4 w-4 animate-spin-slow text-amber-500" />
                    Overhead Gantry Crane Route Planner
                  </span>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Gantry Travel Route Selector & Collision Guard
                  </h3>
                  <p className="text-[10px] text-slate-450 leading-relaxed max-w-xl">
                    Statically evaluates runway longitudinal tracks & lateral trolley bridge travel sequences, identifying physical corridor conflicts and Cleanroom compliance errors.
                  </p>
                </div>

                <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRoutingActive(!isRoutingActive);
                      // Clear existing routes if turning off
                      if (isRoutingActive) {
                        setRouteOrigin(null);
                        setRouteDestination(null);
                      }
                    }}
                    className={`px-3 py-2 text-[10px] font-mono font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer shadow-md ${
                      isRoutingActive
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600 animate-pulse'
                        : 'bg-slate-950 text-slate-350 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {isRoutingActive ? '🛑 Active Map Selector' : '🎯 Activate Map Selector'}
                  </button>
                  <p className="text-[8px] font-mono text-slate-500 uppercase tracking-tight text-center sm:text-right">
                    {isRoutingActive ? 'Click any blueprint sector to load start/term nodes' : 'Select terminals manually or activate click selector'}
                  </p>
                </div>
              </div>

              {/* Dynamic Inputs grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 block mb-1.5 font-extrabold">Origin Station Start Node</label>
                  <select
                    value={routeOrigin || ''}
                    onChange={(e) => setRouteOrigin(e.target.value || null)}
                    className="w-full bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-xxs font-mono text-slate-300 focus:border-amber-500 focus:outline-hidden cursor-pointer h-10 align-middle"
                  >
                    <option value="">-- Choose Start Zone --</option>
                    {Object.keys(zoneCoords).sort().map(zid => (
                      <option key={`origin-opt-${zid}`} value={zid}>
                        {zid} ({zoneCoords[zid].label})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 block mb-1.5 font-extrabold">Destination Term Terminal Node</label>
                  <select
                    value={routeDestination || ''}
                    onChange={(e) => setRouteDestination(e.target.value || null)}
                    className="w-full bg-slate-950 border border-slate-855 p-2.5 rounded-lg text-xxs font-mono text-slate-300 focus:border-amber-500 focus:outline-hidden cursor-pointer h-10 align-middle"
                  >
                    <option value="">-- Choose Destination --</option>
                    {Object.keys(zoneCoords).sort().map(zid => (
                      <option key={`dest-opt-${zid}`} value={zid}>
                        {zid} ({zoneCoords[zid].label})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-mono uppercase tracking-widest text-slate-400 block mb-1.5 font-extrabold">Simulated Cargo Material Class</label>
                  <select
                    value={routeMaterialType}
                    onChange={(e) => setRouteMaterialType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-855 p-2.5 rounded-lg text-xxs font-mono text-slate-300 focus:border-amber-500 focus:outline-hidden cursor-pointer h-10 align-middle"
                  >
                    <option value="ALL">All Rebar Grades (Unchecked Filter)</option>
                    <option value="Epoxy">Epoxy Coated Simcote Grade</option>
                    <option value="Black">Carbon steel Black Rebar Grade</option>
                  </select>
                </div>
              </div>



              {/* Travel Path details panel (Display Only if origin & destination provided) */}
              {routeOrigin && routeDestination ? (() => {
                const totalSpan = routeAnalysis.dX + routeAnalysis.dY;
                // Velocities
                const runwayFps = 150 / 60; // 2.5 ft/sec
                const bridgeFps = 90 / 60;  // 1.5 ft/sec
                const cycleTime = (routeAnalysis.dX / runwayFps) + (routeAnalysis.dY / bridgeFps);

                return (
                  <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-950 p-4 border border-indigo-950/40 rounded-xl font-mono text-center">
                      <div className="space-y-0.5 border-r border-slate-900">
                        <span className="text-[8px] uppercase text-slate-500 block font-bold leading-none">Runway Travel (Horiz)</span>
                        <span className="text-slate-200 text-xs font-black block mt-1">
                          {routeAnalysis.dX.toFixed(0)} <span className="text-[8px] font-normal text-slate-500">FT</span>
                        </span>
                        <span className="text-[7.5px] text-slate-600 block italic leading-none">Index Rate: 150 FPM</span>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-900">
                        <span className="text-[8px] uppercase text-slate-500 block font-bold leading-none">Bridge Travel (Vert)</span>
                        <span className="text-slate-200 text-xs font-black block mt-1">
                          {routeAnalysis.dY.toFixed(0)} <span className="text-[8px] font-normal text-slate-500">FT</span>
                        </span>
                        <span className="text-[7.5px] text-slate-600 block italic leading-none">Index Rate: 90 FPM</span>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-900">
                        <span className="text-[8px] uppercase text-slate-500 block font-bold leading-none">Combined Travel Span</span>
                        <span className="text-slate-400 text-xs font-black block mt-1">
                          {totalSpan.toFixed(0)} <span className="text-[8px] font-normal text-indigo-400">FT</span>
                        </span>
                        <span className="text-[7.5px] text-slate-650 block leading-none">Coordinate Distance Sum</span>
                      </div>
                      <div className="space-y-0.5 border-r border-slate-900">
                        <span className="text-[8px] uppercase text-slate-500 block font-bold leading-none">Ideal Time</span>
                        <span className="text-teal-400 text-xs font-black block mt-1">
                          {routeAnalysis.idealTime.toFixed(1)} <span className="text-[8px] font-normal text-slate-500">SEC</span>
                        </span>
                        <span className="text-[7.5px] text-slate-650 block leading-none">Zero-Density Airways</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase text-amber-500 block font-black leading-none">Predictive Slew Time</span>
                        <span className="text-amber-400 text-xs font-black block mt-1 animate-pulse">
                          {routeAnalysis.predictedTime.toFixed(1)} <span className="text-[8px] font-normal text-amber-500">SEC</span>
                        </span>
                        <span className="text-[7.5px] text-slate-600 block leading-none">Dynamic Pile Burden</span>
                      </div>
                    </div>

                    {/* Predictive Journey Slew Analytics Breakdown */}
                    <div className="bg-slate-950 p-4 border border-slate-900 rounded-xl font-mono">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-2.5 mb-4 gap-2">
                        <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                          <Compass className="h-4 w-4 text-indigo-500" />
                          ROUTE TRANSIT TIME ESTIMATES
                        </span>
                        <span className="text-[8px] text-slate-500 uppercase">
                          Average Gantry Speed: <span className="text-slate-350">120 FPM Typical</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Interactive math parameters */}
                        <div className="lg:col-span-5 space-y-3 lg:border-r lg:border-slate-900/40 pr-0 lg:pr-5">
                          <span className="text-[8.5px] tracking-wider text-slate-400 font-extrabold uppercase block mb-1">
                            Transit Delay Breakdown
                          </span>

                          <div className="space-y-2 text-[10px]">
                            {/* ideal index */}
                            <div className="flex justify-between items-center bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-900/60">
                              <span className="text-slate-400">Mechanical Limit traverse:</span>
                              <span className="text-slate-250">{routeAnalysis.idealTime.toFixed(1)}s</span>
                            </div>

                            {/* acceleration profiles */}
                            <div className="flex justify-between items-center bg-slate-900/40 px-2.5 py-1.5 rounded border border-slate-900/60">
                              <span className="text-slate-400">Ramps / Start-Stop Buffers:</span>
                              <span className="text-slate-250">+{routeAnalysis.rampTime.toFixed(1)}s</span>
                            </div>

                            {/* load density pile burden */}
                            <div className={`flex justify-between items-center px-2.5 py-1.5 rounded border ${
                              routeAnalysis.densitySlewPenalty > 0
                                ? 'bg-amber-500/5 border-amber-500/10 text-amber-500'
                                : 'bg-slate-900/40 border-slate-900/60 text-slate-400'
                            }`}>
                              <span>High-Density Pile Slowdowns:</span>
                              <span className={routeAnalysis.densitySlewPenalty > 0 ? 'font-bold' : ''}>
                                +{routeAnalysis.densitySlewPenalty.toFixed(1)}s
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Crossed sectors visual grid breakdown */}
                        <div className="lg:col-span-7 space-y-3.5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8.5px] tracking-wider text-slate-400 font-extrabold uppercase">
                                Traversed Runway Corridor Sectors ({routeAnalysis.crossedZonesCount})
                              </span>
                              <span className="text-[8px] text-slate-500 uppercase">
                                Active Burden Factor
                              </span>
                            </div>

                            {routeAnalysis.crossedZonesSummary.length === 0 ? (
                              <div className="p-5 border border-dashed border-slate-900 bg-slate-950/40 text-center rounded-xl text-slate-500 text-xxs">
                                🌬️ Traversed runway airspace completely clear. Safe rapid corridor flight.
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[145px] overflow-y-auto pr-1">
                                {routeAnalysis.crossedZonesSummary.map((zone) => (
                                  <div key={`crossed-${zone.id}`} className="bg-slate-900/40 border border-slate-905 p-2 rounded-lg text-xxs">
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-slate-300">{zone.name}</span>
                                        <span className="text-[8px] text-slate-500">({zone.id})</span>
                                      </div>
                                      <span className={`text-[9.5px] font-black ${
                                        zone.ratio >= 0.7 ? 'text-rose-400' : zone.ratio >= 0.4 ? 'text-amber-400' : 'text-teal-400'
                                      }`}>
                                        +{(zone.delay).toFixed(1)}s Delay
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-[8px] text-slate-450">
                                      <div>
                                        Weight: <span className="text-slate-300 font-bold font-mono">{zone.weight.toLocaleString()} LBS</span>
                                      </div>
                                      <div className="text-right">
                                        Density: <span className={`font-bold font-mono ${
                                          zone.ratio >= 0.7 ? 'text-rose-400' : zone.ratio >= 0.4 ? 'text-amber-400' : 'text-teal-400'
                                        }`}>{(zone.ratio * 100).toFixed(0)}% Cap</span>
                                      </div>
                                    </div>

                                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mt-1.5">
                                      <div 
                                        className={`h-full rounded-full ${
                                          zone.ratio >= 0.7 ? 'bg-rose-500' : zone.ratio >= 0.4 ? 'bg-amber-500' : 'bg-teal-500'
                                        }`}
                                        style={{ width: `${Math.min(100, zone.ratio * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Proximity Obstruction List */}
                    <div className="border border-slate-900 bg-slate-950/40 rounded-xl p-4">
                      <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3.5">
                        <span className="text-[10px] font-mono text-slate-350 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                          <HardHat className="h-4 w-4 text-amber-500" />
                          Live Corridor Obstruction guard System
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-black ${
                          routeAnalysis.obstructions.length > 0 
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {routeAnalysis.obstructions.length} ISSUES IDENTIFIED
                        </span>
                      </div>

                      {routeAnalysis.obstructions.length === 0 ? (
                        <div className="p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 rounded-lg text-xxs font-mono leading-relaxed select-none">
                          ✓ <span className="font-bold">CORRIDOR RECON COMPLETE:</span> Zero geometrical or payload clearance conflicts detected. Overhead travel track is certified clear. Gantry crane operator may execute travel command.
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {routeAnalysis.obstructions.map((obs, idx) => (
                            <div 
                              key={`route-obs-${idx}`} 
                              className={`p-3 border rounded-xl font-mono text-[10px] flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                obs.type === 'CRITICAL'
                                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/5 border-amber-500/20 text-amber-500'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest ${
                                    obs.type === 'CRITICAL'
                                      ? 'bg-rose-500 text-slate-950'
                                      : 'bg-amber-500 text-slate-950'
                                  }`}>
                                    {obs.type}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] text-white font-extrabold uppercase bg-slate-900 border border-slate-805`}>
                                    {obs.name}
                                  </span>
                                  <span className="font-extrabold">{obs.reason}</span>
                                </div>
                                <p className="text-[10px] text-slate-350 leading-relaxed font-sans">{obs.desc}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedZone(obs.zoneId)}
                                className="px-2 py-1 max-w-max border border-slate-800 text-[8px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-900 rounded cursor-pointer transition-colors shrink-0"
                              >
                                View Sector Telemetry →
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Execute Gantry Move Interlock Controls */}
                      <div className="mt-4 pt-3.5 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono">
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-400 block uppercase tracking-wide font-extrabold">
                            Security Interlock Status:
                          </span>
                          <span className={`text-[10px] font-extrabold flex items-center gap-1.5 ${
                            routeAnalysis.obstructions.some(obs => obs.type === 'CRITICAL')
                              ? 'text-rose-500' 
                              : 'text-emerald-400 font-black animate-pulse'
                          }`}>
                            {routeAnalysis.obstructions.some(obs => obs.type === 'CRITICAL') ? (
                              <>🛑 ENFORCED SHUTDOWN (CRITICAL CONFLICTS)</>
                            ) : (
                              <>✓ TRAFFIC CLEAR - INTERLOCK BYPASS OK</>
                            )}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={routeAnalysis.obstructions.some(obs => obs.type === 'CRITICAL')}
                          onClick={async () => {
                            setExecutionError(null);
                            setExecutionSuccess(null);
                            try {
                              const res = await fetch('/api/gantry/execute-route', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  originId: routeOrigin,
                                  destinationId: routeDestination,
                                  materialClass: routeMaterialType,
                                  operatorName: currentRole || 'Gantry Operator'
                                })
                              });
                              
                              if (res.ok) {
                                const data = await res.json();
                                setExecutionSuccess(data.message);
                                await loadYardBundles();
                              } else {
                                const errData = await res.json();
                                setExecutionError(errData.error || 'Safety bypass rejected by backend compliance agent.');
                              }
                            } catch (err) {
                              setExecutionError('Real-Time automation telemetry link has timed out.');
                            }
                          }}
                          className={`px-4 py-2.5 rounded-lg text-xxs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md ${
                            routeAnalysis.obstructions.some(obs => obs.type === 'CRITICAL')
                              ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/10 active:scale-95'
                          }`}
                        >
                          Execute Gantry Operational Move
                        </button>
                      </div>

                      {/* Real-time automation telemetry state feedback banners */}
                      {executionSuccess && (
                        <div className="mt-3 p-3 border border-emerald-500/15 bg-emerald-500/5 text-emerald-400 text-xxs rounded font-mono leading-relaxed">
                          ✓ <span className="font-bold">SYSTEM TELEMETRY UPDATE:</span> {executionSuccess}
                        </div>
                      )}
                      {executionError && (
                        <div className="mt-3 p-3 border border-rose-500/15 bg-rose-500/5 text-rose-400 text-xxs rounded font-mono leading-relaxed">
                          🛑 <span className="font-bold">TELEMETRY COMPLIANCE REJECTION:</span> {executionError}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setRouteOrigin(null);
                          setRouteDestination(null);
                        }}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-mono px-3.5 py-2 rounded-lg text-xxs uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Clear Active Route Plan
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-900 rounded-xl bg-slate-950/10 font-mono">
                  <HardHat className="h-10 w-10 text-slate-700 mx-auto mb-3.5" />
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-450 block mb-1">corridor simulation idle</span>
                  <p className="text-[10px] leading-relaxed max-w-md mx-auto font-sans">
                    Define both origin and destination terminal sectors on the blueprint coordinates above (or select them manually in the controllers) to verify travel tracks and check live OSHA collisions.
                  </p>
                </div>
              )}
            </div>

            {/* Plant Layout Color-Coding Legend */}
            <div className="mt-6 pt-5 border-t border-slate-900/60" id="map-legend-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-bold">
                  {isHeatmapMode ? "Heat Map Weight Satiation Scale" : "Facility Area Color-Coding Legend"}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span className="text-[9px] font-mono text-orange-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-3 rounded-xs border-2 border-dashed border-orange-500 animate-pulse"></span>
                    Active Queue (Bending/Staged)
                  </span>
                  <span className="text-[9px] font-mono text-amber-500/80 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-550 animate-pulse"></span>
                    Dashed Amber Section Restricted to Black-Rebar Operations
                  </span>
                </div>
              </div>

              {/* Preset Layout Controls */}
              <div className="mb-4 bg-slate-950/50 p-4 border border-slate-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[8px] uppercase font-mono tracking-widest text-slate-500 font-bold block">Quick Presets</span>
                  <h4 className="text-[10px] font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-amber-500 animate-spin-slow" />
                    PRESET LAYOUT CONTROLS
                  </h4>
                  <p className="text-[9px] font-sans text-slate-400 mt-0.5">
                    Toggle optimized yard overlays and filtering configurations in one tap.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Staged Epoxy Flow', grade: 'Epoxy', status: 'STAGED', mode: false, color: 'hover:border-teal-500/50 hover:bg-teal-950/20 text-teal-450 border-teal-500/25 bg-teal-500/5' },
                    { label: 'Raw Carbon Stacks', grade: 'Black', status: 'RAW', mode: false, color: 'hover:border-blue-500/50 hover:bg-blue-950/20 text-blue-405 border-blue-500/20 bg-blue-500/5' },
                    { label: 'Robotic Bending', grade: 'ALL', status: 'BENDING', mode: false, color: 'hover:border-purple-500/50 hover:bg-purple-950/20 text-purple-400 border-purple-500/20 bg-purple-500/5' },
                    { label: 'Staged Cargo Heatmap', grade: 'ALL', status: 'ALL', mode: true, color: 'hover:border-rose-500/50 hover:bg-rose-950/20 text-rose-455 border-rose-500/20 bg-rose-500/5' },
                    { label: 'Carrier Deliveries', grade: 'ALL', status: 'LOADED', mode: false, color: 'hover:border-emerald-500/50 hover:bg-emerald-950/20 text-emerald-400 border-emerald-500/20 bg-emerald-500/5' }
                  ].map((preset) => {
                    const active = gradeFilter === preset.grade && statusFilter === preset.status && isHeatmapMode === preset.mode;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setGradeFilter(preset.grade);
                          setStatusFilter(preset.status);
                          setIsHeatmapMode(preset.mode);
                          setSearchQuery('');
                        }}
                        className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider font-extrabold rounded-lg border transition-all cursor-pointer ${
                          active 
                            ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md scale-[1.02] font-black'
                            : preset.color
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  
                  {(gradeFilter !== 'ALL' || statusFilter !== 'ALL' || isHeatmapMode) && (
                    <button
                      type="button"
                      onClick={() => {
                        setGradeFilter('ALL');
                        setStatusFilter('ALL');
                        setIsHeatmapMode(false);
                        setSearchQuery('');
                        setHeaderSearchVal('');
                      }}
                      className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-400 hover:text-white border border-slate-800 bg-slate-900 rounded-lg cursor-pointer transition-colors"
                    >
                      Reset Present Layout
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Search & Material/Status Filters */}
              <div className="mb-5 p-3.5 bg-slate-950/70 border border-slate-900 rounded-xl flex flex-col lg:flex-row lg:items-center gap-4 justify-between border-dashed" id="legend-filter-panel">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-amber-500" />
                    Interactive Blueprint Filtering
                  </span>
                  <p className="text-[9px] font-mono text-slate-500 leading-normal max-w-sm">
                    Isolate counts and highlighted zones by material properties, production stages, or bundle identification characteristics.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-500 uppercase">View:</span>
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5" id="view-mode-toggle">
                      <button
                        type="button"
                        onClick={() => setIsHeatmapMode(false)}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-sm font-bold transition-all uppercase cursor-pointer ${
                          !isHeatmapMode 
                            ? 'bg-amber-500 text-slate-950 shadow-xs font-black' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Count
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsHeatmapMode(true)}
                        className={`px-2 py-0.5 text-[9px] font-mono rounded-sm font-bold transition-all uppercase cursor-pointer ${
                          isHeatmapMode 
                            ? 'bg-amber-500 text-slate-950 shadow-xs font-black' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Heat Map (Wt)
                      </button>
                    </div>
                  </div>

                  {/* Search Query Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setHeaderSearchVal(e.target.value);
                      }}
                      placeholder="Search Tag, Mark, Job..."
                      className="w-full sm:w-44 bg-slate-900 border border-slate-800 text-slate-200 font-mono text-[10px] px-2.5 py-1.5 rounded-md focus:border-amber-500 focus:outline-hidden placeholder-slate-600 focus:ring-1 focus:ring-amber-500/20"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => {
                          setSearchQuery('');
                          setHeaderSearchVal('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-300 font-mono font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Grade Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Grade:</span>
                    <select
                      value={gradeFilter}
                      onChange={(e) => setGradeFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] px-2.5 py-1.5 rounded-md focus:border-amber-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Grades</option>
                      <option value="Epoxy">Epoxy</option>
                      <option value="Black">Black</option>
                    </select>
                  </div>

                  {/* Status Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-550 uppercase">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] px-2.5 py-1.5 rounded-md focus:border-amber-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="RAW">RAW</option>
                      <option value="BENDING">BENDING</option>
                      <option value="RACKED">RACKED</option>
                      <option value="STAGED">STAGED</option>
                      <option value="LOADED">LOADED</option>
                    </select>
                  </div>

                  {/* Reset Indicator */}
                  {(gradeFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery !== '') && (
                    <button
                      onClick={() => {
                        setGradeFilter('ALL');
                        setStatusFilter('ALL');
                        setSearchQuery('');
                        setHeaderSearchVal('');
                      }}
                      className="text-[9px] font-mono text-amber-500 hover:text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 rounded-md transition-all self-end sm:self-center uppercase tracking-wide font-bold"
                    >
                      RESET
                    </button>
                  )}
                </div>
              </div>
              <YardMapLegend
                isHeatmapMode={isHeatmapMode}
                getHeatmapCategoryWeight={getHeatmapCategoryWeight}
                getHeatmapCategoryZones={getHeatmapCategoryZones}
                getMachineCategoryWeight={getMachineCategoryWeight}
              />
            </div>
          </div>

        </div>

        {/* Dynamic Zone Details sidebar drawer */}
        <div className="space-y-4" id="zone-telemetry-drawer border-l border-slate-900">
          <div className="bg-slate-900/45 border border-slate-805 rounded-2xl p-5 min-h-[460px] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-3 mb-4">
                <Info className="h-4 w-4 text-slate-400" />
                <h3 className="font-sans text-xs font-bold text-white uppercase tracking-widest">Zone Telemetry</h3>
              </div>

              {activeZoneData ? (
                <div className="space-y-4 flex-1">
                  <div>
                    <span className="text-xxs uppercase font-mono tracking-widest text-slate-500">Selected Station Coordinate</span>
                    <h4 className="text-sm font-bold text-white uppercase font-mono mt-0.5">{activeZoneData.id}</h4>
                    <span className="text-xxs font-mono text-slate-400 block mt-1">{activeZoneData.desc}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-900">
                    <span className="text-xxs uppercase font-mono tracking-widest text-slate-500 block mb-2">residing packages ({activeZoneBundles.length})</span>
                    {activeZoneBundles.length === 0 ? (
                      <p className="text-xxs font-mono text-slate-500 py-6 text-center">No bundles recorded at this location coordinate currently.</p>
                    ) : (
                      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                        {activeZoneBundles.map((b) => (
                          <div key={b.id} className="bg-slate-950 p-2 border border-slate-900 rounded-lg flex items-center justify-between text-xxs">
                            <div className="flex items-center gap-2">
                              <RebarBundleIcon size={22} glow={b.grade === 'Epoxy'} className="shrink-0" />
                              <div className="font-mono">
                                <span className="font-bold text-slate-300 block">{b.tagId}</span>
                                <span className="text-slate-500">{b.mark} • {b.weight} lbs</span>
                              </div>
                            </div>
                            <span className={`text-[8px] font-mono px-1 rounded uppercase ${
                              b.grade === 'Epoxy' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-900 text-slate-500'
                            }`}>
                              {b.grade}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <HelpCircle className="h-8 w-8 text-slate-700 mx-auto stroke-[1.5]" />
                  <p className="text-[10px] font-mono text-slate-550 mt-3 max-w-[180px] mx-auto leading-relaxed uppercase">
                    Click any coordinate cell on the plant floor Map to monitor zone inventories.
                  </p>
                </div>
              )}
            </div>

            {activeZoneData && (
              <p className="text-[9px] font-mono text-slate-600 mt-4 leading-normal">
                SYSTEM ID: {activeZoneData.id}<br />
                COORDINATE CLASS: {activeZoneData.type.toUpperCase()}<br />
                UPDATED UTC: {new Date().toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

      </div>

      {doubleClickedZoneId && (() => {
        const modalZone = zonesList.find(z => z.id === doubleClickedZoneId);
        if (!modalZone) return null;
        const modalZoneBundles = getBundlesAtZone(doubleClickedZoneId);
        const totalZoneWeight = getZoneWeight(doubleClickedZoneId);
        const maxZoneCap = getZoneMaxCapacity(doubleClickedZoneId);
        const utilizationRatio = Math.min(100, Math.round((totalZoneWeight / maxZoneCap) * 100));
        
        const zoneEvents = activities.filter(act => act.fromLocation === doubleClickedZoneId || act.toLocation === doubleClickedZoneId);
        const assignedOp = assignedZoneOperators[doubleClickedZoneId] || 'Unassigned';

        return (
          <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col font-mono overflow-hidden text-slate-200 backdrop-blur-md" id="zone-control-modal">
            {/* HEADER SECTION */}
            <div className="border-b border-slate-800 bg-slate-900/60 p-4 md:px-6 flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="p-1 px-2 rounded-xs border border-orange-500/35 bg-orange-500/10 text-orange-400 text-[10px] uppercase font-bold tracking-widest animate-pulse">
                    LIVE COORDINATE ZONE CONTROL
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">SYSTEM ID: {modalZone.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-sans font-black text-white uppercase tracking-tight">{modalZone.desc || modalZone.label}</h2>
                  <span className="text-xxs px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 capitalize">{modalZone.type}</span>
                </div>
              </div>
              
              <button 
                onClick={() => { setDoubleClickedZoneId(null); setActionError(null); }}
                className="rounded-lg border border-slate-800 hover:border-amber-500 bg-slate-900/70 hover:bg-slate-900 p-2 text-slate-400 hover:text-white transition-all focus:ring-1 focus:ring-amber-500/30 cursor-pointer"
                title="Exit Control Center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* BODY SECTION */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* LEFT BAR: TABS & QUICK CONTROLS */}
              <div className="lg:col-span-3 border-r border-slate-900/80 bg-slate-950/40 p-4 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">NAVIGATE VIEWS</span>
                    <p className="text-[9px] text-slate-500 leading-normal">Operational telemetry projection selectors.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setModalActiveTab('inventory')}
                      className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        modalActiveTab === 'inventory' 
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <span>📦 Active Bundle Inventory</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                        modalActiveTab === 'inventory' ? 'bg-amber-500/20 text-amber-350 font-black' : 'bg-slate-950 text-slate-500 font-bold'
                      }`}>{modalZoneBundles.length}</span>
                    </button>

                    <button 
                      onClick={() => setModalActiveTab('activities')}
                      className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        modalActiveTab === 'activities' 
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <span>📜 Recent Activity Logs</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${
                        modalActiveTab === 'activities' ? 'bg-amber-500/20 text-amber-350 font-black' : 'bg-slate-950 text-slate-500 font-bold'
                      }`}>{zoneEvents.length}</span>
                    </button>

                    <button 
                      onClick={() => setModalActiveTab('configuration')}
                      className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                        modalActiveTab === 'configuration' 
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <span>🛠️ Zone Configuration Tools</span>
                      <Settings className={`h-3.5 w-3.5 ${modalActiveTab === 'configuration' ? 'text-amber-400' : 'text-slate-500'}`} />
                    </button>
                  </div>

                  {/* LIVE LOAD HEALTH INDICATOR */}
                  <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 uppercase font-black">Zone Utilized Capacity</span>
                      <span className={`font-black ${utilizationRatio > 80 ? 'text-rose-500 animate-pulse' : utilizationRatio > 50 ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {utilizationRatio}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          utilizationRatio > 80 ? 'bg-red-500' : utilizationRatio > 50 ? 'bg-orange-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${utilizationRatio}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Active load:</span>
                      <span className="font-extrabold text-slate-200">{totalZoneWeight.toLocaleString()} LBS</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Weight limit:</span>
                      <span className="font-extrabold text-amber-400">{maxZoneCap.toLocaleString()} LBS</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-900 space-y-2 mt-4 text-[9px] text-slate-500 leading-relaxed uppercase">
                  <div>Current Assigned Operator:</div>
                  <div className="text-xs font-bold text-slate-300">{assignedOp === 'Unassigned' ? '🚫 ' + assignedOp : '👷 ' + assignedOp}</div>
                  <div className="mt-2 text-[8px] text-slate-600">Simcote Facility Admin Console <br/>Version 2.7.1 • Live Websocket</div>
                </div>
              </div>

              {/* CENTER PANE: MAIN CONTENT ELEMENT VIEW */}
              <div className="lg:col-span-9 bg-slate-950 p-6 flex flex-col overflow-hidden">
                {actionError && (
                  <div className="mb-4 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-xl text-xxs text-rose-400 font-bold uppercase tracking-wide flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{actionError}</span>
                    </div>
                    <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-white font-black text-xs">×</button>
                  </div>
                )}

                {/* TAB CONTENT: INVENTORY */}
                {modalActiveTab === 'inventory' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                          <span>Active Residing Package Inventory</span>
                          <span className="text-xxs font-mono bg-slate-900 border border-slate-800 text-slate-405 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            {modalZoneBundles.length} detected
                          </span>
                        </h3>
                        <p className="text-xxs text-slate-500 mt-0.5">Physical bundle allocations residing inside coordinates of {modalZone.id}.</p>
                      </div>
                    </div>

                    {/* LIST AND TABLE CONTAINER */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {modalZoneBundles.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-900 rounded-2xl bg-slate-950/30">
                          <HelpCircle className="h-10 w-10 text-slate-700 mb-3" />
                          <span className="text-xxs uppercase tracking-wider text-slate-550 block mb-1">VACANT SECTOR PLAN</span>
                          <p className="text-[10px] text-slate-500 max-w-sm font-sans leading-relaxed">There are currently no package coordinates registered here. You can transition bundles here by staging, or carrying them via Gantry cranes.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-900 bg-slate-900/10 rounded-xl overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left font-mono text-[10px] border-collapse min-w-[700px]">
                              <thead>
                                <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 uppercase text-[9px] tracking-wider font-extrabold h-9">
                                  <th className="px-4">Tag ID</th>
                                  <th className="px-4">Mark</th>
                                  <th className="px-4">Specs (Lgth/Sz)</th>
                                  <th className="px-4">Weight (lbs)</th>
                                  <th className="px-4">Grade</th>
                                  <th className="px-4">Job ID</th>
                                  <th className="px-4">Status</th>
                                  <th className="px-4 text-right">Interactive Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900">
                                {modalZoneBundles.map((b) => (
                                  <tr key={b.id} className="hover:bg-slate-900/30 h-11 transition-colors">
                                    <td className="px-4 font-bold text-white tracking-tight">
                                      <div className="flex items-center gap-2">
                                        <RebarBundleIcon size={20} glow={b.grade === 'Epoxy'} className="shrink-0" />
                                        <span 
                                          onClick={() => setSelectedBundleForModal(b)}
                                          className="cursor-pointer hover:underline hover:text-amber-400"
                                          title="Click to audit comprehensive technical specifications and 3D bend geometry"
                                        >
                                          {b.tagId}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 text-slate-350">{b.mark}</td>
                                    <td className="px-4 text-indigo-400">{b.barSize || '#6'} @ {b.length || 40}ft</td>
                                    <td className="px-4 font-bold text-amber-500">{b.weight?.toLocaleString()}</td>
                                    <td className="px-4">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase border tracking-wider ${
                                        b.grade === 'Epoxy' 
                                          ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' 
                                          : 'bg-slate-950 text-slate-450 border-slate-900'
                                      }`}>
                                        {b.grade}
                                      </span>
                                    </td>
                                    <td className="px-4 text-slate-400 text-[9px]">{b.jobId || 'N/A'}</td>
                                    <td className="px-4">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                        b.status === 'RAW' ? 'bg-slate-800 text-slate-400' :
                                        b.status === 'BENDING' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20' :
                                        b.status === 'STAGED' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/15' :
                                        b.status === 'RACKED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                        b.status === 'LOADED' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                                        'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                      }`}>
                                        {b.status}
                                      </span>
                                    </td>
                                    <td className="px-4 text-right">
                                      <div className="inline-flex gap-1.5 justify-end">
                                        {b.status === 'BENDING' && (
                                          <button 
                                            onClick={() => handleActionOnBundle(b.id, 'mark-bent')}
                                            className="bg-orange-500 text-slate-950 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider hover:bg-orange-400 transition cursor-pointer"
                                          >
                                            ✓ Complete Bend
                                          </button>
                                        )}
                                        
                                        {b.status === 'RAW' && (
                                          <button 
                                            onClick={() => handleActionOnBundle(b.id, 'stage', 'Coat-Station')}
                                            className="bg-indigo-600 text-white px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider hover:bg-indigo-500 transition cursor-pointer"
                                          >
                                            ⚡ Process Coating
                                          </button>
                                        )}

                                        {b.status !== 'BENDING' && modalZone.type !== 'bender' && (
                                          <button 
                                            onClick={() => handleActionOnBundle(b.id, 'send-to-bender', 'Bender-New-Robo')}
                                            className="bg-slate-900 border border-slate-800 text-[8px] px-2 py-1 rounded text-orange-450 font-bold hover:border-orange-500 transition-all cursor-pointer"
                                          >
                                            ⚙️ CNC Bender
                                          </button>
                                        )}

                                        {modalZone.type === 'crane' && (
                                          <button 
                                            onClick={() => handleActionOnBundle(b.id, 'drop', 'Rack J-15')}
                                            className="bg-slate-900 border border-slate-800 text-[8px] px-2 py-1 rounded text-teal-400 font-bold hover:border-teal-550 transition-all cursor-pointer"
                                          >
                                            ⚓ Drop to Rack
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: ACTIVITY LOGS */}
                {modalActiveTab === 'activities' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="mb-4">
                      <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                        <History className="h-4 w-4 text-amber-500" />
                        <span>Sector Activity Log Chronology</span>
                        <span className="text-xxs font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {zoneEvents.length} events
                        </span>
                      </h3>
                      <p className="text-xxs text-slate-500 mt-0.5">Historical and active telemetry movements passing from or into {modalZone.id}.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                      {zoneEvents.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-900 rounded-2xl bg-slate-950/30">
                          <History className="h-10 w-10 text-slate-700 mb-3" />
                          <span className="text-xxs uppercase tracking-wider text-slate-550 block mb-1">NO RECENT HISTORY RECORDED</span>
                          <p className="text-[10px] text-slate-500 max-w-sm font-sans leading-relaxed">No bundle relocations, exceptions, or bender processing requests have been registered at this sector during the current Shift.</p>
                        </div>
                      ) : (
                        zoneEvents.map((ev) => (
                          <div key={ev.id} className="border border-slate-900 bg-slate-900/10 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xxs animate-in fade-in">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[8px] font-black text-slate-450 uppercase border border-slate-805 tracking-widest">{ev.id}</span>
                                <span className="font-extrabold text-white">{ev.action}</span>
                                <span className="text-[10px] text-slate-600">•</span>
                                <span className="text-slate-400 font-bold">Bundle: {ev.tagId}</span>
                              </div>
                              <p className="text-slate-400 leading-relaxed font-sans">{ev.details || `Relocated from: ${ev.fromLocation} → ${ev.toLocation}`}</p>
                            </div>
                            <div className="text-left sm:text-right font-mono text-[9px] shrink-0 text-slate-500 space-y-0.5 border-t sm:border-t-0 border-slate-900/50 pt-1 sm:pt-0">
                              <div>Operator: <span className="text-indigo-400 font-bold">{ev.operatorName}</span></div>
                              <div>{new Date(ev.timestamp).toLocaleDateString()} {new Date(ev.timestamp).toLocaleTimeString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: ZONE CONFIGURATION TOOLS */}
                {modalActiveTab === 'configuration' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="mb-6 border-b border-slate-900 pb-3">
                      <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                        <Settings className="h-4 w-4 text-amber-500" />
                        <span>Coordinate Control Configuration & Compliance</span>
                      </h3>
                      <p className="text-xxs text-slate-500 mt-0.5">Configure live calibration parameters, safety capacities, operator assignments, and exceptions.</p>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                      
                      {/* CONFIG 1: ASSIGN COORDINATOR */}
                      <div className="border border-slate-900 bg-slate-900/10 p-4 rounded-xl space-y-4">
                        <div className="space-y-1 border-b border-slate-900 pb-2">
                          <h4 className="text-[11px] uppercase font-black text-white tracking-widest">👷 Worker Assignment Selector</h4>
                          <p className="text-[9px] text-slate-500 font-sans">Assign a registered floor supervisor or operator to supervise this zone coordinate.</p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-slate-400 uppercase block">Available Plant Operators</label>
                          <select 
                            value={assignedOp}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAssignedZoneOperators(prev => ({
                                ...prev,
                                [doubleClickedZoneId]: val
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-hidden"
                          >
                            <option value="Unassigned">Unassigned (None)</option>
                            {operators.map(op => (
                              <option key={op.id} value={op.name}>
                                {op.name} ({op.role.replace('_', ' ')})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="p-2.5 rounded bg-slate-950 border border-slate-900 text-[10px] text-slate-400 font-sans leading-relaxed">
                          <span className="font-mono font-bold text-slate-300">Live Note:</span> The assigned operator's credentials will be auto-attached to all gantry operations, benders or shears activities created inside {modalZone.id}.
                        </div>
                      </div>

                      {/* CONFIG 2: CAPACITY SLIDER */}
                      <div className="border border-slate-900 bg-slate-905/10 p-4 rounded-xl space-y-4 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="space-y-1 border-b border-slate-900 pb-2">
                            <h4 className="text-[11px] uppercase font-black text-white tracking-widest">📊 Safety Weight Buffer Threshold</h4>
                            <p className="text-[9px] text-slate-500 font-sans">Override default safety ratio. Heatmap color alerts adjust dynamically based on target.</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-350">
                              <span>Current Target:</span>
                              <span className="text-amber-400 text-sm font-extrabold">{maxZoneCap.toLocaleString()} LBS</span>
                            </div>
                            <input 
                              type="range"
                              min="5000"
                              max="150000"
                              step="5000"
                              value={maxZoneCap}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setZoneCustomCapacities(prev => ({
                                  ...prev,
                                  [doubleClickedZoneId]: val
                                }));
                              }}
                              className="w-full bg-slate-900 accent-amber-500 cursor-pointer h-1.5 rounded-lg"
                            />
                            <div className="flex justify-between text-[8px] text-slate-550">
                              <span>5,000 LBS</span>
                              <span>75,000 LBS</span>
                              <span>150,000 LBS</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500/80 font-sans leading-normal">
                          ⚠️ Reducing limit below current residing weight (<span className="font-bold text-amber-400 font-mono">{totalZoneWeight.toLocaleString()} LBS</span>) will immediately trigger RED extreme load floor map status coordinates for this zone.
                        </div>
                      </div>

                      {/* CONFIG 3: FILE EXCEPTION WIDGET */}
                      <div className="border border-slate-900 bg-slate-900/10 p-4 rounded-xl space-y-3.5 md:col-span-2">
                        <div className="space-y-1 border-b border-slate-900 pb-2">
                          <h4 className="text-[11px] uppercase font-black text-white tracking-widest flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span>Fulfill Zone Alert / Safety Exception</span>
                          </h4>
                          <p className="text-[9px] text-slate-500 font-sans">File immediate operations hazard notice or misplaced inventory exception at this sector coordinate.</p>
                        </div>

                        {exSubmitSuccess && (
                          <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-lg text-xxs font-bold uppercase tracking-wide">
                            ✓ {exSubmitSuccess}
                          </div>
                        )}
                        {exSubmitError && (
                          <div className="p-3 bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-lg text-xxs font-bold uppercase tracking-wide">
                            ⚠️ {exSubmitError}
                          </div>
                        )}

                        <form 
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setExSubmitSuccess('');
                            setExSubmitError('');
                            
                            if (!exFormTagId) {
                              setExSubmitError('Must select or specify an active bundle Tag ID.');
                              return;
                            }
                            if (!exFormDesc.trim()) {
                              setExSubmitError('Must describe the issue statement.');
                              return;
                            }

                            try {
                              const resEx = await fetch('/api/exceptions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  tagId: exFormTagId,
                                  operatorName: assignedOp !== 'Unassigned' ? assignedOp : 'Control Supervisor',
                                  type: exFormType,
                                  description: exFormDesc.trim()
                                })
                              });

                              if (resEx.ok) {
                                setExSubmitSuccess(`Exception filed successfully for bundle ${exFormTagId}.`);
                                setExFormTagId('');
                                setExFormDesc('');
                                await loadYardBundles();
                              } else {
                                const errD = await resEx.json();
                                setExSubmitError(errD.error || 'Server rejected creation of exception.');
                              }
                            } catch (err) {
                              setExSubmitError('Network failure filing coordinates hazard.');
                            }
                          }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[10px]"
                        >
                          <div className="space-y-1.5">
                            <label className="text-[9px] text-slate-400 uppercase block">Associate Active Bundle Tag</label>
                            <select 
                              value={exFormTagId}
                              onChange={(e) => setExFormTagId(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                            >
                              <option value="">-- Choose Tag --</option>
                              {bundles.map(b => (
                                <option key={b.id} value={b.tagId}>
                                  {b.tagId} ({b.mark} in {b.location})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] text-slate-400 uppercase block">Exception Category Class</label>
                            <select 
                              value={exFormType}
                              onChange={(e) => setExFormType(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                            >
                              <option value="Misplaced Bar">Misplaced Bar</option>
                              <option value="Fabrication Error">Fabrication Error</option>
                              <option value="Coating Issue">Coating Issue</option>
                              <option value="Safety Obstruction">Safety Obstruction</option>
                              <option value="Crane Slew Drift">Crane Slew Drift</option>
                            </select>
                          </div>

                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[9px] text-slate-400 uppercase block">Detailed Description Statement</label>
                            <input 
                              type="text"
                              value={exFormDesc}
                              onChange={(e) => setExFormDesc(e.target.value)}
                              placeholder="e.g. Bundle J-12 has shifted on the northwest rack array, sagging past limit."
                              className="w-full bg-slate-905 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-amber-500"
                            />
                          </div>

                          <div className="md:col-span-2 text-right">
                            <button 
                              type="submit"
                              className="bg-amber-500 hover:bg-amber-450 active:scale-98 text-slate-950 font-black px-4 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                              🚨 Dispatch Operations Notice
                            </button>
                          </div>
                        </form>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {selectedBundleForModal && (
        <BundleDetailModal 
          bundle={selectedBundleForModal} 
          onClose={() => setSelectedBundleForModal(null)} 
        />
      )}
    </div>
  );
}
