import { useState, useEffect } from 'react';
import { useWebSocket } from '../api';
import {
  Link2,
  Cpu,
  Radio,
  User,
  ShieldCheck,
  Settings as SettingsIcon,
  Info
} from 'lucide-react';
import Architecture from './Architecture';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'about'>('general');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('api_base_url') || 'http://localhost:8000/api');
  const [wsUrl, setWsUrl] = useState(() => localStorage.getItem('ws_base_url') || 'ws://localhost:8000/ws/events');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Hook to display active WebSocket connection status
  const { status: wsStatus } = useWebSocket();

  // Enforce light mode globally in state
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const handleSaveEndpoints = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('api_base_url', apiUrl);
    localStorage.setItem('ws_base_url', wsUrl);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-905">
          Settings & About System
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure API connection endpoints, check operational diagnostics, and review system architectural details.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold uppercase tracking-wider bg-white p-1 rounded-lg border max-w-xs shrink-0 shadow-3xs">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 py-2 px-3 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'general'
              ? 'bg-blue-50 text-blue-600 shadow-3xs'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <SettingsIcon size={14} />
          <span>General Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`flex-1 py-2 px-3 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'about'
              ? 'bg-blue-50 text-blue-600 shadow-3xs'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Info size={14} />
          <span>About System</span>
        </button>
      </div>

      {activeTab === 'general' ? (
        /* General Settings Tab */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Left Column: API Configurations */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-2 uppercase tracking-wider text-slate-400">
              <Link2 size={14} className="text-blue-600" />
              Gateway API Endpoints
            </h2>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Configure endpoints pointing the frontend to the backend FastAPI microservice.
            </p>

            <form onSubmit={handleSaveEndpoints} className="space-y-4">
              {saveSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold text-center">
                  Endpoints saved successfully! Reload the page to connect.
                </div>
              )}

              {/* REST API */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  FastAPI REST Base URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20 font-semibold"
                />
              </div>

              {/* WS Events */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  WebSocket Events URL
                </label>
                <input
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20 font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition cursor-pointer"
              >
                Save Gateway Endpoints
              </button>
            </form>
          </div>

          {/* Right Column: WebSocket & System Info */}
          <div className="space-y-6">
            {/* WebSocket Diagnostics */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
              <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <Radio size={14} className="text-blue-600" />
                WebSocket Live Sync State
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Verify real-time communication events streaming state.
              </p>

              <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-150 rounded-xl">
                <div className="text-xs">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">State Status</span>
                  <span className="font-bold text-slate-700 mt-0.5 block font-mono capitalize">
                    {wsStatus}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    wsStatus === 'OPEN'
                      ? 'bg-emerald-500 animate-pulse'
                      : wsStatus === 'CONNECTING'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                  }`} />
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
              <h2 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
                <Cpu size={14} className="text-blue-600" />
                Client Environment Registry
              </h2>

              <div className="divide-y divide-slate-150 text-xs leading-normal">
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-semibold">User Operator Profile</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <User size={12} />
                    Alice Smith (U101)
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-semibold">Platform Base</span>
                  <span className="font-mono text-slate-700">Vite React TS v19</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-semibold">Styles Compilation</span>
                  <span className="font-mono text-slate-700">Tailwind CSS v4</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400 font-semibold">Sandbox Directory</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1 text-[9px] uppercase bg-green-50 px-2 py-0.5 border border-green-200 rounded-full">
                    <ShieldCheck size={12} />
                    Active and Secure
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* About System Tab: Renders the Architecture Flow directly */
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-xs">
          <Architecture />
        </div>
      )}
    </div>
  );
}
