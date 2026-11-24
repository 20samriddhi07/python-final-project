import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ModelMetadata, DefenceResult } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCw,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Cpu,
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

export const DefenceMechanismsPage: React.FC = () => {
  const [baseModel, setBaseModel] = useState<string>('PyTorch MLP');
  const [attackMethod, setAttackMethod] = useState<string>('FGSM');
  const [epsilon, setEpsilon] = useState<number>(0.2);
  const [advRatio, setAdvRatio] = useState<number>(0.5);
  const [epochs, setEpochs] = useState<number>(10);

  const [training, setTraining] = useState<boolean>(false);
  const [defenceResult, setDefenceResult] = useState<DefenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrainDefence = async () => {
    setTraining(true);
    setError(null);
    try {
      const res = await api.trainDefence({
        base_model_type: baseModel,
        attack_type: attackMethod,
        epsilon: epsilon,
        adv_ratio: advRatio,
        epochs: epochs
      });
      setDefenceResult(res);
    } catch (err: any) {
      setError(err.message || 'Adversarial training failed');
    } finally {
      setTraining(false);
    }
  };

  const comparisonChartData = defenceResult
    ? [
        {
          metric: 'Clean Accuracy (%)',
          Baseline: defenceResult.baseline_metrics.clean_accuracy,
          Defended: defenceResult.defended_metrics.clean_accuracy
        },
        {
          metric: 'Adversarial Accuracy (%)',
          Baseline: defenceResult.baseline_metrics.adversarial_accuracy,
          Defended: defenceResult.defended_metrics.adversarial_accuracy
        },
        {
          metric: 'Attack Success Rate (%)',
          Baseline: defenceResult.baseline_metrics.attack_success_rate,
          Defended: defenceResult.defended_metrics.attack_success_rate
        }
      ]
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Adversarial Defence & Hardening
            <Badge variant="safe" size="sm">PRIMARY DEFENCE</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Augment model decision boundaries with constrained adversarial training to mitigate evasion attacks.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Defence Techniques Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#111928]/90 border border-cyan-500/30 shadow-lg">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs mb-1">
            <ShieldCheck className="w-4 h-4" />
            1. Adversarial Retraining (Available)
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Augments the training split with feature-space adversarial examples and compares clean and attacked metrics on held-out test data.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#111928]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs mb-1">
            <Layers className="w-4 h-4 text-emerald-400" />
            2. Feature-Space Constraints
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Applies limited feature constraints during adversarial experiments. Packet and protocol realism are not validated, and this is not live input sanitization.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#111928]/90 border border-slate-800 shadow-lg">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs mb-1">
            <Cpu className="w-4 h-4 text-blue-400" />
            3. Ensemble Defense (Not Integrated)
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            An ensemble helper exists but is not wired into model selection or inference; saved models are evaluated independently.
          </p>
        </div>
      </div>

      {/* Adversarial Training Setup Card */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Adversarial Retraining Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
          {/* Base Model */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">Base Architecture</label>
            <select
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 outline-none focus:border-cyan-500"
            >
              <option value="PyTorch MLP">PyTorch MLP</option>
              <option value="Random Forest">Random Forest</option>
              <option value="XGBoost">XGBoost</option>
            </select>
          </div>

          {/* Attack Used in Training */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">Training Attack Generator</label>
            <select
              value={attackMethod}
              onChange={(e) => setAttackMethod(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 outline-none focus:border-cyan-500"
            >
              <option value="FGSM">FGSM (Single-step Fast)</option>
              <option value="PGD">PGD (Multi-step Robust)</option>
            </select>
          </div>

          {/* Epsilon */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-medium">Training Epsilon (ε):</span>
              <span className="text-cyan-400 font-mono font-bold">{epsilon}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.5"
              step="0.05"
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer mt-1"
            />
          </div>

          {/* Adversarial Data Ratio */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-medium">Adv Sample Ratio:</span>
              <span className="text-cyan-400 font-mono font-bold">{(advRatio * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.1"
              value={advRatio}
              onChange={(e) => setAdvRatio(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer mt-1"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleTrainDefence}
            disabled={training}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-emerald-950"
          >
            {training ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Hardening Model Decision Boundary...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Train Hardened Defended Model
              </>
            )}
          </button>
        </div>
      </div>

      {/* Defence Findings */}
      {defenceResult && (
        <div className="space-y-6">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Adversarial Evasion Drop"
              value={`-${defenceResult.comparison.asr_reduction_pct}%`}
              subtitle={`Defended ASR: ${defenceResult.defended_metrics.attack_success_rate}% vs Base: ${defenceResult.baseline_metrics.attack_success_rate}%`}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Clean Accuracy Impact"
              value={`${defenceResult.comparison.clean_accuracy_impact_pct > 0 ? '+' : ''}${defenceResult.comparison.clean_accuracy_impact_pct}%`}
              subtitle={`Clean Acc: ${defenceResult.defended_metrics.clean_accuracy}%`}
              icon={ShieldCheck}
              color="cyan"
            />
            <StatCard
              title="Dataset Augmentation"
              value={`${defenceResult.training_samples_augmented.toLocaleString()} flows`}
              subtitle={`+${defenceResult.adversarial_training_samples} synthetic adv flows`}
              icon={Layers}
              color="blue"
            />
            <StatCard
              title="Hardened Model ID"
              value={defenceResult.defended_model_id}
              subtitle={`Trained in ${defenceResult.training_time} s`}
              icon={Cpu}
              color="slate"
            />
          </div>

          {/* Comparison Bar Chart */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Pre-Defence vs Post-Defence Performance Comparison
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="metric" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Baseline" fill="#ef4444" radius={[4, 4, 0, 0]} name="Baseline Model" />
                  <Bar dataKey="Defended" fill="#10b981" radius={[4, 4, 0, 0]} name="Defended Model (Adversarial Training)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Realistic Disclaimer Alert */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Scientific Project Takeaway:
            </div>
            <p>
              Adversarial training provides significant resilience against targeted evasion perturbations, but as established
              in cybersecurity research, <em>no model is 100% attack-proof</em>. Defense-in-depth combining adversarial training,
              input invariant sanitization, and ensemble detection is required for mission-critical SOC environments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
