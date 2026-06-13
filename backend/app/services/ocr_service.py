import base64
import re
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from google import genai
from google.genai import types
from PIL import Image, ImageOps, ImageFilter

from app.core.config import get_settings

settings = get_settings()


def clean_ocr_text(text: str) -> str:
    text = text.replace("\x0c", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def score_ocr_quality(text: str) -> float:
    cleaned = clean_ocr_text(text)

    if not cleaned:
        return 0.0

    words = re.findall(r"[A-Za-z0-9]{2,}", cleaned)
    total_tokens = re.findall(r"\S+", cleaned)

    if not total_tokens:
        return 0.0

    word_ratio = len(words) / max(len(total_tokens), 1)
    length_score = min(len(cleaned) / 400, 1.0)

    weird_chars = re.findall(r"[^A-Za-z0-9\s.,:;!?()'\"/\-]", cleaned)
    weird_penalty = min(len(weird_chars) / max(len(cleaned), 1), 0.5)

    return max(0.0, (word_ratio * 0.7 + length_score * 0.3) - weird_penalty)


def preprocess_for_handwriting(image: Image.Image) -> list[Image.Image]:
    rgb_image = image.convert("RGB")
    grayscale = ImageOps.grayscale(rgb_image)

    # Upscale for OCR
    width, height = grayscale.size
    scale = 2
    upscaled = grayscale.resize((width * scale, height * scale))

    # PIL contrast/sharpness style preprocessing
    autocontrast = ImageOps.autocontrast(upscaled)
    sharpened = autocontrast.filter(ImageFilter.SHARPEN)

    # OpenCV threshold preprocessing
    cv_image = np.array(upscaled)
    denoised = cv2.fastNlMeansDenoising(cv_image, None, 30, 7, 21)

    adaptive_threshold = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    otsu_threshold = cv2.threshold(
        denoised,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )[1]

    adaptive_image = Image.fromarray(adaptive_threshold)
    otsu_image = Image.fromarray(otsu_threshold)

    return [
        rgb_image,
        upscaled,
        autocontrast,
        sharpened,
        adaptive_image,
        otsu_image,
    ]


def run_tesseract_variants(image: Image.Image) -> tuple[str, float]:
    candidates: list[tuple[str, float]] = []

    processed_images = preprocess_for_handwriting(image)

    configs = [
        "--oem 3 --psm 6",
        "--oem 3 --psm 11",
        "--oem 3 --psm 12",
    ]

    for processed_image in processed_images:
        for config in configs:
            try:
                text = pytesseract.image_to_string(
                    processed_image,
                    config=config,
                )
                cleaned = clean_ocr_text(text)
                score = score_ocr_quality(cleaned)
                candidates.append((cleaned, score))
            except Exception:
                continue

    if not candidates:
        return "", 0.0

    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[0]


def extract_text_with_gemini_vision(image_path: Path) -> str:
    if not settings.GEMINI_API_KEY or not settings.GEMINI_VISION_OCR_ENABLED:
        return ""

    image_bytes = image_path.read_bytes()
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    prompt = """
You are an OCR engine for handwritten notes.

Task:
Extract the handwritten text from this image as accurately as possible.

Rules:
1. Preserve headings such as "Set 1", "Set 2", etc.
2. Preserve numbered lists.
3. Do not guess unreadable words. Use [unclear] where needed.
4. Do not summarize.
5. Return only the extracted text.
"""

    response = client.models.generate_content(
        model=settings.GEMINI_VISION_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(text=prompt),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/png",
                            data=encoded_image,
                        )
                    ),
                ],
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.0,
        ),
    )

    return clean_ocr_text(response.text or "")


def extract_best_text_from_image(
    image: Image.Image,
    stored_image_path: Path,
) -> dict:
    tesseract_text, tesseract_score = run_tesseract_variants(image)

    result = {
        "text": tesseract_text,
        "engine": "tesseract_preprocessed",
        "quality_score": tesseract_score,
        "gemini_used": False,
        "gemini_error": None,
    }

    # If Tesseract looks weak, try Gemini Vision OCR.
    if tesseract_score < 0.62:
        try:
            gemini_text = extract_text_with_gemini_vision(stored_image_path)
            gemini_score = score_ocr_quality(gemini_text)

            if gemini_text and gemini_score >= tesseract_score:
                result = {
                    "text": gemini_text,
                    "engine": f"gemini_vision:{settings.GEMINI_VISION_MODEL}",
                    "quality_score": gemini_score,
                    "gemini_used": True,
                    "gemini_error": None,
                }

        except Exception as exc:
            result["gemini_used"] = True
            result["gemini_error"] = str(exc)[:500]

    return result 
