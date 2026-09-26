/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { Switch, Route } from 'wouter';
import { AppContextProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import PageLoader from './components/PageLoader';

// Each console screen loads on demand, so the first page doesn't download every screen's code
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FloorTriggerPage = lazy(() => import('./pages/FloorTriggerPage'));
const CraneCabPage = lazy(() => import('./pages/CraneCabPage'));
const YardMapPage = lazy(() => import('./pages/YardMapPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const ExceptionsPage = lazy(() => import('./pages/ExceptionsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <AppContextProvider>
        <div className="min-h-screen bg-[#0A0F1C] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 font-sans antialiased">
          {/* Top Industrial Header Navigation */}
          <NavBar />

          {/* Primary View Area */}
          <main className="flex-1 w-full max-w-7xl mx-auto py-2 xl:py-4">
            <Suspense fallback={<PageLoader message="Loading console..." />}>
            <Switch>
              <Route path="/" component={LandingPage} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/floor" component={FloorTriggerPage} />
              <Route path="/crane" component={CraneCabPage} />
              <Route path="/yard-map" component={YardMapPage} />
              <Route path="/jobs" component={JobsPage} />
              <Route path="/exceptions" component={ExceptionsPage} />
              <Route component={NotFoundPage} />
            </Switch>
            </Suspense>
          </main>

          {/* Professional Corporate Footer */}
          <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 text-xxs font-mono text-muted">
              <span>© 2300 HIGHWAY 61 N, SAINT PAUL, MN 55109 • SIMCOTE MANUFACTURING INC.</span>
              <span className="flex items-center gap-1">CONSOLE VERSION {__APP_VERSION__} • SYSTEM INTEGRATED STATUS: ACTIVE</span>
            </div>
          </footer>
        </div>
      </AppContextProvider>
    </ErrorBoundary>
  );
}

