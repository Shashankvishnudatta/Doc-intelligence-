import json
import re
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.document import Document

settings = get_settings()


def is_image_document(document: Document) -> bool:
    suffix = Path(document.original_filename).suffix.lower()
    content_type = (document.content_type or "").lower()

    return content_type.startswith("image/") or suffix in {".png", ".jpg", ".jpeg", ".webp"}


def build_document_text_for_classification(document: Document, max_chars: int = 12000) -> str:
    page_blocks: list[str] = []

    sorted_pages = sorted(document.pages, key=lambda page: page.page_number)

    for page in sorted_pages:
        text = page.extracted_text or ""

        if not text.strip():
            continue

        page_blocks.append(
            f"[PAGE {page.page_number}]\n{text.strip()}"
        )

    combined_text = "\n\n".join(page_blocks).strip()

    if len(combined_text) > max_chars:
        combined_text = combined_text[:max_chars] + "\n\n[TRUNCATED_FOR_CLASSIFICATION]"

    return combined_text


def extract_json_from_text(text: str) -> dict[str, Any]:
    cleaned = text.strip()

    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)

    if not match:
        raise ValueError("LLM did not return valid JSON.")

    return json.loads(match.group(0))


def heuristic_fallback_classification(document: Document, document_text: str) -> dict[str, Any]:
    lower_text = document_text.lower()

    topic_keywords = []

    keyword_map = {
        "ai": ["ai", "artificial intelligence", "machine learning", "automation"],
        "security": ["security", "confidential", "sensitive", "access", "privacy"],
        "finance": ["invoice", "revenue", "budget", "payment", "tax"],
        "legal": ["agreement", "contract", "terms", "policy", "compliance"],
        "healthcare": ["patient", "medicine", "clinical", "health", "doctor"],
        "education": ["student", "course", "exam", "learning", "syllabus"],
    }

    for topic, keywords in keyword_map.items():
        if any(keyword in lower_text for keyword in keywords):
            topic_keywords.append(topic)

    image_document = is_image_document(document)

    if "confidential" in lower_text or "sensitive" in lower_text or "private" in lower_text:
        sensitivity = "high"
    elif "policy" in lower_text or "internal" in lower_text or "employee" in lower_text:
        sensitivity = "medium"
    else:
        sensitivity = "low"

    return {
        "document_type": "image_or_ocr_document" if image_document else "unknown_or_text_document",
        "primary_topic": topic_keywords[0] if topic_keywords else "general",
        "secondary_topics": topic_keywords[1:],
        "content_characteristics": {
            "has_tables": any(page.tables_json not in (None, "", "[]") for page in document.pages),
            "has_scanned_or_ocr_content": "[OCR TEXT]" in document_text or image_document,
            "is_policy_or_guideline": "policy" in lower_text or "guideline" in lower_text,
            "is_image_heavy": image_document,
            "is_handwritten_possible": image_document,
            "language": "unknown",
        },
        "sensitivity": {
            "level": sensitivity,
            "reason": "Fallback classification based on keyword signals because Gemini classification was unavailable.",
            "contains_personal_data": any(word in lower_text for word in ["email", "phone", "address", "employee id"]),
            "contains_financial_data": any(word in lower_text for word in ["invoice", "salary", "payment", "bank"]),
            "contains_health_data": any(word in lower_text for word in ["patient", "medicine", "diagnosis", "clinical"]),
        },
        "summary": document_text[:500],
        "recommended_access_policy": "restricted_internal_review" if sensitivity in {"medium", "high"} else "standard_access",
        "confidence": 0.35,
        "classifier_engine": "local_heuristic_fallback",
    }


def classify_with_gemini(document: Document, document_text: str) -> dict[str, Any]:
    if not settings.GEMINI_API_KEY:
        return heuristic_fallback_classification(document=document, document_text=document_text)

    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        prompt = f"""
You are a document intelligence classifier.

Classify the document using ONLY the provided extracted document text.
Return ONLY valid JSON. Do not include markdown. Do not include explanation outside JSON.

Use this exact JSON structure:
{{
  "document_type": "one of: policy, report, invoice, contract, research_paper, handwritten_note, scanned_document, presentation, form, plain_text, unknown",
  "primary_topic": "short topic label",
  "secondary_topics": ["topic 1", "topic 2"],
  "content_characteristics": {{
    "has_tables": true,
    "has_scanned_or_ocr_content": true,
    "is_policy_or_guideline": false,
    "is_image_heavy": false,
    "is_handwritten_possible": false,
    "language": "detected language"
  }},
  "sensitivity": {{
    "level": "public | internal | confidential | highly_sensitive",
    "reason": "short reason",
    "contains_personal_data": false,
    "contains_financial_data": false,
    "contains_health_data": false
  }},
  "summary": "3-5 sentence summary",
  "recommended_access_policy": "public_read | authenticated_only | restricted_internal_review | admin_only",
  "confidence": 0.0,
  "classifier_engine": "gemini"
}}

Document name: {document.original_filename}
Content type: {document.content_type}
Page count: {document.page_count}

Extracted document text:
{document_text}
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        raw_text = response.text or ""

        classification = extract_json_from_text(raw_text)
        classification["classifier_engine"] = f"gemini:{settings.GEMINI_MODEL}"

        return classification

    except Exception as exc:
        fallback = heuristic_fallback_classification(
            document=document,
            document_text=document_text,
        )

        fallback["classifier_engine"] = "local_heuristic_fallback_after_gemini_error"
        fallback["llm_error"] = str(exc)[:500]

        return fallback

def classify_and_store_document(document_id: str, db: Session) -> Document:
    document = (
        db.query(Document)
        .options(selectinload(Document.pages))
        .filter(Document.id == document_id)
        .first()
    )

    if not document:
        raise ValueError("Document not found.")

    if document.status not in {"parsed", "classified", "indexed", "failed"}:
        raise ValueError("Document must be parsed before classification.")

    if document.page_count <= 0 or not document.pages:
        raise ValueError("Document must have parsed pages before classification.")

    document.status = "classifying"
    document.error_message = None
    db.commit()

    try:
        document_text = build_document_text_for_classification(document=document)

        if not document_text.strip():
            if is_image_document(document):
                document_text = (
                    f"Image-based document: {document.original_filename}. "
                    "OCR text was unavailable or too weak. Visual verification is required."
                )
            else:
                raise ValueError("No extracted text available for classification.")

        classification = classify_with_gemini(
            document=document,
            document_text=document_text,
        )

        document.classification_json = json.dumps(
            classification,
            ensure_ascii=False,
            indent=2,
        )

        document.status = "classified"
        document.error_message = None

        db.commit()
        db.refresh(document)

        return document

    except Exception as exc:
        db.rollback()

        document = db.query(Document).filter(Document.id == document_id).first()
        document.status = "failed"
        document.error_message = f"Classification failed: {str(exc)}"

        db.commit()
        db.refresh(document)

        return document 
