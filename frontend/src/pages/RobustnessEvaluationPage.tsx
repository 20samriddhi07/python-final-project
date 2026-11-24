import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ModelMetadata, RobustnessEvaluationResult } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { ConfusionMatrix } from '../components/ConfusionMatrix';
import {
  Gauge,
  ShieldAlert,
  ShieldCheck,
  RotateCw,
  Play,
  Download,
  AlertTriangle,
  Sliders,
  BarChart3,
  Layers
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

export const RobustnessEvaluationPage: React.FC = () => {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [epsilon, setEpsilon] = useState<number>(0.2);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<RobustnessEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await api.listModels();
      setModels(res.models || []);
      if (res.models && res.models.length > 0) {
        setSelectedModel(res.models[0].model_id);
      } else {
        setSelectedModel('');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    setError(null);
    try {
      const res = await api.evaluateRobustness({
        model_id: selectedModel,
        epsilon: epsilon,
        eval_samples: 150
      });
      setEvalResult(res);
    } catch (err: any) {
      setError(err.message || 'Robustness evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const accuracyComparisonData = evalResult
    ? evalResult.conditions.map((c) => ({
        name: c.condition.replace(' Attack', '').replace(' Test Data', ''),
        Accuracy: c.accuracy,
        ASR: c.attack_success_rate
      }))
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Adversarial Robustness Evaluation
            <Badge variant="cyan" size="sm">COMPREHENSIVE</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Multi-condition stress test comparing clean test data vs FGSM, PGD, and Black-box evasions.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Card */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">Evaluation Subject Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 outline-none focus:border-cyan-500"
            >
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_type} · {m.model_id}
                </option>
              ))}
              {models.length === 0 && (
                <option value="" disabled>No loadable models available</option>
              )}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-medium">Stress Perturbation (ε):</span>
              <span className="text-cyan-400 font-mono font-bold">{epsilon}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.6"
              step="0.05"
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer mt-1"
            />
          </div>

          <div>
            <button
              onClick={handleRunEvaluation}
              disabled={evaluating || !selectedModel}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-950"
            >
              {evaluating ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Running Stress Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Multi-Condition Evaluation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Evaluation Results */}
      {evalResult && (
        <div className="space-y-6">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Robustness Index"
              value={`${evalResult.robustness_score} / 100`}
              subtitle="Composite resilience score"
              icon={Gauge}
              color={evalResult.robustness_score > 70 ? 'cyan' : 'amber'}
            />
            <StatCard
              title="Clean Test Accuracy"
              value={`${evalResult.clean_accuracy}%`}
              subtitle="Baseline without attacks"
              icon={ShieldCheck}
              color="green"
            />
            <StatCard
              title="Worst Adversarial Accuracy"
              value={`${evalResult.worst_adversarial_accuracy}%`}
              subtitle={`Degradation: -${(evalResult.clean_accuracy - evalResult.worst_adversarial_accuracy).toFixed(1)}%`}
              icon={ShieldAlert}
              color="red"
            />
            <StatCard
              title="Peak Evasion Rate (ASR)"
              value={`${evalResult.max_attack_success_rate}%`}
              subtitle="Maximum adversary advantage"
              icon={BarChart3}
              color="amber"
            />
          </div>

          {/* Condition Breakdown Table */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Adversarial Stress Test Matrix (Measured Outcomes)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] uppercase">
                    <th className="py-2.5 px-3">Test Condition</th>
                    <th className="py-2.5 px-3 text-right">Accuracy</th>
                    <th className="py-2.5 px-3 text-right">Precision</th>
                    <th className="py-2.5 px-3 text-right">Recall</th>
                    <th className="py-2.5 px-3 text-right">F1-Score</th>
                    <th className="py-2.5 px-3 text-right">FPR</th>
                    <th className="py-2.5 px-3 text-right">Attack Success (ASR)</th>
                    <th className="py-2.5 px-3 text-right">Evasions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {evalResult.conditions.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 font-sans font-medium text-slate-200">{c.condition}</td>
                      <td className="py-2 px-3 text-right font-bold text-cyan-300">{c.accuracy}%</td>
                      <td className="py-2 px-3 text-right text-slate-400">{(c.precision * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right text-slate-400">{(c.recall * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right text-slate-300">{c.f1_score.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-slate-400">{(c.fpr * 100).toFixed(2)}%</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-400">{c.attack_success_rate}%</td>
                      <td className="py-2 px-3 text-right text-amber-400">{c.evasions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Clean vs Adversarial Accuracy & Attack Success Rate Bar Chart */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Accuracy Degradation vs Attack Success Rate (ASR) Across Conditions
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accuracyComparisonData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Accuracy" fill="#0284c7" radius={[4, 4, 0, 0]} name="Model Accuracy (%)" />
                  <Bar dataKey="ASR" fill="#ef4444" radius={[4, 4, 0, 0]} name="Adversarial Evasion Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Confusion Matrices Grid for Conditions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ConfusionMatrix
              matrix={evalResult.confusion_matrices.clean}
              title="Clean Test Data"
            />
            <ConfusionMatrix
              matrix={evalResult.confusion_matrices.fgsm}
              title="Under FGSM"
            />
            <ConfusionMatrix
              matrix={evalResult.confusion_matrices.pgd}
              title="Under PGD"
            />
            <ConfusionMatrix
              matrix={evalResult.confusion_matrices.bbox}
              title="Under Black-Box"
            />
          </div>
        </div>
      )}
    </div>
  );
};
