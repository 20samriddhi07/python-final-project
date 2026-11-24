import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.preprocessing.preprocessor import DatasetPreprocessor
from app.models.model_manager import ModelManager
from app.attacks.attack_manager import AttackManager
from app.defence.adversarial_training import AdversarialTrainingEngine
from app.evaluation.metrics import RobustnessEvaluator
from app.reports.pdf_generator import ReportGenerator

def test_full_pipeline():
    print("=== 1. PREPROCESSING DATASET ===")
    prep = DatasetPreprocessor()
    meta = prep.preprocess_dataset("cicids2017_sample.csv", test_size=0.2)
    print(f"Preprocessed: {meta['train_samples']} train, {meta['test_samples']} test samples. Feature count: {meta['feature_count']}")

    print("\n=== 2. TRAINING BASELINE MODELS ===")
    print("-> Training Random Forest...")
    rf_meta = ModelManager.train_model("Random Forest", {"n_estimators": 50, "max_depth": 10})
    print(f"RF Accuracy: {rf_meta['metrics']['accuracy'] * 100:.2f}%, F1: {rf_meta['metrics']['f1_score']:.3f}")

    print("-> Training XGBoost...")
    xgb_meta = ModelManager.train_model("XGBoost", {"n_estimators": 50, "max_depth": 5, "learning_rate": 0.1})
    print(f"XGBoost Accuracy: {xgb_meta['metrics']['accuracy'] * 100:.2f}%, F1: {xgb_meta['metrics']['f1_score']:.3f}")

    print("-> Training PyTorch MLP...")
    mlp_meta = ModelManager.train_model("PyTorch MLP", {"epochs": 10, "batch_size": 64})
    print(f"MLP Accuracy: {mlp_meta['metrics']['accuracy'] * 100:.2f}%, F1: {mlp_meta['metrics']['f1_score']:.3f}")

    print("\n=== 3. ADVERSARIAL ATTACK SIMULATION ===")
    print("-> Executing FGSM on PyTorch MLP (eps=0.2)...")
    fgsm_res = AttackManager.run_adversarial_simulation(
        target_model_id="PyTorch MLP",
        attack_type="FGSM",
        epsilon=0.2,
        sample_limit=100
    )
    print(f"FGSM Attack Success Rate (Evasion): {fgsm_res['attack_success_rate']}%")
    print(f"Perturbation L-inf: {fgsm_res['perturbation_linf']}, Evasions: {fgsm_res['successful_evasions']}")

    print("-> Executing PGD on PyTorch MLP (eps=0.2, steps=10)...")
    pgd_res = AttackManager.run_adversarial_simulation(
        target_model_id="PyTorch MLP",
        attack_type="PGD",
        epsilon=0.2,
        iterations=10,
        sample_limit=100
    )
    print(f"PGD Attack Success Rate: {pgd_res['attack_success_rate']}%")

    print("-> Executing Black-Box Query on Random Forest (eps=0.2)...")
    bbox_res = AttackManager.run_adversarial_simulation(
        target_model_id="Random Forest",
        attack_type="Black-box Query",
        epsilon=0.2,
        sample_limit=50
    )
    print(f"Black-Box ASR on RF: {bbox_res['attack_success_rate']}%")

    print("\n=== 4. ADVERSARIAL TRAINING DEFENCE ===")
    print("-> Executing Adversarial Training for PyTorch MLP...")
    def_res = AdversarialTrainingEngine.train_defended_model(
        base_model_type="PyTorch MLP",
        attack_type_for_training="FGSM",
        epsilon=0.2,
        adv_ratio=0.5,
        epochs=10
    )
    print(f"Baseline ASR: {def_res['baseline_metrics']['attack_success_rate']}% -> Defended ASR: {def_res['defended_metrics']['attack_success_rate']}%")
    print(f"Evasion Reduction: {def_res['comparison']['asr_reduction_pct']}%")

    print("\n=== 5. ROBUSTNESS EVALUATION ===")
    eval_res = RobustnessEvaluator.run_comprehensive_evaluation(
        model_id="PyTorch MLP",
        epsilon=0.2,
        eval_samples=100
    )
    print(f"Robustness Score: {eval_res['robustness_score']}/100")
    for cond in eval_res["conditions"]:
        print(f" - {cond['condition']}: Acc={cond['accuracy']}%, F1={cond['f1_score']:.3f}, ASR={cond['attack_success_rate']}%")

    print("\n=== 6. GENERATE PDF REPORT ===")
    pdf_path = os.path.join(os.path.dirname(__file__), "..", "results", "reports", "test_report.pdf")
    ReportGenerator.generate_pdf_report(pdf_path)
    print(f"PDF generated successfully at {pdf_path}")

    print("\n>>> Pipeline steps completed. Review the measured metrics above for this dataset and split. <<<")

if __name__ == "__main__":
    test_full_pipeline()
