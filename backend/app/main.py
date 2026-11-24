import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from app.core.config import (
    DATASET_PROCESSED_DIR,
    PROJECT_NAME,
    VERSION,
    DATASET_RAW_DIR,
)
from app.api.routes import router
from app.core.state import state
from app.preprocessing.preprocessor import DatasetPreprocessor

app = FastAPI(
    title=PROJECT_NAME,
    description="AI-Powered Network Intrusion Detection & Adversarial Robustness Evaluation System",
    version=VERSION
)

# Enable CORS for frontend Vite dev server (localhost:5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.on_event("startup")
def startup_event():
    print(f"[{PROJECT_NAME}] Starting up backend engine v{VERSION}...")
    state.restore_experiment_history()
    processed_metadata_path = DATASET_PROCESSED_DIR / "metadata.json"
    if processed_metadata_path.is_file():
        try:
            with processed_metadata_path.open("r", encoding="utf-8") as metadata_file:
                state.preprocessed_metadata = json.load(metadata_file)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[{PROJECT_NAME}] Warning on preprocessing metadata restore: {e}")

    active_filename = (
        Path(state.preprocessed_metadata.get("source_file", "")).name
        if state.preprocessed_metadata
        else "cicids2017_sample.csv"
    )
    active_csv = DATASET_RAW_DIR / active_filename
    if active_csv.is_file():
        state.active_dataset_filename = active_filename
        try:
            summary = DatasetPreprocessor.inspect_csv(str(active_csv))
            state.raw_dataset_summary = summary
            print(f"[{PROJECT_NAME}] Inspected active dataset: {summary['total_rows']} rows.")
        except Exception as e:
            print(f"[{PROJECT_NAME}] Warning on dataset startup inspect: {e}")

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
