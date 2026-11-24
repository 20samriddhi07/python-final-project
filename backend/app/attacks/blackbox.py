import numpy as np
from typing import Dict, Any, List
from app.attacks.constraints import NetworkTrafficConstraintEngine

class BlackBoxQueryAttack:
    def __init__(
        self,
        model,
        constraint_engine: NetworkTrafficConstraintEngine,
        eps: float = 0.25,
        max_queries: int = 50,
        delta: float = 0.05
    ):
        self.model = model
        self.constraint_engine = constraint_engine
        self.eps = eps
        self.max_queries = max_queries
        self.delta = delta

    def generate(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        Zeroth-Order Query-Based Black-Box Attack.
        Approximates directional gradient through finite difference query probabilities.
        """
        x_adv = np.copy(x)
        n_samples, n_features = x.shape

        for i in range(n_samples):
            # Target is evasion: increase Benign probability (class 0)
            initial_prob = self.model.predict_proba(x_adv[i:i+1])[0]
            # If already predicted as benign (class 0), no evasion perturbation needed
            if np.argmax(initial_prob) == 0:
                continue

            # Identify mutable feature candidate indices
            mutable_indices = [
                j for j in range(n_features) if j not in self.constraint_engine.immutable_indices
            ]
            
            # Subsample features to keep query budget reasonable
            selected_features = np.random.choice(
                mutable_indices,
                size=min(15, len(mutable_indices)),
                replace=False
            )

            # Estimate sensitivity for selected features
            best_dir = np.zeros(n_features, dtype=np.float32)
            for j in selected_features:
                # Query +delta
                x_pos = np.copy(x_adv[i:i+1])
                x_pos[0, j] += self.delta
                prob_pos = self.model.predict_proba(x_pos)[0, 0]  # P(benign)

                # Query -delta
                x_neg = np.copy(x_adv[i:i+1])
                x_neg[0, j] -= self.delta
                prob_neg = self.model.predict_proba(x_neg)[0, 0]  # P(benign)

                # Direction that increases P(benign)
                grad_est = (prob_pos - prob_neg) / (2 * self.delta)
                best_dir[j] = np.sign(grad_est)

            # Perturb towards highest benign probability
            step_adv = x_adv[i:i+1] + self.eps * best_dir
            x_adv[i:i+1] = self.constraint_engine.project_and_constrain(
                x_adv_scaled=step_adv,
                x_orig_scaled=x[i:i+1],
                eps=self.eps,
                norm="linf"
            )

        return x_adv


class TransferabilityAttack:
    def __init__(
        self,
        surrogate_model,
        target_model,
        constraint_engine: NetworkTrafficConstraintEngine,
        eps: float = 0.2
    ):
        self.surrogate_model = surrogate_model
        self.target_model = target_model
        self.constraint_engine = constraint_engine
        self.eps = eps

    def generate(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        Generates adversarial examples on surrogate differentiable model (e.g. PyTorch MLP)
        and transfers them to black-box target model (e.g. Random Forest or XGBoost).
        """
        from app.attacks.fgsm import FGSMAttack
        fgsm = FGSMAttack(
            model=self.surrogate_model,
            constraint_engine=self.constraint_engine,
            eps=self.eps
        )
        return fgsm.generate(x, y)
