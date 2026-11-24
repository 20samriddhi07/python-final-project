import json
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from app.core.config import DATASET_PROCESSED_DIR
from app.core.state import state
from app.models.model_manager import ModelManager
from app.attacks.attack_manager import AttackManager
from app.attacks.fgsm import FGSMAttack
from app.attacks.pgd import PGDAttack
from app.attacks.blackbox import BlackBoxQueryAttack

class RobustnessEvaluator:
    @classmethod
    def run_comprehensive_evaluation(
        cls,
        model_id: str,
        epsilon: float = 0.2,
        eval_samples: int = 250
    ) -> Dict[str, Any]:
        """
        Runs comprehensive robustness evaluation comparing:
        1. Clean test data.
        2. FGSM adversarial test samples.
        3. PGD adversarial test samples.
        4. Black-box test samples.
        """
        x_test_path = DATASET_PROCESSED_DIR / "X_test.npy"
        y_test_path = DATASET_PROCESSED_DIR / "y_test.npy"

        if not x_test_path.exists() or not y_test_path.exists():
            raise FileNotFoundError("Processed test data not found. Preprocessing required first.")

        X_test = np.load(x_test_path)
        y_test = np.load(y_test_path)

        # Slice subset for responsive evaluation
        sub_indices = np.random.RandomState(42).choice(
            len(X_test), size=min(eval_samples, len(X_test)), replace=False
        )
        X_sub = X_test[sub_indices]
        y_sub = y_test[sub_indices]

        model = ModelManager.load_model(model_id)
        constraint_engine = AttackManager.get_constraint_engine(model_id)

        # 1. Clean evaluation
        clean_eval = model.evaluate(X_sub, y_sub)

        # 2. Attacks generation
        # Tree models use the MLP as a transfer surrogate; gradients are not
        # calculated through the tree model itself.
        has_gradients = hasattr(model, "get_input_gradient")
        surrogate = model if has_gradients else ModelManager.load_model("PyTorch MLP")
        transfer_note = (
            " (PyTorch MLP transfer surrogate)" if not has_gradients else ""
        )

        # FGSM
        fgsm = FGSMAttack(model=surrogate, constraint_engine=constraint_engine, eps=epsilon)
        X_adv_fgsm = fgsm.generate(X_sub, y_sub)
        fgsm_eval = model.evaluate(X_adv_fgsm, y_sub)

        # Attack Success Rate (evasion rate on true attacks)
        clean_attack_mask = (y_sub == 1) & (model.predict(X_sub) == 1)
        attack_denominator = int(np.sum(clean_attack_mask))
        fgsm_evasions = (
            int(np.sum(model.predict(X_adv_fgsm[clean_attack_mask]) == 0))
            if attack_denominator else 0
        )
        fgsm_asr = round((fgsm_evasions / attack_denominator) * 100, 2) if attack_denominator else 0.0

        # PGD
        pgd = PGDAttack(model=surrogate, constraint_engine=constraint_engine, eps=epsilon, steps=10)
        X_adv_pgd = pgd.generate(X_sub, y_sub)
        pgd_eval = model.evaluate(X_adv_pgd, y_sub)
        pgd_evasions = (
            int(np.sum(model.predict(X_adv_pgd[clean_attack_mask]) == 0))
            if attack_denominator else 0
        )
        pgd_asr = round((pgd_evasions / attack_denominator) * 100, 2) if attack_denominator else 0.0

        # Black-Box Query
        bbox = BlackBoxQueryAttack(model=model, constraint_engine=constraint_engine, eps=epsilon)
        X_adv_bbox = bbox.generate(X_sub, y_sub)
        bbox_eval = model.evaluate(X_adv_bbox, y_sub)
        bbox_evasions = (
            int(np.sum(model.predict(X_adv_bbox[clean_attack_mask]) == 0))
            if attack_denominator else 0
        )
        bbox_asr = round((bbox_evasions / attack_denominator) * 100, 2) if attack_denominator else 0.0

        # Robustness Degradation calculation
        clean_acc = clean_eval["accuracy"] * 100
        fgsm_acc = fgsm_eval["accuracy"] * 100
        pgd_acc = pgd_eval["accuracy"] * 100
        bbox_acc = bbox_eval["accuracy"] * 100

        worst_adversarial_acc = min(fgsm_acc, pgd_acc, bbox_acc)
        robustness_score = round(worst_adversarial_acc, 2)

        summary_comparison = [
            {
                "condition": "Clean Test Data",
                "accuracy": round(clean_acc, 2),
                "f1_score": clean_eval["f1_score"],
                "precision": clean_eval["precision"],
                "recall": clean_eval["recall"],
                "fpr": clean_eval["fpr"],
                "fnr": clean_eval["fnr"],
                "attack_success_rate": 0.0,
                "evasions": 0
            },
            {
                "condition": f"FGSM Attack{transfer_note}",
                "accuracy": round(fgsm_acc, 2),
                "f1_score": fgsm_eval["f1_score"],
                "precision": fgsm_eval["precision"],
                "recall": fgsm_eval["recall"],
                "fpr": fgsm_eval["fpr"],
                "fnr": fgsm_eval["fnr"],
                "attack_success_rate": fgsm_asr,
                "evasions": fgsm_evasions
            },
            {
                "condition": f"PGD Attack{transfer_note}",
                "accuracy": round(pgd_acc, 2),
                "f1_score": pgd_eval["f1_score"],
                "precision": pgd_eval["precision"],
                "recall": pgd_eval["recall"],
                "fpr": pgd_eval["fpr"],
                "fnr": pgd_eval["fnr"],
                "attack_success_rate": pgd_asr,
                "evasions": pgd_evasions
            },
            {
                "condition": "Black-Box Query Attack",
                "accuracy": round(bbox_acc, 2),
                "f1_score": bbox_eval["f1_score"],
                "precision": bbox_eval["precision"],
                "recall": bbox_eval["recall"],
                "fpr": bbox_eval["fpr"],
                "fnr": bbox_eval["fnr"],
                "attack_success_rate": bbox_asr,
                "evasions": bbox_evasions
            }
        ]

        result = {
            "model_id": model_id,
            "evaluated_samples": len(X_sub),
            "attack_samples_count": int(np.sum(y_sub == 1)),
            "epsilon": epsilon,
            "robustness_score": robustness_score,
            "clean_accuracy": round(clean_acc, 2),
            "worst_adversarial_accuracy": round(worst_adversarial_acc, 2),
            "max_attack_success_rate": max(fgsm_asr, pgd_asr, bbox_asr),
            "conditions": summary_comparison,
            "confusion_matrices": {
                "clean": clean_eval["confusion_matrix"],
                "fgsm": fgsm_eval["confusion_matrix"],
                "pgd": pgd_eval["confusion_matrix"],
                "bbox": bbox_eval["confusion_matrix"]
            },
            "timestamp": pd.Timestamp.now().isoformat()
        }

        state.recent_evaluations.insert(0, result)
        state.record_experiment("robustness_evaluation", result)
        return result
