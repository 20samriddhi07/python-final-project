import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ModelMetadata } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { ConfusionMatrix } from '../components/ConfusionMatrix';
import {
  Cpu,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sliders,
  Zap,
  BarChart3
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export const ModelTrainingPage: React.FC = () => {
  const [modelType, setModelType] = useState<string>('PyTorch MLP');
  const [training, setTraining] = useState<boolean>(false);
  const [trainedModels, setTrainedModels] = useState<ModelMetadata[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hyperparameters
  const [rfTrees, setRfTrees] = useState<number>(100);
  const [rfDepth, setRfDepth] = useState<number>(15);

  const [xgbTrees, setXgbTrees] = useState<number>(100);
  const [xgbDepth, setXgbDepth] = useState<number>(6);
  const [xgbLr, setXgbLr] = useState<number>(0.1);

  const [mlpEpochs, setMlpEpochs] = useState<number>(15);
  const [mlpBatch, setMlpBatch] = useState<number>(64);
  const [mlpLr, setMlpLr] = useState<number>(0.001);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const res = await api.listModels();
      setTrainedModels(res.models || []);
      if (res.models && res.models.length > 0) {
        setSelectedModel(res.models[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setError(null);

    let params: Record<string, any> = {};
    if (modelType === 'Random Forest') {
      params = { n_estimators: rfTrees, max_depth: rfDepth };
    } else if (modelType === 'XGBoost') {
      params = { n_estimators: xgbTrees, max_depth: xgbDepth, learning_rate: xgbLr };
    } else {
      params = { epochs: mlpEpochs, batch_size: mlpBatch, learning_rate: mlpLr };
    }

    try {
      const res = await api.trainModel(modelType, params);
      await loadModels();
      setSelectedModel(res.model);
    } catch (err: any) {
      setError(err.message || 'Model training failed');
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Model Training & Evaluation
            <Badge variant="info" size="sm">3 ARCHITECTURES</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Train and benchmark Random Forest, XGBoost, and PyTorch Multilayer Perceptrons (MLP).
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Training Configuration Panel */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Model Training Configuration
        </h3>

        {/* Model Architecture Tabs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {(['PyTorch MLP', 'Random Forest', 'XGBoost'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setModelType(type)}
              className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                modelType === type
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-950'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              {type}
            </button>
          ))}
        </div>

        {/* Hyperparameter Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {modelType === 'Random Forest' && (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Number of Trees (n_estimators)</label>
                <input
                  type="number"
                  value={rfTrees}
                  onChange={(e) => setRfTrees(parseInt(e.target.value) || 50)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Max Tree Depth</label>
                <input
                  type="number"
                  value={rfDepth}
                  onChange={(e) => setRfDepth(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Parallel Jobs</label>
                <input
                  type="text"
                  disabled
                  value="-1 (All CPU Cores)"
                  className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-500 rounded-lg p-2.5 font-mono"
                />
              </div>
            </>
          )}

          {modelType === 'XGBoost' && (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Boosting Rounds (n_estimators)</label>
                <input
                  type="number"
                  value={xgbTrees}
                  onChange={(e) => setXgbTrees(parseInt(e.target.value) || 50)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Max Depth</label>
                <input
                  type="number"
                  value={xgbDepth}
                  onChange={(e) => setXgbDepth(parseInt(e.target.value) || 6)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Learning Rate (eta)</label>
                <input
                  type="number"
                  step="0.01"
                  value={xgbLr}
                  onChange={(e) => setXgbLr(parseFloat(e.target.value) || 0.1)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
            </>
          )}

          {modelType === 'PyTorch MLP' && (
            <>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Training Epochs</label>
                <input
                  type="number"
                  value={mlpEpochs}
                  onChange={(e) => setMlpEpochs(parseInt(e.target.value) || 10)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Batch Size</label>
                <input
                  type="number"
                  value={mlpBatch}
                  onChange={(e) => setMlpBatch(parseInt(e.target.value) || 64)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Learning Rate (Adam)</label>
                <input
                  type="number"
                  step="0.0005"
                  value={mlpLr}
                  onChange={(e) => setMlpLr(parseFloat(e.target.value) || 0.001)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2.5 font-mono"
                />
              </div>
            </>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleTrain}
            disabled={training}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-950"
          >
            {training ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Fitting {modelType}...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Start Model Training
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trained Models Manifest & Results */}
      {selectedModel && selectedModel.metrics && (
        <div className="space-y-6">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Test Accuracy"
              value={`${(selectedModel.metrics.accuracy * 100).toFixed(2)}%`}
              subtitle={`F1 Score: ${selectedModel.metrics.f1_score.toFixed(3)}`}
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              title="Precision / Recall"
              value={`${(selectedModel.metrics.precision * 100).toFixed(1)}% / ${(selectedModel.metrics.recall * 100).toFixed(1)}%`}
              subtitle="False alarms vs detection rate"
              icon={BarChart3}
              color="cyan"
            />
            <StatCard
              title="Training Duration"
              value={`${selectedModel.metrics.training_time} s`}
              subtitle={`Inference: ${selectedModel.metrics.inference_time_ms.toFixed(3)} ms/flow`}
              icon={Clock}
              color="blue"
            />
            <StatCard
              title="False Positive / Negative"
              value={`${(selectedModel.metrics.fpr * 100).toFixed(2)}% / ${(selectedModel.metrics.fnr * 100).toFixed(2)}%`}
              subtitle="FPR / FNR on held-out test data"
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              title="Architecture"
              value={selectedModel.model_type}
              subtitle={selectedModel.model_id}
              icon={Cpu}
              color="slate"
            />
          </div>

          {/* Confusion Matrix and Classification Report Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confusion Matrix Card */}
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Confusion Matrix (Hold-out Test Split)
              </h3>
              <ConfusionMatrix
                matrix={selectedModel.metrics.confusion_matrix}
                title={`${selectedModel.model_type} Matrix`}
              />
            </div>

            {/* Classification Report Table */}
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Classification Report Details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] uppercase">
                      <th className="py-2 px-3">Class</th>
                      <th className="py-2 px-3 text-right">Precision</th>
                      <th className="py-2 px-3 text-right">Recall</th>
                      <th className="py-2 px-3 text-right">F1-Score</th>
                      <th className="py-2 px-3 text-right">Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {['0', '1'].map((clsKey) => {
                      const rep = selectedModel.metrics.classification_report?.[clsKey];
                      if (!rep) return null;
                      return (
                        <tr key={clsKey} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-sans font-medium text-slate-200">
                            {clsKey === '0' ? 'BENIGN (0)' : 'ATTACK (1)'}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">{(rep.precision * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right text-slate-300">{(rep.recall * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right text-cyan-400 font-semibold">{rep['f1-score'].toFixed(3)}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{rep.support}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PyTorch MLP Training Convergence Curve */}
          {selectedModel.metrics.history && selectedModel.metrics.history.length > 0 && (
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                PyTorch Neural Training Convergence History
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedModel.metrics.history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="epoch" stroke="#64748b" fontSize={11} label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} name="CrossEntropy Loss" />
                    <Line type="monotone" dataKey="accuracy" stroke="#06b6d4" strokeWidth={2} name="Training Accuracy" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
