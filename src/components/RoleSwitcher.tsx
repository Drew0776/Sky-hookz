import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { Shield, ChevronDown, Check, User } from 'lucide-react';

export default function RoleSwitcher() {
  const { currentRole, currentOperator, operators, setOperator } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape press
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN': return 'Control Center (Admin)';
      case 'CRANE_OPERATOR': return 'Crane Cab Operator';
      case 'SHEAR_OPERATOR': return 'Shear Station';
      case 'BENDER': return 'Fabrication Bender';
      default: return role;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef} id="role-switcher-container">
      <div>
        <button
          type="button"
          id="role-switcher-button"
          aria-haspopup="true"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex w-full items-center justify-between gap-x-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-amber-400 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 border border-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="font-mono text-xs tracking-wider">
              {currentOperator ? `${currentOperator.name} [${currentOperator.role}]` : getRoleLabel(currentRole)}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {isOpen && (
        <div
          id="role-switcher-menu"
          role="menu"
          aria-label="Operator Station Selection"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-800 bg-slate-950 p-1 shadow-2xl focus:outline-hidden shadow-black/80 ring-1 ring-black/5"
        >
          <div className="px-3 py-2 border-b border-slate-900 mb-1">
            <span className="text-xxs font-mono uppercase tracking-widest text-slate-500">Select Operator Station</span>
          </div>
          <div className="space-y-1">
            {operators.map((op) => (
              <button
                key={op.id}
                role="menuitem"
                onClick={() => {
                  setOperator(op.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                  currentOperator?.id === op.id
                    ? 'bg-amber-500/10 text-amber-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-xs">{op.name}</span>
                  <span className="text-xxs text-slate-500 uppercase tracking-wide font-mono">
                    {op.role.replace('_', ' ')} {op.currentStation ? `• ${op.currentStation}` : ''}
                  </span>
                </div>
                {currentOperator?.id === op.id && (
                  <Check className="h-4 w-4 text-amber-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
