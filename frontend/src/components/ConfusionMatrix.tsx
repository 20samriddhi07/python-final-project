import React from 'react';

interface ConfusionMatrixProps {
  matrix: number[][];
  labels?: [string, string];
  title?: string;
}

export const ConfusionMatrix: React.FC<ConfusionMatrixProps> = ({
  matrix,
  labels = ['BENIGN', 'ATTACK'],
  title = 'Confusion Matrix'
}) => {
  if (!matrix || matrix.length < 2 || matrix[0].length < 2) {
    return <div className="text-slate-500 text-xs italic">No matrix data</div>;
  }

  const [tn, fp] = matrix[0];
  const [fn, tp] = matrix[1];
  const total = tn + fp + fn + tp || 1;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs">
      <div className="font-semibold text-slate-300 mb-2 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[10px] text-slate-500">N = {total}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        {/* Top-Left: TN */}
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded p-2.5">
          <div className="text-slate-400 text-[10px] uppercase font-semibold">True Negative (TN)</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">{tn}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{((tn / total) * 100).toFixed(1)}%</div>
          <div className="text-[9px] text-emerald-500/80 mt-0.5">Benign Correct</div>
        </div>

        {/* Top-Right: FP */}
        <div className="bg-rose-950/30 border border-rose-800/40 rounded p-2.5">
          <div className="text-slate-400 text-[10px] uppercase font-semibold">False Positive (FP)</div>
          <div className="text-lg font-bold text-rose-400 mt-1">{fp}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{((fp / total) * 100).toFixed(1)}%</div>
          <div className="text-[9px] text-rose-500/80 mt-0.5">False Alarm</div>
        </div>

        {/* Bottom-Left: FN */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded p-2.5">
          <div className="text-slate-400 text-[10px] uppercase font-semibold">False Negative (FN)</div>
          <div className="text-lg font-bold text-amber-400 mt-1">{fn}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{((fn / total) * 100).toFixed(1)}%</div>
          <div className="text-[9px] text-amber-500/80 mt-0.5">Evasion / Missed</div>
        </div>

        {/* Bottom-Right: TP */}
        <div className="bg-cyan-950/40 border border-cyan-800/40 rounded p-2.5">
          <div className="text-slate-400 text-[10px] uppercase font-semibold">True Positive (TP)</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">{tp}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{((tp / total) * 100).toFixed(1)}%</div>
          <div className="text-[9px] text-cyan-500/80 mt-0.5">Attack Detected</div>
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-1">
        <span>Actual: {labels[0]} / {labels[1]}</span>
        <span>Predicted: Horizontal</span>
      </div>
    </div>
  );
};
