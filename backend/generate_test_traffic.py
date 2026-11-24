from generate_sample_dataset import generate_cicids2017_sample
from app.core.config import DATASET_RAW_DIR

if __name__ == "__main__":
    generate_cicids2017_sample(
        str(DATASET_RAW_DIR / "network_traffic_stream.csv"),
        n_samples=500,
    )
    print("Generated live stream sample traffic.")
