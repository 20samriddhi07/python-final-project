import React, { useState, useEffect } from 'react';
import { OverviewStats, PageTab } from '../types';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { AlertFeed } from '../components/AlertFeed';
import { EmptyState } from '../components/EmptyState';
import { Badge } from '../components/Badge';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Gauge,
  Activity,
  Layers,
  Database,
  ArrowRight
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';

interface OverviewPageProps {
  onNavigate: (tab: PageTab) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await api.getOverview();
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-slate-400">
        <Activity className="w-6 h-6 animate-spin text-cyan-400 mr-3" />
        <span>Loading SOC Overview analytics...</span>
      </div>
    );
  }

  if (error || !stats || (!stats.dataset_loaded && stats.total_records_analyzed === 0)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">ADVERSHIELD Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Offline network-traffic analysis and adversarial robustness evaluation.</p>
        </div>
        <EmptyState
          title="No Network Dataset Loaded"
          description="Upload or inspect a network traffic dataset (CICIDS2017) to view traffic composition, class distributions, and train baseline IDS detectors."
          icon={Database}
          actionText="Open Dataset & Training"
          onAction={() => onNavigate('dataset-training')}
        />
      </div>
    );
  }

  // Chart data: Normal vs Malicious
  const trafficPieData = [
    { name: 'Normal (Benign)', value: stats.normal_traffic_count, color: '#10b981' },
    { name: 'Malicious (Attack)', value: stats.malicious_traffic_count, color: '#ef4444' }
  ];

  // Attack categories data
  const attackCategoryData = Object.entries(stats.attack_distribution)
    .filter(([k]) => k.toUpperCase() !== 'BENIGN')
    .map(([name, count]) => ({
      name,
      count
    }));

  // Model comparison bar data
  const modelBarData = (stats.recent_models || []).map((m) => ({
    name: m.model_type,
    Accuracy: Number((m.metrics?.accuracy * 100).toFixed(1)),
    F1: Number((m.metrics?.f1_score * 100).toFixed(1))
  }));

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            ADVERSHIELD Dashboard
            <Badge variant="safe" size="sm">OFFLINE ANALYSIS</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Active Dataset: <span className="text-cyan-400 font-mono">{stats.active_dataset}</span>
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-2 transition"
        >
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          Refresh Metrics
        </button>
      </div>

      {/* Top SOC Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Flows Analyzed"
          value={stats.total_records_analyzed.toLocaleString()}
          subtitle="Processed network records"
          icon={Database}
          color="blue"
        />
        <StatCard
          title="Safe Benign Traffic"
          value={stats.normal_traffic_count.toLocaleString()}
          subtitle={`${((stats.normal_traffic_count / (stats.total_records_analyzed || 1)) * 100).toFixed(1)}% of total traffic`}
          icon={ShieldCheck}
          color="green"
        />
        <StatCard
          title="Detected Malicious Flows"
          value={stats.malicious_traffic_count.toLocaleString()}
          subtitle={`${((stats.malicious_traffic_count / (stats.total_records_analyzed || 1)) * 100).toFixed(1)}% attack ratio`}
          icon={ShieldAlert}
          color="red"
        />
        <StatCard
          title="Loadable Models"
          value={stats.trained_models_count.toLocaleString()}
          subtitle="Saved and available for inference"
          icon={Cpu}
          color="cyan"
        />
        <StatCard
          title="Worst-Case Robust Accuracy"
          value={stats.adversarial_robustness_score !== null ? `${stats.adversarial_robustness_score}/100` : 'N/A'}
          subtitle={stats.adversarial_robustness_score !== null ? 'Lowest measured accuracy across attack conditions' : 'No evaluation recorded'}
          icon={Gauge}
          color={stats.adversarial_robustness_score !== null && stats.adversarial_robustness_score > 75 ? 'cyan' : 'amber'}
        />
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Normal vs Malicious Traffic Chart */}
        <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Traffic Composition (Clean vs Malicious)
            </h3>
            <span className="text-xs text-slate-400 font-mono">CICIDS2017</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }: any) => `${String(name || '').split(' ')[0]}: ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {trafficPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  formatter={(val: any) => [val != null ? val.toLocaleString() : '0', 'Flows']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Benign:</span>
              <span className="font-semibold text-slate-200">{stats.normal_traffic_count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-400">Attacks:</span>
              <span className="font-semibold text-slate-200">{stats.malicious_traffic_count.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Attack Category Distribution */}
        <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Attack Vector Breakdown
            </h3>
            <span className="text-xs text-slate-400 font-mono">{attackCategoryData.length} Vectors</span>
          </div>

          <div className="h-64">
            {attackCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attackCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(val: any) => [val != null ? val.toLocaleString() : '0', 'Samples']}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                No individual attack categories available.
              </div>
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Attack categories shown from the loaded dataset label distribution.</span>
          </div>
        </div>
      </div>

      {/* Model Performance Comparison & Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Accuracy Comparison */}
        <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Trained Model Performance
            </h3>
            <button
              onClick={() => onNavigate('results-defence')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
            >
              Compare All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {modelBarData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelBarData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Accuracy" fill="#0284c7" radius={[4, 4, 0, 0]} name="Accuracy (%)" />
                  <Bar dataKey="F1" fill="#06b6d4" radius={[4, 4, 0, 0]} name="F1 Score (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-xs text-center p-4">
              <span>No models trained yet.</span>
              <button
                onClick={() => onNavigate('dataset-training')}
                className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold"
              >
                Train Baseline Model
              </button>
            </div>
          )}
        </div>

        {/* Security Alerts Feed */}
        <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Saved Experiment Activity
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Audit Stream</span>
            </div>
            <AlertFeed alerts={stats.security_alerts} />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Experiments Logged: <strong className="text-white">{stats.total_experiments}</strong></span>
            <button
              onClick={() => onNavigate('adversarial-testing')}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              Simulate Evasion <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Recent Adversarial Experiments
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {stats.recent_attacks.length} saved in activity cache
          </span>
        </div>
        {stats.recent_attacks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                  <th className="py-2 pr-3">Target model</th>
                  <th className="py-2 pr-3">Attack</th>
                  <th className="py-2 pr-3 text-right">Flows evaluated</th>
                  <th className="py-2 text-right">Success rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.recent_attacks.slice(0, 5).map((attack, index) => (
                  <tr key={`${attack.timestamp}-${index}`} className="text-slate-300">
                    <td className="py-2 pr-3">{attack.target_model}</td>
                    <td className="py-2 pr-3">{attack.actual_method}</td>
                    <td className="py-2 pr-3 text-right">{attack.evaluated_samples.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-cyan-300">{attack.attack_success_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No adversarial simulations have been recorded yet.</p>
        )}
      </div>
    </div>
  );
};
