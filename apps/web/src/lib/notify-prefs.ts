import { useAuth } from '@/app/AuthContext'
import { useSyncExternalStore } from 'react'

export const NOTIFY_KINDS = ['overdue', 'dueSoon', 'inProgress', 'vocab'] as const
export type NotifyKind = (typeof NOTIFY_KINDS)[number]
export type NotifyPrefs = Record<NotifyKind, boolean>

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  overdue: true,
  dueSoon: true,
  inProgress: true,
  vocab: true,
}

const PREFIX = 'toeic.notify.prefs.'

type CacheEntry = { raw: string | null; prefs: NotifyPrefs }
const cache = new Map<string, CacheEntry>()
const listeners = new Map<string, Set<() => void>>()

function storageKey(userId: string) {
  return PREFIX + userId
}

function parse(raw: string | null): NotifyPrefs {
  if (!raw) return { ...DEFAULT_NOTIFY_PREFS }
  try {
    const data = JSON.parse(raw) as Partial<Record<NotifyKind, unknown>>
    const prefs = { ...DEFAULT_NOTIFY_PREFS }
    for (const kind of NOTIFY_KINDS) {
      if (typeof data[kind] === 'boolean') prefs[kind] = data[kind]
    }
    return prefs
  } catch {
    return { ...DEFAULT_NOTIFY_PREFS }
  }
}

function read(userId: string): NotifyPrefs {
  const key = storageKey(userId)
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.prefs
  const prefs = parse(raw)
  cache.set(key, { raw, prefs })
  return prefs
}

function emit(userId: string) {
  listeners.get(userId)?.forEach((fn) => fn())
}

let storageBound = false
function bindStorage() {
  if (storageBound || typeof window === 'undefined') return
  storageBound = true
  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(PREFIX)) return
    cache.delete(event.key)
    emit(event.key.slice(PREFIX.length))
  })
}

export function writeNotifyPrefs(userId: string, prefs: NotifyPrefs) {
  const key = storageKey(userId)
  const raw = JSON.stringify(prefs)
  localStorage.setItem(key, raw)
  cache.set(key, { raw, prefs })
  emit(userId)
}

export function subscribeNotifyPrefs(userId: string, onChange: () => void) {
  bindStorage()
  let set = listeners.get(userId)
  if (!set) {
    set = new Set()
    listeners.set(userId, set)
  }
  set.add(onChange)
  return () => set.delete(onChange)
}

/** Per-student switches for the header bell. Defaults stay on until the student turns a kind off. */
export function useNotifyPrefs() {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const prefs = useSyncExternalStore(
    (onChange) => subscribeNotifyPrefs(userId, onChange),
    () => read(userId),
    () => DEFAULT_NOTIFY_PREFS,
  )
  function setPrefs(next: NotifyPrefs) {
    if (!userId) return
    writeNotifyPrefs(userId, next)
  }
  return [prefs, setPrefs] as const
}
