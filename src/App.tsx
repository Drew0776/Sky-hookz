/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Switch, Route } from 'wouter';
import { AppContextProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import FloorTriggerPage from './pages/FloorTriggerPage';
import CraneCabPage from './pages/CraneCabPage';
import YardMapPage from './pages/YardMapPage';
import JobsPage from './pages/JobsPage';
import ExceptionsPage from './pages/ExceptionsPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContextProvider>
        <div className="min-h-screen bg-[#0A0F1C] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans antialiased">
          {/* Top Industrial Header Navigation */}
          <NavBar />

          {/* Primary View Area */}
          <main className="flex-1 w-full max-w-7xl mx-auto py-2 xl:py-4">
            <Switch>
              <Route path="/" component={LandingPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/floor" component={FloorTriggerPage} />
              <Route path="/crane" component={CraneCabPage} />
              <Route path="/yard-map" component={YardMapPage} />
              <Route path="/jobs" component={JobsPage} />
              <Route path="/exceptions" component={ExceptionsPage} />
              <Route>
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
                  <span className="font-mono text-xs text-rose-500 font-bold uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 mb-3 animate-pulse">404 COORD ERROR</span>
                  <h2 className="font-sans text-sm font-bold text-white uppercase tracking-wider">COORDINATE CELL LOST</h2>
                  <p className="text-xs text-slate-500 font-mono tracking-wide max-w-sm mt-1 mb-4">
                    The requested route does not map to any active terminal or crane console.
                  </p>
                  <a href="/" className="font-mono text-xxs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 px-3.5 py-2 rounded-lg transition-colors">RETURN OVERVIEW</a>
                </div>
              </Route>
            </Switch>
          </main>

          {/* Professional Corporate Footer */}
          <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xxs font-mono text-slate-600">
              <span>© 2300 HIGHWAY 61 N, SAINT PAUL, MN 55109 • SIMCOTE MANUFACTURING INC.</span>
              <span className="flex items-center gap-1">CONSOLE VERSION 2.4.0 • SYSTEM INTEGRATED STATUS: ACTIVE</span>
            </div>
          </footer>
        </div>
      </AppContextProvider>
    </ErrorBoundary>
  );
}

