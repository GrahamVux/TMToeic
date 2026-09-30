import type { ChangePasswordInput, LoginInput, SessionDto, UserDto } from '@toeic/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, onSessionLost } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

type Status = 'loading' | 'authenticated' | 'anonymous'

type AuthState = {
  status: Status
  user: UserDto | null
  login: (input: LoginInput) => Promise<UserDto>
  logout: () => Promise<void>
  changePassword: (input: ChangePasswordInput) => Promise<UserDto>
  /** Replace the cached user after the server returned a fresh copy (e.g. goal changed). */
  updateUser: (user: UserDto) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const queryClient = useQueryClient()

  // Restore the session from the HttpOnly cookie on page load (api() transparently refreshes an expired access token).
  useEffect(() => {
    let active = true
    api<SessionDto>('/auth/me')
      .then((s) => {
        if (!active) return
        setUser(s.user)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [])

  // Session revoked/expired/disabled while using the app → back to login (route guards redirect).
  useEffect(
    () =>
      onSessionLost(() => {
        queryClient.clear()
        setUser(null)
        setStatus('anonymous')
      }),
    [queryClient],
  )

  const login = useCallback(async (input: LoginInput) => {
    queryClient.clear()
    const s = await api<SessionDto>('/auth/login', { method: 'POST', body: input })
    setUser(s.user)
    setStatus('authenticated')
    return s.user
  }, [queryClient])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      queryClient.clear()
      setUser(null)
      setStatus('anonymous')
    }
  }, [queryClient])

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const s = await api<SessionDto>('/auth/change-password', { method: 'POST', body: input })
    setUser(s.user)
    return s.user
  }, [])

  const updateUser = useCallback((next: UserDto) => setUser(next), [])

  const value = useMemo<AuthState>(() => ({ status, user, login, logout, changePassword, updateUser }), [status, user, login, logout, changePassword, updateUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}
