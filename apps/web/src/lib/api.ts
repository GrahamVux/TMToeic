import { CSRF_HEADER, CSRF_HEADER_VALUE, ERROR_CODES, type ApiErrorBody, type ErrorCode } from '@toeic/shared'

/** `/api/v1` via the Vite proxy in dev; set VITE_API_URL (e.g. https://api.example.com/api/v1) for a separate API origin. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'

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
