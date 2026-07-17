import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bundle, ActivityEvent, ShiftMessage } from '../types';
import { INITIAL_BUNDLES, INITIAL_ACTIVITY, INITIAL_SHIFT_MESSAGES } from '../seedData';
import PageLoader from '../components/PageLoader';
import { 
  Building2, 
  Send, 
  Clock, 
  Users, 
  Activity, 
  MessageSquare,
  RefreshCw,
  HardHat,
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const { currentRole, currentOperator, operators } = useApp();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [shiftMsgs, setShiftMsgs] = useState<ShiftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Shift Message state
  const [newMsgContent, setNewMsgContent] = useState('');
  const [activeTab, setActiveTab] = useState<'First Shift' | 'Second Shift'>('First Shift');
  const [isHandoffOpen, setIsHandoffOpen] = useState(false);

  const loadData = async () => {
    try {
      const [bRes, aRes, mRes] = await Promise.all([
        fetch('/api/bundles').catch(() => null),
        fetch('/api/activity').catch(() => null),
        fetch('/api/shift-messages').catch(() => null)
      ]);
      
      let gotBundles = false;
      let gotActivities = false;
      let gotShiftMsgs = false;

      if (bRes && bRes.ok) {
        setBundles(await bRes.json());
        gotBundles = true;
      }
      if (aRes && aRes.ok) {
        setActivities(await aRes.json());
        gotActivities = true;
      }
      if (mRes && mRes.ok) {
        setShiftMsgs(await mRes.json());
        gotShiftMsgs = true;
      }

      if (!gotBundles) setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      if (!gotActivities) setActivities(prev => prev.length ? prev : INITIAL_ACTIVITY);
      if (!gotShiftMsgs) setShiftMsgs(prev => prev.length ? prev : INITIAL_SHIFT_MESSAGES);
    } catch (err) {
      console.warn('Network issue loading overview data, using local seed fallback:', err);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
      setActivities(prev => prev.length ? prev : INITIAL_ACTIVITY);
      setShiftMsgs(prev => prev.length ? prev : INITIAL_SHIFT_MESSAGES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Refresh overview stats every 15s
    const timer = setInterval(loadData, 15000);
    return () => clearInterval(timer);
  }, []);

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgContent.trim()) return;

    try {
      const response = await fetch('/api/shift-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: currentOperator?.name || 'Operator',
          content: newMsgContent,
          shift: activeTab
        })
      });

      if (response.ok) {
        const addedMsg = await response.json();
        setShiftMsgs([addedMsg, ...shiftMsgs]);
        setNewMsgContent('');
      }
    } catch (err) {
      console.error('Error posting message:', err);
    }
  };

  if (loading) {
    return <PageLoader message="Initializing Simcote Terminal console..." />;
  }

  // Calculate live summary cards
  const activeCoating = bundles.filter(b => b.location === 'Coat-Station').length;
  const activeShear = bundles.filter(b => b.location.startsWith('Shear')).length;
  const activeBending = bundles.filter(b => b.status === 'BENDING').length;
  const loadedCount = bundles.filter(b => b.status === 'LOADED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="landing-page-root">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/40 relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-500" />
            <h1 className="font-sans text-xl font-bold text-white tracking-tight">Simcote Manufacturing Terminal</h1>
          </div>
          <p className="text-xs text-slate-400 font-mono tracking-wide">
            Saint Paul Yard Operations Control Cabin • 2300 Highway 61 N, Saint Paul, MN 55109
          </p>
        </div>
        
        {/* Active operator card */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-mono font-bold text-sm">
            {currentOperator?.name.charAt(0) || 'U'}
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white">{currentOperator?.name || 'Unassigned Operator'}</div>
            <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">
              {currentRole.replace('_', ' ')} • {currentOperator?.currentStation || 'Control Center'}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'COATING LINE', count: activeCoating, color: 'text-sky-400', desc: 'At coat station' },
          { label: 'SHEAR BED', count: activeShear, color: 'text-indigo-400', desc: 'Sizing queued' },
          { label: 'FABRICATION', count: activeBending, color: 'text-amber-500', desc: 'Being bent' },
          { label: 'SHIPPED/LOADED', count: loadedCount, color: 'text-emerald-400', desc: 'Trailers staged' },
        ].map((item, idx) => (
          <div key={idx} className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/60 hover:border-slate-800 transition-all">
            <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500">{item.label}</div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-mono font-bold ${item.color}`}>{item.count}</span>
              <span className="text-xxs font-mono text-slate-400">bundles</span>
            </div>
            <p className="text-xxs text-slate-500 font-mono mt-1">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Main split grid: Activity Feed & Shift Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Logs (Left Col: 2 spans) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <h2 className="font-sans text-sm font-bold text-white uppercase tracking-wider">Live Activity Stream</h2>
            </div>
            <button 
              onClick={loadData}
              className="text-xxs font-mono text-slate-500 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>SYNC NOW</span>
            </button>
          </div>

          <div className="bg-slate-950/40 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-900/80 max-h-[460px] overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="p-8 text-center font-mono text-xs text-slate-500">No recent physical events logged on the floor.</p>
            ) : (
              activities.map((ev) => (
                <div key={ev.id} className="p-3.5 hover:bg-slate-900/20 transition-colors flex items-start gap-3 text-xs">
                  <div className="mt-0.5 rounded-sm bg-slate-905 p-1.5 text-slate-400 border border-slate-800 font-mono text-[9px] scale-95 font-bold">
                    {ev.action}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-white hover:text-amber-400 cursor-pointer">
                        Bundle {ev.tagId}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1 font-sans text-xxs">
                      Moved from <span className="font-mono text-slate-300">{ev.fromLocation}</span> <ArrowRight className="h-2.5 w-2.5 inline mx-1" /> <span className="font-mono text-slate-300">{ev.toLocation}</span>
                    </p>
                    {ev.details && (
                      <p className="text-slate-500 font-mono text-[10px] mt-1 bg-slate-900/40 px-2 py-1 rounded inline-block">
                        {ev.details}
                      </p>
                    )}
                    <p className="text-slate-600 font-mono text-[9px] mt-1 uppercase tracking-wide">
                      OPERATOR: {ev.operatorName}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Shift log messages board (Right Col: 1 span) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              <h2 className="font-sans text-sm font-bold text-white uppercase tracking-wider">Shift Controls</h2>
            </div>
          </div>

          {/* S5. Supervisor Shift Handoff Control Desk */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3" id="handoff-desk">
            <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-bold block">
              📋 Operational Handoff Desk
            </span>
            <p className="text-xxs font-sans text-slate-400 leading-normal">
              Bundle work status, safety flags, and active shift instructions compiled into a formal transition checklist.
            </p>
            <button
              onClick={() => setIsHandoffOpen(true)}
              className="w-full text-center bg-amber-500 hover:bg-amber-450 text-slate-950 font-mono text-xxs font-bold py-2 rounded-lg transition-all cursor-pointer shadow-xs uppercase"
            >
              🤝 Run Handoff Wizard
            </button>
          </div>

          <div className="bg-slate-900/20 rounded-xl border border-slate-800 p-4 space-y-4" id="shift-message-cabin">
            {/* Shift selection tabs */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('First Shift')}
                className={`flex-1 rounded-md py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer ${
                  activeTab === 'First Shift'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1st (6a - 4:30p)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Second Shift')}
                className={`flex-1 rounded-md py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all cursor-pointer ${
                  activeTab === 'Second Shift'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                2nd (4:30p - 3a)
              </button>
            </div>

            {/* Post message form */}
            <form onSubmit={handlePostMessage} className="space-y-2">
              <textarea
                value={newMsgContent}
                onChange={(e) => setNewMsgContent(e.target.value)}
                placeholder={`Post a log note for ${activeTab}...`}
                className="w-full text-xs font-mono bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
                rows={2}
              />
              <button
                type="submit"
                disabled={!newMsgContent.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.8 text-xxs font-mono tracking-wider font-bold bg-slate-900 text-amber-500 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 rounded-lg cursor-pointer transition-colors"
                id="post-note-button"
              >
                <Send className="h-3.5 w-3.5" />
                <span>POST SHIFT NOTE</span>
              </button>
            </form>

            {/* List of messages filtered by active tab */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {shiftMsgs.filter(m => m.shift === activeTab).length === 0 ? (
                <p className="text-center font-mono text-[10px] text-slate-500 py-6">No reports logged for this shift.</p>
              ) : (
                shiftMsgs.filter(m => m.shift === activeTab).map((msg) => (
                  <div key={msg.id} className="bg-slate-950/60 p-3 rounded-lg border border-slate-900 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xxs font-mono">
                      <span className="font-bold text-slate-300">{msg.sender}</span>
                      <span className="text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xxs text-slate-400 font-sans tracking-wide leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {isHandoffOpen && (
        <HandoffWizardModal 
          onClose={() => setIsHandoffOpen(false)}
          onComplete={async (handoffSummary) => {
            try {
              const response = await fetch('/api/shift-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sender: `${currentOperator?.name || 'Supervisor'} (Handoff)`,
                  content: handoffSummary,
                  shift: activeTab
                })
              });
              if (response.ok) {
                loadData();
                setIsHandoffOpen(false);
              }
            } catch (err) {
              console.error('Failed to post handoff message:', err);
            }
          }}
          bundles={bundles}
        />
      )}
    </div>
  );
}

interface HandoffWizardModalProps {
  onClose: () => void;
  onComplete: (handoffSummary: string) => Promise<void>;
  bundles: Bundle[];
}

function HandoffWizardModal({ onClose, onComplete, bundles }: HandoffWizardModalProps) {
  const [step, setStep] = useState(1);
  const [lockoutChecked, setLockoutChecked] = useState(false);
  const [housekeepingChecked, setHousekeepingChecked] = useState(false);
  const [craneCalibrated, setCraneCalibrated] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Stats for the current warehouse floor state
  const unbendingCount = bundles.filter(b => b.status === 'BENDING').length;
  const rawCount = bundles.filter(b => b.status === 'RAW').length;
  const coatedCount = bundles.filter(b => b.status === 'COATED').length;
  const totalCount = bundles.length;

  const handleFinish = async () => {
    setLoadingComplete(true);
    const summary = `*** SHIFT OPERATIONAL HANDOFF REPORT ***\n- All cranes parked and calibrated: ${craneCalibrated ? 'YES' : 'NO'}\n- Lockout Tagout procedures verified: ${lockoutChecked ? 'YES' : 'NO'}\n- Housekeeping finished: ${housekeepingChecked ? 'YES' : 'NO'}\n- Current active inventory: ${totalCount} packages total (${unbendingCount} in bending, ${rawCount} raw, ${coatedCount} coated).\n- Shift Supervisor observations:\n"${additionalNotes || 'No additional shift notes provided.'}"`;
    await onComplete(summary);
    setLoadingComplete(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" id="handoff-wizard-modal">
      <div className="bg-slate-900 border border-slate-850 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden text-left">
        <div className="absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r from-teal-500 to-amber-500"></div>

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="font-mono text-xs font-black text-white tracking-widest uppercase">
            Supervisor Handoff Desk (Step {step}/2)
          </span>
          <button onClick={onClose} className="text-slate-500 hover:text-white font-mono text-xs cursor-pointer select-none">✕</button>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <span className="text-[9px] font-mono text-slate-505 uppercase tracking-widest font-black block border-b border-slate-955 pb-1 text-slate-500">
              Step 1: Shift Safety Checkpoint
            </span>
            <p className="text-xxs text-slate-405 font-sans leading-relaxed text-slate-400">
              Before passing control to the incoming crew, the outgoing supervisor must explicitly verify the following physical safeguards:
            </p>

            <div className="space-y-3 font-mono text-xxs bg-slate-950/50 p-4 border border-slate-850 rounded-xl text-left">
              <label className="flex items-start gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={lockoutChecked}
                  onChange={(e) => setLockoutChecked(e.target.checked)}
                  className="mt-0.5 bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
                />
                <span>Lockout/Tagout (LOTO) energy isolation verifications matched</span>
              </label>

              <label className="flex items-start gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={housekeepingChecked}
                  onChange={(e) => setHousekeepingChecked(e.target.checked)}
                  className="mt-0.5 bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
                />
                <span>Floor housekeeping cleared of scrap wire/cutting slag remnants</span>
              </label>

              <label className="flex items-start gap-2.5 text-slate-300 hover:text-white cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={craneCalibrated}
                  onChange={(e) => setCraneCalibrated(e.target.checked)}
                  className="mt-0.5 bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 rounded cursor-pointer"
                />
                <span>NW, NE, SW, SE Gantry cranes set to neutral staging buffers</span>
              </label>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!lockoutChecked || !housekeepingChecked || !craneCalibrated}
              className="w-full text-center py-2 bg-amber-500 hover:bg-amber-450 disabled:bg-slate-950 disabled:text-slate-600 disabled:border-slate-850 text-slate-950 font-mono text-xxs font-bold rounded-lg border border-amber-500 select-none cursor-pointer transition-colors"
            >
              PROCEED TO OBSERVATIONS ▶
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-black block border-b border-slate-950 pb-1">
              Step 2: Operations Balance & Notes
            </span>

            <div className="space-y-2.5 p-3 bg-slate-950 rounded-xl border border-slate-850 text-xxs font-mono">
              <span className="text-slate-500 text-[8px] uppercase font-black">Automatic Balance Count</span>
              <div className="flex justify-between">
                <span className="text-slate-400">Total rebar packs tracked:</span>
                <span className="text-white font-bold">{totalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Currently being fabricated (Bent):</span>
                <span className="text-amber-500 font-bold">{unbendingCount}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-mono text-slate-400 block uppercase font-bold text-left">Additional Supervisor Shift logs</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Include details about any CNC machine maintenance, crane anomalies, or upcoming hot-rolled shipments..."
                className="w-full text-xxs font-mono bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 text-center py-2 bg-slate-950 text-slate-400 hover:text-white font-mono text-xxs font-bold rounded-lg border border-slate-850 select-none cursor-pointer transition-colors"
              >
                ◀ BACK
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={loadingComplete}
                className="flex-1 text-center py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-mono text-xxs font-bold rounded-lg select-none cursor-pointer transition-colors border border-emerald-500"
              >
                {loadingComplete ? 'SUBMITTING...' : 'COMPILE & HANDOFF'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
