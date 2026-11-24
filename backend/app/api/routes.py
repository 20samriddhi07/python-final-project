import os
import shutil
import json
from pathlib import Path
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.core.config import (
    DATASET_RAW_DIR, DATASET_PROCESSED_DIR, EXPERIMENTS_DIR,
    REPORTS_DIR, MODELS_DIR, PROJECT_NAME, VERSION
)
from app.core.state import state
from app.preprocessing.preprocessor import DatasetPreprocessor
from app.models.model_manager import ModelManager
from app.attacks.attack_manager import AttackManager
from app.defence.adversarial_training import AdversarialTrainingEngine
from app.evaluation.metrics import RobustnessEvaluator
from app.reports.pdf_generator import ReportGenerator

router = APIRouter()

# Pydantic Request Models
class PreprocessRequest(BaseModel):
    filename: str = Field(..., description="Name of raw CSV file in dataset/raw")
    test_size: float = Field(0.2, ge=0.1, le=0.5)
    random_state: int = 42

class TrainModelRequest(BaseModel):
    model_type: str = Field(..., description="'Random Forest', 'XGBoost', or 'PyTorch MLP'")
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)

class AttackSimulationRequest(BaseModel):
    target_model_id: str
    attack_type: str = Field("FGSM", description="'FGSM', 'PGD', 'Black-box Query', or 'Black-box Transfer'")
    epsilon: float = Field(0.2, ge=0.01, le=1.0)
    iterations: int = Field(15, ge=1, le=100)
    alpha: Optional[float] = None
    sample_limit: int = Field(200, ge=10, le=1000)

class RobustnessEvalRequest(BaseModel):
    model_id: str
    epsilon: float = Field(0.2, ge=0.01, le=1.0)
    eval_samples: int = Field(250, ge=20, le=1000)

class DefenceTrainRequest(BaseModel):
    base_model_type: str = Field("PyTorch MLP")
    attack_type: str = Field("FGSM")
    epsilon: float = Field(0.2, ge=0.01, le=1.0)
    adv_ratio: float = Field(0.5, ge=0.1, le=1.0)
    epochs: int = Field(15, ge=1, le=50)

# --- System & Overview ---

@router.get("/health")
def get_health():
    return {
        "status": "healthy",
        "service": PROJECT_NAME,
        "version": VERSION,
        "timestamp": pd.Timestamp.now().isoformat()
    }

@router.get("/overview")
def get_overview_statistics():
    """Module 1: Overview Dashboard Statistics from real state."""
    raw_summary = state.raw_dataset_summary
    prep_meta = state.preprocessed_metadata
    models_manifest = ModelManager.get_trained_models()

    total_records = 0
    normal_count = 0
    attack_count = 0
    class_dist = {}

    if raw_summary:
        total_records = raw_summary.get("total_rows", 0)
        bin_dist = raw_summary.get("binary_distribution", {})
        normal_count = bin_dist.get("BENIGN", 0)
        attack_count = bin_dist.get("ATTACK", 0)
        class_dist = raw_summary.get("class_distribution", {})
    elif prep_meta:
        normal_count = prep_meta.get("train_benign_count", 0) + prep_meta.get("test_benign_count", 0)
        attack_count = prep_meta.get("train_attack_count", 0) + prep_meta.get("test_attack_count", 0)
        total_records = normal_count + attack_count

    # Current model accuracy & robustness
    current_acc = None
    if models_manifest:
        accuracy = models_manifest[0].get("metrics", {}).get("accuracy")
        if accuracy is not None:
            current_acc = round(accuracy * 100, 2)

    robustness_score = None
    if state.recent_evaluations:
        robustness_score = state.recent_evaluations[0].get("worst_adversarial_accuracy")

    # Count saved experiments
    exp_count = len(list(EXPERIMENTS_DIR.glob("*.json")))

    return {
        "dataset_loaded": bool(state.active_dataset_filename or prep_meta),
        "active_dataset": state.active_dataset_filename or (prep_meta.get("source_file") if prep_meta else None),
        "total_records_analyzed": total_records,
        "normal_traffic_count": normal_count,
        "malicious_traffic_count": attack_count,
        "attack_distribution": class_dist,
        "trained_models_count": len(models_manifest),
        "current_model_accuracy": current_acc,
        "adversarial_robustness_score": robustness_score,
        "total_experiments": exp_count,
        "recent_models": models_manifest[:4],
        "recent_evaluations": state.recent_evaluations[:3],
        "recent_attacks": state.recent_attacks[:3],
        "security_alerts": state.security_alerts[:10]
    }

# --- Module 2: Dataset Upload & Preprocessing ---

@router.get("/dataset/list")
def list_raw_datasets():
    files = list(DATASET_RAW_DIR.glob("*.csv"))
    res = []
    for f in files:
        stat = f.stat()
        res.append({
            "filename": f.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "modified": pd.Timestamp(stat.st_mtime, unit="s").isoformat()
        })
    return {"datasets": res}

@router.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...)):
    uploaded_name = Path(file.filename or "").name
    if not uploaded_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV datasets are supported.")

    dest_path = DATASET_RAW_DIR / uploaded_name
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

    # Automatically inspect uploaded dataset
    try:
        summary = DatasetPreprocessor.inspect_csv(str(dest_path))
        state.active_dataset_filename = uploaded_name
        state.raw_dataset_summary = summary
        state.add_alert("info", f"Dataset '{uploaded_name}' uploaded and inspected: {summary['total_rows']} rows, {summary['total_cols']} columns.")
        return {"message": "Dataset uploaded successfully", "summary": summary}
    except Exception as e:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Dataset validation failed: {str(e)}")

@router.get("/dataset/summary")
def get_dataset_summary(filename: Optional[str] = Query(None)):
    target_file = filename or state.active_dataset_filename or "cicids2017_sample.csv"
    if Path(target_file).name != target_file or not target_file.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Dataset name must be a CSV file in dataset/raw.")
    file_path = DATASET_RAW_DIR / target_file

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset file '{target_file}' not found.")

    summary = DatasetPreprocessor.inspect_csv(str(file_path))
    state.active_dataset_filename = target_file
    state.raw_dataset_summary = summary
    return summary

@router.post("/dataset/preprocess")
def preprocess_dataset(req: PreprocessRequest):
    preprocessor = DatasetPreprocessor()
    try:
        metadata = preprocessor.preprocess_dataset(
            raw_filename=req.filename,
            test_size=req.test_size,
            random_state=req.random_state
        )
        state.active_dataset_filename = req.filename
        state.preprocessed_metadata = metadata
        state.add_alert(
            "safe",
            f"Preprocessed '{req.filename}': {metadata['train_samples']} train samples, {metadata['test_samples']} test samples. Scaler fit on train set only."
        )
        state.record_experiment("preprocessing", metadata)
        return {"status": "success", "metadata": metadata}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

@router.get("/dataset/preprocessed-info")
def get_preprocessed_info():
    meta_path = DATASET_PROCESSED_DIR / "metadata.json"
    if not meta_path.exists():
        return {"preprocessed": False}
    with open(meta_path, "r") as f:
        meta = json.load(f)
    state.preprocessed_metadata = meta
    return {"preprocessed": True, "metadata": meta}

# --- Module 4: Model Training ---

@router.post("/models/train")
def train_model(req: TrainModelRequest):
    try:
        result = ModelManager.train_model(
            model_type=req.model_type,
            hyperparameters=req.hyperparameters
        )
        return {"status": "success", "model": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training error: {str(e)}")

@router.get("/models")
def list_models():
    manifest = ModelManager.get_trained_models()
    return {"models": manifest}

# --- Module 3: Intrusion Detection Prediction ---

@router.post("/models/predict")
async def predict_traffic(
    model_id: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    """Classifies network traffic records against a chosen model."""
    if file:
        try:
            df = pd.read_csv(file.file, low_memory=False)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")
    else:
        # Fallback to sample network traffic stream
        sample_stream_path = DATASET_RAW_DIR / "network_traffic_stream.csv"
        if not sample_stream_path.exists():
            sample_stream_path = DATASET_RAW_DIR / "cicids2017_sample.csv"
        if not sample_stream_path.exists():
            raise HTTPException(status_code=400, detail="No traffic CSV provided and no sample stream found.")
        df = pd.read_csv(sample_stream_path, low_memory=False).head(300)

    try:
        results = ModelManager.predict_traffic(model_id_or_type=model_id, traffic_df=df)
        state.add_alert(
            "danger" if results["malicious_records"] > 0 else "safe",
            f"IDS Detection complete: {results['malicious_records']} attacks detected out of {results['total_records']} flows ({results['detection_percentage']}% attack rate)."
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

# --- Module 5: Adversarial Attack Simulator ---

@router.post("/attacks/run")
def run_adversarial_attack(req: AttackSimulationRequest):
    try:
        res = AttackManager.run_adversarial_simulation(
            target_model_id=req.target_model_id,
            attack_type=req.attack_type,
            epsilon=req.epsilon,
            iterations=req.iterations,
            alpha=req.alpha,
            sample_limit=req.sample_limit
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Attack simulation failed: {str(e)}")

# --- Module 6: Robustness Evaluation ---

@router.post("/robustness/evaluate")
def evaluate_robustness(req: RobustnessEvalRequest):
    try:
        res = RobustnessEvaluator.run_comprehensive_evaluation(
            model_id=req.model_id,
            epsilon=req.epsilon,
            eval_samples=req.eval_samples
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Robustness evaluation failed: {str(e)}")

# --- Module 7: Defence Mechanisms ---

@router.post("/defence/train")
def train_adversarial_defence(req: DefenceTrainRequest):
    try:
        res = AdversarialTrainingEngine.train_defended_model(
            base_model_type=req.base_model_type,
            attack_type_for_training=req.attack_type,
            epsilon=req.epsilon,
            adv_ratio=req.adv_ratio,
            epochs=req.epochs
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Adversarial training failed: {str(e)}")

# --- Module 8: Model Comparison ---

@router.get("/models/compare")
def compare_models():
    """Side-by-side comparative matrix across RF, XGBoost, MLP, and Defended Model."""
    manifest = ModelManager.get_trained_models()
    if not manifest:
        return {"comparison": []}

    comparison_rows = []
    for item in manifest:
        mets = item.get("metrics", {})
        comparison_rows.append({
            "model_id": item["model_id"],
            "model_type": item["model_type"],
            "accuracy": round(mets.get("accuracy", 0) * 100, 2),
            "precision": round(mets.get("precision", 0) * 100, 2),
            "recall": round(mets.get("recall", 0) * 100, 2),
            "f1_score": round(mets.get("f1_score", 0), 4),
            "fpr": round(mets.get("fpr", 0) * 100, 2),
            "fnr": round(mets.get("fnr", 0) * 100, 2),
            "confusion_matrix": mets.get("confusion_matrix"),
            "training_time": mets.get("training_time", 0),
            "inference_time_ms": mets.get("inference_time_ms", 0),
            "is_defended": "Defended" in item["model_type"] or "defended" in item["model_id"]
        })
    return {"comparison": comparison_rows}

# --- Module 9: Reports Generation & Export ---

@router.get("/reports/generate")
def generate_report():
    report_filename = f"ADVERSHIELD_Report_{int(pd.Timestamp.now().timestamp())}.pdf"
    output_path = REPORTS_DIR / report_filename
    try:
        ReportGenerator.generate_pdf_report(str(output_path))
        return {
            "status": "ready",
            "report_filename": report_filename,
            "download_url": f"/api/reports/download/{report_filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@router.get("/reports/download/{filename}")
def download_pdf_report(filename: str):
    file_path = REPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Requested report file does not exist.")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/pdf"
    )

@router.get("/reports/export-csv")
def export_csv_summary():
    manifest = ModelManager.get_trained_models()
    records = []
    for m in manifest:
        row = {
            "Model ID": m["model_id"],
            "Type": m["model_type"],
            "Accuracy": m.get("metrics", {}).get("accuracy"),
            "Precision": m.get("metrics", {}).get("precision"),
            "Recall": m.get("metrics", {}).get("recall"),
            "F1": m.get("metrics", {}).get("f1_score"),
            "False Positive Rate": m.get("metrics", {}).get("fpr"),
            "False Negative Rate": m.get("metrics", {}).get("fnr"),
            "Confusion Matrix": m.get("metrics", {}).get("confusion_matrix"),
            "Training Time (s)": m.get("metrics", {}).get("training_time"),
            "Created At": m.get("created_at")
        }
        records.append(row)
    
    df = pd.DataFrame(records)
    csv_path = REPORTS_DIR / "advershield_models_summary.csv"
    df.to_csv(csv_path, index=False)
    return FileResponse(
        path=str(csv_path),
        filename="advershield_models_summary.csv",
        media_type="text/csv"
    )

# --- Module 10: Settings & System Info ---

@router.get("/settings")
def get_settings():
    return {
        "project_name": PROJECT_NAME,
        "version": VERSION,
        "directories": {
            "dataset_raw": str(DATASET_RAW_DIR),
            "dataset_processed": str(DATASET_PROCESSED_DIR),
            "experiments": str(EXPERIMENTS_DIR),
            "models": str(MODELS_DIR),
            "reports": str(REPORTS_DIR)
        },
        "experiments_count": len(list(EXPERIMENTS_DIR.glob("*.json"))),
        "trained_models_count": len(ModelManager.get_trained_models()),
        "active_dataset": state.active_dataset_filename
    }

@router.post("/settings/reset")
def reset_system():
    state.trained_models.clear()
    state.recent_attacks.clear()
    state.recent_evaluations.clear()
    state.recent_defence_results.clear()
    state.security_alerts.clear()
    state.add_alert("info", "In-memory telemetry cache reset; persisted files were retained.")
    return {
        "status": "success",
        "message": "Telemetry cache reset. Saved models and experiment files were retained.",
    }
