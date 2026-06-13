from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag_service import answer_question_with_rag

router = APIRouter(prefix="/chat", tags=["Chatbot"])


@router.post("", response_model=ChatResponse)
def chat_with_documents(request: ChatRequest):
    result = answer_question_with_rag(
    question=request.question,
    conversation_history=request.conversation_history,
    top_k=request.top_k,
    document_id=request.document_id,
)

    return ChatResponse(**result) 
