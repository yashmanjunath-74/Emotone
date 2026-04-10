import os
import sys
from uuid import uuid4

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import librosa
import numpy as np
import torch

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_NAME = "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition"
TARGET_SAMPLE_RATE = 16000
UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".webm", ".ogg", ".m4a"}


class EmotionClassifier:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        self.model_name = model_name
        self._pipeline = None
        self.device = 0 if torch.cuda.is_available() else -1
        logger.info(f"Using device: {'CUDA' if self.device == 0 else 'CPU'}")

    def _ensure_loaded(self):
        """Lazy load the model on first use"""
        if self._pipeline is None:
            logger.info("Importing transformers...")
            from transformers import pipeline
            logger.info(f"Loading model: {self.model_name}")
            self._pipeline = pipeline(
                "audio-classification",
                model=self.model_name,
                device=self.device,
            )
            logger.info("Model loaded successfully")

    def classify(self, file_path: str) -> dict:
        try:
            logger.info(f"Loading audio from: {file_path}")
            audio, sr = librosa.load(file_path, sr=TARGET_SAMPLE_RATE, mono=True)
            logger.info(f"Raw audio - shape: {audio.shape}, SR: {sr}, min: {audio.min():.4f}, max: {audio.max():.4f}, mean: {audio.mean():.4f}, std: {audio.std():.4f}")
            
            # Trim silence less aggressively (top_db=50 is very conservative)
            audio_trimmed, idx = librosa.effects.trim(audio, top_db=50, ref=np.max)
            logger.info(f"After trim - shape: {audio_trimmed.shape}, Duration: {len(audio_trimmed) / TARGET_SAMPLE_RATE:.2f}s")
            
            min_samples = int(TARGET_SAMPLE_RATE * 0.3)  # 0.3 seconds minimum
            if audio_trimmed.size < min_samples:
                logger.warning(f"Audio too short: {len(audio_trimmed) / TARGET_SAMPLE_RATE:.2f}s")
                return {
                    "label": "unknown",
                    "score": 0.0,
                    "error": f"Audio too short or too quiet. Got {len(audio_trimmed) / TARGET_SAMPLE_RATE:.2f}s, need at least 0.3s of speech.",
                }
            
            # Normalize audio to [-1, 1] range (important for wav2vec2)
            max_val = np.max(np.abs(audio_trimmed))
            if max_val > 0:
                audio_normalized = audio_trimmed / max_val
            else:
                audio_normalized = audio_trimmed
            
            logger.info(f"Normalized audio - min: {audio_normalized.min():.4f}, max: {audio_normalized.max():.4f}, mean: {audio_normalized.mean():.4f}, std: {audio_normalized.std():.4f}")
            
            self._ensure_loaded()
            
            logger.info("Running emotion classification...")
            results = self._pipeline(
                {"array": audio_normalized, "sampling_rate": TARGET_SAMPLE_RATE}
            )
            logger.info(f"Model results: {results}")
            
            top_result = results[0] if results else {"label": "unknown", "score": 0.0}
            return {"label": top_result["label"], "score": float(top_result["score"])}
        except Exception as e:
            logger.error(f"Classification error: {str(e)}", exc_info=True)
            return {
                "label": "unknown",
                "score": 0.0,
                "error": f"Classification failed: {str(e)}",
            }


app = Flask(__name__)
CORS(app)

os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize classifier (model loads lazily on first request)
classifier = EmotionClassifier()


@app.route("/health")
def health_check():
    return {"status": "ok"}


@app.route("/api/predict", methods=["POST"])
def predict_emotion():
    if "file" not in request.files:
        return jsonify({"error": "Missing file in request."}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    filename = secure_filename(file.filename)
    _, ext = os.path.splitext(filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported file format. Use .wav, .mp3, .webm, .ogg or .m4a"}), 400

    saved_name = f"{uuid4().hex}{ext.lower()}"
    file_path = os.path.join(UPLOAD_DIR, saved_name)
    file.save(file_path)

    try:
        result = classifier.classify(file_path)
    except Exception:
        return jsonify({"error": "Failed to process audio file."}), 500
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

    if "error" in result:
        return jsonify({"error": result["error"]}), 400

    return jsonify({"emotion": result["label"], "confidence": result["score"]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
