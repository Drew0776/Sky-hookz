import { useAppContext } from '../context/AppContext';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useEffect } from 'react';
import { Zap, Package, Truck, AlertCircle } from 'lucide-react';

const DashboardPage = () => {
  const { dashboardMetrics, bundles, jobs, fetchDashboard, loading } = useAppContext();

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) return <div className="text-center py-12">Loading dashboard...</div>;

  const metrics = dashboardMetrics || {
    bendingCount: 0,
    totalActiveJobs: 0,
    stagedCount: 0,
    loadedCount: 0,
    rackedCount: 0,
    firstShiftThroughput: 0,
    secondShiftThroughput: 0,
  };

  const bundleStatusData = [
    { name: 'Raw', value: bundles.filter(b => b.status === 'RAW').length },
    { name: 'Staged', value: bundles.filter(b => b.status === 'STAGED').length },
    { name: 'Bending', value: bundles.filter(b => b.status === 'BENDING').length },
    { name: 'Loaded', value: bundles.filter(b => b.status === 'LOADED').length },
    { name: 'Racked', value: bundles.filter(b => b.status === 'RACKED').length },
    { name: 'Coated', value: bundles.filter(b => b.status === 'COATED').length },
  ];

  const shiftData = [
    { name: 'First Shift', tons: metrics.firstShiftThroughput },
    { name: 'Second Shift', tons: metrics.secondShiftThroughput },
  ];

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Active Jobs</h3>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.totalActiveJobs}</p>
          <p className="text-xs text-slate-500 mt-1">Projects in progress</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-blue-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Bending Queue</h3>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.bendingCount}</p>
          <p className="text-xs text-slate-500 mt-1">Bundles being fabricated</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-green-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Ready to Load</h3>
            <Truck className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.stagedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Staged bundles</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-purple-500/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase">Loaded</h3>
            <AlertCircle className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.loadedCount}</p>
          <p className="text-xs text-slate-500 mt-1">Ready to ship</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
