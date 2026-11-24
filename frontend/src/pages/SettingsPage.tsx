import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import {
  Settings,
  Database,
  Cpu,
  Folder,
  History,
  Shield,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset in-memory telemetry cache? Saved models and experiment files will be retained.')) return;
    setResetting(true);
    try {
      const res = await api.resetSystem();
      setMessage(res.message);
      await fetchSettings();
    } catch (err: any) {
      setMessage('Failed to reset system.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            System & Architecture Settings
            <Badge variant="neutral" size="sm">SOC CONFIG</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Backend environment status, storage paths, telemetry cache, and software versioning.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* System Information Card */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          ADVERSHIELD Framework Specifications
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Software Suite:</span>
              <span className="font-semibold text-slate-200">ADVERSHIELD SOC Lab</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Release Version:</span>
              <span className="font-mono text-cyan-400">v1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Backend Server:</span>
              <span className="font-mono text-slate-200">FastAPI + Uvicorn (Port 8000)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Client UI:</span>
              <span className="font-mono text-slate-200">React 19 + TypeScript + Tailwind CSS</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Deep Learning Engine:</span>
              <span className="font-mono text-slate-200">PyTorch 2.15 (CPU Core)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Tree Models:</span>
              <span className="font-mono text-slate-200">Scikit-Learn 1.8 & XGBoost 3.4</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Primary Dataset Schema:</span>
              <span className="font-mono text-cyan-400">CICIDS2017 Flow Metrics</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Report Engine:</span>
              <span className="font-mono text-slate-200">ReportLab PDF Compiler</span>
            </div>
          </div>
        </div>
      </div>

      {/* Directory Storage Configuration */}
      {settings && settings.directories && (
        <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
            <Folder className="w-4 h-4 text-cyan-400" />
            Storage Directories & Working Paths
          </h3>

          <div className="space-y-2 text-xs font-mono">
            {Object.entries(settings.directories).map(([key, val]: [string, any]) => (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 gap-1"
              >
                <span className="text-slate-400 uppercase text-[10px] tracking-wider">{key.replace('_', ' ')}</span>
                <span className="text-slate-200 truncate max-w-lg">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experiment History & Cache Management */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-2 flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          Cache Management & Experiment Logs
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Experiments and attack simulation logs are persisted as JSON in the <code className="text-cyan-400">experiments/</code> directory.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 gap-4">
          <div className="text-xs text-slate-300">
            <span>Logged Experiments: <strong className="text-white">{settings?.experiments_count || 0}</strong></span>
            <span className="mx-2">•</span>
            <span>Trained Model Files: <strong className="text-cyan-400">{settings?.trained_models_count || 0}</strong></span>
          </div>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition"
          >
            <Trash2 className="w-4 h-4" />
            Reset Telemetry Cache
          </button>
        </div>
      </div>
    </div>
  );
};
