import numpy as np
from typing import Dict, Any, Tuple
from app.attacks.constraints import NetworkTrafficConstraintEngine

class FGSMAttack:
    def __init__(
        self,
        model,
        constraint_engine: NetworkTrafficConstraintEngine,
        eps: float = 0.2
    ):
        self.model = model
        self.constraint_engine = constraint_engine
        self.eps = eps

    def generate(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        Generates FGSM adversarial examples targeting evasion.
        Maximizes loss on true attack label to evade detection.
        """
        # Ensure model supports gradient extraction
        if not hasattr(self.model, "get_input_gradient"):
            raise ValueError("Target model does not support gradient calculation (FGSM requires PyTorch MLP).")

        # Get gradients of loss w.r.t input
        grads = self.model.get_input_gradient(x, y)
        grad_sign = np.sign(grads)

        # FGSM step
        x_adv = x + self.eps * grad_sign

        # Apply semantic and norm constraints
        x_adv_constrained = self.constraint_engine.project_and_constrain(
            x_adv_scaled=x_adv,
            x_orig_scaled=x,
            eps=self.eps,
            norm="linf"
        )
        return x_adv_constrained
