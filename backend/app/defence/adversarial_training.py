import time
import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.model_selection import train_test_split
from app.core.config import MODELS_DIR, DATASET_PROCESSED_DIR
from app.core.state import state
from app.models.model_manager import ModelManager
from app.models.mlp_model import MLPModelWrapper
from app.models.random_forest import RFModelWrapper
from app.models.xgboost_model import XGBoostModelWrapper
from app.attacks.constraints import NetworkTrafficConstraintEngine
from app.attacks.fgsm import FGSMAttack
from app.attacks.pgd import PGDAttack

class AdversarialTrainingEngine:
    @classmethod
    def train_defended_model(
        cls,
        base_model_type: str = "PyTorch MLP",
        attack_type_for_training: str = "FGSM",
        epsilon: float = 0.2,
        adv_ratio: float = 0.5,
        epochs: int = 15
    ) -> Dict[str, Any]:
        """
        Executes real Adversarial Training:
        1. Loads training data X_train, y_train.
        2. Generates feature-constrained adversarial training samples for attacks in train set.
        3. Augments training set with clean + adversarial samples.
        4. Trains a new robust defended model.
        5. Evaluates on UNTOUCHED clean test set AND adversarial test set.
        6. Measures robustness gain vs clean accuracy trade-off.
        """
        x_train_path = DATASET_PROCESSED_DIR / "X_train.npy"
        y_train_path = DATASET_PROCESSED_DIR / "y_train.npy"
        x_test_path = DATASET_PROCESSED_DIR / "X_test.npy"
        y_test_path = DATASET_PROCESSED_DIR / "y_test.npy"
        if not all(p.exists() for p in [x_train_path, y_train_path, x_test_path, y_test_path]):
            raise FileNotFoundError("Processed dataset required for adversarial training.")

        X_train = np.load(x_train_path)
        y_train = np.load(y_train_path)
        X_test = np.load(x_test_path)
        y_test = np.load(y_test_path)

        # Baseline: Train or load original baseline model
        base_model_meta = ModelManager.validate_active_preprocessing(base_model_type)
        base_model = ModelManager.load_model(base_model_meta["model_id"])
        base_scaler, _, base_feature_names, _ = ModelManager._preprocessing_spec(
            base_model_meta
        )
        constraint_engine = NetworkTrafficConstraintEngine(
            feature_names=base_feature_names,
            scaler_mean=np.array(base_scaler.mean_, dtype=np.float32),
            scaler_scale=np.array(base_scaler.scale_, dtype=np.float32)
        )

        # Generate adversarial samples from training set
        # Adversary perturbs attack samples (y=1) to evade
        train_attack_idx = np.where(y_train == 1)[0]
        n_adv_samples = int(len(train_attack_idx) * adv_ratio)
        if n_adv_samples == 0:
            raise ValueError(
                "The training split has too few attack records to generate adversarial examples."
            )
        selected_attack_idx = np.random.RandomState(42).choice(
            train_attack_idx, size=n_adv_samples, replace=False
        )

        x_train_attacks = X_train[selected_attack_idx]
        y_train_attacks = y_train[selected_attack_idx]

        # Use PyTorch model to generate gradients for training
        if hasattr(base_model, "get_input_gradient"):
            surrogate = base_model
        else:
            surrogate = ModelManager.load_model("PyTorch MLP")

        if attack_type_for_training == "PGD":
            attacker = PGDAttack(model=surrogate, constraint_engine=constraint_engine, eps=epsilon, steps=10)
        else:
            attacker = FGSMAttack(model=surrogate, constraint_engine=constraint_engine, eps=epsilon)

        start_time = time.time()
        x_train_adv = attacker.generate(x_train_attacks, y_train_attacks)

        # Augmented training set
        X_train_augmented = np.vstack([X_train, x_train_adv])
        y_train_augmented = np.concatenate([y_train, y_train_attacks])

        # Instantiate new robust model
        defended_model_id = (
            f"defended_{base_model_type.lower().replace(' ', '_')}_"
            f"{time.time_ns() // 1_000_000}"
        )
        
        if base_model_type == "Random Forest":
            defended_model = RFModelWrapper(n_estimators=100, max_depth=15, random_state=42)
            save_path = MODELS_DIR / f"{defended_model_id}.joblib"
        elif base_model_type == "XGBoost":
            defended_model = XGBoostModelWrapper(
                n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42
            )
            save_path = MODELS_DIR / f"{defended_model_id}.joblib"
        else:
            defended_model = MLPModelWrapper(
                input_dim=X_train.shape[1],
                hidden_dim1=128,
                hidden_dim2=64,
                epochs=epochs,
                random_state=42
            )
            save_path = MODELS_DIR / f"{defended_model_id}.pt"

        defended_model.fit(X_train_augmented, y_train_augmented)
        training_time = round(time.time() - start_time, 3)
        defended_model.save(str(save_path))
        preprocessing_artifacts = ModelManager.save_preprocessing_artifacts(
            defended_model_id
        )

        # Register defended model
        state.trained_models[defended_model_id] = defended_model

        # Use the same deterministic, stratified hold-out subset for both
        # models. Test records are only perturbed here for final evaluation.
        evaluation_count = min(1000, len(X_test))
        if evaluation_count < len(X_test):
            _, evaluation_indices = train_test_split(
                np.arange(len(X_test)),
                test_size=evaluation_count,
                random_state=42,
                stratify=y_test,
            )
            X_eval = X_test[evaluation_indices]
            y_eval = y_test[evaluation_indices]
        else:
            X_eval = X_test
            y_eval = y_test

        baseline_eval_clean = base_model.evaluate(X_eval, y_eval)
        defended_clean_eval = defended_model.evaluate(X_eval, y_eval)
        base_clean_preds = base_model.predict(X_eval)
        defended_clean_preds = defended_model.predict(X_eval)

        test_attack_idx = np.flatnonzero(y_eval == 1)
        if len(test_attack_idx) == 0:
            raise ValueError("The evaluation split contains no attack records.")
        x_test_attacks = X_eval[test_attack_idx]
        y_test_attacks = y_eval[test_attack_idx]
        test_adv_attacks = attacker.generate(x_test_attacks, y_test_attacks)

        X_eval_adv = X_eval.copy()
        X_eval_adv[test_attack_idx] = test_adv_attacks
        base_adv_preds = base_model.predict(X_eval_adv)
        defended_adv_preds = defended_model.predict(X_eval_adv)
        base_adv_eval = base_model.evaluate(X_eval_adv, y_eval)
        defended_adv_eval = defended_model.evaluate(X_eval_adv, y_eval)

        base_detected_attack_idx = test_attack_idx[
            base_clean_preds[test_attack_idx] == 1
        ]
        defended_detected_attack_idx = test_attack_idx[
            defended_clean_preds[test_attack_idx] == 1
        ]
        base_evasions = int(np.sum(base_adv_preds[base_detected_attack_idx] == 0))
        defended_evasions = int(
            np.sum(defended_adv_preds[defended_detected_attack_idx] == 0)
        )
        base_asr = (
            round((base_evasions / len(base_detected_attack_idx)) * 100, 2)
            if len(base_detected_attack_idx) else 0.0
        )
        defended_asr = (
            round((defended_evasions / len(defended_detected_attack_idx)) * 100, 2)
            if len(defended_detected_attack_idx) else 0.0
        )
        base_adv_acc = round(base_adv_eval["accuracy"] * 100, 2)
        defended_adv_acc = round(defended_adv_eval["accuracy"] * 100, 2)

        # Robustness gain calculation
        evasion_reduction = round(base_asr - defended_asr, 2)
        clean_acc_change = round(
            (defended_clean_eval["accuracy"] - baseline_eval_clean["accuracy"]) * 100, 2
        )

        result = {
            "defended_model_id": defended_model_id,
            "base_model_type": base_model_type,
            "attack_used_in_training": attack_type_for_training,
            "epsilon": epsilon,
            "adversarial_sample_ratio": adv_ratio,
            "training_samples_augmented": len(X_train_augmented),
            "clean_training_samples": len(X_train),
            "adversarial_training_samples": len(x_train_adv),
            "evaluation_samples": len(X_eval),
            "evaluation_attack_samples": len(test_attack_idx),
            "training_time": training_time,
            "baseline_metrics": {
                "clean_accuracy": round(baseline_eval_clean["accuracy"] * 100, 2),
                "clean_f1": baseline_eval_clean["f1_score"],
                "clean_precision": baseline_eval_clean["precision"],
                "clean_recall": baseline_eval_clean["recall"],
                "adversarial_accuracy": base_adv_acc,
                "attack_success_rate": base_asr,
                "evasions": base_evasions
            },
            "defended_metrics": {
                "clean_accuracy": round(defended_clean_eval["accuracy"] * 100, 2),
                "clean_f1": defended_clean_eval["f1_score"],
                "clean_precision": defended_clean_eval["precision"],
                "clean_recall": defended_clean_eval["recall"],
                "adversarial_accuracy": defended_adv_acc,
                "attack_success_rate": defended_asr,
                "evasions": defended_evasions
            },
            "comparison": {
                "asr_reduction_pct": evasion_reduction,
                "clean_accuracy_impact_pct": clean_acc_change,
                "robustness_improvement": "Positive" if evasion_reduction > 0 else "Neutral"
            },
            "timestamp": pd.Timestamp.now().isoformat()
        }

        # Update manifest
        manifest = ModelManager.get_trained_models()
        manifest.insert(0, {
            "model_id": defended_model_id,
            "model_type": f"Defended {base_model_type}",
            "file_path": ModelManager._portable_path(save_path),
            "hyperparameters": {"adv_training": True, "attack": attack_type_for_training, "epsilon": epsilon},
            "created_at": pd.Timestamp.now().isoformat(),
            "metrics": defended_clean_eval,
            **preprocessing_artifacts,
        })
        ModelManager.save_manifest(manifest)

        state.recent_defence_results.insert(0, result)
        state.add_alert(
            "safe",
            f"Adversarial Training Complete: Evasion rate decreased by {evasion_reduction}% (Defended ASR: {defended_asr}% vs Base ASR: {base_asr}%)",
            result
        )
        state.record_experiment("adversarial_training", result)

        return result
