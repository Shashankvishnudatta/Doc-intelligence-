import type {
  BulkUploadResponse,
  DocumentListItem,
  IndexResponse,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function readErrorResponse(response: Response) {
  try {
    const data = await response.json();

    if (typeof data?.detail === "string") {
      return data.detail;
    }

    return JSON.stringify(data);
  } catch {
    return response.text();
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getPageImageUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith("http")) {
    return relativeUrl;
  }

  return `${API_BASE_URL}${relativeUrl}`;
}

export async function uploadDocuments(files: File[]) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/uploads/bulk`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<BulkUploadResponse>;
}

export async function parseDocument(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/parse`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<DocumentListItem>;
}

export async function classifyDocument(documentId: string) {
  const response = await fetch(
    `${API_BASE_URL}/documents/${documentId}/classify`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<DocumentListItem>;
}

export async function indexDocument(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/index`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  return response.json() as Promise<IndexResponse>;
}

export async function deleteDocument(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to delete document");
  }

  return response.json();
}