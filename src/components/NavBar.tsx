import { Link } from 'wouter';
import { LayoutDashboard, Zap, Map, Package, AlertTriangle, Settings } from 'lucide-react';

const NavBar = () => {
  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/yard-map', label: 'Yard Map', icon: Map },
    { href: '/jobs', label: 'Jobs', icon: Package },
    { href: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
    { href: '/crane', label: 'Crane Cab', icon: Zap },
  ];

  return (
    <nav className="bg-slate-950 border-b border-slate-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <a className="flex items-center gap-2 font-mono font-bold text-amber-500 hover:text-amber-400 transition-colors">
              <Zap className="w-5 h-5" />
              <span className="text-sm uppercase tracking-wider">Sky-hookz</span>
            </a>
          </Link>

          {/* Nav Items */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <a className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono rounded hover:bg-slate-900 text-slate-400 hover:text-amber-500 transition-all font-semibold">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xxs font-mono text-slate-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              ONLINE
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
