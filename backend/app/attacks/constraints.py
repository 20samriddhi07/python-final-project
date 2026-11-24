import numpy as np
from typing import List, Optional, Set

class NetworkTrafficConstraintEngine:
    def __init__(
        self,
        feature_names: List[str],
        scaler_mean: np.ndarray,
        scaler_scale: np.ndarray,
        immutable_features: Optional[List[str]] = None
    ):
        self.feature_names = feature_names
        self.mean = np.array(scaler_mean, dtype=np.float32)
        self.scale = np.array(scaler_scale, dtype=np.float32)
        # Avoid division by zero
        self.scale = np.where(self.scale == 0, 1e-6, self.scale)

        # Default immutable network features that an adversary cannot alter arbitrarily
        # in a real network evasion attack against a target server
        default_immutables = {
            "Destination Port",
            "min_seg_size_forward"
        }
        if immutable_features is not None:
            default_immutables.update(immutable_features)

        self.immutable_indices = [
            i for i, name in enumerate(feature_names) if name in default_immutables
        ]

        # Non-negative features (counts, durations, lengths, rates)
        self.non_negative_indices = [
            i for i, name in enumerate(feature_names)
            if any(term in name.lower() for term in [
                "duration", "packet", "length", "byte", "iat", "total",
                "header", "count", "mean", "std", "max", "min", "ratio", "size"
            ])
        ]

        # Binary/flag features [0, 1]
        self.flag_indices = [
            i for i, name in enumerate(feature_names) if "flag count" in name.lower()
        ]

    def inverse_transform(self, x_scaled: np.ndarray) -> np.ndarray:
        return x_scaled * self.scale + self.mean

    def transform(self, x_raw: np.ndarray) -> np.ndarray:
        return (x_raw - self.mean) / self.scale

    def project_and_constrain(
        self,
        x_adv_scaled: np.ndarray,
        x_orig_scaled: np.ndarray,
        eps: float,
        norm: str = "linf"
    ) -> np.ndarray:
        """
        Enforces both:
        1. Norm bound (L-inf or L-2) in scaled space.
        2. Real-world network semantic and physical constraints in raw domain.
        """
        # 1. Project to epsilon ball in scaled space
        diff = x_adv_scaled - x_orig_scaled
        if norm == "linf":
            diff = np.clip(diff, -eps, eps)
        elif norm == "l2":
            norms = np.linalg.norm(diff, axis=1, keepdims=True) + 1e-8
            factor = np.minimum(1.0, eps / norms)
            diff = diff * factor

        x_projected_scaled = x_orig_scaled + diff

        # 2. Convert to raw physical domain to enforce semantic network rules
        x_raw = self.inverse_transform(x_projected_scaled)
        x_orig_raw = self.inverse_transform(x_orig_scaled)

        # A. Restore immutable features
        for idx in self.immutable_indices:
            x_raw[:, idx] = x_orig_raw[:, idx]

        # B. Enforce non-negativity (packet count, duration, lengths >= 0)
        for idx in self.non_negative_indices:
            x_raw[:, idx] = np.maximum(0.0, x_raw[:, idx])

        # C. Enforce flag constraints [0, 1]
        for idx in self.flag_indices:
            x_raw[:, idx] = np.clip(np.round(x_raw[:, idx]), 0.0, 1.0)

        # D. Port constraints [0, 65535]
        for i, name in enumerate(self.feature_names):
            if "port" in name.lower():
                x_raw[:, i] = np.clip(np.round(x_raw[:, i]), 0.0, 65535.0)

        # 3. Convert back to scaled domain
        return self.transform(x_raw)
