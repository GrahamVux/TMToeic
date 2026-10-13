import { api } from '@/lib/api'
import { useEffect, useState, useSyncExternalStore } from 'react'

const NOTICE = 'Bạn vừa rời màn hình. Lần này đã được ghi lại.'

type Snapshot = { notice: string | null }

/**
 * Folds tab-hide and window-blur into one absence so a single Alt-Tab is not counted twice.
 * Posts are queued: `back` never overtakes the `away` that opened the same absence.
 */
export class FocusGuard {
  private open = false
  private chain: Promise<void> = Promise.resolve()
  private snapshot: Snapshot = { notice: null }
  private listeners = new Set<() => void>()
  private readonly post: (state: 'away' | 'back') => Promise<{ recorded: boolean }>

  constructor(post: (state: 'away' | 'back') => Promise<{ recorded: boolean }>) {
    this.post = post
  }

  getSnapshot = () => this.snapshot

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dismiss = () => {
    if (!this.snapshot.notice) return
    this.snapshot = { notice: null }
    this.emit()
  }

  /** `away` when the tab is hidden or the window has lost focus. */
  setAway(away: boolean) {
    if (away) {
      if (this.open) return
      this.open = true
      this.enqueue('away')
      return
    }
    if (!this.open) return
    this.open = false
    this.enqueue('back')
  }

  /** Close an open absence when the player unmounts, without showing the student banner. */
  dispose() {
    if (!this.open) return
    this.open = false
    this.enqueue('back', true)
  }

  /** Resolves when the queued posts have finished. Tests use this. */
  idle(): Promise<void> {
    return this.chain
  }

  private enqueue(state: 'away' | 'back', silent = false) {
    this.chain = this.chain
      .then(async () => {
        const res = await this.post(state)
        if (!silent && state === 'back' && res.recorded) {
          this.snapshot = { notice: NOTICE }
          this.emit()
        }
      })
      .catch(() => undefined)
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

export function useFocusGuard(attemptId: string, enabled: boolean) {
  const [guard] = useState(
    () =>
      new FocusGuard((state) => api<{ recorded: boolean }>(`/attempts/${attemptId}/focus`, { method: 'POST', body: { state } })),
  )
  const snap = useSyncExternalStore(guard.subscribe, guard.getSnapshot)
  useEffect(() => {
    if (!enabled) return
    const sync = () => guard.setAway(document.visibilityState === 'hidden' || !document.hasFocus())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('blur', sync)
    window.addEventListener('focus', sync)
    sync()
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('blur', sync)
      window.removeEventListener('focus', sync)
      guard.dispose()
    }
  }, [enabled, guard])
  return { notice: snap.notice, dismiss: guard.dismiss }
}
