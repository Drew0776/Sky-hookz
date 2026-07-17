import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bundle } from '../types';
import { INITIAL_BUNDLES } from '../seedData';
import PageLoader from '../components/PageLoader';
import BundleDetailModal from '../components/BundleDetailModal';
import { 
  ShieldCheck, 
  RotateCcw, 
  ArrowDown, 
  Anchor, 
  HardHat, 
  AlertCircle,
  Truck,
  Layers,
  HelpCircle
} from 'lucide-react';

export default function CraneCabPage() {
  const { currentRole, currentOperator } = useApp();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Modal inspection display
  const [selectedBundleForModal, setSelectedBundleForModal] = useState<Bundle | null>(null);

  // Active crane controlled by the current cab operator
  const [activeCrane, setActiveCrane] = useState<'Crane-NE' | 'Crane-SE' | 'Crane-NW' | 'Crane-SW'>('Crane-NW');

  // Selected drop target in crane dropdown
  const [dropTarget, setDropTarget] = useState<string>('');

  const loadCraneBundles = async () => {
    try {
      const response = await fetch('/api/bundles').catch(() => null);
      if (response && response.ok) {
        setBundles(await response.json());
      } else {
        setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      }
    } catch (err) {
      console.warn('Network issue loading crane bundles, using local seed fallback:', err);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCraneBundles();

    // Setup real-time pub/sub synchronization stream via SSE
    const eventSource = new EventSource('/api/updates');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'update') {
          if (payload.data.bundles) {
            setBundles(payload.data.bundles);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE updates on CraneCabPage:', err);
      }
    };

    eventSource.onerror = () => {
      console.warn('SSE stream disconnected in CraneCab. Re-establishing.');
    };

    // Keep active periodic fail-safe at slow pace
    const interval = setInterval(loadCraneBundles, 25000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Update default crane view based on operator's station if matching Crane-*
  useEffect(() => {
    if (currentOperator?.currentStation && currentOperator.currentStation.startsWith('Crane-')) {
      setActiveCrane(currentOperator.currentStation as any);
    }
  }, [currentOperator]);

  const clearMessages = () => {
    setErrorNotice(null);
    setSuccessNotice(null);
  };

  // Find if currently active crane has a load suspended
  const loadedUnderActiveCrane = bundles.find(b => b.location === activeCrane);

  // Filter list of bundles sitting in yard ready for pick-up (not loaded/suspended)
  // These should have a STAGED, COATED, or RACKED status but NOT be in a crane or loaded door
  const stagingQueues = bundles.filter(b => 
    !b.location.startsWith('Crane-') && 
    !b.location.startsWith('Door-') &&
    b.status !== 'LOADED' && 
    b.status !== 'RAW' && 
    b.status !== 'BENDING'
  );

  const handlePickUp = async (bundleId: string) => {
    clearMessages();
    if (loadedUnderActiveCrane) {
      setErrorNotice('CRANE COLLISION HAZARD: Active crane already has a suspended load. Clear crane first.');
      return;
    }

    try {
      const response = await fetch(`/api/bundles/${bundleId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Crane Operator',
          craneId: activeCrane
        })
      });

      if (response.ok) {
        setSuccessNotice(`Successfully clamped bundle ${bundleId}. Under active rigging hoist.`);
        loadCraneBundles();
      } else {
        const errData = await response.json();
        setErrorNotice(errData.error || 'Pickup rigging failed.');
      }
    } catch (err) {
      setErrorNotice('Network communications crash during pickup.');
    }
  };

  const handleDrop = async (bundleId: string) => {
    clearMessages();
    if (!dropTarget) {
      setErrorNotice('Specify a target dropdown location first.');
      return;
    }

    try {
      const response = await fetch(`/api/bundles/${bundleId}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Crane Operator',
          location: dropTarget
        })
      });

      if (response.ok) {
        setSuccessNotice(`Clamps released! Bundle ${bundleId} nested safely at ${dropTarget}.`);
        setDropTarget('');
        loadCraneBundles();
      } else {
        const errData = await response.json();
        setErrorNotice(errData.error || 'Drop release sequence aborted.');
      }
    } catch (err) {
      setErrorNotice('Network error releasing bundle drops.');
    }
  };

  if (loading) {
    return <PageLoader message="Connecting hoist motor systems..." />;
  }

  // Restricting target dropdown list based on suspended rebar type for active security check
  const isSuspendedBlack = loadedUnderActiveCrane?.grade === 'Black';

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="crane-cab-page">
      
      {/* Title row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-sans text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <HardHat className="h-5 w-5 text-amber-500" />
            <span>Heavy Rigging Gantry Crane Terminal</span>
          </h1>
          <p className="text-xxs text-slate-400 font-mono tracking-wider mt-0.5 uppercase">RIGGER CAB CONSOLE • AUTO-POLLS 10s</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xxs font-mono text-slate-500">CAB ACTIVE:</span>
          <span className="font-mono text-xs text-amber-500 font-bold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
            {activeCrane}
          </span>
        </div>
      </div>

      {/* Retro CRT Scanline HUD Overlay Banner */}
      <div className="relative overflow-hidden bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col md:flex-row md:items-center justify-between gap-6" id="cybernetic-gantry-hud">
        {/* Fine Scanlines */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,24,38,0)_94%,rgba(148,163,184,0.03)_95%,rgba(148,163,184,0.03)_100%)] bg-[size:100%_4px]" />
        
        <div className="space-y-1.5 z-10 flex-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono tracking-wider text-emerald-400 font-bold uppercase">CAB SYSTEM TELEMETRY ONLINE</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1 text-slate-400 font-mono text-[10px]">
            <div>
              <span className="text-slate-550 block uppercase text-[8px] font-bold">WIND VELOCITY</span>
              <span className="text-white font-extrabold flex items-center gap-1">💨 14.5 knots <span className="text-emerald-400 text-[8px] font-normal">[SAFE]</span></span>
            </div>
            <div>
              <span className="text-slate-550 block uppercase text-[8px] font-bold">GANTRY RAIL SPEED</span>
              <span className="text-white font-extrabold">⚡ 2.4 m/s</span>
            </div>
            <div>
              <span className="text-slate-550 block uppercase text-[8px] font-bold">HOIST CABLE LOAD</span>
              <span className="text-white font-extrabold">{loadedUnderActiveCrane ? '⚖️ ' + loadedUnderActiveCrane.weight + ' LBS' : 'EMPTY'}</span>
            </div>
            <div>
              <span className="text-slate-550 block uppercase text-[8px] font-bold">MOTOR STATS</span>
              <span className="text-emerald-400 font-bold">⚡ NORMAL OPERATIONAL</span>
            </div>
          </div>
        </div>

        {/* Dynamic Gantry Interactive Slewer coordinates hook */}
        <GantrySlewer activeCrane={activeCrane} hasLoad={!!loadedUnderActiveCrane} />
      </div>

      {/* Warning notices */}
      {errorNotice && (
        <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-mono mb-4 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-bold">CRANE RIGGING EXCEPTION:</span> {errorNotice}
          </div>
          <button onClick={clearMessages} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {successNotice && (
        <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-mono mb-4 animate-fadeIn">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div className="flex-1">
            <span className="font-bold">CONE STATUS LOCKED:</span> {successNotice}
          </div>
          <button onClick={clearMessages} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {/* Crane Select Header Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5" id="crane-units-switcher">
        {[
          { id: 'Crane-NW', label: 'Northwest Gantry', area: 'NW Zone (Epoxy)', status: 'Active' },
          { id: 'Crane-NE', label: 'Northeast Gantry', area: 'NE Zone (Epoxy)', status: 'Active' },
          { id: 'Crane-SE', label: 'Southeast Gantry', area: 'SE Zone (Epoxy)', status: 'Active' },
          { id: 'Crane-SW', label: 'Southwest Gantry', area: 'SW Zone (Black Bar Only)', status: 'Active' }
        ].map((c) => {
          const isSelected = activeCrane === c.id;
          const hasLoad = bundles.some(b => b.location === c.id);
          return (
            <button
              key={c.id}
              onClick={() => {
                setActiveCrane(c.id as any);
                clearMessages();
              }}
              className={`p-3.5 text-left rounded-xl transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 border-amber-500 shadow-xl shadow-amber-500/10'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-mono uppercase tracking-widest ${isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-500'}`}>
                  {c.id}
                </span>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${hasLoad ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              </div>
              <div className={`text-xs font-bold ${isSelected ? 'text-slate-950' : 'text-slate-200'}`}>{c.label}</div>
              <div className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                {hasLoad ? 'RIGGED WITH SUSPENDED LOAD' : c.area}
              </div>
            </button>
          )
        })}
      </div>

      {/* Rigging Controls split panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cockit Hoist state (Suspended load block) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6" id="active-rigging-hoist">
            <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Anchor className="h-4 w-4 text-slate-400" />
              <span>ACTIVE RIGGING SUSPENSION CHAMBER [{activeCrane}]</span>
            </h2>

            {loadedUnderActiveCrane ? (
              <div className="space-y-5 animate-pulse">
                {/* Active Card description */}
                <div className="bg-slate-950 p-5 rounded-xl border border-rose-500/20 relative">
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-xxs font-mono">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    <span>RIGGING ACTIVE</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono block">SUSPENDED CARGO TAG:</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    BUNDLE {loadedUnderActiveCrane.tagId}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-900 pb-2">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">GRADE</span>
                      <span className="text-xs font-mono font-bold text-teal-400">{loadedUnderActiveCrane.grade}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">MASS WEIGHT</span>
                      <span className="text-xs font-mono font-bold text-white">{loadedUnderActiveCrane.weight} LBS</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">DIMENSION SIZE</span>
                      <span className="text-xs font-mono font-bold text-white">{loadedUnderActiveCrane.barSize} SIZE</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 uppercase block">ROUTE DESTINATION</span>
                      <span className="text-xs font-mono font-bold text-amber-500 truncate max-w-[120px] block">
                        {loadedUnderActiveCrane.route.split(' -> ').slice(-2).join(' → ') || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drop Action Form */}
                <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">Select Release Drop Target</span>
                  <div className="flex flex-col md:flex-row gap-2.5">
                    <select
                      value={dropTarget}
                      onChange={(e) => setDropTarget(e.target.value)}
                      className="bg-slate-900 text-slate-200 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono flex-1 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                    >
                      <option value="">-- Click to Target Zone Coordinates --</option>
                      
                      {/* Enforce SW rules inside HTML options selectively for clean UX and easy operation */}
                      {isSuspendedBlack ? (
                        <>
                          <optgroup label="SW Black-Rebar Storage Racks">
                            <option value="Rack J-19">Rack J-19 (SW Zone)</option>
                            <option value="Rack J-20">Rack J-20 (SW Zone)</option>
                            <option value="Rack J-21">Rack J-21 (SW Zone)</option>
                            <option value="Rack J-22">Rack J-22 (SW Zone)</option>
                            <option value="Rack J-23">Rack J-23 (SW Zone)</option>
                            <option value="Rack J-24">Rack J-24 (SW Zone)</option>
                            <option value="Rack J-25">Rack J-25 (SW Zone)</option>
                            <option value="Rack L-6">Rack L-6 (SW Zone)</option>
                            <option value="Rack L-7">Rack L-7 (SW Zone)</option>
                            <option value="Rack L-8">Rack L-8 (SW Zone)</option>
                            <option value="Rack L-9">Rack L-9 (SW Zone)</option>
                            <option value="Rack L-10">Rack L-10 (SW Zone)</option>
                          </optgroup>
                          <optgroup label="SW Shipping Bay Loading Doors">
                            <option value="Door-7">Door-7 (SW Flatbed/Step Deck)</option>
                            <option value="Door-8">Door-8 (SW Flatbed/Step Deck)</option>
                          </optgroup>
                        </>
                      ) : (
                        <>
                          <optgroup label="NW/NE/SE Epoxy Racks">
                            <option value="Rack J-01">Rack J-01 (Epoxy Buffer)</option>
                            <option value="Rack J-02">Rack J-02 (Epoxy Buffer)</option>
                            <option value="Rack J-03">Rack J-03 (Epoxy Buffer)</option>
                            <option value="Rack J-04">Rack J-04 (Epoxy Buffer)</option>
                            <option value="Rack J-05">Rack J-05 (Epoxy Buffer)</option>
                            <option value="Rack J-06">Rack J-06 (Epoxy Buffer)</option>
                            <option value="Rack J-08">Rack J-08 (Epoxy Buffer)</option>
                            <option value="Rack J-10">Rack J-10 (Epoxy Buffer)</option>
                            <option value="Rack J-11">Rack J-11 (Epoxy Buffer)</option>
                            <option value="Rack J-12">Rack J-12 (Epoxy Buffer)</option>
                            <option value="Rack J-15">Rack J-15 (Epoxy Buffer)</option>
                            <option value="Rack J-16">Rack J-16 (Epoxy Buffer)</option>
                            <option value="Rack J-17">Rack J-17 (Epoxy Buffer)</option>
                            <option value="Rack J-18">Rack J-18 (Epoxy Buffer)</option>
                            <option value="Rack K-1">Rack K-1 (Epoxy Buffer)</option>
                            <option value="Rack K-2">Rack K-2 (Epoxy Buffer)</option>
                            <option value="Rack L-1">Rack L-1 (Epoxy Buffer)</option>
                            <option value="Rack L-2">Rack L-2 (Epoxy Buffer)</option>
                            <option value="Rack L-3">Rack L-3 (Epoxy Buffer)</option>
                            <option value="Rack L-4">Rack L-4 (Epoxy Buffer)</option>
                            <option value="Rack L-5">Rack L-5 (Epoxy Buffer)</option>
                          </optgroup>
                          <optgroup label="Epoxy Staging Areas (Ready)">
                            <option value="Coat-Station">Coat-Station (Epoxy Buffer)</option>
                          </optgroup>
                          <optgroup label="Core Gantry Loading Doors">
                            <option value="Door-1">Door-1 (Epoxy Logistics)</option>
                            <option value="Door-2">Door-2 (Epoxy Logistics)</option>
                            <option value="Door-3">Door-3 (Epoxy Logistics)</option>
                            <option value="North-End">North-End Door (Epoxy Logistics)</option>
                          </optgroup>
                        </>
                      )}
                    </select>

                    <button
                      onClick={() => handleDrop(loadedUnderActiveCrane.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 font-mono text-xs font-bold text-slate-950 px-5 py-2 hover:bg-emerald-450 cursor-pointer text-center whitespace-nowrap"
                    >
                      <ArrowDown className="h-4 w-4" />
                      <span>RELEASE PRESSURE CLAMP</span>
                    </button>
                  </div>
                  {isSuspendedBlack && (
                    <div className="flex items-center gap-1.5 mt-2 text-rose-400 font-mono text-[10px]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>BLACK-BAR SAFETY GUARD ACTIVE: Drops constrained strictly to SW yard lines.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center p-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 font-mono text-xs text-slate-500">
                Rigging suspension hook resides empty. Choose a staged bundle below to pickup.
              </div>
            )}
          </div>
        </div>

          {/* Staging Bundles queue panel (Right side) */}
          <div className="space-y-4">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5" id="bundles-staged-panel">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-2">Facility-Wide Buffer</span>
              <h3 className="text-xs font-bold font-mono text-white mb-4">BUNDLES WAITING ON CRANE IN YARD</h3>

              {stagingQueues.length === 0 ? (
                <p className="text-center py-12 font-mono text-xxs text-slate-650">No bundles staged for transport currently.</p>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {stagingQueues.map((b) => (
                    <div key={b.id} className="bg-slate-950 p-3 rounded-lg border border-slate-900 hover:border-slate-800 transition-colors flex items-center justify-between gap-2.5 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span 
                            onClick={() => setSelectedBundleForModal(b)}
                            className="font-mono text-xs font-bold text-slate-200 cursor-pointer hover:underline hover:text-amber-400"
                            title="Click to audit comprehensive technical specifications and 3D bend geometry"
                          >
                            {b.tagId}
                          </span>
                          <span className={`text-[8px] uppercase font-mono px-1 rounded ${
                            b.grade === 'Epoxy' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-slate-900 text-slate-500 border border-slate-850'
                          }`}>
                            {b.grade}
                          </span>
                        </div>
                        <p className="text-xxs font-mono text-slate-400 mt-1">Weight: {b.weight} lbs • Size: {b.barSize}</p>
                        <p className="text-[9px] font-mono text-slate-500 mt-0.5 truncate max-w-[130px]" title={b.location}>Location: {b.location}</p>
                      </div>

                      <button
                        onClick={() => handlePickUp(b.id)}
                        className="bg-slate-900 hover:bg-slate-850 text-amber-500 border border-slate-800 px-3 py-1.5 text-xxs font-mono rounded-lg transition-colors cursor-pointer"
                      >
                        RIG / HOIST
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

      </div>

      {selectedBundleForModal && (
        <BundleDetailModal 
          bundle={selectedBundleForModal} 
          onClose={() => setSelectedBundleForModal(null)} 
        />
      )}
    </div>
  );
}

interface GantrySlewerProps {
  activeCrane: string;
  hasLoad: boolean;
}

function GantrySlewer({ activeCrane, hasLoad }: GantrySlewerProps) {
  const [posX, setPosX] = useState(48);
  const [posY, setPosY] = useState(36);

  useEffect(() => {
    // Seed positions based on the crane selected
    if (activeCrane === 'Crane-NW') { setPosX(30); setPosY(28); }
    else if (activeCrane === 'Crane-NE') { setPosX(75); setPosY(25); }
    else if (activeCrane === 'Crane-SE') { setPosX(80); setPosY(72); }
    else if (activeCrane === 'Crane-SW') { setPosX(25); setPosY(75); }
  }, [activeCrane]);

  // Determine current active sector based on coordinates
  let sectorName = 'Center Hub';
  if (posX < 50 && posY < 50) sectorName = 'NW Epoxy Specialty';
  else if (posX >= 50 && posY < 50) sectorName = 'NE Epoxy Storage';
  else if (posX < 50 && posY >= 50) sectorName = 'SW Black Rebar (Restricted)';
  else if (posX >= 50 && posY >= 50) sectorName = 'SE CNC Production';

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const clickY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPosX(Math.max(5, Math.min(95, clickX)));
    setPosY(Math.max(5, Math.min(95, clickY)));
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-mono text-xs z-10 shrink-0 select-none max-w-full">
      {/* S3. 2D Grid Representation of Gantry Space */}
      <div className="space-y-1.5 shrink-0">
        <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest block">Interactive Gantry Coordinates</span>
        <div 
          onClick={handleGridClick}
          className="relative h-28 w-44 bg-slate-950 rounded-lg border border-slate-800 p-1 overflow-hidden cursor-crosshair hover:border-slate-700 transition-colors"
          title="Click inside grid to position hook manually"
        >
          {/* Subtle grid lines */}
          <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 opacity-[0.06] pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="border-r border-b border-white" />
            ))}
          </div>
          
          {/* Active position dot marker */}
          <div 
            className="absolute h-2.5 w-2.5 bg-amber-500 rounded-full flex items-center justify-center transition-all duration-300"
            style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className={`animate-ping absolute inline-flex h-5 w-5 rounded-full ${hasLoad ? 'bg-rose-500/50' : 'bg-amber-500/40'}`} />
            <span className={`h-1 w-1 rounded-full ${hasLoad ? 'bg-rose-200' : 'bg-white'}`} />
          </div>

          <div className="absolute bottom-1 right-2 text-[7px] text-slate-500 uppercase">
            X:{posX}ft | Y:{posY}ft
          </div>
          <div className="absolute top-1 left-2 text-[7px] text-amber-500/80 font-bold font-mono">
            {activeCrane} Hook
          </div>
        </div>
      </div>

      {/* Axis controllers & Diagnostics */}
      <div className="flex flex-col gap-2 shrink-0 w-44">
        <div>
          <span className="text-[7px] text-slate-500 uppercase block font-bold">Grid sector detection</span>
          <span className="text-[10px] text-slate-300 font-extrabold truncate block w-40">{sectorName}</span>
        </div>

        <div className="flex gap-1.5 justify-center">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button 
              onClick={() => { setPosY(prev => Math.max(5, prev - 8)); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-800 text-[10px] font-bold select-none cursor-pointer"
            >
              ▲ N
            </button>
            <div className="flex gap-1.5">
              <button 
                onClick={() => { setPosX(prev => Math.max(5, prev - 8)); }}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-800 text-[10px] font-bold select-none cursor-pointer"
              >
                ◀ W
              </button>
              <button 
                onClick={() => { setPosX(prev => Math.min(95, prev + 8)); }}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-800 text-[10px] font-bold select-none cursor-pointer"
              >
                E ▶
              </button>
            </div>
            <button 
              onClick={() => { setPosY(prev => Math.min(95, prev + 8)); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-800 text-[10px] font-bold select-none cursor-pointer"
            >
              ▼ S
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
