import {
  OverviewStats,
  DatasetSummary,
  ModelMetadata,
  AttackResult,
  DefenceResult,
  RobustnessEvaluationResult
} from '../types';

const API_BASE = '/api';

export const api = {
  // System Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend connection failed');
    return res.json();
  },

  // Overview Stats
  async getOverview(): Promise<OverviewStats> {
    const res = await fetch(`${API_BASE}/overview`);
    if (!res.ok) throw new Error('Failed to fetch overview stats');
    return res.json();
  },

  // Dataset Operations
  async listDatasets() {
    const res = await fetch(`${API_BASE}/dataset/list`);
    if (!res.ok) throw new Error('Failed to list datasets');
    return res.json();
  },

  async getDatasetSummary(filename?: string): Promise<DatasetSummary> {
    const url = filename 
      ? `${API_BASE}/dataset/summary?filename=${encodeURIComponent(filename)}`
      : `${API_BASE}/dataset/summary`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch dataset summary');
    return res.json();
  },

  async uploadDataset(file: File): Promise<{ message: string; summary: DatasetSummary }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/dataset/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async preprocessDataset(filename: string, testSize: number = 0.2) {
    const res = await fetch(`${API_BASE}/dataset/preprocess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, test_size: testSize }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Preprocessing failed');
    }
    return res.json();
  },

  async getPreprocessedInfo() {
    const res = await fetch(`${API_BASE}/dataset/preprocessed-info`);
    if (!res.ok) throw new Error('Failed to fetch preprocessed info');
    return res.json();
  },

  // Model Operations
  async listModels(): Promise<{ models: ModelMetadata[] }> {
    const res = await fetch(`${API_BASE}/models`);
    if (!res.ok) throw new Error('Failed to list models');
    return res.json();
  },

  async trainModel(modelType: string, hyperparameters: Record<string, any>) {
    const res = await fetch(`${API_BASE}/models/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_type: modelType, hyperparameters }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Model training failed');
    }
    return res.json();
  },

  async predictTraffic(modelId: string, file?: File) {
    const formData = new FormData();
    formData.append('model_id', modelId);
    if (file) {
      formData.append('file', file);
    }
    const res = await fetch(`${API_BASE}/models/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Traffic classification failed');
    }
    return res.json();
  },

  // Adversarial Attacks
  async runAttack(params: {
    target_model_id: string;
    attack_type: string;
    epsilon: number;
    iterations?: number;
    sample_limit?: number;
  }): Promise<AttackResult> {
    const res = await fetch(`${API_BASE}/attacks/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Attack simulation failed');
    }
    return res.json();
  },

  // Robustness Evaluation
  async evaluateRobustness(params: {
    model_id: string;
    epsilon: number;
    eval_samples?: number;
  }): Promise<RobustnessEvaluationResult> {
    const res = await fetch(`${API_BASE}/robustness/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Robustness evaluation failed');
    }
    return res.json();
  },

  // Defence Mechanisms
  async trainDefence(params: {
    base_model_type: string;
    attack_type: string;
    epsilon: number;
    adv_ratio: number;
    epochs?: number;
  }): Promise<DefenceResult> {
    const res = await fetch(`${API_BASE}/defence/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Adversarial defence training failed');
    }
    return res.json();
  },

  // Model Comparison
  async getModelComparison() {
    const res = await fetch(`${API_BASE}/models/compare`);
    if (!res.ok) throw new Error('Failed to fetch model comparison');
    return res.json();
  },

  // Reports
  async generateReport() {
    const res = await fetch(`${API_BASE}/reports/generate`);
    if (!res.ok) throw new Error('Failed to generate PDF report');
    return res.json();
  },

  // Settings
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async resetSystem() {
    const res = await fetch(`${API_BASE}/settings/reset`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset system');
    return res.json();
  }
};
