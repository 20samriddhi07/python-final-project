import React, { useState, useEffect, useRef } from 'react';
import { DatasetSummary } from '../types';
import { api } from '../services/api';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Sliders,
  Database,
  Hash,
  Table as TableIcon
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

export const TrafficAnalysisPage: React.FC = () => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('cicids2017_sample.csv');
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [preprocessing, setPreprocessing] = useState<boolean>(false);
  const [preprocessResult, setPreprocessResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testSplit, setTestSplit] = useState<number>(0.2);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDatasetList();
    loadSummary(selectedFilename);
  }, []);

  const loadDatasetList = async () => {
    try {
      const res = await api.listDatasets();
      setDatasets(res.datasets || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadSummary = async (filename: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDatasetSummary(filename);
      setSummary(data);
      setSelectedFilename(filename);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect dataset');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.uploadDataset(file);
      setSummary(res.summary);
      setSelectedFilename(file.name);
      await loadDatasetList();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePreprocess = async () => {
    if (!selectedFilename) return;
    setPreprocessing(true);
    setError(null);
    try {
      const res = await api.preprocessDataset(selectedFilename, testSplit);
      setPreprocessResult(res.metadata);
    } catch (err: any) {
      setError(err.message || 'Preprocessing error');
    } finally {
      setPreprocessing(false);
    }
  };

  const classDistData = summary
    ? Object.entries(summary.class_distribution).map(([name, count]) => ({
        name,
        count
      }))
    : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Network Traffic Analysis & Preprocessing
            <Badge variant="info" size="sm">CICIDS2017</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Ingest, inspect anomalies, validate network features, and prepare training splits.
          </p>
        </div>

        {/* Dataset selector & Upload button */}
        <div className="flex items-center gap-2">
          <select
            value={selectedFilename}
            onChange={(e) => loadSummary(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 font-mono"
          >
            {datasets.map((d) => (
              <option key={d.filename} value={d.filename}>
                {d.filename} ({d.size_mb} MB)
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition shadow-md shadow-cyan-950"
          >
            <UploadCloud className="w-4 h-4" />
            Upload CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <>
          {/* Dimension & Anomaly Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Dataset Dimensions"
              value={`${summary.total_rows.toLocaleString()} × ${summary.total_cols}`}
              subtitle="Flow records × Features"
              icon={Database}
              color="blue"
            />
            <StatCard
              title="Duplicate Records"
              value={summary.total_duplicates.toLocaleString()}
              subtitle={summary.total_duplicates > 0 ? 'Will be deduplicated' : 'Clean & Unique'}
              icon={Hash}
              color={summary.total_duplicates > 0 ? 'amber' : 'green'}
            />
            <StatCard
              title="Missing Values"
              value={summary.total_missing_values.toLocaleString()}
              subtitle={summary.total_missing_values > 0 ? 'Handled via median' : 'Zero missing'}
              icon={CheckCircle2}
              color={summary.total_missing_values > 0 ? 'amber' : 'green'}
            />
            <StatCard
              title="Infinite Values (Inf)"
              value={summary.total_infinite_values.toLocaleString()}
              subtitle="Replaced and imputed"
              icon={AlertTriangle}
              color={summary.total_infinite_values > 0 ? 'amber' : 'green'}
            />
          </div>

          {/* Preprocessing Actions & Class Imbalance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Preprocessing Control Card */}
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2 mb-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Preprocessing Pipeline Controls
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Prevents test-data leakage by fitting StandardScaler exclusively on the training partition.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Hold-Out Test Split Ratio: <span className="text-cyan-400 font-mono">{(testSplit * 100).toFixed(0)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.4"
                      step="0.05"
                      value={testSplit}
                      onChange={(e) => setTestSplit(parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>10% Test</span>
                      <span>20% (Standard)</span>
                      <span>40% Test</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-[11px] text-slate-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Feature:</span>
                      <span className="text-cyan-400 font-bold">{summary.label_column || 'Label'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Binary Mapping:</span>
                      <span>BENIGN=0, ATTACK=1</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scaling:</span>
                      <span>StandardScaler (Train only)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={handlePreprocess}
                  disabled={preprocessing}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-950"
                >
                  {preprocessing ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Splitting & Scaling...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Execute Safe Preprocessing
                    </>
                  )}
                </button>

                {preprocessResult && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400">
                    ✓ Partitioned: <strong>{preprocessResult.train_samples}</strong> train, <strong>{preprocessResult.test_samples}</strong> test flows. Ready for model training!
                  </div>
                )}
              </div>
            </div>

            {/* Class Imbalance Chart */}
            <div className="lg:col-span-2 bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  Traffic Class Imbalance Distribution
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {summary.total_rows.toLocaleString()} total flows
                </span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classDistData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                      formatter={(val: any) => [val != null ? val.toLocaleString() : '0', 'Flows']}
                    />
                    <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Safe Ratio: <strong className="text-emerald-400">{summary.binary_distribution.BENIGN.toLocaleString()}</strong></span>
                <span>Attack Ratio: <strong className="text-rose-400">{summary.binary_distribution.ATTACK.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          {/* Feature Descriptive Statistics Table */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-white tracking-wide mb-3 flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-cyan-400" />
              Network Feature Invariant Statistics (Physical Range)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Feature Name</th>
                    <th className="py-2.5 px-3 text-right">Mean</th>
                    <th className="py-2.5 px-3 text-right">Std Dev</th>
                    <th className="py-2.5 px-3 text-right">Min</th>
                    <th className="py-2.5 px-3 text-right">Median</th>
                    <th className="py-2.5 px-3 text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {summary.feature_statistics.map((stat, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 px-3 font-sans font-medium text-slate-300">{stat.feature}</td>
                      <td className="py-2 px-3 text-right text-slate-400">{stat.mean.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-400">{stat.std.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">{stat.min.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-cyan-400">{stat.median.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-amber-400">{stat.max.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Correlation Matrix Heatmap */}
          {summary.correlation_matrix && summary.correlation_matrix.length > 0 && (
            <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-white tracking-wide mb-3 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                Feature Cross-Correlation Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-[10px] font-mono">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="p-2 text-left font-sans text-slate-400">Feature</th>
                      {summary.correlation_features.map((f, idx) => (
                        <th key={idx} className="p-2 text-slate-400 truncate max-w-[80px]" title={f}>
                          {f.length > 10 ? f.slice(0, 10) + '...' : f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.correlation_matrix.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-slate-800/50">
                        <td className="p-2 text-left font-sans font-medium text-slate-300 truncate max-w-[140px]" title={row.feature}>
                          {row.feature}
                        </td>
                        {summary.correlation_features.map((cCol, cIdx) => {
                          const val = row[cCol] || 0;
                          const bgIntensity = Math.abs(val);
                          const isPositive = val >= 0;
                          return (
                            <td
                              key={cIdx}
                              className="p-2"
                              style={{
                                backgroundColor: isPositive
                                  ? `rgba(6, 182, 212, ${bgIntensity * 0.4})`
                                  : `rgba(239, 68, 68, ${bgIntensity * 0.4})`,
                                color: bgIntensity > 0.4 ? '#ffffff' : '#94a3b8'
                              }}
                            >
                              {val.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
