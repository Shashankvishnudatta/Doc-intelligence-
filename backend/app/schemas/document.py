from pydantic import BaseModel, ConfigDict


class DocumentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    content_type: str
    size_bytes: int
    status: str
    page_count: int
    classification_json: str | None
    error_message: str | None


class DocumentPageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    page_number: int
    extracted_text: str
    image_path: str
    tables_json: str | None


class DocumentDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    stored_filename: str
    file_path: str
    content_type: str
    size_bytes: int
    sha256_hash: str
    status: str
    page_count: int
    classification_json: str | None
    error_message: str | None
    pages: list[DocumentPageItem] = []


class UploadResult(BaseModel):
    filename: str
    document_id: str | None = None
    status: str
    detail: str
    size_bytes: int | None = None


class BulkUploadResponse(BaseModel):
    total_files: int
    successful: int
    failed: int
    results: list[UploadResult]


class IndexResponse(BaseModel):
    document_id: str
    status: str
    page_count: int
    chunk_count: int
    detail: str


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


class DeleteDocumentResponse(BaseModel):
    document_id: str
    status: str
    detail: str