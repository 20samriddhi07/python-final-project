export type PageTab =
  | 'dashboard'
  | 'dataset-training'
  | 'intrusion-detection'
  | 'adversarial-testing'
  | 'results-defence';

export interface OverviewStats {
  dataset_loaded: boolean;
  active_dataset: string | null;
  total_records_analyzed: number;
  normal_traffic_count: number;
  malicious_traffic_count: number;
  attack_distribution: Record<string, number>;
  trained_models_count: number;
  current_model_accuracy: number | null;
  adversarial_robustness_score: number | null;
  total_experiments: number;
  recent_models: ModelMetadata[];
  recent_evaluations: any[];
  recent_attacks: AttackResult[];
  security_alerts: SecurityAlert[];
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  level: 'safe' | 'warning' | 'danger' | 'info';
  message: string;
  details?: any;
}

export interface ModelMetadata {
  model_id: string;
  model_type: string;
  file_path: string;
  hyperparameters: Record<string, any>;
  created_at: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    fpr: number;
    fnr: number;
    confusion_matrix: number[][];
    classification_report: any;
    training_time: number;
    inference_time_ms: number;
    history?: { epoch: number; loss: number; accuracy: number }[];
  };
}

export interface DatasetSummary {
  filename: string;
  total_rows: number;
  total_cols: number;
  columns: string[];
  numeric_columns_count: number;
  total_missing_values: number;
  missing_by_column: Record<string, number>;
  total_infinite_values: number;
  infinite_by_column: Record<string, number>;
  total_duplicates: number;
  label_column: string;
  class_distribution: Record<string, number>;
  binary_distribution: { BENIGN: number; ATTACK: number };
  feature_statistics: {
    feature: string;
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
  }[];
  correlation_features: string[];
  correlation_matrix: Record<string, any>[];
  preview: Record<string, any>[];
}

export interface AttackResult {
  target_model: string;
  configured_attack: string;
  actual_method: string;
  method_note?: string;
  epsilon: number;
  iterations: number;
  evaluated_samples: number;
  initially_detected_attacks: number;
  successful_evasions: number;
  attack_success_rate: number;
  clean_detection_rate: number;
  adversarial_detection_rate: number;
  adversarial_accuracy: number;
  perturbation_linf: number;
  perturbation_l2_mean: number;
  sample_comparisons: {
    sample_id: number;
    original_prediction: string;
    original_confidence: number;
    adversarial_prediction: string;
    adversarial_confidence: number;
    evasion_success: boolean;
    features: {
      feature: string;
      original: number;
      adversarial: number;
      delta: number;
      is_immutable: boolean;
    }[];
  }[];
  timestamp: string;
}

export interface DefenceResult {
  defended_model_id: string;
  base_model_type: string;
  attack_used_in_training: string;
  epsilon: number;
  adversarial_sample_ratio: number;
  training_samples_augmented: number;
  clean_training_samples: number;
  adversarial_training_samples: number;
  training_time: number;
  baseline_metrics: {
    clean_accuracy: number;
    clean_f1: number;
    clean_precision: number;
    clean_recall: number;
    adversarial_accuracy: number;
    attack_success_rate: number;
    evasions: number;
  };
  defended_metrics: {
    clean_accuracy: number;
    clean_f1: number;
    clean_precision: number;
    clean_recall: number;
    adversarial_accuracy: number;
    attack_success_rate: number;
    evasions: number;
  };
  comparison: {
    asr_reduction_pct: number;
    clean_accuracy_impact_pct: number;
    robustness_improvement: string;
  };
  timestamp: string;
}

export interface RobustnessEvaluationResult {
  model_id: string;
  evaluated_samples: number;
  attack_samples_count: number;
  epsilon: number;
  robustness_score: number;
  clean_accuracy: number;
  worst_adversarial_accuracy: number;
  max_attack_success_rate: number;
  conditions: {
    condition: string;
    accuracy: number;
    f1_score: number;
    precision: number;
    recall: number;
    fpr: number;
    fnr: number;
    attack_success_rate: number;
    evasions: number;
  }[];
  confusion_matrices: {
    clean: number[][];
    fgsm: number[][];
    pgd: number[][];
    bbox: number[][];
  };
  timestamp: string;
}
