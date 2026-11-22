import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@toeic/shared'
import { viewAsHeaders } from './view-as'

/** Production Pages host. Its Function proxy shares a few Cloudflare IPs, and Render's Cloudflare answers 429. */
const PROD_PAGES_API = 'https://toeic-api-prod.onrender.com/api/v1'

/**
 * Local and Vercel stay on same-origin `/api/v1`. The production Pages site calls Render directly
 * so each student is their own IP. A Pages Function fetch is one shared Cloudflare IP, which
 * Render's Cloudflare challenges with HTTP 429.
 */
export function resolveApiBase(raw: string | undefined, hostname?: string): string {
  const v = raw?.trim()
  if (v && !/^https?:\/\//i.test(v)) return v.replace(/\/$/, '')
  if (v && /^https?:\/\//i.test(v)) return v.replace(/\/$/, '')
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase()
  if (host === 'toeic-prod.pages.dev' || host.endsWith('.toeic-prod.pages.dev')) return PROD_PAGES_API
  return '/api/v1'
}

const BASE = resolveApiBase(import.meta.env.VITE_API_URL as string | undefined)

/** Managed thumbnails follow the same API origin as profile requests. Preserve older image URLs. */
export function accountImageSrc(url: string) {
  return url.startsWith('/api/v1/avatars/') ? BASE + url.slice('/api/v1'.length) : url
}

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
        ...viewAsHeaders(),
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

const NO_REFRESH = new Set(['/auth/login', '/auth/refresh', '/auth/logout', '/auth/recover-admin'])

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
        headers: { 'Content-Type': contentType, [CSRF_HEADER]: CSRF_HEADER_VALUE, ...viewAsHeaders() },
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
        headers: { 'Content-Type': contentType, [CSRF_HEADER]: CSRF_HEADER_VALUE, ...viewAsHeaders() },
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

/** GET a file the API returns as bytes (class result workbook, Excel templates). */
export async function apiGetFile(path: string, fallbackName = 'ket-qua.xlsx'): Promise<{ blob: Blob; filename: string }> {
  const sendRaw = async () => {
    try {
      return await fetch(`${BASE}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE, ...viewAsHeaders() },
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
  return { blob: await res.blob(), filename: match?.[1] ?? fallbackName }
}

/** Save an authenticated file download. A plain link skips the session cookie on the deployed site. */
export async function downloadApiFile(path: string, fallbackName: string) {
  const file = await apiGetFile(path, fallbackName)
  const url = URL.createObjectURL(file.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename || fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
