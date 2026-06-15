# Document Intelligence + Agentic RAG

AI Engineer Intern Assessment project for building a document intelligence web application that can ingest messy documents, parse page-level content, classify documents, index them for retrieval, and answer user questions with grounded citations and source page thumbnails.

## 1. Project Overview

This project is a full-stack Document Intelligence + Agentic RAG application.

It supports:

* Bulk upload of multiple documents
* PDF, TXT, PNG, JPG, and JPEG ingestion
* OCR-based extraction for scanned/image-heavy content
* Page image rendering and storage
* Table extraction from PDFs
* LLM-based document classification with local fallback
* ChromaDB vector indexing
* Retrieval-Augmented Generation chatbot
* Inline document/page citations
* Clickable cited page thumbnails
* Full-page citation preview
* No-answer behavior when relevant context is missing
* Security-aware upload, storage, processing, and retrieval layers

The system is designed as a practical AI engineering prototype using free and open-source tooling wherever possible.

## 2. Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS
* lucide-react

### Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite
* pdfplumber
* pdf2image
* pytesseract
* Pillow
* ChromaDB
* sentence-transformers
* Google GenAI SDK with Gemini model support
* Local heuristic fallback classifier

### Storage

* Local file storage for uploaded documents
* Local page image storage
* SQLite for document, page, and chunk metadata
* ChromaDB persistent local vector store

## 3. Main Features

### Bulk Upload

The upload page allows users to upload multiple files at once. Each file moves through the following pipeline:

1. Uploaded
2. Parsing
3. Parsed
4. Classifying
5. Classified
6. Indexing
7. Indexed

The UI shows per-file processing status and error messages when something fails.

### Document Parser

The backend parser handles:

* Text-based PDFs
* Scanned PDFs
* Image-heavy PDFs
* Plain text files
* PNG/JPG/JPEG image documents

For each page, the backend stores:

* Extracted text
* Rendered page image
* Structured table data where available

### Document Classifier

After parsing, each document is classified into structured JSON.

The classification schema includes:

* Document type
* Primary topic
* Secondary topics
* Content characteristics
* Sensitivity level
* Personal/financial/health data indicators
* Summary
* Recommended access policy
* Confidence score
* Classifier engine used

If Gemini API access fails or is unavailable, the system uses a local heuristic fallback classifier so the pipeline continues working.

### Agentic RAG Chatbot

The chatbot retrieves relevant document chunks from ChromaDB and answers only from indexed document context.

Each grounded answer includes:

* Inline citation with document name and page number
* Citation cards
* Source page thumbnail
* Full page preview on click

If no relevant content exists, the chatbot returns a no-answer response instead of hallucinating.

### Sample Documents

The repository includes 6 sample documents inside the `samples/` folder:

1. `sample_ai_policy.txt`
2. `sample_employee_access_sop.txt`
3. `sample_invoice_table.txt`
4. `sample_rag_research_report.txt`
5. `sample_handwritten_meeting_note.txt`
6. `sample_medical_intake_form.txt`

A seed script is included to ingest, parse, classify, and index all sample documents.
### RAG Provider Modes

The backend supports multiple answer-generation modes:

- `fallback`: deterministic grounded answer generation from retrieved context.
- `hf`: Hugging Face Inference Providers for LLM-based synthesis.
- `hybrid`: fast deterministic answers for direct factual questions, Hugging Face for complex summary/explanation questions, and fallback if the provider is unavailable.
- `gemini`: optional Gemini route if API access is available.

The default recommended local mode is `hybrid` because it gives low-latency answers for direct questions while still supporting LLM synthesis for broader document summaries.

## 4. Project Structure

```text
BFAI-Document-Intelligence-RAG/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py
│   │   │   ├── documents.py
│   │   │   ├── health.py
│   │   │   └── uploads.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   └── document.py
│   │   ├── schemas/
│   │   │   ├── chat.py
│   │   │   └── document.py
│   │   ├── services/
│   │   │   ├── chunking_service.py
│   │   │   ├── classification_service.py
│   │   │   ├── document_processing_service.py
│   │   │   ├── indexing_service.py
│   │   │   ├── parser_service.py
│   │   │   ├── rag_service.py
│   │   │   ├── storage_service.py
│   │   │   └── vector_service.py
│   │   ├── utils/
│   │   │   └── file_security.py
│   │   └── main.py
│   ├── scripts/
│   │   └── seed_samples.py
│   ├── data/
│   │   ├── uploads/
│   │   ├── pages/
│   │   ├── chroma/
│   │   └── sqlite/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── chat/
│   │   │   ├── documents/
│   │   │   ├── upload/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
├── samples/
├── README.md
└── .gitignore
```

## 5. Backend Setup

### 5.1 Create and activate virtual environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
```

### 5.2 Install dependencies

```powershell
pip install -r requirements.txt
```

### 5.3 Create `.env`

Copy:

```powershell
copy .env.example .env
```

Then update:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_VISION_MODEL=gemini-2.5-flash
RAG_USE_GEMINI_VISION=true
```

Do not commit the real `.env` file. Gemini is optional for the basic demo because the project includes fallback classification and fallback answer generation, but Gemini Vision should be configured for the strongest image and handwritten-document answers.

### 5.4 Required local tools

Install:

* Tesseract OCR
* Poppler for Windows

Tesseract is used for OCR. Poppler is used by `pdf2image` to render PDF pages into images.

### 5.5 Run backend

```powershell
uvicorn app.main:app --reload
```

Backend will run at:

```text
http://127.0.0.1:8000
```

FastAPI docs:

```text
http://127.0.0.1:8000/docs
```

## 6. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

Frontend will run at:

```text
http://localhost:3000
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## 7. Seed Sample Documents

From the backend folder:

```powershell
python scripts\seed_samples.py
```

This script:

1. Reads files from the `samples/` folder
2. Saves them into backend storage
3. Parses each document
4. Classifies each document
5. Indexes chunks into ChromaDB

After seeding, open:

```text
http://localhost:3000/chat
```

Try questions like:

```text
Which document contains financial data?
```

```text
Which document is highly sensitive?
```

```text
What does the access SOP say about interns?
```

```text
What does the RAG research report say about hallucination?
```

## 8. API Endpoints

### Health

```text
GET /health
```

### Documents

```text
GET /documents
GET /documents/{document_id}
POST /documents/{document_id}/parse
POST /documents/{document_id}/classify
POST /documents/{document_id}/index
GET /documents/{document_id}/pages/{page_number}/image
```

### Upload

```text
POST /uploads/bulk
```

### Chat

```text
POST /chat
```

## 9. Security Decisions

Uploaded documents may contain sensitive or confidential content. The project implements security controls across upload, storage, processing, and retrieval layers.

### 9.1 Upload Layer

Implemented:

* File extension allowlist
* MIME type allowlist
* Maximum upload size limit
* Empty file rejection
* Filename sanitization
* Batch upload error isolation so one failed file does not break all files

Considered but skipped due to time:

* Antivirus scanning
* Deep file signature validation
* User authentication before upload
* Per-user upload quotas

Would add with more time:

* Authentication with role-based access control
* Malware scanning using ClamAV
* Rate limiting
* Signed upload URLs
* Upload audit logs

### 9.2 Storage Layer

Implemented:

* Sanitized stored filenames
* UUID-based stored filenames to avoid collisions
* SHA-256 hash tracking
* Local storage folders separated by purpose
* Path traversal protection before writing files
* `.env` excluded from Git
* Runtime data excluded from Git

Considered but skipped due to time:

* File encryption at rest
* Separate object storage bucket
* Per-user storage isolation

Would add with more time:

* AES encryption for stored files
* S3-compatible object storage
* Signed URL access for page images
* Automatic deletion policy for old uploads

### 9.3 Processing Layer

Implemented:

* Parsing errors are caught and stored per document
* Processing status is tracked in SQLite
* OCR is only applied when extracted PDF text is weak
* Page images are generated into controlled storage paths
* Classification fallback prevents API failure from breaking the pipeline

Considered but skipped due to time:

* Sandboxed document processing
* Worker queue for long-running OCR
* Background task isolation
* Resource limits per document

Would add with more time:

* Celery/RQ worker queue
* Docker sandbox for parsing untrusted files
* Timeout limits for OCR and PDF parsing
* Document processing audit trail

### 9.4 API / Retrieval Layer

Implemented:

* Chat answers are generated only from retrieved indexed chunks
* No-answer behavior when no relevant content is found
* Citations include document name and page number
* Source page images are shown for verification
* Retrieval filtering reduces irrelevant context
* API errors return structured messages

Considered but skipped due to time:

* User-level document permissions
* Authentication middleware
* Per-user vector namespaces
* API rate limiting

Would add with more time:

* JWT authentication
* Document-level ACLs
* User-scoped Chroma collections
* API request logging and monitoring
* Rate limiting for chat and upload endpoints

## 10. Known Limitations

* Handwriting support depends on Tesseract OCR quality.
* Gemini API may fail if the API key or project does not have access; fallback classification is included.
* Long PDFs may take time because parsing and OCR run synchronously.
* Current storage is local and intended for prototype/demo use.
* The app currently has no login system.
* ChromaDB is local and not user-isolated.

## 11. Demo Flow

For a detailed walkthrough, see `docs/DEMO_SCRIPT.md`.

Recommended demo steps:

1. Open the Bulk Upload page.
2. Upload 2-3 sample documents.
3. Show status moving from uploaded to indexed.
4. Open Documents page.
5. Show classification JSON summary, document type, topic, and sensitivity.
6. Open Chatbot page.
7. Ask a question with relevant document context.
8. Show answer with inline citation.
9. Click citation thumbnail and open full page.
10. Ask an unrelated question and show no-answer behavior.

## 12. Evaluation Mapping

| Requirement         | Implementation                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| Document Parser     | `parser_service.py` extracts text, OCR text, tables, and page images     |
| Document Classifier | `classification_service.py` creates structured JSON                      |
| Agentic RAG         | `rag_service.py`, `vector_service.py`, ChromaDB retrieval                |
| Chatbot Page        | Next.js `/chat` page with history, citations, thumbnails, modal          |
| Bulk Upload Page    | Next.js `/upload` page with multi-file pipeline status                   |
| Sample Documents    | 6 files in `samples/` and `seed_samples.py`                              |
| Security            | Upload validation, filename sanitization, path checks, no secrets in Git |
| Code Quality        | Modular backend services, schemas, APIs, clean frontend pages            |

