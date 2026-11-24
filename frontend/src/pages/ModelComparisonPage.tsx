import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import {
  GitCompare,
  CheckCircle2,
  Cpu,
  Clock,
  Zap,
  ShieldCheck,
  RotateCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export const ModelComparisonPage: React.FC = () => {
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchComparison();
  }, []);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await api.getModelComparison();
      setComparison(res.comparison || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = comparison.map((m) => ({
    name: m.model_type,
    Accuracy: m.accuracy,
    F1: Number((m.f1_score * 100).toFixed(1)),
    Inference_ms: Number((m.inference_time_ms * 100).toFixed(2))
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Model Benchmarking & Comparison
            <Badge variant="cyan" size="sm">MULTI-ARCH</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Side-by-side empirical comparison across Random Forest, XGBoost, PyTorch MLP, and Defended architectures.
          </p>
        </div>
        <button
          onClick={fetchComparison}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-2 transition"
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-20 text-center text-slate-400">Loading model benchmarks...</div>
      ) : comparison.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
          No trained models found. Train models in Module 4 to populate the comparative benchmark.
        </div>
      ) : (
        <>
          {/* Comparison Bar Chart */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-cyan-400" />
              Comparative Accuracy & F1-Score Breakdown
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[90, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Accuracy" fill="#0284c7" radius={[4, 4, 0, 0]} name="Accuracy (%)" />
                  <Bar dataKey="F1" fill="#10b981" radius={[4, 4, 0, 0]} name="F1 Score (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Data Table */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Master Model Comparison Matrix
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] uppercase">
                    <th className="py-2.5 px-3">Architecture</th>
                    <th className="py-2.5 px-3 text-right">Accuracy</th>
                    <th className="py-2.5 px-3 text-right">Precision</th>
                    <th className="py-2.5 px-3 text-right">Recall</th>
                    <th className="py-2.5 px-3 text-right">F1-Score</th>
                    <th className="py-2.5 px-3 text-right">FPR</th>
                    <th className="py-2.5 px-3 text-right">FNR</th>
                    <th className="py-2.5 px-3 text-right">Confusion Matrix</th>
                    <th className="py-2.5 px-3 text-right">Train Time</th>
                    <th className="py-2.5 px-3 text-right">Inference (ms/flow)</th>
                    <th className="py-2.5 px-3 text-center">Hardened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {comparison.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200 flex items-center gap-2">
                        {m.is_defended ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        )}
                        {m.model_type}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-300">{m.accuracy}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{m.precision}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{m.recall}%</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">{m.f1_score}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{m.fpr}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{m.fnr}%</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        {m.confusion_matrix ? JSON.stringify(m.confusion_matrix) : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{m.training_time} s</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{m.inference_time_ms.toFixed(4)} ms</td>
                      <td className="py-2.5 px-3 text-center">
                        {m.is_defended ? (
                          <Badge variant="safe" size="sm">Yes (Adv Trained)</Badge>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
