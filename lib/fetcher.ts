export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    const message =
      (isJson && payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : typeof payload === 'string' && payload
          ? payload
          : `Request failed with status ${response.status}`) || 'Request failed'
    throw new ApiError(message, response.status)
  }

  return payload as T
}

/** Thin fetch wrapper with JSON parsing + typed errors. */
export async function apiRequest<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  return parseResponse<T>(response)
}

/** SWR fetcher. */
export const fetcher = <T = unknown>(url: string) => apiRequest<T>(url)

export const api = {
  get: <T = unknown>(url: string) => apiRequest<T>(url),
  post: <T = unknown>(url: string, body?: unknown) =>
    apiRequest<T>(url, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T = unknown>(url: string, body?: unknown) =>
    apiRequest<T>(url, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T = unknown>(url: string) => apiRequest<T>(url, { method: 'DELETE' }),
  upload: <T = unknown>(url: string, formData: FormData) =>
    apiRequest<T>(url, { method: 'POST', body: formData }),
}
