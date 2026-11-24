import React, { useState } from 'react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileSpreadsheet,
  Layers,
  GraduationCap
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [generating, setGenerating] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePDF = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.generateReport();
      setDownloadUrl(res.download_url);
    } catch (err: any) {
      setError(err.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Engineering Project Report Generator
            <Badge variant="info" size="sm">PDF & CSV EXPORT</Badge>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Compile empirical research findings, attack evaluations, and defence benchmarks into an academic report.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Report Summary Card */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">
              Research Summary: Adversarial Robustness Evaluation
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              The compiled PDF report encompasses: Project Executive Summary, CICIDS2017 Preprocessing Metadata,
              Hold-Out Confusion Matrices, FGSM / PGD / Black-Box Attack Success Rates, Adversarial Training Gains,
              and Concluding Engineering Takeaways for Defense-in-Depth SOC deployments.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              {/* PDF Action */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Formal PDF Project Report
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Formatted with ReportLab tables, executive summaries, and empirical matrices ready for faculty evaluation.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleGeneratePDF}
                    disabled={generating}
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-950"
                  >
                    {generating ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Compiling PDF Report...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Generate & Download PDF
                      </>
                    )}
                  </button>

                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition"
                    >
                      ✓ Download Compiled PDF Now
                    </a>
                  )}
                </div>
              </div>

              {/* CSV Export Action */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Model Metrics CSV Dataset
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Exports raw tabular metrics across all trained baseline and defended models for custom plotting in Excel or Python.
                  </p>
                </div>

                <a
                  href="/api/reports/export-csv"
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition text-center"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  Export Models Benchmark CSV
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Included Sections Preview */}
      <div className="bg-[#111928]/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-semibold text-white tracking-wide mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Included Report Chapters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 1: Project Objective & Architecture</span>
              <p className="text-slate-400 text-[11px] mt-0.5">Problem definition, NIDS role, and technology stack overview.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 2: CICIDS2017 Preprocessing</span>
              <p className="text-slate-400 text-[11px] mt-0.5">StandardScaler parameters, zero data-leakage hold-out test split, and feature invariants.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 3: Baseline Detection Models</span>
              <p className="text-slate-400 text-[11px] mt-0.5">Accuracy, F1-Score, Confusion Matrices, and inference latency comparison.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 4: Adversarial Evasion & Attacks</span>
              <p className="text-slate-400 text-[11px] mt-0.5">FGSM, PGD, and Black-Box query findings with semantic network constraints.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 5: Adversarial Defence & Hardening</span>
              <p className="text-slate-400 text-[11px] mt-0.5">Adversarial training evaluation, evasion reduction rates, and clean trade-off.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Chapter 6: Final Engineering Conclusion</span>
              <p className="text-slate-400 text-[11px] mt-0.5">SOC takeaways, defense-in-depth suggestions, and future work.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
