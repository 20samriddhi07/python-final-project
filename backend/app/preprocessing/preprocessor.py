import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from app.core.config import DATASET_RAW_DIR, DATASET_PROCESSED_DIR

class DatasetPreprocessor:
    def __init__(self):
        self.imputer = None
        self.scaler = None
        self.feature_columns = []
        self.target_column = "Label"

    @staticmethod
    def inspect_csv(file_path: str) -> Dict[str, Any]:
        """Thoroughly inspect a raw CSV dataset without modifying it."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset file {file_path} does not exist.")

        # Read sample or full dataset
        df = pd.read_csv(file_path, low_memory=False)
        # Strip leading/trailing whitespaces in column names
        df.columns = df.columns.str.strip()

        total_rows, total_cols = df.shape

        # Missing values
        missing_counts = df.isnull().sum()
        total_missing = int(missing_counts.sum())
        missing_by_col = {col: int(cnt) for col, cnt in missing_counts.items() if cnt > 0}

        # Infinite values in numerical columns
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        inf_counts = {}
        total_infs = 0
        for col in num_cols:
            infs = np.isinf(df[col]).sum()
            if infs > 0:
                inf_counts[col] = int(infs)
                total_infs += int(infs)

        # Duplicate rows
        total_duplicates = int(df.duplicated().sum())

        # Target label column identification
        label_col = None
        for candidate in ["Label", "label", "Attack", "class", "Class"]:
            if candidate in df.columns:
                label_col = candidate
                break

        class_distribution = {}
        binary_distribution = {"BENIGN": 0, "ATTACK": 0}

        if label_col:
            val_counts = df[label_col].astype(str).str.strip().value_counts()
            class_distribution = {k: int(v) for k, v in val_counts.items()}
            for label_name, count in class_distribution.items():
                if label_name.upper() == "BENIGN":
                    binary_distribution["BENIGN"] += count
                else:
                    binary_distribution["ATTACK"] += count

        # Feature summary statistics (numeric columns, top 12 or all)
        stats_summary = []
        for col in num_cols[:15]:
            clean_series = df[col].replace([np.inf, -np.inf], np.nan).dropna()
            if len(clean_series) > 0:
                stats_summary.append({
                    "feature": col,
                    "mean": round(float(clean_series.mean()), 3),
                    "std": round(float(clean_series.std()), 3),
                    "min": round(float(clean_series.min()), 3),
                    "max": round(float(clean_series.max()), 3),
                    "median": round(float(clean_series.median()), 3)
                })

        # Correlation heatmap data (select top 10 most varied numeric columns)
        top_variance_cols = []
        if len(num_cols) > 0:
            variances = df[num_cols].var().sort_values(ascending=False).dropna()
            top_variance_cols = variances.head(8).index.tolist()
            
        corr_data = []
        if len(top_variance_cols) > 1:
            clean_num_df = df[top_variance_cols].replace([np.inf, -np.inf], np.nan).fillna(0)
            corr_matrix = clean_num_df.corr().round(2)
            for row_col in top_variance_cols:
                row_dict = {"feature": row_col}
                for c_col in top_variance_cols:
                    val = corr_matrix.loc[row_col, c_col]
                    row_dict[c_col] = float(val) if not np.isnan(val) else 0.0
                corr_data.append(row_dict)

        return {
            "filename": os.path.basename(file_path),
            "total_rows": total_rows,
            "total_cols": total_cols,
            "columns": list(df.columns),
            "numeric_columns_count": len(num_cols),
            "total_missing_values": total_missing,
            "missing_by_column": missing_by_col,
            "total_infinite_values": total_infs,
            "infinite_by_column": inf_counts,
            "total_duplicates": total_duplicates,
            "label_column": label_col,
            "class_distribution": class_distribution,
            "binary_distribution": binary_distribution,
            "feature_statistics": stats_summary,
            "correlation_features": top_variance_cols,
            "correlation_matrix": corr_data,
            "preview": df.head(5).to_dict(orient="records")
        }

    def preprocess_dataset(
        self,
        raw_filename: str,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """Split first, then fit imputation and scaling on training rows only."""
        raw_path = DATASET_RAW_DIR / raw_filename
        if not raw_path.exists():
            raise FileNotFoundError(f"Raw file {raw_filename} not found.")

        df = pd.read_csv(raw_path, low_memory=False)
        df.columns = df.columns.str.strip()

        initial_count = len(df)

        # Identify label column
        label_col = None
        for candidate in ["Label", "label", "Attack", "class", "Class"]:
            if candidate in df.columns:
                label_col = candidate
                break

        if not label_col:
            raise ValueError("No valid Label column found in the dataset.")

        # Clean target: Binary mapping (0 = BENIGN, 1 = ATTACK)
        original_labels = df[label_col].astype(str).str.strip()
        if df[label_col].isna().any() or original_labels.str.len().eq(0).any():
            raise ValueError("The target label column contains missing or empty labels.")
        y_binary = (original_labels.str.upper() != "BENIGN").astype(int).values
        multiclass_labels = original_labels.values

        X_df = df.drop(columns=[label_col])
        num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()
        if not num_cols:
            raise ValueError("The dataset has no numeric input features.")
        X_numeric = X_df[num_cols].apply(pd.to_numeric, errors="coerce")
        X_numeric = X_numeric.replace([np.inf, -np.inf], np.nan)

        feature_names = list(X_numeric.columns)
        feature_hashes = pd.util.hash_pandas_object(X_numeric, index=False)
        labels_per_feature = pd.DataFrame(
            {"feature_hash": feature_hashes, "label": y_binary}
        ).groupby("feature_hash", sort=False)["label"].nunique()
        if (labels_per_feature > 1).any():
            conflict_count = int((labels_per_feature > 1).sum())
            raise ValueError(
                f"{conflict_count} identical feature vectors have conflicting labels. "
                "Resolve these records before training to avoid ambiguous targets."
            )

        keep_rows = ~feature_hashes.duplicated(keep="first").to_numpy()
        duplicates_removed = int((~keep_rows).sum())
        X_numeric = X_numeric.loc[keep_rows].reset_index(drop=True)
        y_binary = y_binary[keep_rows]
        multiclass_labels = multiclass_labels[keep_rows]
        X_values = X_numeric.to_numpy(dtype=np.float64)

        related_flow_columns = [
            "Source IP",
            "Source Port",
            "Destination IP",
            "Destination Port",
            "Protocol",
        ]
        group_columns = [column for column in related_flow_columns if column in df.columns]
        if len(group_columns) == len(related_flow_columns):
            groups = pd.util.hash_pandas_object(
                df.loc[keep_rows, group_columns].reset_index(drop=True).astype(str),
                index=False,
            ).to_numpy()
            n_splits = max(2, min(10, round(1 / test_size)))
            splitter = StratifiedGroupKFold(
                n_splits=n_splits, shuffle=True, random_state=random_state
            )
            candidates = []
            for train_indices, test_indices in splitter.split(X_values, y_binary, groups):
                if (
                    np.unique(y_binary[train_indices]).size < 2
                    or np.unique(y_binary[test_indices]).size < 2
                ):
                    continue
                size_error = abs(len(test_indices) / len(X_values) - test_size)
                class_error = abs(
                    float(np.mean(y_binary[test_indices])) - float(np.mean(y_binary))
                )
                candidates.append((size_error + class_error, train_indices, test_indices))
            if not candidates:
                raise ValueError(
                    "Could not create a group-aware split containing both target classes."
                )
            _, train_indices, test_indices = min(candidates, key=lambda item: item[0])
            X_train_raw, X_test_raw = X_values[train_indices], X_values[test_indices]
            y_train, y_test = y_binary[train_indices], y_binary[test_indices]
            train_labels = multiclass_labels[train_indices]
            test_labels = multiclass_labels[test_indices]
            train_groups = groups[train_indices]
            test_groups = groups[test_indices]
            related_group_overlap = int(len(set(train_groups) & set(test_groups)))
        else:
            X_train_raw, X_test_raw, y_train, y_test, train_labels, test_labels = train_test_split(
                X_values,
                y_binary,
                multiclass_labels,
                test_size=test_size,
                random_state=random_state,
                stratify=y_binary,
            )
            related_group_overlap = None

        self.imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        X_train_imputed = self.imputer.fit_transform(X_train_raw)
        X_test_imputed = self.imputer.transform(X_test_raw)
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train_imputed)
        X_test_scaled = self.scaler.transform(X_test_imputed)

        self.feature_columns = feature_names

        np.save(DATASET_PROCESSED_DIR / "X_train.npy", X_train_scaled)
        np.save(DATASET_PROCESSED_DIR / "X_test.npy", X_test_scaled)
        np.save(DATASET_PROCESSED_DIR / "y_train.npy", y_train)
        np.save(DATASET_PROCESSED_DIR / "y_test.npy", y_test)
        np.save(DATASET_PROCESSED_DIR / "X_train_raw.npy", X_train_raw)
        np.save(DATASET_PROCESSED_DIR / "X_test_raw.npy", X_test_raw)
        np.save(DATASET_PROCESSED_DIR / "train_labels_multi.npy", train_labels)
        np.save(DATASET_PROCESSED_DIR / "test_labels_multi.npy", test_labels)

        joblib.dump(self.imputer, DATASET_PROCESSED_DIR / "imputer.joblib")
        joblib.dump(self.scaler, DATASET_PROCESSED_DIR / "scaler.joblib")

        train_feature_hashes = pd.util.hash_pandas_object(
            pd.DataFrame(X_train_raw, columns=feature_names), index=False
        ).to_numpy()
        test_feature_hashes = pd.util.hash_pandas_object(
            pd.DataFrame(X_test_raw, columns=feature_names), index=False
        ).to_numpy()
        metadata = {
            "source_file": raw_filename,
            "original_rows": int(initial_count),
            "train_samples": int(len(X_train_scaled)),
            "test_samples": int(len(X_test_scaled)),
            "feature_count": len(feature_names),
            "feature_names": feature_names,
            "label_column": label_col,
            "class_distribution": {
                str(label): int(count)
                for label, count in zip(*np.unique(multiclass_labels, return_counts=True))
            },
            "train_benign_count": int(np.sum(y_train == 0)),
            "train_attack_count": int(np.sum(y_train == 1)),
            "test_benign_count": int(np.sum(y_test == 0)),
            "test_attack_count": int(np.sum(y_test == 1)),
            "duplicates_removed": duplicates_removed,
            "exact_feature_overlap_between_splits": int(
                len(set(train_feature_hashes) & set(test_feature_hashes))
            ),
            "related_flow_group_columns": group_columns
            if len(group_columns) == len(related_flow_columns)
            else [],
            "related_flow_group_overlap_between_splits": related_group_overlap,
            "test_size": test_size,
            "random_state": random_state,
            "imputation_strategy": "median fit on training split only",
            "scaling_strategy": "StandardScaler fit on training split only",
            "scaler_mean": [float(m) for m in self.scaler.mean_],
            "scaler_scale": [float(s) for s in self.scaler.scale_],
            "imputer_statistics": [float(value) for value in self.imputer.statistics_],
            "timestamp": pd.Timestamp.now().isoformat()
        }

        with open(DATASET_PROCESSED_DIR / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        return metadata
