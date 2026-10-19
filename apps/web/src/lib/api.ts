import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@toeic/shared'

/**
 * Always same-origin `/api/v1` in the browser (Vite proxy in dev, Cloudflare Pages Function in prod).
 * Absolute `VITE_API_URL` values are ignored: a separate API host makes login cookies third-party,
 * which iOS Safari blocks.
 */
export function resolveApiBase(raw: string | undefined): string {
  const v = raw?.trim()
  if (!v || /^https?:\/\//i.test(v)) return '/api/v1'
  return v.replace(/\/$/, '')
}

const BASE = resolveApiBase(import.meta.env.VITE_API_URL as string | undefined)

export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'NETWORK'
  readonly details?: unknown

  constructor(status: number, code: ErrorCode | 'NETWORK', message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }

  /** Per-field messages from a 400 VALIDATION_FAILED response. */
  get fields(): Record<string, string> {
    const f = (this.details as { fields?: Record<string, string> } | undefined)?.fields
    return f ?? {}
  }
}

let sessionLostHandler: (() => void) | null = null
/** AuthProvider registers this to drop local auth state when the server says the session is gone. */
export function onSessionLost(handler: () => void) {
  sessionLostHandler = handler
  return () => {
    if (sessionLostHandler === handler) sessionLostHandler = null
  }
}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }

async function send(path: string, { method = 'GET', body }: Options): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { [CSRF_HEADER]: CSRF_HEADER_VALUE } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.')
  }
}

// Single-flight: parallel 401s share ONE refresh call. Refresh tokens rotate, so concurrent refreshes would look like token theft.
let refreshing: Promise<boolean> | null = null
function refreshSession(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

const NO_REFRESH = new Set(['/auth/login', '/auth/refresh', '/auth/logout'])

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null
  return new ApiError(res.status, body?.error.code ?? ERROR_CODES.INTERNAL, body?.error.message ?? 'Đã có lỗi xảy ra, vui lòng thử lại.', body?.error.details)
}

export async function api<T = void>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options)

  if (res.status === 401 && !NO_REFRESH.has(path)) {
    if (await refreshSession()) res = await send(path, options)
  }

  if (!res.ok) {
    const err = await toError(res)
    const lost =
      !NO_REFRESH.has(path) && (err.status === 401 || err.code === ERROR_CODES.ACCOUNT_DISABLED || err.code === ERROR_CODES.SESSION_EXPIRED)
    if (lost) sessionLostHandler?.()
    throw err
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** POST a file as raw bytes (Listening audio). Same cookie and refresh behaviour as `api`. */
export async function apiUpload<T = void>(path: string, file: Blob, contentType: string): Promise<T> {
  const sendRaw = async () => {
    try {
      return await fetch(`${BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': contentType, [CSRF_HEADER]: CSRF_HEADER_VALUE },
        body: file,
      })
    } catch {
      throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.')
    }
  }

  let res = await sendRaw()
  if (res.status === 401 && !NO_REFRESH.has(path.split('?')[0] ?? path)) {
    if (await refreshSession()) res = await sendRaw()
  }
  if (!res.ok) {
    const err = await toError(res)
    if (err.status === 401 || err.code === ERROR_CODES.ACCOUNT_DISABLED || err.code === ERROR_CODES.SESSION_EXPIRED) sessionLostHandler?.()
    throw err
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Download a file the API returns as bytes (Excel export). Same cookie and refresh behaviour as `api`. */
export async function apiDownload(path: string, file: Blob, contentType: string): Promise<{ blob: Blob; filename: string; headers: Headers }> {
  const sendRaw = async () => {
    try {
      return await fetch(`${BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': contentType, [CSRF_HEADER]: CSRF_HEADER_VALUE },
        body: file,
      })
    } catch {
      throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.')
    }
  }

  let res = await sendRaw()
  if (res.status === 401) {
    if (await refreshSession()) res = await sendRaw()
  }
  if (!res.ok) {
    const err = await toError(res)
    if (err.status === 401 || err.code === ERROR_CODES.ACCOUNT_DISABLED || err.code === ERROR_CODES.SESSION_EXPIRED) sessionLostHandler?.()
    throw err
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
  return { blob: await res.blob(), filename: match?.[1] ?? 'download.xlsx', headers: res.headers }
}

/** GET a file the API returns as bytes (class result workbook). */
export async function apiGetFile(path: string): Promise<{ blob: Blob; filename: string }> {
  const sendRaw = async () => {
    try {
      return await fetch(`${BASE}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE },
      })
    } catch {
      throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.')
    }
  }

  let res = await sendRaw()
  if (res.status === 401) {
    if (await refreshSession()) res = await sendRaw()
  }
  if (!res.ok) {
    const err = await toError(res)
    if (err.status === 401 || err.code === ERROR_CODES.ACCOUNT_DISABLED || err.code === ERROR_CODES.SESSION_EXPIRED) sessionLostHandler?.()
    throw err
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
  return { blob: await res.blob(), filename: match?.[1] ?? 'ket-qua.xlsx' }
}
