export type DocumentPageItem = {
  id: string;
  page_number: number;
  extracted_text: string;
  image_path: string;
  tables_json: string | null;
};

export type DocumentListItem = {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  page_count: number;
  classification_json: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentDetail = DocumentListItem & {
  stored_filename: string;
  file_path: string;
  sha256_hash: string;
  pages: DocumentPageItem[];
};

export type UploadResult = {
  filename: string;
  status: string;
  document_id?: string | null;
  error_message?: string | null;
};

export type BulkUploadResponse = {
  total_files: number;
  successful_uploads: number;
  failed_uploads: number;
  results: UploadResult[];
};

export type IndexResponse = {
  document_id: string;
  status: string;
  chunk_count?: number;
  error_message?: string | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Citation = {
  document_id?: string | null;
  document_name: string;
  page_number: number;
  source?: string | null;
  text?: string | null;
  page_image_url?: string | null;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  retrieved_context_count: number;
  grounded: boolean;
};

export type HealthResponse = {
  status: string;
  app: string;
  environment: string;
  message: string;
};

export type DeleteDocumentResponse = {
  deleted: boolean;
  document_id: string;
  filename: string | null;
  file_deleted: boolean | null;
  page_images_deleted: boolean | null;
  vectors_deleted: boolean | null;
  detail: string;
};