import { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Menu, Bell, Search } from 'lucide-react';

// Sidebar component
import Sidebar from './components/Sidebar';

// Pages
import Dashboard from './pages/Dashboard';
import SupportPortal from './pages/SupportPortal';
import AIChatbot from './pages/AIChatbot';
import TicketDashboard from './pages/TicketDashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import A2AMonitor from './pages/A2AMonitor';
import SystemHealth from './pages/SystemHealth';
import Settings from './pages/Settings';

// Create a React Query client
const queryClient = new QueryClient();

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex min-h-screen bg-slate-50 text-slate-800 transition-colors duration-200">
          
          {/* Collapsible Sidebar Navigation */}
          <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
          
          {/* Main Layout Area */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Top Navbar */}
            <header className="h-14 sticky top-0 flex items-center justify-between px-6 bg-white border-b border-slate-200 z-20 shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile Menu Trigger */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <Menu size={18} />
                </button>
                
                {/* Global Search Bar */}
                <div className="hidden md:flex items-center relative w-64 lg:w-80">
                  <Search size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tickets, articles, resources..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Action Buttons & System Status */}
              <div className="flex items-center gap-4">
                {/* System Status Badge */}
                <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>System: Operational</span>
                </div>

                <button className="relative p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
                  <Bell size={16} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full border border-white" />
                </button>

                <div className="h-6 w-px bg-slate-200" />

                {/* Compact profile */}
                <div className="flex items-center gap-2">
                  <div className="w-6.5 h-6.5 rounded-full bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                    AS
                  </div>
                  <span className="hidden sm:inline text-xs font-bold text-slate-700">Alice Smith</span>
                </div>
              </div>
            </header>

            {/* Page Content Viewport */}
            <main className="flex-1 p-6 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/support" element={<SupportPortal />} />
                <Route path="/chat" element={<AIChatbot />} />
                <Route path="/tickets" element={<TicketDashboard />} />
                <Route path="/kb" element={<KnowledgeBase />} />
                <Route path="/activity" element={<A2AMonitor />} />
                <Route path="/health" element={<SystemHealth />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

