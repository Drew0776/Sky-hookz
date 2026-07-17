import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, Operator } from '../types';
import { INITIAL_OPERATORS } from '../seedData';

interface AppContextType {
  currentRole: UserRole;
  currentOperator: Operator | null;
  operators: Operator[];
  setRole: (role: UserRole) => void;
  setOperator: (opId: string) => void;
  fetchOperators: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('ADMIN');
  const [currentOperator, setCurrentOperator] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);

  const fetchOperators = async () => {
    try {
      const response = await fetch('/api/operators').catch(() => null);
      let data = [];
      if (response && response.ok) {
        data = await response.json();
      } else {
        data = INITIAL_OPERATORS;
      }
      setOperators(data);
      // Set default operator based on role if not set
      if (!currentOperator && data.length > 0) {
        const match = data.find((op: Operator) => op.role === 'ADMIN');
        if (match) {
          setCurrentOperator(match);
        } else {
          setCurrentOperator(data[0]);
        }
      }
    } catch (error) {
      console.warn('Network issue fetching operators, using local seed fallback:', error);
      setOperators(INITIAL_OPERATORS);
      if (!currentOperator && INITIAL_OPERATORS.length > 0) {
        const match = INITIAL_OPERATORS.find((op: Operator) => op.role === 'ADMIN');
        setCurrentOperator(match || INITIAL_OPERATORS[0]);
      }
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const setRole = (role: UserRole) => {
    setCurrentRole(role);
    // Automatically match first active operator with that role
    if (operators.length > 0) {
      const match = operators.find(op => op.role === role);
      if (match) {
        setCurrentOperator(match);
      }
    }
  };

  const setOperator = (opId: string) => {
    const op = operators.find(o => o.id === opId);
    if (op) {
      setCurrentOperator(op);
      setCurrentRole(op.role);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        currentOperator,
        operators,
        setRole,
        setOperator,
        fetchOperators,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppContextProvider');
  }
  return context;
}
