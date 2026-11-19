import type { ChangePasswordInput, LoginInput, RecoverAdminPasswordInput, SessionDto, UserDto } from '@toeic/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onSessionLost } from '@/lib/api'
import { getViewAsId, setViewAsId } from '@/lib/view-as'
import { useQueryClient } from '@tanstack/react-query'

type Status = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  status: Status
  /** The account whose screens are shown. While an admin previews someone, this is that teacher or student. */
  user: UserDto | null
  /** Set while an admin previews another account: the admin who is actually signed in. */
  viewing: { admin: UserDto } | null
  login: (input: LoginInput) => Promise<UserDto>
  /** Set a new admin password with the recovery code, then sign that admin in. */
  recoverAdmin: (input: RecoverAdminPasswordInput) => Promise<UserDto>
  logout: () => Promise<void>
  changePassword: (input: ChangePasswordInput) => Promise<UserDto>
  /** Replace the cached user after the server returned a fresh copy (e.g. goal changed). */
  updateUser: (user: UserDto) => void
  /** Admin only: show the app exactly as this teacher or student sees it, read-only. */
  startViewAs: (userId: string) => Promise<UserDto>
  /** Leave the preview and return to the admin's own screens. */
  stopViewAs: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [viewing, setViewing] = useState<{ admin: UserDto } | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const queryClient = useQueryClient()

  const apply = useCallback((s: SessionDto) => {
    // The server only honours a preview for an admin. Forget a stored id that it ignored.
    if (!s.viewingAs && getViewAsId()) setViewAsId(null)
    setUser(s.user)
    setViewing(s.viewingAs ?? null)
  }, [])

  // Restore the session from the HttpOnly cookie on page load (api() transparently refreshes an expired access token).
  useEffect(() => {
    let active = true
    api<SessionDto>('/auth/me')
      .catch((err: unknown) => {
        // A stale preview (account removed) must not keep the admin out of the app.
        if (!getViewAsId()) throw err
        setViewAsId(null)
        return api<SessionDto>('/auth/me')
      })
      .then((s) => {
        if (!active) return
        apply(s)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setViewing(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [apply])

  // Session revoked/expired/disabled while using the app → back to login (route guards redirect).
  useEffect(
    () =>
      onSessionLost(() => {
        queryClient.clear()
        setViewAsId(null)
        setUser(null)
        setViewing(null)
        setStatus('anonymous')
      }),
    [queryClient],
  )

  const login = useCallback(async (input: LoginInput) => {
    queryClient.clear()
    setViewAsId(null)
    const s = await api<SessionDto>('/auth/login', { method: 'POST', body: input })
    apply(s)
    setStatus('authenticated')
    return s.user
  }, [queryClient, apply])

  const recoverAdmin = useCallback(async (input: RecoverAdminPasswordInput) => {
    queryClient.clear()
    setViewAsId(null)
    const s = await api<SessionDto>('/auth/recover-admin', { method: 'POST', body: input })
    apply(s)
    setStatus('authenticated')
    return s.user
  }, [queryClient, apply])

  const logout = useCallback(async () => {
    setViewAsId(null)
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      queryClient.clear()
      setUser(null)
      setViewing(null)
      setStatus('anonymous')
    }
  }, [queryClient])

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const s = await api<SessionDto>('/auth/change-password', { method: 'POST', body: input })
    setUser(s.user)
    return s.user
  }, [])

  const updateUser = useCallback((next: UserDto) => setUser(next), [])

  const startViewAs = useCallback(async (userId: string) => {
    // The start request is an admin request, so it must not carry the previous preview.
    setViewAsId(null)
    const s = await api<SessionDto>('/auth/view-as', { method: 'POST', body: { userId } })
    queryClient.clear()
    setViewAsId(userId)
    setUser(s.user)
    setViewing(s.viewingAs ?? null)
    return s.user
  }, [queryClient])

  const stopViewAs = useCallback(async () => {
    setViewAsId(null)
    const s = await api<SessionDto>('/auth/me')
    setUser(s.user)
    setViewing(null)
    // Everything cached so far belongs to the previewed account.
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({ status, user, viewing, login, recoverAdmin, logout, changePassword, updateUser, startViewAs, stopViewAs }),
    [status, user, viewing, login, recoverAdmin, logout, changePassword, updateUser, startViewAs, stopViewAs],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}
