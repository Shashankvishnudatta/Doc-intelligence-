export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
