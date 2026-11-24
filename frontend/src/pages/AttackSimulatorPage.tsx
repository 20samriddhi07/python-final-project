import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ModelMetadata, AttackResult } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import {
  Crosshair,
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCw,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const AttackSimulatorPage: React.FC = () => {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [targetModel, setTargetModel] = useState<string>('');
  const [attackType, setAttackType] = useState<string>('FGSM');
  const [epsilon, setEpsilon] = useState<number>(0.25);
  const [iterations, setIterations] = useState<number>(15);
  const [sampleLimit, setSampleLimit] = useState<number>(100);

  const [simulating, setSimulating] = useState<boolean>(false);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await api.listModels();
      setModels(res.models || []);
      if (res.models && res.models.length > 0) {
        setTargetModel(res.models[0].model_id);
      } else {
        setTargetModel('');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRunAttack = async () => {
    setSimulating(true);
    setError(null);
    try {
      const res = await api.runAttack({
        target_model_id: targetModel,
        attack_type: attackType,
        epsilon: epsilon,
        iterations: iterations,
        sample_limit: sampleLimit
      });
      setAttackResult(res);
    } catch (err: any) {
      setError(err.message || 'Adversarial simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  // Detection rates are measured over malicious flows only.
  const detectionComparisonData = attackResult
    ? [
        { name: 'Clean Test Data', DetectionRate: attackResult.clean_detection_rate },
        { name: `Adversarial (${attackResult.actual_method})`, DetectionRate: attackResult.adversarial_detection_rate }
      ]
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Adversarial Attack Simulator
            <Badge variant="danger" size="sm">EVASION LAB</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Evaluate held-out traffic with gradient attacks on PyTorch models and query-based attacks on tree models.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Semantic Constraints Notice */}
      <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Network Traffic Semantic Invariants Enforced:</p>
          <p className="text-slate-300">
            Perturbations are bounded in standardized feature space, then non-negative traffic measures and immutable
            destination-port features are constrained in the available tabular representation. This is a feature-space
            experiment, not packet replay or proof that every modified feature vector is a realizable network flow.
          </p>
        </div>
      </div>

      {/* Attack Configurator Card */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Attack Vector Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
          {/* Target Model */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">Target IDS Model</label>
            <select
              value={targetModel}
              onChange={(e) => {
                const nextModelId = e.target.value;
                const nextModel = models.find((model) => model.model_id === nextModelId);
                setTargetModel(nextModelId);
                if (
                  !nextModel?.model_type.includes('PyTorch MLP')
                  && (attackType === 'FGSM' || attackType === 'PGD')
                ) {
                  setAttackType('Black-box Query');
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 outline-none focus:border-cyan-500"
            >
              {models.length > 0 ? models.map((model) => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_type} · {model.model_id}
                </option>
              )) : (
                <option value="" disabled>No loadable models available</option>
              )}
            </select>
          </div>

          {/* Attack Method */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">Attack Algorithm</label>
            <select
              value={attackType}
              onChange={(e) => setAttackType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 outline-none focus:border-cyan-500"
            >
              <option value="FGSM" disabled={!models.find((model) => model.model_id === targetModel)?.model_type.includes('PyTorch MLP')}>
                FGSM (PyTorch gradient model)
              </option>
              <option value="PGD" disabled={!models.find((model) => model.model_id === targetModel)?.model_type.includes('PyTorch MLP')}>
                PGD (PyTorch gradient model)
              </option>
              <option value="Black-box Query">Black-box Zeroth-Order Query</option>
              <option value="Black-box Transfer">Black-box Transferability</option>
            </select>
          </div>

          {/* Epsilon Slider */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="font-medium">Perturbation Strength (ε):</span>
              <span className="text-cyan-400 font-mono font-bold">{epsilon}</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.05"
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer mt-1.5"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.05 (Subtle)</span>
              <span>0.25 (Standard)</span>
              <span>0.80 (Aggressive)</span>
            </div>
          </div>

          {/* Iterations / Sample count */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">
              {attackType === 'PGD' ? 'PGD Iterations (k)' : 'Evaluated Malicious Flows'}
            </label>
            {attackType === 'PGD' ? (
              <input
                type="number"
                min="5"
                max="50"
                value={iterations}
                onChange={(e) => setIterations(parseInt(e.target.value) || 10)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
              />
            ) : (
              <input
                type="number"
                min="20"
                max="500"
                value={sampleLimit}
                onChange={(e) => setSampleLimit(parseInt(e.target.value) || 100)}
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
              />
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleRunAttack}
            disabled={simulating || !targetModel}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-rose-950"
          >
            {simulating ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Perturbing Malicious Flows...
              </>
            ) : (
              <>
                <Crosshair className="w-4 h-4" />
                Launch Adversarial Attack Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Attack Findings View */}
      {attackResult && (
        <div className="space-y-6">
          {attackResult.method_note && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{attackResult.method_note}</span>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Attack Success Rate (ASR)"
              value={`${attackResult.attack_success_rate}%`}
              subtitle={`${attackResult.successful_evasions} / ${attackResult.initially_detected_attacks} evasions`}
              icon={ShieldAlert}
              color={attackResult.attack_success_rate > 30 ? 'red' : 'amber'}
            />
            <StatCard
              title="Adversarial Accuracy"
              value={`${attackResult.adversarial_accuracy}%`}
              subtitle={`Clean detection rate: ${attackResult.clean_detection_rate}%`}
              icon={Crosshair}
              color="red"
            />
            <StatCard
              title="Maximum Perturbation (L-inf)"
              value={`ε = ${attackResult.perturbation_linf}`}
              subtitle={`Mean L2: ${attackResult.perturbation_l2_mean}`}
              icon={Sliders}
              color="blue"
            />
            <StatCard
              title="Algorithm Deployed"
              value={attackResult.actual_method}
              subtitle={`Target: ${attackResult.target_model}`}
              icon={Crosshair}
              color="cyan"
            />
          </div>

          {/* Chart & Evasion Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detection Degradation Chart */}
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Intrusion Detection Collapse Under Evasion
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detectionComparisonData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                      formatter={(val: any) => [`${val}%`, 'Detection Rate']}
                    />
                    <Bar dataKey="DetectionRate" fill="#ef4444" radius={[4, 4, 0, 0]} name="True Detection (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evasion Assessment Summary */}
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  Adversarial Vulnerability Findings
                </h3>
                <div className="space-y-3 text-xs text-slate-300">
                  <p>
                    • Tested <strong className="text-white">{attackResult.evaluated_samples}</strong> held-out malicious flows against{' '}
                    <strong className="text-cyan-400">{attackResult.target_model}</strong>.
                  </p>
                  <p>
                    • Without defence,{' '}
                    <strong className="text-rose-400">
                      {attackResult.successful_evasions} malicious attacks ({attackResult.attack_success_rate}%)
                    </strong>{' '}
                    completely evaded detection and were misclassified as legitimate <strong className="text-emerald-400">BENIGN</strong> network traffic.
                  </p>
                  <p>
                    • Selected feature-level constraints were applied; packet- and protocol-level realism was not validated.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs flex justify-between items-center">
                <span className="text-slate-400">Defense Recommended:</span>
                <span className="text-cyan-400 font-semibold">                Adversarial Retraining (Results & Defence)</span>
              </div>
            </div>
          </div>

          {/* Sample-by-Sample Feature Modification Inspection Table */}
          {attackResult.sample_comparisons && attackResult.sample_comparisons.length > 0 && (
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-3 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Physical Feature Perturbation Inspection (Sample #{attackResult.sample_comparisons[0].sample_id})
              </h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Original Prediction:</span>
                  <Badge variant="danger" size="sm">{attackResult.sample_comparisons[0].original_prediction}</Badge>
                  <span className="text-slate-500">({attackResult.sample_comparisons[0].original_confidence}%)</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Adversarial Prediction:</span>
                  <Badge
                    variant={attackResult.sample_comparisons[0].evasion_success ? 'safe' : 'danger'}
                    size="sm"
                  >
                    {attackResult.sample_comparisons[0].adversarial_prediction}
                  </Badge>
                  <span className="text-slate-500">({attackResult.sample_comparisons[0].adversarial_confidence}%)</span>
                </div>
                <div className="font-semibold">
                  Status:{' '}
                  {attackResult.sample_comparisons[0].evasion_success ? (
                    <span className="text-rose-400 font-bold">EVADED (ATTACK SUCCEEDED)</span>
                  ) : (
                    <span className="text-emerald-400 font-bold">STILL DETECTED</span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] uppercase">
                      <th className="py-2 px-3">Network Feature</th>
                      <th className="py-2 px-3 text-right">Original (Raw Domain)</th>
                      <th className="py-2 px-3 text-right">Perturbed (Adversarial)</th>
                      <th className="py-2 px-3 text-right">Delta (Δ)</th>
                      <th className="py-2 px-3 text-center">Semantic Constraint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {attackResult.sample_comparisons[0].features.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-sans font-medium text-slate-300">{f.feature}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{f.original}</td>
                        <td className="py-2 px-3 text-right text-cyan-300">{f.adversarial}</td>
                        <td
                          className={`py-2 px-3 text-right font-semibold ${
                            f.delta > 0 ? 'text-amber-400' : f.delta < 0 ? 'text-rose-400' : 'text-slate-500'
                          }`}
                        >
                          {f.delta > 0 ? `+${f.delta}` : f.delta}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {f.is_immutable ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              <Lock className="w-2.5 h-2.5" /> Immutable
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              Bounded (≥0)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
