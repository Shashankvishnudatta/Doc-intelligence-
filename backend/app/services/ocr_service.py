import base64
import re
from pathlib import Path

import numpy as np
import pytesseract
from google import genai
from google.genai import types
from PIL import Image, ImageOps, ImageFilter

from app.core.config import get_settings

settings = get_settings()

try:
    import cv2
except Exception:
    cv2 = None


def clean_ocr_text_for_storage(text: str) -> str:
    if not text:
        return ""

    diagnostic_patterns = [
        r"\[?\s*OCR\s+ENGINE\s*:[^\]\n]*\]?",
        r"\[?\s*OCR\s+QUALITY\s+SCORE\s*:[^\]\n]*\]?",
        r"\[?\s*OCR\s+VARIANT\s*:[^\]\n]*\]?",
        r"\[?\s*GEMINI\s+OCR\s+ERROR\s*\]?",
        r"\[[^\]\n]*(?:OCR\s+ENGINE|OCR\s+QUALITY|OCR\s+VARIANT|TESSERACT|GEMINI)[^\]\n]*\]",
        r"\b(?:tesseract_preprocessed|tesseract_raw|tesseract_clean|tesseract_default|gemini_vision|gemini vision)\b",
    ]

    cleaned_lines: list[str] = []

    for raw_line in text.replace("\x0c", " ").splitlines():
        line = raw_line

        for pattern in diagnostic_patterns:
            line = re.sub(pattern, " ", line, flags=re.IGNORECASE)

        line = re.sub(r"[ \t]+", " ", line).strip()

        if line:
            cleaned_lines.append(line)

    return re.sub(r"\n{3,}", "\n\n", "\n".join(cleaned_lines)).strip()


def clean_ocr_text(text: str) -> str:
    return clean_ocr_text_for_storage(text)


def estimate_ocr_quality(text: str) -> float:
    cleaned = clean_ocr_text(text)

    if not cleaned:
        return 0.0

    words = re.findall(r"[A-Za-z]{3,}", cleaned)
    long_words = re.findall(r"[A-Za-z]{5,}", cleaned)
    total_tokens = re.findall(r"\S+", cleaned)

    if not total_tokens:
        return 0.0

    word_ratio = len(words) / max(len(total_tokens), 1)
    long_word_ratio = len(long_words) / max(len(total_tokens), 1)
    alpha_ratio = len(re.findall(r"[A-Za-z]", cleaned)) / max(len(cleaned), 1)
    length_score = min(len(cleaned) / 400, 1.0)

    weird_chars = re.findall(r"[^A-Za-z0-9\s.,:;!?()'\"/\-]", cleaned)
    weird_penalty = min(len(weird_chars) / max(len(cleaned), 1), 0.5)
    malformed_tokens = [
        token
        for token in total_tokens
        if len(token) >= 4 and not re.search(r"[A-Za-z]{3,}", token)
    ]
    malformed_penalty = len(malformed_tokens) / max(len(total_tokens), 1)

    score = (
        word_ratio * 0.35
        + long_word_ratio * 0.2
        + alpha_ratio * 0.25
        + length_score * 0.2
        - weird_penalty * 1.2
        - malformed_penalty * 0.35
    )

    return max(0.0, min(1.0, score))


def score_ocr_quality(text: str) -> float:
    return estimate_ocr_quality(text)


def preprocess_for_handwriting(image: Image.Image) -> list[tuple[str, Image.Image]]:
    rgb_image = image.convert("RGB")
    grayscale = ImageOps.grayscale(rgb_image)

    # Upscale for OCR
    width, height = grayscale.size
    scale = 2
    upscaled = grayscale.resize((width * scale, height * scale))

    # PIL contrast/sharpness style preprocessing
    autocontrast = ImageOps.autocontrast(upscaled)
    sharpened = autocontrast.filter(ImageFilter.SHARPEN)

    variants: list[tuple[str, Image.Image]] = [
        ("rgb", rgb_image),
        ("grayscale", grayscale),
        ("upscaled", upscaled),
        ("autocontrast", autocontrast),
        ("sharpened", sharpened),
    ]

    try:
        if cv2 is None:
            raise RuntimeError("opencv_unavailable")

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

        variants.extend(
            [
                ("denoised", Image.fromarray(denoised)),
                ("adaptive_threshold", Image.fromarray(adaptive_threshold)),
                ("otsu_threshold", Image.fromarray(otsu_threshold)),
            ]
        )
    except Exception as exc:
        print(f"[OCR WARNING] opencv_preprocessing_failed error={str(exc)[:200]}")

    return variants


def run_tesseract_variants(image: Image.Image) -> dict:
    candidates: list[dict] = []

    processed_images = preprocess_for_handwriting(image)

    configs = [
        "--oem 3 --psm 3",
        "--oem 3 --psm 4",
        "--oem 3 --psm 6",
        "--oem 3 --psm 11",
        "--oem 3 --psm 12",
    ]

    for variant_name, processed_image in processed_images:
        for config in configs:
            try:
                text = pytesseract.image_to_string(
                    processed_image,
                    config=config,
                )
                cleaned = clean_ocr_text(text)
                score = score_ocr_quality(cleaned)
                candidates.append(
                    {
                        "text": cleaned,
                        "quality_score": score,
                        "engine": "tesseract_preprocessed",
                        "variant": f"{variant_name}:{config}",
                        "used_vision": False,
                    }
                )
            except Exception:
                continue

    if not candidates:
        return {
            "text": "",
            "quality_score": 0.0,
            "engine": "tesseract_preprocessed",
            "variant": "none",
            "used_vision": False,
        }

    candidates.sort(key=lambda item: float(item["quality_score"]), reverse=True)
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


def coerce_ocr_result_text(result) -> str:
    if result is None:
        return ""

    if isinstance(result, str):
        return clean_ocr_text_for_storage(result)

    if isinstance(result, dict):
        return clean_ocr_text_for_storage(str(result.get("text") or ""))

    if isinstance(result, tuple) and result:
        return clean_ocr_text_for_storage(str(result[0] or ""))

    return clean_ocr_text_for_storage(str(result))


def extract_best_text_from_image(
    image: Image.Image,
    stored_image_path: Path,
) -> dict:
    result = run_tesseract_variants(image)
    result["text"] = clean_ocr_text_for_storage(result.get("text") or "")
    result["gemini_used"] = False
    result["used_vision"] = False
    result["gemini_error"] = None

    tesseract_score = float(result.get("quality_score") or 0.0)

    # If Tesseract looks weak, try Gemini Vision OCR.
    if tesseract_score < 0.62:
        try:
            gemini_text = extract_text_with_gemini_vision(stored_image_path)
            gemini_score = score_ocr_quality(gemini_text)

            if gemini_text and gemini_score >= tesseract_score:
                result = {
                    "text": clean_ocr_text_for_storage(gemini_text),
                    "engine": f"gemini_vision:{settings.GEMINI_VISION_MODEL}",
                    "variant": "gemini_vision_ocr",
                    "quality_score": gemini_score,
                    "gemini_used": True,
                    "used_vision": True,
                    "gemini_error": None,
                }
            else:
                result["gemini_used"] = bool(gemini_text)

        except Exception as exc:
            result["gemini_used"] = True
            result["used_vision"] = False
            result["gemini_error"] = str(exc)[:500]

    print(
        "[OCR] "
        f"file={stored_image_path.name} "
        f"best_variant={result.get('variant', 'unknown')} "
        f"engine={result.get('engine', 'unknown')} "
        f"quality={float(result.get('quality_score') or 0):.2f} "
        f"chars={len(result.get('text') or '')}"
    )

    return result 
