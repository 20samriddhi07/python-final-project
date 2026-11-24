import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'cyan' | 'green' | 'red' | 'amber' | 'slate';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}) => {
  const colorMap = {
    blue: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
    cyan: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/10',
    green: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10',
    red: 'border-red-500/20 text-red-400 bg-red-500/10',
    amber: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
    slate: 'border-slate-700 text-slate-400 bg-slate-800/40',
  };

  return (
    <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg backdrop-blur hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            {trend && <span className="text-cyan-400 font-medium">{trend}</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
