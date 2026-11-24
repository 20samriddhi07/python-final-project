import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { ModelMetadata } from '../types';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import {
  ShieldAlert,
  ShieldCheck,
  Upload,
  Play,
  Download,
  AlertTriangle,
  Cpu,
  Activity,
  FileText
} from 'lucide-react';

export const IntrusionDetectionPage: React.FC = () => {
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [classifying, setClassifying] = useState<boolean>(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setError(err.message || 'Failed to load available models');
    }
  };

  const handleRunClassification = async () => {
    setClassifying(true);
    setError(null);
    try {
      const res = await api.predictTraffic(selectedModel, selectedFile || undefined);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Traffic classification failed');
    } finally {
      setClassifying(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!results || !results.records) return;
    const header = ['Record ID', 'Classification', 'Confidence (%)', 'Attack Type', 'Destination Port', 'Flow Duration', 'Total Packets'];
    const rows = results.records.map((r: any) => [
      r.record_id,
      r.classification,
      r.confidence,
      r.attack_type,
      r.destination_port,
      r.flow_duration,
      r.total_packets
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ids_classification_${selectedModel.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Intrusion Detection Classifier
            <Badge variant="danger" size="sm">INSPECTION</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Classify uploaded or bundled network-traffic CSV records using a saved model and its preprocessing pipeline.
          </p>
        </div>

        {results && (
          <button
            onClick={handleDownloadCSV}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            Download Predictions CSV
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration & Controls */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Model Selector */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Active Detection Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
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

          {/* Traffic Source File */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Network Traffic CSV
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 text-left px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 truncate hover:border-slate-600"
              >
                {selectedFile ? selectedFile.name : 'Default Stream (network_traffic_stream.csv)'}
              </button>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={handleRunClassification}
              disabled={classifying || !selectedModel}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-950"
            >
              {classifying ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  Running Neural Classification...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Execute Classification
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results View */}
      {results && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Records Analyzed"
              value={results.total_records.toLocaleString()}
              subtitle="Network flows ingested"
              icon={FileText}
              color="blue"
            />
            <StatCard
              title="Benign Verified Traffic"
              value={results.normal_records.toLocaleString()}
              subtitle={`${((results.normal_records / (results.total_records || 1)) * 100).toFixed(1)}% safe`}
              icon={ShieldCheck}
              color="green"
            />
            <StatCard
              title="Intrusions Detected"
              value={results.malicious_records.toLocaleString()}
              subtitle={`${results.detection_percentage}% flagged malicious`}
              icon={ShieldAlert}
              color="red"
            />
            <StatCard
              title="Model Utilized"
              value={results.model_used}
              subtitle="Standard scaled inference"
              icon={Cpu}
              color="cyan"
            />
          </div>

          {/* Records Table */}
          <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                Live Ingress Traffic Classification Stream
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Showing top {results.records.length} records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-sans font-medium uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Attack Vector / Type</th>
                    <th className="py-2.5 px-3">Dest Port</th>
                    <th className="py-2.5 px-3">Duration (μs)</th>
                    <th className="py-2.5 px-3">Total Pkts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {results.records.map((r: any) => (
                    <tr
                      key={r.record_id}
                      className={`hover:bg-slate-800/40 transition ${
                        r.is_attack ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-500">{r.record_id}</td>
                      <td className="py-2 px-3">
                        {r.is_attack ? (
                          <Badge variant="danger" size="sm">ATTACK</Badge>
                        ) : (
                          <Badge variant="safe" size="sm">BENIGN</Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-200">
                        {r.confidence}%
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <span
                          className={`font-medium ${
                            r.is_attack ? 'text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          {r.attack_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{r.destination_port}</td>
                      <td className="py-2 px-3 text-slate-400">{r.flow_duration.toLocaleString()}</td>
                      <td className="py-2 px-3 text-cyan-400">{r.total_packets}</td>
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
