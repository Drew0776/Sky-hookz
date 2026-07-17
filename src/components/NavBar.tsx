import React from 'react';
import { useLocation, Link } from 'wouter';
import { useApp } from '../context/AppContext';
import RoleSwitcher from './RoleSwitcher';
import { Anchor, LayoutDashboard, Shuffle, HardHat, Map, Briefcase, AlertTriangle, Home } from 'lucide-react';

export default function NavBar() {
  const [location] = useLocation();
  const { currentRole } = useApp();

  const navItems = [
    { href: '/', label: 'Overview', icon: Home, roles: ['ADMIN', 'CRANE_OPERATOR', 'SHEAR_OPERATOR', 'BENDER'] },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
    { href: '/floor', label: 'Floor Trigger', icon: Shuffle, roles: ['ADMIN', 'SHEAR_OPERATOR', 'BENDER'] },
    { href: '/crane', label: 'Crane Cab', icon: HardHat, roles: ['ADMIN', 'CRANE_OPERATOR'] },
    { href: '/yard-map', label: 'Yard Map', icon: Map, roles: ['ADMIN', 'CRANE_OPERATOR'] },
    { href: '/jobs', label: 'Jobs & Bundles', icon: Briefcase, roles: ['ADMIN', 'CRANE_OPERATOR', 'SHEAR_OPERATOR', 'BENDER'] },
    { href: '/exceptions', label: 'Exceptions', icon: AlertTriangle, roles: ['ADMIN', 'CRANE_OPERATOR', 'SHEAR_OPERATOR', 'BENDER'] },
  ];

  // Filter based on user profile
  const visibleItems = navItems.filter(item => item.roles.includes(currentRole));

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3" id="main-navigation-bar">
      <div className="mx-auto max-w-7xl flex items-center justify-between">
        {/* Logo & Corporate Letterhead with custom vector industrial gantry logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9.5 w-9.5 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 shadow-inner group-hover:border-amber-400/40 transition-colors">
            <svg 
              className="h-7 w-7" 
              viewBox="0 0 32 32" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="skyhook-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
                <linearGradient id="skyhook-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#b45309" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              {/* Overhead Gantry Bridge Rail Structural truss */}
              <line x1="4" y1="9" x2="28" y2="9" stroke="url(#skyhook-blue)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="13" x2="26" y2="13" stroke="url(#skyhook-blue)" strokeWidth="1" strokeDasharray="2 1.5" />
              
              {/* Gantry Dual Supporting Leg pillars */}
              <path d="M7 9L4 25M25 9L28 25" stroke="url(#skyhook-blue)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              
              {/* Travelling Trolley hoist assembly */}
              <rect x="13" y="7" width="6" height="4" rx="1" fill="url(#skyhook-gold)" className="transition-transform duration-500 group-hover:translate-x-1" />
              
              {/* Suspension cable dropped from trolley */}
              <line x1="16" y1="11" x2="16" y2="18" stroke="url(#skyhook-gold)" strokeWidth="1" />
              
              {/* Specialized Lifting SkyHook attachment holding cargo rebar billet */}
              <path d="M14.5 18H17.5M16 18C15 19.5 15.5 21 17 21C18 21 18.5 20 18.5 19.5" stroke="url(#skyhook-gold)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="12" y1="23" x2="20" y2="23" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-xs font-black tracking-widest text-white leading-none flex items-center group-hover:text-amber-400 transition-colors">
              SKY<span className="text-amber-400">HOOK</span>
            </span>
            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500 leading-tight">YARD LOGISTICS</span>
          </div>
        </Link>

        {/* Dynamic Navigation Tabs list */}
        <div className="hidden lg:flex items-center gap-1.5" role="tablist">
          {visibleItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-amber-400 border border-slate-800'
                    : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-amber-500' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Integration State & Role selection switcher */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 font-medium">SERVER LIVE</span>
          </div>
          <RoleSwitcher />
        </div>
      </div>

      {/* Mobile navigation tab list */}
      <div className="flex lg:hidden overflow-x-auto gap-1.5 mt-3 pt-2 border-t border-slate-900/50 no-scrollbar">
        {visibleItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xxs font-mono tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-amber-400 border border-slate-800'
                  : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
