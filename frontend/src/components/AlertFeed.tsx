import React from 'react';
import { SecurityAlert } from '../types';
import { ShieldAlert, ShieldCheck, Info, AlertTriangle } from 'lucide-react';

interface AlertFeedProps {
  alerts: SecurityAlert[];
}

export const AlertFeed: React.FC<AlertFeedProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-slate-500 text-xs italic py-4 text-center">
        No recent security events logged.
      </div>
    );
  }

  const getIcon = (level: SecurityAlert['level']) => {
    switch (level) {
      case 'danger':
        return <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'safe':
        return <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
  };

  const getBorderColor = (level: SecurityAlert['level']) => {
    switch (level) {
      case 'danger':
        return 'border-rose-500/20 bg-rose-500/5';
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/5';
      case 'safe':
        return 'border-emerald-500/20 bg-emerald-500/5';
      default:
        return 'border-slate-800 bg-slate-900/40';
    }
  };

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-3 rounded-lg border text-xs transition ${getBorderColor(
            alert.level
          )}`}
        >
          <div className="mt-0.5">{getIcon(alert.level)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-200 truncate">{alert.message}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{alert.timestamp}</span>
            </div>
            {alert.details && Object.keys(alert.details).length > 0 && (
              <div className="mt-1 text-[11px] text-slate-400 font-mono">
                {Object.entries(alert.details)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' • ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
