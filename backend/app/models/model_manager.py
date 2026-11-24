import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

from app.core.config import (
    DATASET_PROCESSED_DIR,
    MODELS_DIR,
    PROJECT_ROOT,
)
from app.core.state import state
from app.models.mlp_model import MLPModelWrapper
from app.models.random_forest import RFModelWrapper
from app.models.xgboost_model import XGBoostModelWrapper

logger = logging.getLogger(__name__)


class ModelManager:
    @staticmethod
    def _manifest_path() -> Path:
        return MODELS_DIR / "models_manifest.json"

    @staticmethod
    def _portable_path(path: Path) -> str:
        return path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()

    @classmethod
    def _read_manifest(cls) -> List[Dict[str, Any]]:
        manifest_path = cls._manifest_path()
        if not manifest_path.exists():
            return []
        with manifest_path.open("r", encoding="utf-8") as manifest_file:
            manifest = json.load(manifest_file)
        if not isinstance(manifest, list):
            raise ValueError(f"Model manifest must contain a list: {manifest_path}")
        return manifest

    @classmethod
    def save_manifest(cls, manifest: List[Dict[str, Any]]) -> None:
        manifest_path = cls._manifest_path()
        temporary_path = manifest_path.with_suffix(".json.tmp")
        with temporary_path.open("w", encoding="utf-8") as manifest_file:
            json.dump(manifest, manifest_file, indent=2)
            manifest_file.flush()
            os.fsync(manifest_file.fileno())
        os.replace(temporary_path, manifest_path)

    @staticmethod
    def _resolve_path(stored_path: Optional[str], fallback_dir: Path) -> Path:
        if not stored_path:
            raise ValueError("Model metadata does not contain an artifact path.")

        saved_path = Path(stored_path)
        candidates = [saved_path] if saved_path.is_absolute() else [PROJECT_ROOT / saved_path]
        candidates.append(fallback_dir / saved_path.name)
        for candidate in candidates:
            if candidate.is_file():
                return candidate.resolve()
        raise FileNotFoundError(
            f"Artifact '{stored_path}' is unavailable in this project. "
            f"Also checked '{fallback_dir / saved_path.name}'."
        )

    @staticmethod
    def _new_wrapper(model_type: str):
        if "Random Forest" in model_type:
            return RFModelWrapper()
        if "XGBoost" in model_type:
            return XGBoostModelWrapper()
        if "PyTorch MLP" in model_type:
            return MLPModelWrapper()
        raise ValueError(f"Unsupported saved model type: {model_type}")

    @staticmethod
    def _input_dimension(wrapper: Any) -> Optional[int]:
        if isinstance(wrapper, MLPModelWrapper):
            return wrapper.input_dim
        model = getattr(wrapper, "model", None)
        return getattr(model, "n_features_in_", None)

    @classmethod
    def _preprocessing_spec(
        cls, model_meta: Dict[str, Any]
    ) -> Tuple[Any, Optional[Any], List[str], Path]:
        scaler_path = cls._resolve_path(
            model_meta.get("scaler_file_path"),
            DATASET_PROCESSED_DIR,
        ) if model_meta.get("scaler_file_path") else DATASET_PROCESSED_DIR / "scaler.joblib"
        if not scaler_path.is_file():
            raise FileNotFoundError(
                "The model's StandardScaler is missing. Preprocess the training dataset again."
            )
        scaler = joblib.load(scaler_path)

        imputer = None
        imputer_path_value = model_meta.get("imputer_file_path")
        if imputer_path_value:
            imputer_path = cls._resolve_path(imputer_path_value, DATASET_PROCESSED_DIR)
            imputer = joblib.load(imputer_path)

        feature_names = model_meta.get("feature_names")
        if not feature_names:
            metadata_path = DATASET_PROCESSED_DIR / "metadata.json"
            if not metadata_path.is_file():
                raise FileNotFoundError(
                    "Feature metadata is missing. Preprocess the dataset before inference."
                )
            with metadata_path.open("r", encoding="utf-8") as metadata_file:
                feature_names = json.load(metadata_file).get("feature_names")
        if not isinstance(feature_names, list) or not feature_names:
            raise ValueError("Model metadata does not contain an ordered feature list.")

        expected_features = len(feature_names)
        scaler_features = getattr(scaler, "n_features_in_", expected_features)
        if scaler_features != expected_features:
            raise ValueError(
                f"Scaler has {scaler_features} features but metadata lists {expected_features}."
            )
        if imputer is not None and getattr(imputer, "n_features_in_", expected_features) != expected_features:
            raise ValueError(
                f"Imputer dimensions do not match the {expected_features} ordered features."
            )
        return scaler, imputer, feature_names, scaler_path

    @classmethod
    def validate_active_preprocessing(cls, model_id_or_type: str) -> Dict[str, Any]:
        model_meta = cls._find_model_record(model_id_or_type)
        metadata_path = DATASET_PROCESSED_DIR / "metadata.json"
        if not metadata_path.is_file():
            raise FileNotFoundError("Preprocessed dataset metadata is missing.")
        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            active_metadata = json.load(metadata_file)

        model_features = model_meta.get("feature_names")
        active_features = active_metadata.get("feature_names")
        if model_features and model_features != active_features:
            raise ValueError(
                "The saved model feature order does not match the active processed dataset. "
                "Preprocess the model's training dataset before running this evaluation."
            )
        model_timestamp = model_meta.get("preprocessing_timestamp")
        active_timestamp = active_metadata.get("timestamp")
        if model_timestamp and active_timestamp and model_timestamp != active_timestamp:
            raise ValueError(
                "This model was trained with a different preprocessing split. "
                "Retrain it on the active processed dataset before attack or defence evaluation."
            )
        return model_meta

    @classmethod
    def _load_model_record(
        cls, model_meta: Dict[str, Any], force_reload: bool = False
    ) -> Any:
        model_id = model_meta["model_id"]
        model_path = cls._resolve_path(model_meta.get("file_path"), MODELS_DIR)
        cached_model = state.trained_models.get(model_id)
        if cached_model is not None and not force_reload:
            wrapper = cached_model
        else:
            wrapper = cls._new_wrapper(model_meta["model_type"])
            wrapper.load(str(model_path))
            state.trained_models[model_id] = wrapper

        expected_features = len(cls._preprocessing_spec(model_meta)[2])
        model_features = cls._input_dimension(wrapper)
        if model_features != expected_features:
            raise ValueError(
                f"Model '{model_id}' expects {model_features} features but its preprocessing "
                f"metadata specifies {expected_features}."
            )
        return wrapper

    @classmethod
    def get_trained_models(cls) -> List[Dict[str, Any]]:
        manifest = cls._read_manifest()
        valid_models = []
        changed = False
        for raw_item in manifest:
            if not isinstance(raw_item, dict) or not raw_item.get("model_id"):
                logger.warning("Skipping malformed model manifest entry: %r", raw_item)
                continue
            item = dict(raw_item)
            try:
                model_path = cls._resolve_path(item.get("file_path"), MODELS_DIR)
                portable_path = cls._portable_path(model_path)
                if item.get("file_path") != portable_path:
                    item["file_path"] = portable_path
                    changed = True
                cls._load_model_record(item)
                valid_models.append(item)
            except Exception as exc:
                logger.warning(
                    "Model '%s' is unavailable and will not be listed: %s",
                    item.get("model_id"),
                    exc,
                )
        if changed:
            cls.save_manifest(
                [
                    next(
                        (valid for valid in valid_models if valid["model_id"] == item.get("model_id")),
                        item,
                    )
                    for item in manifest
                ]
            )
        return valid_models

    @classmethod
    def save_preprocessing_artifacts(cls, model_id: str) -> Dict[str, Any]:
        metadata_path = DATASET_PROCESSED_DIR / "metadata.json"
        scaler_path = DATASET_PROCESSED_DIR / "scaler.joblib"
        if not metadata_path.is_file() or not scaler_path.is_file():
            raise FileNotFoundError(
                "Preprocessing metadata or StandardScaler is missing. Preprocess the dataset first."
            )

        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            metadata = json.load(metadata_file)
        feature_names = metadata.get("feature_names")
        if not isinstance(feature_names, list) or not feature_names:
            raise ValueError("Preprocessing metadata has no ordered feature names.")

        model_scaler_path = MODELS_DIR / f"{model_id}.scaler.joblib"
        shutil.copy2(scaler_path, model_scaler_path)
        model_imputer_path = DATASET_PROCESSED_DIR / "imputer.joblib"
        model_imputer_copy = None
        if model_imputer_path.is_file():
            model_imputer_copy = MODELS_DIR / f"{model_id}.imputer.joblib"
            shutil.copy2(model_imputer_path, model_imputer_copy)

        scaler = joblib.load(model_scaler_path)
        if getattr(scaler, "n_features_in_", len(feature_names)) != len(feature_names):
            raise ValueError("Saved scaler dimensions do not match preprocessing metadata.")

        return {
            "scaler_file_path": cls._portable_path(model_scaler_path),
            "imputer_file_path": (
                cls._portable_path(model_imputer_copy) if model_imputer_copy else None
            ),
            "feature_names": feature_names,
            "dataset_source": metadata.get("source_file"),
            "preprocessing_timestamp": metadata.get("timestamp"),
        }

    @classmethod
    def train_model(
        cls,
        model_type: str,
        hyperparameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        paths = {
            "X_train": DATASET_PROCESSED_DIR / "X_train.npy",
            "y_train": DATASET_PROCESSED_DIR / "y_train.npy",
            "X_test": DATASET_PROCESSED_DIR / "X_test.npy",
            "y_test": DATASET_PROCESSED_DIR / "y_test.npy",
        }
        if not all(path.is_file() for path in paths.values()):
            raise FileNotFoundError(
                "Processed dataset splits not found. Please preprocess a dataset first."
            )
        metadata_path = DATASET_PROCESSED_DIR / "metadata.json"
        if not metadata_path.is_file():
            raise FileNotFoundError("Processed dataset metadata not found.")

        X_train = np.load(paths["X_train"])
        y_train = np.load(paths["y_train"])
        X_test = np.load(paths["X_test"])
        y_test = np.load(paths["y_test"])
        with metadata_path.open("r", encoding="utf-8") as metadata_file:
            dataset_metadata = json.load(metadata_file)
        feature_names = dataset_metadata.get("feature_names", [])
        if (
            X_train.ndim != 2
            or X_test.ndim != 2
            or X_train.shape[1] != len(feature_names)
            or X_test.shape[1] != len(feature_names)
        ):
            raise ValueError("Processed feature arrays do not match their metadata.")
        if len(X_train) != len(y_train) or len(X_test) != len(y_test):
            raise ValueError("Processed feature and target array lengths do not match.")

        model_id = f"{model_type.lower().replace(' ', '_')}_{time.time_ns() // 1_000_000}"
        if model_type == "Random Forest":
            wrapper = RFModelWrapper(
                n_estimators=hyperparameters.get("n_estimators", 100),
                max_depth=hyperparameters.get("max_depth", 15),
                random_state=42,
            )
            model_path = MODELS_DIR / f"{model_id}.joblib"
        elif model_type == "XGBoost":
            wrapper = XGBoostModelWrapper(
                n_estimators=hyperparameters.get("n_estimators", 100),
                max_depth=hyperparameters.get("max_depth", 6),
                learning_rate=hyperparameters.get("learning_rate", 0.1),
                random_state=42,
            )
            model_path = MODELS_DIR / f"{model_id}.joblib"
        elif model_type == "PyTorch MLP":
            wrapper = MLPModelWrapper(
                input_dim=X_train.shape[1],
                hidden_dim1=hyperparameters.get("hidden_dim1", 128),
                hidden_dim2=hyperparameters.get("hidden_dim2", 64),
                dropout_rate=hyperparameters.get("dropout_rate", 0.2),
                learning_rate=hyperparameters.get("learning_rate", 0.001),
                epochs=hyperparameters.get("epochs", 15),
                batch_size=hyperparameters.get("batch_size", 64),
                random_state=42,
            )
            model_path = MODELS_DIR / f"{model_id}.pt"
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

        wrapper.fit(X_train, y_train)
        eval_metrics = wrapper.evaluate(X_test, y_test)
        wrapper.save(str(model_path))
        preprocessing_artifacts = cls.save_preprocessing_artifacts(model_id)

        model_meta = {
            "model_id": model_id,
            "model_type": model_type,
            "file_path": cls._portable_path(model_path),
            "hyperparameters": hyperparameters,
            "created_at": pd.Timestamp.now().isoformat(),
            "metrics": eval_metrics,
            **preprocessing_artifacts,
        }
        state.trained_models[model_id] = wrapper

        manifest = cls._read_manifest()
        manifest = [item for item in manifest if item.get("model_id") != model_id]
        manifest.insert(0, model_meta)
        cls.save_manifest(manifest)

        state.add_alert(
            "safe",
            f"Successfully trained {model_type} with Accuracy: "
            f"{eval_metrics['accuracy'] * 100:.1f}%, F1: {eval_metrics['f1_score']:.3f}",
            {"model_id": model_id, "type": model_type},
        )
        state.record_experiment("model_training", model_meta)
        return model_meta

    @classmethod
    def _find_model_record(cls, model_id_or_type: str) -> Dict[str, Any]:
        for item in cls.get_trained_models():
            if item["model_id"] == model_id_or_type:
                return item
        for item in cls.get_trained_models():
            if item["model_type"] == model_id_or_type:
                return item
        raise ValueError(f"Trained model '{model_id_or_type}' not found or not loadable.")

    @classmethod
    def load_model(cls, model_id_or_type: str):
        models = cls.get_trained_models()
        model_meta = next(
            (item for item in models if item["model_id"] == model_id_or_type),
            None,
        )
        if model_meta is None:
            model_meta = next(
                (item for item in models if item["model_type"] == model_id_or_type),
                None,
            )
        if model_meta is None:
            raise ValueError(f"Trained model '{model_id_or_type}' not found or not loadable.")
        if model_meta["model_id"] in state.trained_models:
            return state.trained_models[model_meta["model_id"]]
        return cls._load_model_record(model_meta)

    @classmethod
    def predict_traffic(
        cls, model_id_or_type: str, traffic_df: pd.DataFrame
    ) -> Dict[str, Any]:
        model_meta = cls._find_model_record(model_id_or_type)
        model = cls.load_model(model_meta["model_id"])
        scaler, imputer, feature_names, _ = cls._preprocessing_spec(model_meta)

        traffic_df = traffic_df.copy()
        traffic_df.columns = traffic_df.columns.str.strip()
        label_column = next(
            (
                column
                for column in traffic_df.columns
                if column.strip().lower() in {"label", "attack", "class"}
            ),
            None,
        )
        true_labels = traffic_df[label_column].to_numpy() if label_column else None

        for feature in feature_names:
            if feature not in traffic_df.columns:
                traffic_df[feature] = np.nan
            traffic_df[feature] = pd.to_numeric(traffic_df[feature], errors="coerce")
        X_numeric = traffic_df[feature_names].replace([np.inf, -np.inf], np.nan)
        if imputer is not None:
            X_imputed = imputer.transform(X_numeric)
        else:
            X_imputed = X_numeric.fillna(0.0).to_numpy()
        X_scaled = scaler.transform(X_imputed)

        predictions = model.predict(X_scaled)
        probabilities = model.predict_proba(X_scaled)
        records = []
        normal_count = 0
        attack_count = 0
        for index, prediction in enumerate(predictions):
            predicted_class = int(prediction)
            confidence = float(probabilities[index][predicted_class])
            is_attack = predicted_class == 1
            normal_count += int(not is_attack)
            attack_count += int(is_attack)
            record = {
                "record_id": index + 1,
                "classification": "ATTACK" if is_attack else "BENIGN",
                "confidence": round(confidence * 100, 2),
                "is_attack": is_attack,
                "attack_type": "Unknown Attack" if is_attack else "Normal Traffic",
            }
            if true_labels is not None:
                record["true_label"] = str(true_labels[index])
                if is_attack and str(true_labels[index]).upper() != "BENIGN":
                    record["attack_type"] = str(true_labels[index])
            if "Destination Port" in traffic_df.columns:
                record["destination_port"] = int(traffic_df["Destination Port"].iloc[index])
            else:
                record["destination_port"] = 0
            record["flow_duration"] = (
                float(traffic_df["Flow Duration"].iloc[index])
                if "Flow Duration" in traffic_df.columns
                else 0.0
            )
            record["total_packets"] = (
                int(
                    traffic_df["Total Fwd Packets"].iloc[index]
                    + traffic_df["Total Backward Packets"].iloc[index]
                )
                if {
                    "Total Fwd Packets",
                    "Total Backward Packets",
                }.issubset(traffic_df.columns)
                else 0
            )
            records.append(record)

        total_records = len(records)
        return {
            "model_used": model_meta["model_id"],
            "total_records": total_records,
            "normal_records": normal_count,
            "malicious_records": attack_count,
            "detection_percentage": (
                round((attack_count / total_records) * 100, 2) if total_records else 0.0
            ),
            "records": records[:500],
        }
