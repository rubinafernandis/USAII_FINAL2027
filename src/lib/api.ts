const TOKEN_KEY = 'usaii.lms.token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(t: string | null) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable: session-only login */
    }
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Called when the server ends the session, with its reason (for example, a suspended account). */
let onUnauthorized: ((message: string) => void) | null = null;
export const setUnauthorizedHandler = (fn: ((message: string) => void) | null) => {
  onUnauthorized = fn;
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the server. Check that the LMS is running.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error ?? `Request failed (${res.status}).`;
    if (res.status === 401 && path !== '/auth/login') onUnauthorized?.(message);
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  mime: string;
}

export function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<UploadResult> {
  return uploadTo<UploadResult>('/uploads', file, onProgress, (d) => !!(d as UploadResult | null)?.url);
}

/**
 * POST one file (multipart field "file") to an API path, reporting upload progress.
 * Pass an AbortSignal to cancel; the promise then rejects with an AbortError.
 */
export function uploadTo<T>(path: string, file: File, onProgress?: (pct: number) => void, isOk: (data: unknown) => boolean = () => true, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Upload cancelled.', 'AbortError'));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const done = () => signal?.removeEventListener('abort', onAbort);
    xhr.onload = () => {
      done();
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300 && isOk(data)) resolve(data as T);
      else {
        const message = data?.error ?? 'Upload failed.';
        if (xhr.status === 401) onUnauthorized?.(message);
        reject(new ApiError(xhr.status, message));
      }
    };
    xhr.onerror = () => {
      done();
      reject(new ApiError(0, 'Upload failed. Check your connection.'));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}
