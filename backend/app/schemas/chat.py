from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    conversation_history: list[ChatMessage] = []
    top_k: int = 5
    document_id: str | None = None


class CitationItem(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    source: str
    page_image_url: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[CitationItem]
    retrieved_context_count: int
    grounded: bool 

class PageTextUpdateRequest(BaseModel):
    extracted_text: str
    reclassify: bool = True
    reindex: bool = True


class PageTextUpdateResponse(BaseModel):
    document_id: str
    page_number: int
    status: str
    detail: str
    extracted_text: str