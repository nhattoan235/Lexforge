"""Download model files once. No recordings are uploaded."""
import os
from pathlib import Path
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
cache = Path(__file__).resolve().parent / "models" / ".hf-cache"
os.environ["HF_HOME"] = str(cache)
os.environ["HF_HUB_CACHE"] = str(cache / "hub")
os.environ["HF_XET_CACHE"] = str(cache / "xet")
os.environ["HF_HUB_DISABLE_XET"] = "1"
from huggingface_hub import snapshot_download

if __name__ == "__main__":
    destination = Path(__file__).resolve().parent / "models" / "small"
    snapshot_download("Systran/faster-whisper-small", local_dir=str(destination),
                      allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.*", "preprocessor_config.json"])
    print(f"Local model downloaded: {destination}")
