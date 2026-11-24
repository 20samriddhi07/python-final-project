# System Architecture Specification

## 1. Mathematical Formulation of Adversarial Attacks on Network Features

### 1.1 White-Box Attacks (PyTorch MLP)

#### Fast Gradient Sign Method (FGSM)
FGSM computes the gradient of the loss function \(\mathcal{L}(\theta, x, y)\) with respect to the input feature vector \(x\):
$$\nabla_x \mathcal{L}(\theta, x, y)$$
The perturbed adversarial feature vector \(x_{adv}\) is generated in a single step with perturbation budget \(\epsilon\):
$$x_{adv} = x + \epsilon \cdot \text{sign}(\nabla_x \mathcal{L}(\theta, x, y))$$

#### Projected Gradient Descent (PGD)
PGD is an iterative multi-step extension with step size \(\alpha \approx \frac{\epsilon}{4}\):
$$x^{t+1} = \Pi_{x + \mathcal{S}} \left( x^t + \alpha \cdot \text{sign}(\nabla_{x^t} \mathcal{L}(\theta, x^t, y)) \right)$$
where \(\Pi_{x + \mathcal{S}}\) is the projection operator projecting the perturbed vector back onto the \(\epsilon\)-ball around \(x\).

### 1.2 Feature-Aware Network Semantic Constraints
Unlike unconstrained perturbations in computer vision where pixel values are merely clipped to \([0, 1]\), network traffic flow features have strict domain constraints:
1. **Non-negativity Invariant**:
   $$\forall i \in \mathcal{F}_{\text{counts, durations, lengths}}, \quad x_{\text{raw}, i} \ge 0$$
2. **TCP Flag Invariant**:
   $$\forall j \in \mathcal{F}_{\text{flags}}, \quad x_{\text{raw}, j} \in [0, 1]$$
3. **Immutable Port Invariant**:
   An adversary initiating a connection to a victim server listening on port 80/443 cannot alter the server's listening port in the resulting flow record:
   $$x_{\text{raw}, \text{DestPort}} = x_{\text{orig}, \text{DestPort}}$$

ADVERSHIELD solves this via its two-phase projection:
$$x_{\text{proj}} = \text{Transform}\left( \text{Constrain}_{\text{domain}}\left( \text{InverseTransform}(x_{\text{adv}}) \right) \right)$$

---

## 2. Adversarial Training (Min-Max Optimization)

Adversarial training formulates model training as a min-max game:
$$\min_\theta \mathbb{E}_{(x, y) \sim \mathcal{D}} \left[ \max_{\delta \in \Delta} \mathcal{L}(\theta, x + \delta, y) \right]$$
During each training epoch, adversarial perturbations \(\delta\) are generated on the training split, and the model weights \(\theta\) are updated to correctly classify both clean and perturbed samples.
