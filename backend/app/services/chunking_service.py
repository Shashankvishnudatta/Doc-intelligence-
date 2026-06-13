from app.models.document import DocumentPage


def split_text_into_chunks(
    text: str,
    max_chars: int = 900,
    overlap_chars: int = 150,
) -> list[str]:
    cleaned_text = text.strip()

    if not cleaned_text:
        return []

    paragraphs = [paragraph.strip() for paragraph in cleaned_text.split("\n\n") if paragraph.strip()]

    chunks: list[str] = []
    current_chunk = ""

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) + 2 <= max_chars:
            current_chunk = f"{current_chunk}\n\n{paragraph}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)

            if len(paragraph) <= max_chars:
                current_chunk = paragraph
            else:
                start = 0

                while start < len(paragraph):
                    end = start + max_chars
                    chunk = paragraph[start:end].strip()

                    if chunk:
                        chunks.append(chunk)

                    start = end - overlap_chars

                current_chunk = ""

    if current_chunk:
        chunks.append(current_chunk)

    deduped_chunks: list[str] = []
    seen = set()

    for chunk in chunks:
        normalized = " ".join(chunk.split())

        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped_chunks.append(chunk)

    return deduped_chunks


def build_page_chunks(page: DocumentPage) -> list[str]:
    page_text = page.extracted_text or ""

    chunks = split_text_into_chunks(
        text=page_text,
        max_chars=900,
        overlap_chars=150,
    )

    return chunks
