import numpy as np
from typing import Dict, Any, Tuple, List
from app.attacks.constraints import NetworkTrafficConstraintEngine

class InputSanitizerDefense:
    def __init__(self, constraint_engine: NetworkTrafficConstraintEngine):
        self.constraint_engine = constraint_engine

    def sanitize_and_audit(self, x_scaled: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Input validation & sanitization:
        1. Checks statistical bounds.
        2. Clamps extreme adversarial anomalies.
        3. Audits violations.
        """
        x_raw = self.constraint_engine.inverse_transform(x_scaled)
        initial_raw = np.copy(x_raw)
        violations = 0

        # Check negative counts
        for idx in self.constraint_engine.non_negative_indices:
            neg_mask = x_raw[:, idx] < 0
            if np.any(neg_mask):
                violations += int(np.sum(neg_mask))
                x_raw[:, idx] = np.maximum(0.0, x_raw[:, idx])

        # Check TCP flags out of [0, 1]
        for idx in self.constraint_engine.flag_indices:
            flag_mask = (x_raw[:, idx] < 0) | (x_raw[:, idx] > 1.0)
            if np.any(flag_mask):
                violations += int(np.sum(flag_mask))
                x_raw[:, idx] = np.clip(np.round(x_raw[:, idx]), 0.0, 1.0)

        sanitized_scaled = self.constraint_engine.transform(x_raw)
        
        audit_summary = {
            "total_records": len(x_scaled),
            "invariant_violations_detected": violations,
            "sanitization_applied": violations > 0
        }
        return sanitized_scaled, audit_summary
