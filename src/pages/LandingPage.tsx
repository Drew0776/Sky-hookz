const LandingPage = () => {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-lg p-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-mono tracking-tight">
          SKY-HOOKZ
        </h1>
        <p className="text-lg text-slate-300 mb-8 font-mono">
          Industrial Yard Management System
        </p>
        <p className="text-slate-400 max-w-2xl mx-auto mb-8">
          Real-time gantry crane operations, bundle tracking, and logistics management for rebar processing facilities.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a href="/dashboard" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-lg font-mono text-sm uppercase transition-colors">
            View Dashboard
          </a>
          <a href="/yard-map" className="bg-slate-800 hover:bg-slate-700 text-amber-500 font-bold px-6 py-3 rounded-lg font-mono text-sm uppercase transition-colors border border-slate-700">
            Explore Yard Map
          </a>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
