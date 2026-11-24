import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from app.core.config import DATASET_PROCESSED_DIR
from app.core.state import state
from app.models.model_manager import ModelManager
from app.attacks.constraints import NetworkTrafficConstraintEngine
from app.attacks.fgsm import FGSMAttack
from app.attacks.pgd import PGDAttack
from app.attacks.blackbox import BlackBoxQueryAttack, TransferabilityAttack

class AttackManager:
    @classmethod
    def get_constraint_engine(cls, model_id: str) -> NetworkTrafficConstraintEngine:
        model_meta = ModelManager.validate_active_preprocessing(model_id)
        scaler, _, feature_names, _ = ModelManager._preprocessing_spec(model_meta)
        return NetworkTrafficConstraintEngine(
            feature_names=feature_names,
            scaler_mean=np.array(scaler.mean_, dtype=np.float32),
            scaler_scale=np.array(scaler.scale_, dtype=np.float32)
        )

    @classmethod
    def run_adversarial_simulation(
        cls,
        target_model_id: str,
        attack_type: str,  # 'FGSM', 'PGD', 'Black-box Query', 'Black-box Transfer'
        epsilon: float = 0.2,
        iterations: int = 15,
        alpha: float = 0.05,
        sample_limit: int = 200
    ) -> Dict[str, Any]:
        """
        Executes adversarial simulation against the specified target model.
        Evaluates evasion metrics on malicious test traffic.
        """
        # Load test set
        x_test_path = DATASET_PROCESSED_DIR / "X_test.npy"
        y_test_path = DATASET_PROCESSED_DIR / "y_test.npy"
        x_raw_path = DATASET_PROCESSED_DIR / "X_test_raw.npy"
        metadata_path = DATASET_PROCESSED_DIR / "metadata.json"

        if not all(p.exists() for p in [x_test_path, y_test_path, metadata_path]):
            raise FileNotFoundError("Processed test data not found. Please preprocess dataset first.")

        X_test = np.load(x_test_path)
        y_test = np.load(y_test_path)
        X_test_raw = np.load(x_raw_path) if x_raw_path.exists() else None

        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        feature_names = metadata["feature_names"]

        # Filter strictly for ATTACK samples (class 1)
        # Adversarial evasion focuses on causing attacks to be classified as BENIGN (class 0)
        attack_indices = np.where(y_test == 1)[0]
        if len(attack_indices) == 0:
            raise ValueError("No malicious records found in test set to evaluate evasion.")

        # Limit samples for interactive latency
        eval_indices = attack_indices[:sample_limit]
        X_eval = X_test[eval_indices]
        y_eval = y_test[eval_indices]
        X_eval_raw = X_test_raw[eval_indices] if X_test_raw is not None else None

        target_model = ModelManager.load_model(target_model_id)
        constraint_engine = cls.get_constraint_engine(target_model_id)

        # Check model compatibility
        is_gradient_model = hasattr(target_model, "get_input_gradient")
        
        # Gradient-based attacks are only valid for models that expose input gradients.
        actual_method = attack_type
        method_note = ""

        if attack_type in ["FGSM", "PGD"] and not is_gradient_model:
            raise ValueError(
                f"{attack_type} requires a differentiable PyTorch MLP model. "
                "Choose Black-box Query or Black-box Transfer for tree-based models."
            )
        if attack_type == "FGSM":
            attacker = FGSMAttack(
                model=target_model,
                constraint_engine=constraint_engine,
                eps=epsilon
            )
        elif attack_type == "PGD":
            attacker = PGDAttack(
                model=target_model,
                constraint_engine=constraint_engine,
                eps=epsilon,
                alpha=alpha,
                steps=iterations
            )
        elif attack_type == "Black-box Query":
            attacker = BlackBoxQueryAttack(
                model=target_model,
                constraint_engine=constraint_engine,
                eps=epsilon
            )
        elif attack_type == "Black-box Transfer":
            # Uses PyTorch MLP as surrogate
            surrogate = ModelManager.load_model("PyTorch MLP")
            attacker = TransferabilityAttack(
                surrogate_model=surrogate,
                target_model=target_model,
                constraint_engine=constraint_engine,
                eps=epsilon
            )
        else:
            raise ValueError(f"Unknown attack type: {attack_type}")

        # Clean baseline predictions
        orig_preds = target_model.predict(X_eval)
        orig_probs = target_model.predict_proba(X_eval)
        
        # Generate constrained adversarial examples
        X_adv = attacker.generate(X_eval, y_eval)

        # Adversarial predictions
        adv_preds = target_model.predict(X_adv)
        adv_probs = target_model.predict_proba(X_adv)

        # Count only true attack records that the clean model detected correctly.
        true_attack_indices = np.where(y_eval == 1)[0]
        initially_detected_indices = np.where((y_eval == 1) & (orig_preds == 1))[0]
        initially_detected_count = len(initially_detected_indices)

        # Evasion occurs when initially detected attack is predicted as BENIGN (class 0) under attack
        evasions = 0
        for idx in initially_detected_indices:
            if adv_preds[idx] == 0:
                evasions += 1

        attack_success_rate = (
            round((evasions / max(1, initially_detected_count)) * 100, 2)
            if initially_detected_count > 0 else 0.0
        )

        clean_accuracy_on_attacks = (
            round((initially_detected_count / len(true_attack_indices)) * 100, 2)
            if len(true_attack_indices) else 0.0
        )
        adv_accuracy_on_attacks = (
            round((np.sum(adv_preds[true_attack_indices] == 1) / len(true_attack_indices)) * 100, 2)
            if len(true_attack_indices) else 0.0
        )
        adversarial_accuracy = round(float(np.mean(adv_preds == y_eval)) * 100, 2)

        # Perturbation norms
        diff = X_adv - X_eval
        l_inf = round(float(np.max(np.abs(diff))), 4)
        l_2_mean = round(float(np.mean(np.linalg.norm(diff, axis=1))), 4)

        # Convert back to raw physical values for feature-level inspection of sample 0
        X_eval_phys = constraint_engine.inverse_transform(X_eval)
        X_adv_phys = constraint_engine.inverse_transform(X_adv)

        # Sample comparisons (top 5 samples)
        sample_comparisons = []
        for i in range(min(5, len(X_eval))):
            feature_diffs = []
            for f_idx, f_name in enumerate(feature_names):
                orig_val = round(float(X_eval_phys[i, f_idx]), 3)
                adv_val = round(float(X_adv_phys[i, f_idx]), 3)
                delta = round(adv_val - orig_val, 3)
                if abs(delta) > 0.001 or f_idx < 10:
                    feature_diffs.append({
                        "feature": f_name,
                        "original": orig_val,
                        "adversarial": adv_val,
                        "delta": delta,
                        "is_immutable": f_name in ["Destination Port", "min_seg_size_forward"]
                    })

            orig_label = "ATTACK" if orig_preds[i] == 1 else "BENIGN"
            adv_label = "ATTACK" if adv_preds[i] == 1 else "BENIGN"
            is_evaded = (orig_preds[i] == 1 and adv_preds[i] == 0)

            sample_comparisons.append({
                "sample_id": i + 1,
                "original_prediction": orig_label,
                "original_confidence": round(float(orig_probs[i, orig_preds[i]]) * 100, 2),
                "adversarial_prediction": adv_label,
                "adversarial_confidence": round(float(adv_probs[i, adv_preds[i]]) * 100, 2),
                "evasion_success": bool(is_evaded),
                "features": feature_diffs[:15]
            })

        result = {
            "target_model": target_model_id,
            "configured_attack": attack_type,
            "actual_method": actual_method,
            "method_note": method_note,
            "epsilon": epsilon,
            "iterations": iterations if attack_type == "PGD" else 1,
            "evaluated_samples": len(X_eval),
            "initially_detected_attacks": initially_detected_count,
            "successful_evasions": evasions,
            "attack_success_rate": attack_success_rate,
            "clean_detection_rate": clean_accuracy_on_attacks,
            "adversarial_detection_rate": adv_accuracy_on_attacks,
            "adversarial_accuracy": adversarial_accuracy,
            "perturbation_linf": l_inf,
            "perturbation_l2_mean": l_2_mean,
            "sample_comparisons": sample_comparisons,
            "timestamp": pd.Timestamp.now().isoformat()
        }

        # Record in system state
        state.recent_attacks.insert(0, result)
        state.add_alert(
            "danger" if attack_success_rate > 30 else "warning",
            f"Adversarial Attack ({actual_method}) on {target_model_id} resulted in ASR: {attack_success_rate}% ({evasions}/{initially_detected_count} evasions)",
            {"model": target_model_id, "asr": attack_success_rate}
        )
        state.record_experiment("adversarial_attack", result)

        return result
