import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Bundle, Job } from '../types';
import { INITIAL_BUNDLES, INITIAL_JOBS } from '../seedData';
import PageLoader from '../components/PageLoader';
import BundleDetailModal from '../components/BundleDetailModal';
import { useLocation } from 'wouter';
import { 
  Briefcase, 
  ChevronRight, 
  ChevronDown, 
  RefreshCw, 
  AlertTriangle, 
  Truck,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle,
  Eye
} from 'lucide-react';

export default function JobsPage() {
  const { currentRole, currentOperator } = useApp();
  const [, setLoc] = useLocation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal inspection display
  const [selectedBundleForModal, setSelectedBundleForModal] = useState<Bundle | null>(null);

  // Accordion open/close state mapped by Job ID
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  
  // Searching / filtering
  const [searchVal, setSearchVal] = useState('');

  // Advanced Filtering / Sorting parameters
  const [jobGradeFilter, setJobGradeFilter] = useState<'ALL' | 'Epoxy' | 'Black'>('ALL');
  const [jobSortOption, setJobSortOption] = useState<'DEFAULT' | 'PROGRESS_DESC' | 'PROGRESS_ASC' | 'TONS_DESC' | 'ORDER_ASC'>('DEFAULT');
  const [bundleSortOption, setBundleSortOption] = useState<'TAG_ASC' | 'WEIGHT_DESC' | 'LENGTH_DESC' | 'STATUS_ASC'>('TAG_ASC');

  // Admin Force Load override drawer state
  const [forceLoadActiveId, setForceLoadActiveId] = useState<string | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<string>('');
  const [selectedTrailer, setSelectedTrailer] = useState<'Flatbed' | 'Step Deck'>('Flatbed');
  const [cncBypass, setCncBypass] = useState<boolean>(false);
  const [overrideErr, setOverrideErr] = useState<string | null>(null);
  const [overrideOk, setOverrideOk] = useState<string | null>(null);

  // Bulk operations states
  const [selectedBundleIds, setSelectedBundleIds] = useState<Record<string, boolean>>({});
  const [bulkActionErr, setBulkActionErr] = useState<string | null>(null);
  const [bulkActionSuccess, setBulkActionSuccess] = useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const handleBulkAction = async (action: 'LOAD' | 'STAGE' | 'SEND_TO_FABRICATION') => {
    setBulkActionErr(null);
    setBulkActionSuccess(null);
    const bundleIds = Object.keys(selectedBundleIds).filter(id => selectedBundleIds[id]);

    if (bundleIds.length === 0) {
      setBulkActionErr('WARNING: Check at least one bundle before selecting a bulk operation.');
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const response = await fetch('/api/bundles/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleIds,
          action,
          operatorName: currentOperator?.name || 'Bulk Operator'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBulkActionSuccess(`BATCH COMPLETED: Processed ${data.count} bundles via '${action}' bulk command.`);
        setSelectedBundleIds({}); // Clear selected checkboxes
        fetchJobsData();
      } else {
        const errData = await response.json();
        setBulkActionErr(errData.error || 'Failed to submit batch operations.');
      }
    } catch (err) {
      setBulkActionErr('Network transmission error executing bulk command.');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const fetchJobsData = async () => {
    try {
      const [jRes, bRes] = await Promise.all([
        fetch('/api/jobs').catch(() => null),
        fetch('/api/bundles').catch(() => null)
      ]);

      let gotJobs = false;
      let gotBundles = false;

      if (jRes && jRes.ok) {
        setJobs(await jRes.json());
        gotJobs = true;
      }
      if (bRes && bRes.ok) {
        setBundles(await bRes.json());
        gotBundles = true;
      }

      if (!gotJobs) setJobs(prev => prev.length ? prev : INITIAL_JOBS);
      if (!gotBundles) setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } catch (err) {
      console.warn('Network issue fetching jobs inventory, using local seed fallback:', err);
      setJobs(prev => prev.length ? prev : INITIAL_JOBS);
      setBundles(prev => prev.length ? prev : INITIAL_BUNDLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsData();
  }, []);

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const handleOverrideForceLoad = async (bundle: Bundle) => {
    setOverrideErr(null);
    setOverrideOk(null);

    // Safeguard 1: Operator Authorization Check
    if (currentRole !== 'ADMIN') {
      setOverrideErr('AUTHORIZATION DENIED: Force-loading is restricted exclusively to certified Administrators.');
      return;
    }

    // Safeguard 2: Target Door existence
    if (!selectedDoor) {
      setOverrideErr('SAFETY EXCEPTION: Select a targeted loading door.');
      return;
    }

    // Safeguard 3: Epoxy vs Black door mismatch constraints
    if (bundle.grade === 'Epoxy') {
      const allowedEpoxyDoors = ['Door-1', 'Door-2', 'Door-3', 'North-End'];
      if (!allowedEpoxyDoors.includes(selectedDoor)) {
        setOverrideErr(`GEOMETRICAL DEVIATION: Epoxy coated rebar cannot reside at black raw steel door ${selectedDoor}. Must use NW/NE Bay Doors.`);
        return;
      }
    } else {
      const allowedBlackDoors = ['Door-7', 'Door-8'];
      if (!allowedBlackDoors.includes(selectedDoor)) {
        setOverrideErr(`GEOMETRICAL DEVIATION: Standard carbon black rebar is restricted to SW Bay Doors ${selectedDoor}. Must use Door-7 or Door-8.`);
        return;
      }
    }

    // Safeguard 4: Dynamic legal highway weight limit checks for Gantry Trailing
    const maxTonnageAllowed = selectedTrailer === 'Flatbed' ? 25000 : 40500;
    // Calculate weight already dispatched to this door's trailer
    const currentlyOnDoorTrailer = bundles
      .filter(b => b.status === 'LOADED' && b.location === selectedDoor)
      .reduce((sum, b) => sum + (b.weight || 0), 0);
    
    if (currentlyOnDoorTrailer + bundle.weight > maxTonnageAllowed) {
      setOverrideErr(`HIGHWAY LOAD VIOLATION: Current trailer weight at ${selectedDoor} is ${currentlyOnDoorTrailer.toLocaleString()} lbs. Loading this bundle (${bundle.weight.toLocaleString()} lbs) exceeds max allowed cargo limit of ${maxTonnageAllowed.toLocaleString()} lbs for a ${selectedTrailer}. Please select a different deck or clear the trailer!`);
      return;
    }

    // Safeguard 5: Active CNC Bending clear indicators override requirement
    if ((bundle.status === 'BENDING' || bundle.status === 'RAW') && !cncBypass) {
      setOverrideErr(`CRITICAL INTERLOCK ALERT: Bundle ${bundle.tagId} has status ${bundle.status}. Direct dispatch requires confirmation of mechanical clearance. Please certify manual CNC clearance to proceed.`);
      return;
    }

    try {
      const response = await fetch(`/api/bundles/${bundle.id}/force-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: currentOperator?.name || 'Administrator Override',
          door: selectedDoor,
          trailerSize: selectedTrailer
        })
      });

      if (response.ok) {
        setOverrideOk(`Bundle ${bundle.tagId} has been administrative force-loaded onto a ${selectedTrailer} trailer at ${selectedDoor}. Total trailer payload is now ${(currentlyOnDoorTrailer + bundle.weight).toLocaleString()} / ${maxTonnageAllowed.toLocaleString()} lbs.`);
        setForceLoadActiveId(null);
        setSelectedDoor('');
        setCncBypass(false);
        fetchJobsData();
      } else {
        const errData = await response.json();
        setOverrideErr(errData.error || 'Direct override dispatch failed.');
      }
    } catch (err) {
      setOverrideErr('Communications failure during Override force load.');
    }
  };

  const isJobMatch = (j: Job): boolean => {
    const term = searchVal.trim().toLowerCase();
    if (!term) return false;
    return (
      j.customerName.toLowerCase().includes(term) ||
      j.projectName.toLowerCase().includes(term) ||
      j.orderNumber.toLowerCase().includes(term) ||
      j.id.toLowerCase().includes(term)
    );
  };

  const isBundleMatch = (b: Bundle): boolean => {
    const term = searchVal.trim().toLowerCase();
    if (!term) return false;
    return (
      b.tagId.toLowerCase().includes(term) ||
      (b.mark && b.mark.toLowerCase().includes(term)) ||
      (b.location && b.location.toLowerCase().includes(term)) ||
      b.status.toLowerCase().includes(term) ||
      b.grade.toLowerCase().includes(term) ||
      b.barSize.toLowerCase().includes(term) ||
      String(b.length).includes(term) ||
      String(b.weight).includes(term)
    );
  };

  const highlightText = (val: string | number | undefined, search: string) => {
    if (val === undefined || val === null) return null;
    const text = String(val);
    if (!search || !search.trim()) return <>{text}</>;
    try {
      const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedSearch})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) => 
            regex.test(part) ? (
              <mark key={i} className="bg-amber-500/25 text-amber-250 py-0.5 px-1 rounded font-bold border border-amber-500/40 no-underline shadow-xs">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch (err) {
      return <>{text}</>;
    }
  };

  const getBundleStatusClass = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'RAW':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
      case 'STAGED':
        return 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25';
      case 'LOADED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      case 'BENDING':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse';
      case 'RACKED':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'COATED':
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
      default:
        return 'bg-slate-950 text-slate-500 border border-slate-900';
    }
  };

  // Auto-expand accordions that contain matches when search criteria updates
  useEffect(() => {
    const term = searchVal.trim();
    if (!term) return;

    const matchingIds: Record<string, boolean> = {};
    jobs.forEach(job => {
      const jobBundles = bundles.filter(b => b.jobId === job.id);
      if (isJobMatch(job) || jobBundles.some(b => isBundleMatch(b))) {
        matchingIds[job.id] = true;
      }
    });

    if (Object.keys(matchingIds).length > 0) {
      setExpandedJobs(prev => ({ ...prev, ...matchingIds }));
    }
  }, [searchVal, jobs, bundles]);

  if (loading) {
    return <PageLoader message="Calling jobs repositories..." />;
  }

  // Filter and sort list of jobs matching search term and active advanced parameters
  let filteredJobs = jobs.filter(j => {
    // 1. Search Query mapping
    const term = searchVal.trim().toLowerCase();
    const passesSearch = !term || isJobMatch(j) || bundles.filter(b => b.jobId === j.id).some(isBundleMatch);
    if (!passesSearch) return false;

    // 2. Job Grade filtration
    if (jobGradeFilter !== 'ALL') {
      const jobBundles = bundles.filter(b => b.jobId === j.id);
      const matchesGrade = jobBundles.some(b => b.grade === jobGradeFilter);
      if (!matchesGrade) return false;
    }

    return true;
  });

  // Now sort the jobs list
  filteredJobs = [...filteredJobs].sort((a, b) => {
    if (jobSortOption === 'PROGRESS_DESC') {
      const aPct = a.totalBundles ? (a.completedBundles / a.totalBundles) : 0;
      const bPct = b.totalBundles ? (b.completedBundles / b.totalBundles) : 0;
      return bPct - aPct;
    }
    if (jobSortOption === 'PROGRESS_ASC') {
      const aPct = a.totalBundles ? (a.completedBundles / a.totalBundles) : 0;
      const bPct = b.totalBundles ? (b.completedBundles / b.totalBundles) : 0;
      return aPct - bPct;
    }
    if (jobSortOption === 'TONS_DESC') {
      const aWeight = bundles.filter(b => b.jobId === a.id).reduce((sum, b) => sum + (b.weight || 0), 0);
      const bWeight = bundles.filter(b => b.jobId === b.id).reduce((sum, b) => sum + (b.weight || 0), 0);
      return bWeight - aWeight;
    }
    if (jobSortOption === 'ORDER_ASC') {
      return a.orderNumber.localeCompare(b.orderNumber);
    }
    return 0; // Default
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6" id="jobs-page-root">
      
      {/* Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-sans text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-amber-500" />
            <span>Facility Jobs & Fabricated Bundles Registry</span>
          </h1>
          <p className="text-xxs text-slate-400 font-mono tracking-wider mt-0.5 uppercase">ADMIN OVERRIDES • ALL ACTIVE JOBS LIST</p>
        </div>
        
        {/* Search header input */}
        <div className="relative inline-block w-full md:w-64">
          <input
            type="text"
            placeholder="Search Project / Client name..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full text-xs font-mono bg-slate-900 text-slate-200 border border-slate-800 rounded-lg pl-9 pr-3 py-1.8 focus:border-amber-500 focus:outline-hidden"
          />
          <Search className="absolute left-3 top-2.2 h-3.5 w-3.5 text-slate-500" />
        </div>
      </div>

      {/* Advanced Filtering & Sorters Panel */}
      <div className="bg-slate-950/70 p-4 border border-slate-900 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-dashed" id="jobs-filters-toolbar-container">
        <div className="space-y-1">
          <h2 className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Registry Smart Filters & Advanced Sorting Options
          </h2>
          <p className="text-[9px] font-mono text-slate-500 leading-none">
            Isolate scheduled client projects, order completion rates, or reorder the nested structural package logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Material Grade selectivity */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase">Grade:</span>
            <select
              value={jobGradeFilter}
              onChange={(e) => setJobGradeFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-350 font-mono text-[10px] px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Grades</option>
              <option value="Epoxy">Epoxy Coating Only</option>
              <option value="Black">Carbon Black Only</option>
            </select>
          </div>

          {/* Jobs Sorting Option */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase">Sort Jobs:</span>
            <select
              value={jobSortOption}
              onChange={(e) => setJobSortOption(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-355 font-mono text-[10px] px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-hidden cursor-pointer"
            >
              <option value="DEFAULT">Default (Planned Index)</option>
              <option value="PROGRESS_DESC">Percent Complete (% High → Low)</option>
              <option value="PROGRESS_ASC">Percent Complete (% Low → High)</option>
              <option value="TONS_DESC">Total Tonnage (Tons High → Low)</option>
              <option value="ORDER_ASC">Order Number (Alphabetical)</option>
            </select>
          </div>

          {/* Bundles Sorting Option */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-slate-500 uppercase">Sort Bundles:</span>
            <select
              value={bundleSortOption}
              onChange={(e) => setBundleSortOption(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-355 font-mono text-[10px] px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-hidden cursor-pointer"
            >
              <option value="TAG_ASC">Bundle Tag ID (A-Z)</option>
              <option value="WEIGHT_DESC">Weight (lbs Heavy → Light)</option>
              <option value="LENGTH_DESC">Length (ft Long → Short)</option>
              <option value="STATUS_ASC">Stage Status (Alphabetical)</option>
            </select>
          </div>

          {/* Reset Action */}
          {(jobGradeFilter !== 'ALL' || jobSortOption !== 'DEFAULT' || bundleSortOption !== 'TAG_ASC' || searchVal) && (
            <button
              onClick={() => {
                setJobGradeFilter('ALL');
                setJobSortOption('DEFAULT');
                setBundleSortOption('TAG_ASC');
                setSearchVal('');
              }}
              className="text-[9px] font-mono text-amber-500 hover:text-amber-400 border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer uppercase font-extrabold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Exception Notices if any force overrides fail/succeed */}
      {overrideErr && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-4 rounded-xl text-xs font-mono flex items-start gap-2 animate-fadeIn">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1 font-mono">
            <strong>ADMIN ALARM:</strong> {overrideErr}
          </div>
          <button onClick={() => setOverrideErr(null)} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {overrideOk && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 p-4 rounded-xl text-xs font-mono flex items-start gap-2 animate-fadeIn">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
          <div className="flex-1 font-mono">
            <strong>OVERRIDE COMPLETE:</strong> {overrideOk}
          </div>
          <button onClick={() => setOverrideOk(null)} className="text-slate-500 hover:text-white cursor-pointer select-none">✕</button>
        </div>
      )}

      {/* Jobs Accordion */}
      {filteredJobs.length === 0 ? (
        <div className="text-center p-12 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
          No matches found for search string in database logs.
        </div>
      ) : (
        <div className="space-y-3" id="jobs-accordions-group">
          {filteredJobs.map((job) => {
            const isExpanded = !!expandedJobs[job.id];
            const jobBundles = bundles.filter(b => b.jobId === job.id);
            const percentComplete = Math.round((job.completedBundles / job.totalBundles) * 100);

            const hasJobMatch = isJobMatch(job);
            const hasBundlesMatch = jobBundles.some(isBundleMatch);
            const hasAnyJobMatch = hasJobMatch || hasBundlesMatch;

            return (
              <div 
                key={job.id} 
                className={`transition-all duration-300 rounded-2xl overflow-hidden border ${
                  searchVal.trim() && hasAnyJobMatch
                    ? 'bg-amber-950/15 border-amber-500/35 shadow-md shadow-amber-500/5'
                    : 'bg-slate-900/35 border-slate-800/80 hover:border-slate-700/65'
                }`}
                id={`job-box-${job.id}`}
              >
                {/* Accordion Trigger Head */}
                <button
                  type="button"
                  onClick={() => toggleJob(job.id)}
                  aria-expanded={isExpanded}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-900/10 hover:bg-slate-900/40 text-left transition-colors cursor-pointer gap-4 border-b border-slate-950/20"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="h-4 w-4 text-slate-500 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-mono text-[10px] text-amber-500 uppercase tracking-wider">
                        {highlightText(job.id, searchVal)} • ORDER: {highlightText(job.orderNumber, searchVal)}
                      </div>
                      <h3 className="font-sans text-xs font-bold text-white mt-1 uppercase tracking-wide">
                        {highlightText(job.customerName, searchVal)}
                      </h3>
                      <p className="text-xxs text-slate-400 font-mono mt-0.5 truncate">
                        {highlightText(job.projectName, searchVal)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar info */}
                  <div className="flex items-center gap-4 shrink-0 pl-7 md:pl-0">
                    <div className="flex flex-col items-end">
                      <div className="font-mono text-xxs text-slate-400">
                        {job.completedBundles} / {job.totalBundles} LOADED
                      </div>
                      <div className="relative w-28 h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1.5 border border-slate-900">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300"
                          style={{ width: `${percentComplete}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-xs text-white font-bold w-10 text-right">{percentComplete}%</span>
                  </div>
                </button>

                 {/* Accordion Content Body: List of bundles in Job */}
                {isExpanded && (() => {
                  const sortedBundles = [...jobBundles].sort((a, b) => {
                    if (bundleSortOption === 'WEIGHT_DESC') {
                      return (b.weight || 0) - (a.weight || 0);
                    }
                    if (bundleSortOption === 'LENGTH_DESC') {
                      return (b.length || 0) - (a.length || 0);
                    }
                    if (bundleSortOption === 'STATUS_ASC') {
                      return a.status.localeCompare(b.status);
                    }
                    return a.tagId.localeCompare(b.tagId); // TAG_ASC default
                  });

                  return (
                    <div className="p-4 bg-slate-950/20 border-t border-slate-900 overflow-x-auto pr-1">
                      <table className="w-full text-left text-xxs font-mono tracking-wide text-slate-400 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-550 uppercase tracking-widest text-[9px] font-mono font-bold">
                            <th className="pb-2.5 pl-2.5">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="checkbox"
                                  checked={sortedBundles.length > 0 && sortedBundles.every(b => !!selectedBundleIds[b.id])}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedBundleIds(prev => {
                                      const updated = { ...prev };
                                      sortedBundles.forEach(b => {
                                        updated[b.id] = checked;
                                      });
                                      return updated;
                                    });
                                  }}
                                  className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 accent-amber-500 h-3.5 w-3.5 bg-slate-900 cursor-pointer"
                                  title="Select/Deselect all bundles in this job"
                                />
                                <span>Tag ID / Mark</span>
                              </div>
                            </th>
                            <th className="pb-2.5">Spec details</th>
                            <th className="pb-2.5">Route map (Designated)</th>
                            <th className="pb-2.5">Residing cell</th>
                            <th className="pb-2.5 text-center">Operational Stage</th>
                            <th className="pb-2.5 text-right pr-2">Administrative controls</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 font-mono">
                          {sortedBundles.map((b) => {
                            const isBMatched = isBundleMatch(b);
                            const isChecked = !!selectedBundleIds[b.id];
                            return (
                              <React.Fragment key={b.id}>
                                <tr className={`transition-all duration-300 border-l-2 ${
                                  isChecked 
                                    ? 'bg-amber-950/15 hover:bg-amber-950/25 border-l-amber-500 shadow-sm'
                                    : searchVal.trim() && isBMatched
                                      ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-amber-500 shadow-xs'
                                      : 'hover:bg-slate-900/10 border-l-transparent'
                                }`}>
                                  <td className="py-3 pl-2.5">
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setSelectedBundleIds(prev => ({ ...prev, [b.id]: checked }));
                                        }}
                                        className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 accent-amber-500 h-3.5 w-3.5 bg-slate-900 cursor-pointer shrink-0"
                                      />
                                      <div>
                                        <span 
                                          onClick={() => setSelectedBundleForModal(b)}
                                          className="font-bold text-slate-200 block cursor-pointer hover:underline hover:text-amber-450 transition-colors"
                                          title="Click to audit comprehensive technical specifications and 3D bend geometry"
                                        >
                                          {highlightText(b.tagId, searchVal)}
                                        </span>
                                        <span className="text-[10px] text-slate-500">{highlightText(b.mark, searchVal)}</span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-mono border uppercase mb-1 transition-all duration-200 ${
                                      b.grade === 'Epoxy' ? 'bg-teal-500/10 text-teal-400 border-teal-500/25' : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}>
                                      {highlightText(b.grade, searchVal)}
                                    </span>
                                    <div className="text-xxs font-mono text-slate-500">
                                      {highlightText(b.barSize, searchVal)} size • {highlightText(b.length, searchVal)}ft • {highlightText(b.weight, searchVal)} lbs
                                    </div>
                                  </td>
                                  <td className="py-3 max-w-[180px] break-all text-slate-500" title={b.route}>
                                    {b.route.split(' -> ').slice(-2).join(' → ')}
                                  </td>
                                  <td className="py-3 font-bold text-slate-355">{highlightText(b.location, searchVal)}</td>
                                  <td className="py-3 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase font-mono font-medium transition-all duration-200 ${getBundleStatusClass(b.status)}`}>
                                      {highlightText(b.status, searchVal)}
                                    </span>
                                  </td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Quick view specs button */}
                                    <button
                                      onClick={() => setSelectedBundleForModal(b)}
                                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-teal-500/30 rounded text-slate-300 hover:text-teal-400 cursor-pointer inline-flex items-center gap-1 font-sans text-[10px] font-bold transition-all"
                                      title="Quick view comprehensive 3D bending geometry and technical specs"
                                    >
                                      <Eye className="h-3 w-3 text-teal-400" />
                                      <span>VIEW SPECS</span>
                                    </button>
  
                                    {/* Log exception redirect button */}
                                    <button
                                      onClick={() => setLoc(`/exceptions?tagId=${b.tagId}`)}
                                      className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 hover:border-amber-500/30 rounded text-slate-400 hover:text-amber-500 cursor-pointer"
                                      title="Report fabrication exception tag"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    </button>
  
                                    {/* Force load admin override button */}
                                    {currentRole === 'ADMIN' && b.status !== 'LOADED' && (
                                      <button
                                        onClick={() => {
                                          setForceLoadActiveId(forceLoadActiveId === b.id ? null : b.id);
                                          setOverrideErr(null);
                                          setOverrideOk(null);
                                          setCncBypass(false);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-[10px] font-mono font-bold text-amber-500 hover:text-amber-400 border border-slate-850 hover:border-amber-500/20 rounded cursor-pointer transition-colors"
                                      >
                                        <Truck className="h-3.5 w-3.5" />
                                        <span>FORCE LOAD</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
  
                              {/* Fold-out Force Load Setup Block */}
                              {forceLoadActiveId === b.id && (
                                <tr>
                                  <td colSpan={6} className="bg-slate-950/40 p-3.5 border border-amber-500/15 rounded-xl">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                          <span className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider block">Admin Override Panel</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 inline-block leading-relaxed max-w-sm font-sans block">
                                          Instantly release gantry locks and load bundle {b.tagId} directly to bay doors.
                                        </span>
                                        <div className="text-[9px] font-mono text-slate-500">
                                          * Epoxy limit: Door NW/NE • Black limit: Door 7/8 SW
                                        </div>
                                      </div>
                                      
                                      <div className="flex flex-wrap items-center gap-3">
                                        {/* Status bypass */}
                                        {(b.status === 'BENDING' || b.status === 'RAW') && (
                                          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-800 rounded-lg p-2 hover:border-amber-500/40 select-none">
                                            <input
                                              type="checkbox"
                                              checked={cncBypass}
                                              onChange={() => setCncBypass(!cncBypass)}
                                              className="accent-amber-500 h-3 w-3 shrink-0 rounded border-slate-800"
                                            />
                                            <span className="text-[9px] text-amber-400 font-mono font-black uppercase">CONFIRM CNC REBAR CLEARANCE</span>
                                          </label>
                                        )}

                                        {/* Door selector */}
                                        <select
                                          value={selectedDoor}
                                          onChange={(e) => setSelectedDoor(e.target.value)}
                                          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-[10px]"
                                        >
                                          <option value="">-- Targeted Bay Door --</option>
                                          {b.grade === 'Black' ? (
                                            <>
                                              <option value="Door-7">Door-7 (SW Black Only)</option>
                                              <option value="Door-8">Door-8 (SW Black Only)</option>
                                            </>
                                          ) : (
                                            <>
                                              <option value="Door-1">Door-1 (NW Epoxy)</option>
                                              <option value="Door-2">Door-2 (NW Epoxy)</option>
                                              <option value="Door-3">Door-3 (NE Epoxy)</option>
                                              <option value="North-End">North-End Door (NE Epoxy)</option>
                                            </>
                                          )}
                                        </select>
  
                                        {/* Trailer size */}
                                        <select
                                          value={selectedTrailer}
                                          onChange={(e) => setSelectedTrailer(e.target.value as any)}
                                          className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-[10px]"
                                        >
                                          <option value="Flatbed">Flatbed (Max 25k lbs)</option>
                                          <option value="Step Deck">Step Deck (Max 40.5k lbs)</option>
                                        </select>
  
                                        <button
                                          onClick={() => handleOverrideForceLoad(b)}
                                          className="bg-amber-500 text-slate-950 hover:bg-amber-400 font-mono text-xs font-black px-4 py-2 rounded-lg cursor-pointer transition-colors"
                                        >
                                          GO OVERRIDE
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              </div>
            );
          })}
        </div>
      )}

      {selectedBundleForModal && (
        <BundleDetailModal 
          bundle={selectedBundleForModal} 
          onClose={() => setSelectedBundleForModal(null)} 
        />
      )}
    </div>
  );
}
