import React from 'react';
import { PageTab } from '../types';
import {
  LayoutDashboard,
  Database,
  ShieldAlert,
  Crosshair,
  Shield
} from 'lucide-react';

interface SidebarProps {
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems: { id: PageTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'dataset-training', label: 'Dataset & Training', icon: Database },
    { id: 'intrusion-detection', label: 'Intrusion Detection', icon: ShieldAlert },
    { id: 'adversarial-testing', label: 'Adversarial Testing', icon: Crosshair },
    { id: 'results-defence', label: 'Results & Defence', icon: Shield },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0c1222] border-r border-slate-800 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-950/60">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <span className="font-extrabold text-base tracking-wider text-white font-mono">ADVERSHIELD</span>
          <span className="block text-[10px] text-cyan-400 font-mono tracking-tight font-medium">SOC ROBUSTNESS LAB</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition ${
                  isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              )}
            </button>
          );
        })}
      </nav>

    </aside>
  );
};
