import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Exception, Bundle } from '../types';
import { INITIAL_BUNDLES, INITIAL_EXCEPTIONS } from '../seedData';
import PageLoader from '../components/PageLoader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  RefreshCw, 
  PlusCircle, 
  Trash2,
  Calendar,
  Lock,
  User 
} from 'lucide-react';

export default function ExceptionsPage() {
  const { currentRole, currentOperator } = useApp();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedType, setSelectedType] = useState('Misplaced Bar');
  const [description, setDescription] = useState('');
  const [coatingDamagePct, setCoatingDamagePct] = useState('2.5');
  const [damagedFootSection, setDamagedFootSection] = useState('Section 3');
  
  // Notification states
  const [errMessage, setErrMessage] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const loadExceptionsData = async () => {
    try {
      const [eRes, bRes] = await Promise.all([
        fetch('/api/exceptions').catch(() => null),
        fetch('/api/bundles').catch(() => null)
      ]);

      let gotEx = false;
      let gotBundles = false;

      if (eRes && eRes.ok) {
        setExceptions(await eRes.json());
        gotEx = true;
      }
      if (bRes && bRes.ok) {
        setBundles(await bRes.json());
        gotBundles = true;
      }

      if (!gotEx) setExceptions(prev => prev.length ? prev : INITIAL_EXCEPTIONS);
      if (!gotBundles) setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } catch (err) {
      console.warn('Network issue fetching exceptions, using local seed fallback:', err);
      setExceptions(prev => prev.length ? prev : INITIAL_EXCEPTIONS);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptionsData();

    // Support URL pre-fill check (e.g. ?tagId=TG-104)
    const params = new URLSearchParams(window.location.search);
    const presetTag = params.get('tagId');
    if (presetTag) {
      setSelectedTag(presetTag);
    }
  }, []);

  const clearAlerts = () => {
    setErrMessage(null);
    setOkMessage(null);
  };

  const handleSubmitException = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    if (!selectedTag) {
      setErrMessage('Select a bundle Tag ID to report exceptions against.');
      return;
    }
    if (!description.trim()) {
      setErrMessage('Provide a short description of the floor error.');
      return;
    }

    try {
      const response = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagId: selectedTag,
          operatorName: currentOperator?.name || 'Floor Operator',
          type: selectedType,
          description: description,
          qualityAudit: selectedType === 'Quality Audit' ? {
            coatingDamagePct: Number(coatingDamagePct),
            damagedFootSection: damagedFootSection
          } : undefined
        })
      });

      if (response.ok) {
        setOkMessage(`Exception reported successfully against bundle ${selectedTag}.`);
        setSelectedTag('');
        setDescription('');
        loadExceptionsData();
      } else {
        const errData = await response.json();
        setErrMessage(errData.error || 'Failed to submit error report.');
      }
    } catch (err) {
      setErrMessage('Network failure sending exception report.');
    }
  };

  const handleResolveException = async (expId: string) => {
    clearAlerts();
    try {
      const response = await fetch(`/api/exceptions/${expId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedBy: currentOperator?.name || 'Administrator Override'
        })
      });

      if (response.ok) {
        setOkMessage(`Exception ${expId} has been successfully resolved & archived.`);
        loadExceptionsData();
      } else {
        const errData = await response.json();
        setErrMessage(errData.error || 'Failed to resolve exception.');
      }
    } catch (err) {
      setErrMessage('Network error resolving exception.');
    }
  };

  if (loading) {
    return <PageLoader message="Inspecting floor error logs..." />;
  }

  // Filter lists: open vs archived resolved exceptions
  const openExceptions = exceptions.filter(e => e.status === 'OPEN');
  const resolvedExceptions = exceptions.filter(e => e.status === 'RESOLVED');

  // Generate 7-day trend data for Recharts, showing resolved vs open exceptions per day over the last 7 days.
  const getLast7DaysTrend = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      const dateStart = new Date(d);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(d);
      dateEnd.setHours(23, 59, 59, 999);

      const dayExceptions = exceptions.filter(e => {
        const t = new Date(e.timestamp);
        return t >= dateStart && t <= dateEnd;
      });

      const openCount = dayExceptions.filter(e => e.status === 'OPEN').length;
      const resolvedCount = dayExceptions.filter(e => e.status === 'RESOLVED').length;

      data.push({
        name: label,
        'Open Exceptions': openCount,
        'Resolved Exceptions': resolvedCount,
      });
    }
    return data;
  };

  const chartData = getLast7DaysTrend();

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="exceptions-page-root">
      
      {/* Page Title row */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-sans text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Plant-Floor Exceptions Control Desk</span>
          </h1>
          <p className="text-xxs text-slate-400 font-mono tracking-wider mt-0.5 uppercase">DEVIATION REPORTING & MITIGATION LOGGER</p>
        </div>
        <button
          onClick={loadExceptionsData}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xxs font-mono tracking-wider text-slate-400 hover:text-amber-400 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>SYNC LOGS</span>
        </button>
      </div>

      {/* Warning/OK Banners */}
      {errMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <strong>LOG ACCIDENT SYSTEM ALARM:</strong> {errMessage}
          </div>
          <button onClick={clearAlerts} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {okMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-mono flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div className="flex-1 font-mono">
            <strong>FLIGHT CORRECTION LOGGED:</strong> {okMessage}
          </div>
          <button onClick={clearAlerts} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {/* 7-Day Deviation Metrics Summary Chart */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <span>📈 Floor Exception Trends (Last 7 Days)</span>
        </h3>
        <p className="text-xxs font-sans text-slate-400 leading-normal max-w-xl">
          Tracks the volume of unresolved active deviation holds versus resolved and archived issues across the last week, optimizing recovery logs on the plant-floor.
        </p>
        <div className="h-44 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px' }}
                labelStyle={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}
                itemStyle={{ fontSize: '10px', fontFamily: 'monospace' }}
              />
              <Legend 
                verticalAlign="top" 
                height={28} 
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }}
              />
              <Bar dataKey="Open Exceptions" name="Open Holds" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Resolved Exceptions" name="Resolved Log Archives" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main split: Report Exception Form (Left/Top) vs Ongoing lists (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form panel to submit a new plant deviation (Left Col: 1 span) */}
        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4" id="report-exception-form">
            <div className="border-b border-slate-900 pb-2">
              <h2 className="text-xs font-bold font-mono text-white uppercase tracking-widest flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-emerald-500" />
                <span>File Plant Deviation</span>
              </h2>
            </div>

            <form onSubmit={handleSubmitException} className="space-y-4">
              {/* Pre-fill bundle list */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Associated Bundle Tag ID</label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:border-amber-500"
                >
                  <option value="">-- Choose Residing Tag --</option>
                  {bundles.map((b) => (
                    <option key={b.id} value={b.tagId}>
                      {b.tagId} ({b.grade} • Job: {b.jobId})
                    </option>
                  ))}
                </select>
              </div>

              {/* Deviation type selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Accident Classification</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:border-amber-500"
                >
                  <option value="Misplaced Bar">Misplaced Bar / Bundle Loose</option>
                  <option value="Incorrect Grade">Incorrect Grade Loading Collision</option>
                  <option value="Bent Spec Error">Bent Spec Error Fabrication Halt</option>
                  <option value="Damaged Coating">Damaged Epoxy Coating Scratch</option>
                  <option value="Machine Breakdown">Processing Machinery Halt</option>
                  <option value="Quality Audit">Quality Audit (ASTM QC Compliance)</option>
                </select>
              </div>

              {selectedType === 'Quality Audit' && (
                <div className="space-y-4 p-3.5 bg-rose-950/20 border border-rose-500/20 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-rose-400 block font-bold">Coating Damage Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={coatingDamagePct}
                      onChange={(e) => setCoatingDamagePct(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs font-mono focus:border-rose-500"
                    />
                    <p className="text-[9px] text-slate-500 font-mono">ASTM standard automatic REJECTION is triggered if damage &gt; 2.0%.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-rose-400 block font-bold">Damaged 1-Foot Section ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1-foot section #3"
                      value={damagedFootSection}
                      onChange={(e) => setDamagedFootSection(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs font-mono focus:border-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* Accompanying descriptive body */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block">Descriptive Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise details (e.g. sheared short by 12 inches on North Bed)..."
                  className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 text-xs font-mono focus:border-amber-500"
                  rows={4}
                />
              </div>

              {/* Submit trigger button */}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 font-mono text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
              >
                <span>LOG ACCIDENT REPORT</span>
              </button>
            </form>
          </div>
        </div>

        {/* Existing Open & Closed deviations monitor lists (Right Col: 2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active deviations needing administrative clearance */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-bounce"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>Active Deviation holds ({openExceptions.length})</span>
            </h3>

            {openExceptions.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-950/20 font-mono text-xs text-slate-550">
                All production lines report clean sheets. No hold active.
              </div>
            ) : (
              <div className="space-y-2.5">
                {openExceptions.map((ex) => (
                  <div key={ex.id} className="bg-slate-900/40 border border-rose-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xxs font-bold text-rose-500 bg-rose-500/10 px-1.8 py-0.5 rounded border border-rose-500/20">
                          {ex.type}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">Bundle {ex.tagId}</span>
                      </div>
                      <p className="text-xxs text-slate-300 font-sans leading-normal pt-1.5">
                        {ex.description}
                      </p>
                      {ex.qualityAudit && (
                        <div className="mt-2 p-2 bg-rose-950/10 border border-rose-500/10 rounded-lg text-xxs font-mono space-y-1">
                          <div className="font-bold text-rose-400">🔍 ASTM QC Audit Data:</div>
                          <div className="text-slate-300">
                            Coating Damage: <span className={`font-bold ${ex.qualityAudit.coatingDamagePct > 2 ? 'text-rose-500' : 'text-amber-400'}`}>{ex.qualityAudit.coatingDamagePct}%</span> in 1-Foot Section: <span className="text-white font-bold">{ex.qualityAudit.damagedFootSection}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(ex.timestamp).toLocaleTimeString()}</span>
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Reporter: {ex.operatorName}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-start md:items-center">
                      {currentRole === 'ADMIN' ? (
                        <button
                          onClick={() => handleResolveException(ex.id)}
                          className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-mono text-xxs font-bold px-3 py-1.8 rounded-lg cursor-pointer transition-colors"
                        >
                          ARCHIVE RESOLVED
                        </button>
                      ) : (
                        <span className="font-mono text-[9px] text-slate-550 uppercase select-none tracking-wider flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Admin Only
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolved/Archived deviations list */}
          <div className="space-y-3 pt-4 border-t border-slate-900">
            <h3 className="text-xs font-bold font-mono text-slate-500 uppercase tracking-widest pl-1">
              Archived Holds ({resolvedExceptions.length})
            </h3>

            {resolvedExceptions.length === 0 ? (
              <p className="text-center font-mono text-xxs text-slate-650 py-8">No archived deviation reports listed.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {resolvedExceptions.map((ex) => (
                  <div key={ex.id} className="bg-slate-950/60 p-3 border border-slate-900 rounded-xl flex flex-col md:flex-row justify-between gap-4 text-xxs font-mono text-slate-500">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[9.5px] font-bold text-slate-400">Bundle {ex.tagId}</span>
                        <span className="text-slate-600">({ex.type})</span>
                      </div>
                      <p className="text-slate-400 font-sans py-1 leading-normal">{ex.description}</p>
                      {ex.qualityAudit && (
                        <div className="my-1.5 p-1.5 bg-slate-900/40 border border-slate-800 rounded-lg text-[10px] font-mono space-y-0.5">
                          <div className="text-slate-500">ASTM QC: <span className="text-slate-400 font-bold">{ex.qualityAudit.coatingDamagePct}%</span> damage in section <span className="text-slate-400 font-bold">{ex.qualityAudit.damagedFootSection}</span></div>
                        </div>
                      )}
                      <span className="text-xxs block text-slate-600">RESOLVED BY {ex.resolvedBy} AT {new Date(ex.resolvedAt!).toLocaleTimeString()}</span>
                    </div>
                    <span className="text-xxs text-emerald-500 flex items-center gap-1 font-bold shrink-0 self-start md:self-center">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> CLOSED
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
