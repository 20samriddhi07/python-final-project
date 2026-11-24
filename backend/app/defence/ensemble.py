import numpy as np
from typing import List, Dict, Any
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

class EnsembleDefenseClassifier:
    def __init__(self, models: List[Any], weights: List[float] = None):
        self.models = models
        self.weights = weights if weights is not None else [1.0 / len(models)] * len(models)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        weighted_probs = np.zeros((len(X), 2), dtype=np.float32)
        for model, weight in zip(self.models, self.weights):
            probs = model.predict_proba(X)
            weighted_probs += probs * weight
        return weighted_probs

    def predict(self, X: np.ndarray) -> np.ndarray:
        probs = self.predict_proba(X)
        return np.argmax(probs, axis=1)

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        preds = self.predict(X_test)
        acc = float(accuracy_score(y_test, preds))
        prec = float(precision_score(y_test, preds, zero_division=0))
        rec = float(recall_score(y_test, preds, zero_division=0))
        f1 = float(f1_score(y_test, preds, zero_division=0))
        cm = confusion_matrix(y_test, preds).tolist()

        return {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": cm
        }
