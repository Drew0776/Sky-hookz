import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Bundle, Job, Operator, Exception, ShiftMessage, ActivityEvent, DashboardMetrics } from '../types';

interface AppContextType {
  // State
  bundles: Bundle[];
  jobs: Job[];
  operators: Operator[];
  exceptions: Exception[];
  shiftMessages: ShiftMessage[];
  activityEvents: ActivityEvent[];
  dashboardMetrics: DashboardMetrics | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchDashboard: () => Promise<void>;
  executeGantryRoute: (originId: string, destinationId: string, operatorName: string) => Promise<any>;
  stageBundule: (bundleId: string, location: string, operatorName: string) => Promise<any>;
  pickupBundle: (bundleId: string, craneId: string, operatorName: string) => Promise<any>;
  dropBundle: (bundleId: string, location: string, operatorName: string) => Promise<any>;
  loadBundle: (bundleId: string, door: string, operatorName: string, trailerSize: string) => Promise<any>;
  sendToBender: (bundleId: string, benderId: string, operatorName: string) => Promise<any>;
  createException: (tagId: string, operatorName: string, type: string, description: string) => Promise<any>;
  resolveException: (exceptionId: string, resolvedBy: string) => Promise<any>;
  sendShiftMessage: (sender: string, content: string, shift: string) => Promise<any>;
  bulkBundleAction: (bundleIds: string[], action: string, operatorName: string) => Promise<any>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [shiftMessages, setShiftMessages] = useState<ShiftMessage[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Initialize SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/updates`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'update') {
          setBundles(data.data.bundles || []);
          setJobs(data.data.jobs || []);
          setExceptions(data.data.exceptions || []);
          setShiftMessages(data.data.shiftMessages || []);
          setActivityEvents(data.data.activityEvents || []);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [API_URL]);

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [jobsRes, bundlesRes, opsRes, exRes, msgsRes, actRes] = await Promise.all([
          fetch(`${API_URL}/api/jobs`),
          fetch(`${API_URL}/api/bundles`),
          fetch(`${API_URL}/api/operators`),
          fetch(`${API_URL}/api/exceptions`),
          fetch(`${API_URL}/api/shift-messages`),
          fetch(`${API_URL}/api/activity`),
        ]);

        if (jobsRes.ok) setJobs(await jobsRes.json());
        if (bundlesRes.ok) setBundles(await bundlesRes.json());
        if (opsRes.ok) setOperators(await opsRes.json());
        if (exRes.ok) setExceptions(await exRes.json());
        if (msgsRes.ok) setShiftMessages(await msgsRes.json());
        if (actRes.ok) setActivityEvents(await actRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [API_URL]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard`);
      if (res.ok) setDashboardMetrics(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
    }
  };

  const executeGantryRoute = async (originId: string, destinationId: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/gantry/execute-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originId, destinationId, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Route execution failed');
      throw err;
    }
  };

  const stageBundule = async (bundleId: string, location: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Staging failed');
      throw err;
    }
  };

  const pickupBundle = async (bundleId: string, craneId: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ craneId, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pickup failed');
      throw err;
    }
  };

  const dropBundle = async (bundleId: string, location: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}/drop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drop failed');
      throw err;
    }
  };

  const loadBundle = async (bundleId: string, door: string, operatorName: string, trailerSize: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}/force-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ door, operatorName, trailerSize }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
      throw err;
    }
  };

  const sendToBender = async (bundleId: string, benderId: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/${bundleId}/send-to-bender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benderId, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bender send failed');
      throw err;
    }
  };

  const createException = async (tagId: string, operatorName: string, type: string, description: string) => {
    try {
      const res = await fetch(`${API_URL}/api/exceptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, operatorName, type, description }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exception creation failed');
      throw err;
    }
  };

  const resolveException = async (exceptionId: string, resolvedBy: string) => {
    try {
      const res = await fetch(`${API_URL}/api/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Exception resolution failed');
      throw err;
    }
  };

  const sendShiftMessage = async (sender: string, content: string, shift: string) => {
    try {
      const res = await fetch(`${API_URL}/api/shift-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, content, shift }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message send failed');
      throw err;
    }
  };

  const bulkBundleAction = async (bundleIds: string[], action: string, operatorName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/bundles/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleIds, action, operatorName }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
      throw err;
    }
  };

  return (
    <AppContext.Provider
      value={{
        bundles,
        jobs,
        operators,
        exceptions,
        shiftMessages,
        activityEvents,
        dashboardMetrics,
        loading,
        error,
        fetchDashboard,
        executeGantryRoute,
        stageBundule,
        pickupBundle,
        dropBundle,
        loadBundle,
        sendToBender,
        createException,
        resolveException,
        sendShiftMessage,
        bulkBundleAction,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppContextProvider');
  return context;
};
