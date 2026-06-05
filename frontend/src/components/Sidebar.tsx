import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquareCode,
  Database,
  BookOpen,
  Shuffle,
  Activity,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Server
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Initialize theme: force light mode as default for new sessions to clear legacy dark settings
  useEffect(() => {
    localStorage.setItem('theme', 'light');
    localStorage.setItem('theme_init_v2', 'true');
    document.documentElement.classList.remove('dark');
  }, []);

  const navItems = [
    { to: '/', name: 'Dashboard', icon: LayoutDashboard },
    { to: '/support', name: 'Support Requests', icon: ClipboardList },
    { to: '/chat', name: 'AI Assistant', icon: MessageSquareCode },
    { to: '/tickets', name: 'Tickets', icon: Database },
    { to: '/kb', name: 'Knowledge Base', icon: BookOpen },
    { to: '/activity', name: 'Activity Center', icon: Shuffle },
    { to: '/health', name: 'System Health', icon: Activity },
    { to: '/settings', name: 'Settings', icon: SettingsIcon },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-700 border-r border-slate-200 transition-all duration-300">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-150 h-16 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0">
            <Server size={16} />
          </div>
          {!collapsed && (
            <span className="font-bold tracking-tight text-slate-900 whitespace-nowrap text-xs uppercase tracking-wider">
              Autonomous IT Helpdesk
            </span>
          )}
        </div>
        
        {/* Desktop Collapse Trigger */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded shrink-0 transition"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        
        {/* Mobile Close Trigger */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.name}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Profile / Settings */}
      <div className="p-3.5 border-t border-slate-150 space-y-3 shrink-0 bg-slate-50/50">
        {/* User Card */}
        <div className="flex items-center gap-2.5 overflow-hidden text-xs text-slate-500">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shrink-0 text-[10px]">
            AS
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-slate-800 text-xs">Alice Smith</span>
              <span className="text-[9px] text-slate-400 uppercase font-semibold">Engineering | U101</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:block h-screen sticky top-0 shrink-0 ${collapsed ? 'w-16' : 'w-48'} transition-all duration-300 z-30`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-40 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      >
        <aside
          className={`h-full w-48 fixed top-0 left-0 z-50 transform transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}

