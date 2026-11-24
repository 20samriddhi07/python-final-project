import json
import logging
import time
from typing import Dict, Any, List, Optional
from app.core.config import EXPERIMENTS_DIR

logger = logging.getLogger(__name__)

class AppState:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AppState, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "initialized", False):
            return
        self.initialized = True
        self.active_dataset_filename: Optional[str] = None
        self.raw_dataset_summary: Optional[Dict[str, Any]] = None
        self.preprocessed_metadata: Optional[Dict[str, Any]] = None
        
        # In-memory model instances and artifacts
        self.trained_models: Dict[str, Any] = {}
        self.model_metadata_list: List[Dict[str, Any]] = []
        
        # Evaluations and experiments
        self.recent_evaluations: List[Dict[str, Any]] = []
        self.recent_attacks: List[Dict[str, Any]] = []
        self.recent_defence_results: List[Dict[str, Any]] = []
        self.security_alerts: List[Dict[str, Any]] = []
        
        # Pre-seed alert
        self.add_alert("info", "ADVERSHIELD Engine initialized. System ready for dataset analysis.")

    def add_alert(self, level: str, message: str, details: Optional[Dict[str, Any]] = None):
        alert = {
            "id": f"alert-{int(time.time() * 1000)}",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "level": level,  # 'safe', 'warning', 'danger', 'info'
            "message": message,
            "details": details or {}
        }
        self.security_alerts.insert(0, alert)
        if len(self.security_alerts) > 50:
            self.security_alerts = self.security_alerts[:50]

    def record_experiment(self, exp_type: str, details: Dict[str, Any]) -> str:
        exp_id = f"exp_{int(time.time())}"
        record = {
            "id": exp_id,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "type": exp_type,
            "details": details
        }
        exp_file = EXPERIMENTS_DIR / f"{exp_id}.json"
        try:
            with open(exp_file, "w") as f:
                json.dump(record, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving experiment {exp_id}: {e}")
        return exp_id

    def restore_experiment_history(self) -> None:
        history = []
        for experiment_path in EXPERIMENTS_DIR.glob("exp_*.json"):
            try:
                with experiment_path.open("r", encoding="utf-8") as experiment_file:
                    record = json.load(experiment_file)
                if not isinstance(record, dict) or not isinstance(record.get("details"), dict):
                    logger.warning("Skipping malformed experiment record: %s", experiment_path)
                    continue
                history.append((experiment_path.stat().st_mtime, record))
            except (OSError, json.JSONDecodeError) as exc:
                logger.warning("Could not restore experiment record %s: %s", experiment_path, exc)

        history.sort(key=lambda item: item[0], reverse=True)
        self.recent_attacks = []
        self.recent_evaluations = []
        self.recent_defence_results = []
        for _, record in history:
            details = record["details"]
            if record.get("type") == "adversarial_attack":
                self.recent_attacks.append(details)
            elif record.get("type") == "robustness_evaluation":
                self.recent_evaluations.append(details)
            elif record.get("type") == "adversarial_training":
                self.recent_defence_results.append(details)

        self.recent_attacks = self.recent_attacks[:50]
        self.recent_evaluations = self.recent_evaluations[:50]
        self.recent_defence_results = self.recent_defence_results[:50]

state = AppState()
