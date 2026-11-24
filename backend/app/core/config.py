import os
from pathlib import Path

# Paths configuration
APP_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

DATASET_DIR = PROJECT_ROOT / "dataset"
DATASET_RAW_DIR = DATASET_DIR / "raw"
DATASET_PROCESSED_DIR = DATASET_DIR / "processed"
EXPERIMENTS_DIR = PROJECT_ROOT / "experiments"
RESULTS_DIR = PROJECT_ROOT / "results"
MODELS_DIR = EXPERIMENTS_DIR / "models"
REPORTS_DIR = RESULTS_DIR / "reports"

for d in [DATASET_RAW_DIR, DATASET_PROCESSED_DIR, EXPERIMENTS_DIR, RESULTS_DIR, MODELS_DIR, REPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

PROJECT_NAME = "ADVERSHIELD"
PROJECT_SUBTITLE = "AI-Powered Intrusion Detection & Adversarial Robustness Evaluation System"
VERSION = "1.0.0"
AUTHOR = "CSE Cybersecurity & Machine Learning Project"
