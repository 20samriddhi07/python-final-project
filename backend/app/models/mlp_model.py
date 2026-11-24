import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from typing import Dict, Any, Tuple
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report

class MLPNet(nn.Module):
    def __init__(self, input_dim: int, hidden_dim1: int = 128, hidden_dim2: int = 64, dropout_rate: float = 0.2):
        super(MLPNet, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim1),
            nn.BatchNorm1d(hidden_dim1),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_dim1, hidden_dim2),
            nn.BatchNorm1d(hidden_dim2),
            nn.ReLU(),
            nn.Dropout(dropout_rate),
            nn.Linear(hidden_dim2, 2)
        )

    def forward(self, x):
        return self.network(x)

class MLPModelWrapper:
    def __init__(
        self,
        input_dim: int = 42,
        hidden_dim1: int = 128,
        hidden_dim2: int = 64,
        dropout_rate: float = 0.2,
        learning_rate: float = 0.001,
        epochs: int = 15,
        batch_size: int = 64,
        random_state: int = 42
    ):
        torch.manual_seed(random_state)
        np.random.seed(random_state)
        self.device = torch.device("cpu")
        self.input_dim = input_dim
        self.hidden_dim1 = hidden_dim1
        self.hidden_dim2 = hidden_dim2
        self.dropout_rate = dropout_rate
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.batch_size = batch_size
        
        self.net = MLPNet(input_dim, hidden_dim1, hidden_dim2, dropout_rate).to(self.device)
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(self.net.parameters(), lr=learning_rate)
        
        self.params = {
            "input_dim": input_dim,
            "hidden_dim1": hidden_dim1,
            "hidden_dim2": hidden_dim2,
            "dropout_rate": dropout_rate,
            "learning_rate": learning_rate,
            "epochs": epochs,
            "batch_size": batch_size
        }
        self.training_time = 0.0
        self.training_history = []

    def fit(self, X_train: np.ndarray, y_train: np.ndarray) -> Dict[str, Any]:
        start = time.time()
        self.input_dim = X_train.shape[1]
        self.net = MLPNet(self.input_dim, self.hidden_dim1, self.hidden_dim2, self.dropout_rate).to(self.device)
        self.optimizer = optim.Adam(self.net.parameters(), lr=self.learning_rate)
        
        dataset = TensorDataset(
            torch.tensor(X_train, dtype=torch.float32),
            torch.tensor(y_train, dtype=torch.long)
        )
        loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)
        
        self.net.train()
        self.training_history = []
        for epoch in range(self.epochs):
            running_loss = 0.0
            correct = 0
            total = 0
            for batch_x, batch_y in loader:
                batch_x, batch_y = batch_x.to(self.device), batch_y.to(self.device)
                self.optimizer.zero_grad()
                outputs = self.net(batch_x)
                loss = self.criterion(outputs, batch_y)
                loss.backward()
                self.optimizer.step()
                
                running_loss += loss.item() * len(batch_y)
                _, predicted = torch.max(outputs, 1)
                total += len(batch_y)
                correct += (predicted == batch_y).sum().item()
                
            epoch_loss = running_loss / total
            epoch_acc = correct / total
            self.training_history.append({"epoch": epoch + 1, "loss": round(epoch_loss, 4), "accuracy": round(epoch_acc, 4)})

        self.training_time = round(time.time() - start, 3)
        return {"training_time": self.training_time, "history": self.training_history}

    def predict(self, X: np.ndarray) -> np.ndarray:
        self.net.eval()
        with torch.no_grad():
            tensor_x = torch.tensor(X, dtype=torch.float32).to(self.device)
            outputs = self.net(tensor_x)
            _, predicted = torch.max(outputs, 1)
            return predicted.cpu().numpy()

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        self.net.eval()
        with torch.no_grad():
            tensor_x = torch.tensor(X, dtype=torch.float32).to(self.device)
            outputs = self.net(tensor_x)
            probs = torch.softmax(outputs, dim=1)
            return probs.cpu().numpy()

    def get_input_gradient(self, x_np: np.ndarray, y_np: np.ndarray) -> np.ndarray:
        """Computes gradient of loss w.r.t input tensor for gradient-based adversarial attacks."""
        self.net.eval()
        tensor_x = torch.tensor(x_np, dtype=torch.float32, requires_grad=True, device=self.device)
        tensor_y = torch.tensor(y_np, dtype=torch.long, device=self.device)
        
        outputs = self.net(tensor_x)
        loss = self.criterion(outputs, tensor_y)
        loss.backward()
        
        return tensor_x.grad.detach().cpu().numpy()

    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, Any]:
        start = time.time()
        y_pred = self.predict(X_test)
        inference_time_ms = round((time.time() - start) * 1000 / len(X_test), 4)

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_pred).tolist()
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

        tn, fp, fn, tp = confusion_matrix(y_test, y_pred).ravel()
        fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
        fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

        return {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "fpr": round(fpr, 4),
            "fnr": round(fnr, 4),
            "confusion_matrix": cm,
            "classification_report": report,
            "training_time": self.training_time,
            "inference_time_ms": inference_time_ms,
            "history": self.training_history
        }

    def save(self, filepath: str):
        torch.save({
            "model_state_dict": self.net.state_dict(),
            "input_dim": self.input_dim,
            "hidden_dim1": self.hidden_dim1,
            "hidden_dim2": self.hidden_dim2,
            "dropout_rate": self.dropout_rate,
            "training_time": self.training_time
        }, filepath)

    def load(self, filepath: str):
        checkpoint = torch.load(filepath, map_location=self.device)
        self.input_dim = checkpoint["input_dim"]
        self.hidden_dim1 = checkpoint.get("hidden_dim1", 128)
        self.hidden_dim2 = checkpoint.get("hidden_dim2", 64)
        self.dropout_rate = checkpoint.get("dropout_rate", 0.2)
        self.net = MLPNet(self.input_dim, self.hidden_dim1, self.hidden_dim2, self.dropout_rate).to(self.device)
        self.net.load_state_dict(checkpoint["model_state_dict"])
        self.training_time = checkpoint.get("training_time", 0.0)
