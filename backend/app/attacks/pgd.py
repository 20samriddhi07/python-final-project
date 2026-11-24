import numpy as np
from typing import Dict, Any
from app.attacks.constraints import NetworkTrafficConstraintEngine

class PGDAttack:
    def __init__(
        self,
        model,
        constraint_engine: NetworkTrafficConstraintEngine,
        eps: float = 0.2,
        alpha: float = 0.05,
        steps: int = 15,
        random_start: bool = True
    ):
        self.model = model
        self.constraint_engine = constraint_engine
        self.eps = eps
        self.alpha = alpha if alpha is not None else (eps / 4.0)
        self.steps = steps
        self.random_start = random_start

    def generate(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        Executes multi-step Projected Gradient Descent with semantic constraints projection.
        """
        if not hasattr(self.model, "get_input_gradient"):
            raise ValueError("Target model does not support gradient calculation (PGD requires PyTorch MLP).")

        x_adv = np.copy(x)
        if self.random_start:
            # Random uniform initialization within [-eps, eps]
            noise = np.random.uniform(-self.eps, self.eps, size=x.shape).astype(np.float32)
            x_adv = self.constraint_engine.project_and_constrain(
                x_adv_scaled=x + noise,
                x_orig_scaled=x,
                eps=self.eps,
                norm="linf"
            )

        for step in range(self.steps):
            grads = self.model.get_input_gradient(x_adv, y)
            grad_sign = np.sign(grads)
            x_adv = x_adv + self.alpha * grad_sign
            x_adv = self.constraint_engine.project_and_constrain(
                x_adv_scaled=x_adv,
                x_orig_scaled=x,
                eps=self.eps,
                norm="linf"
            )

        return x_adv
