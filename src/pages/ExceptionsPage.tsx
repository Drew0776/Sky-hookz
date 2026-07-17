import { useAppContext } from '../context/AppContext';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

const ExceptionsPage = () => {
  const { exceptions, resolveException } = useAppContext();

  const openExceptions = exceptions.filter(e => e.status === 'OPEN');
  const resolvedExceptions = exceptions.filter(e => e.status === 'RESOLVED');

  const handleResolve = async (exceptionId: string, resolvedBy: string) => {
    try {
      await resolveException(exceptionId, resolvedBy);
    } catch (err) {
      console.error('Failed to resolve exception:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-xl font-bold text-red-500 font-mono uppercase">Open Exceptions ({openExceptions.length})</h2>
        </div>

        {openExceptions.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No open exceptions</p>
        ) : (
          <div className="space-y-3">
            {openExceptions.map((ex) => (
              <div key={ex.id} className="bg-slate-950 border border-red-900/50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-mono text-red-500 font-bold">{ex.type}</p>
                    <p className="text-xs text-slate-500 mt-1">Bundle: {ex.tagId}</p>
                  </div>
                  <span className="text-xs font-mono text-red-500 bg-red-950/50 px-2 py-1 rounded">OPEN</span>
                </div>
                <p className="text-sm text-slate-300 mb-3">{ex.description}</p>
                <button
                  onClick={() => handleResolve(ex.id, 'Admin')}
                  className="text-xs font-mono bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded font-bold uppercase transition-colors"
                >
                  Mark Resolved
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h2 className="text-xl font-bold text-green-500 font-mono uppercase">Resolved ({resolvedExceptions.length})</h2>
        </div>

        {resolvedExceptions.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No resolved exceptions yet</p>
        ) : (
          <div className="space-y-3">
            {resolvedExceptions.map((ex) => (
              <div key={ex.id} className="bg-slate-950 border border-green-900/50 rounded-lg p-4 opacity-75">
                <p className="text-sm font-mono text-green-500 font-bold line-through">{ex.type}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExceptionsPage;
