import { useAppContext } from '../context/AppContext';
import { Package } from 'lucide-react';

const JobsPage = () => {
  const { jobs, bundles } = useAppContext();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white font-mono mb-6">Active Jobs</h1>

      <div className="grid grid-cols-1 gap-6">
        {jobs.map((job) => {
          const jobBundles = bundles.filter(b => b.jobId === job.id);
          const progressPercent = (job.completedBundles / job.totalBundles) * 100;

          return (
            <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-amber-500/50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl font-bold text-white font-mono">{job.id}</h2>
                  </div>
                  <p className="text-lg font-semibold text-amber-500">{job.projectName}</p>
                  <p className="text-sm text-slate-400">{job.customerName}</p>
                  <p className="text-xs text-slate-600 mt-1">Order: {job.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{job.completedBundles}/{job.totalBundles}</p>
                  <p className="text-xs text-slate-400 mt-1">Bundles Complete</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="w-full bg-slate-800 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">{Math.round(progressPercent)}% Complete</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JobsPage;
