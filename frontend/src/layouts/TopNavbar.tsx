import React from 'react';
import { Badge } from '../components/Badge';
import { Database, Activity, ShieldAlert, Wifi, Terminal } from 'lucide-react';

interface TopNavbarProps {
  backendConnected: boolean;
  datasetName: string | null;
  datasetRecords: number;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  backendConnected,
  datasetName,
  datasetRecords,
}) => {
  return (
    <header className="h-16 bg-[#0c1222]/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Project title and analysis status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">ADVERSHIELD</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400 font-mono text-[11px]">OFFLINE ROBUSTNESS ANALYSIS</span>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-800">
          <Badge variant="safe" size="sm">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              ANALYSIS READY
            </span>
          </Badge>
        </div>
      </div>

      {/* Right: Dataset & Connectivity Status */}
      <div className="flex items-center gap-4">
        {/* Dataset indicator */}
        <div className="hidden sm:flex items-center gap-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Dataset:</span>
          <span className="text-slate-200 font-medium truncate max-w-[150px]">
            {datasetName || 'No Dataset Active'}
          </span>
          {datasetRecords > 0 && (
            <span className="text-cyan-400 font-mono text-[11px]">
              ({datasetRecords.toLocaleString()} flows)
            </span>
          )}
        </div>

        {/* Backend health pill */}
        <div className="flex items-center gap-2">
          {backendConnected ? (
            <Badge variant="safe" size="sm">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                Backend Online (8000)
              </span>
            </Badge>
          ) : (
            <Badge variant="danger" size="sm">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-rose-400" />
                Backend Offline
              </span>
            </Badge>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600/40 to-blue-600/40 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xs font-bold">
          SOC
        </div>
      </div>
    </header>
  );
};
