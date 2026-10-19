import { api, ApiError } from '@/lib/api'
import { ERROR_CODES } from '@toeic/shared'

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'
export type AutosaveSnapshot = {
  answers: Readonly<Record<string, string | null>>
  /** Number of answers not yet confirmed by the server. */
  pending: number
  status: SaveStatus
}

type Key = string | null

const RETRY_BASE_MS = 1500
const RETRY_MAX_MS = 10_000

/**
 * Per-attempt autosave queue (an external store for `useSyncExternalStore`).
 *
 * - The UI updates instantly (optimistic); the server copy is the source of truth on resume.
 * - One request in flight per question; later picks replace the queued value, so a slow
 *   earlier request can never overwrite a newer answer.
 * - Network/5xx failures retry with backoff; nothing is dropped until the attempt closes.
 */
export class AutosaveStore {
  private snapshot: AutosaveSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly saved = new Map<string, Key>()
  private readonly desired = new Map<string, Key>()
  private readonly spent = new Map<string, number>()
  private viewing: { id: string; since: number } | null = null
  private readonly inflight = new Set<string>()
  private readonly retries = new Map<string, number>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private disposed = false
  private hardError = false
  private offline = false
  private closed = false
  private readonly attemptId: string
  private readonly onClosed: () => void
  private readonly textIds: ReadonlySet<string>
  private readonly textTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(attemptId: string, initial: Record<string, string | null>, onClosed: () => void, textIds: ReadonlySet<string> = new Set()) {
    this.attemptId = attemptId
    this.onClosed = onClosed
    this.textIds = textIds
    for (const [id, key] of Object.entries(initial)) this.saved.set(id, key)
    this.snapshot = { answers: { ...initial }, pending: 0, status: 'saved' }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  /** Call when a question becomes the visible one; accumulates time-on-question for analytics. */
  enter(questionId: string) {
    this.leave()
    this.viewing = { id: questionId, since: Date.now() }
  }

  leave() {
    if (!this.viewing) return
    const { id, since } = this.viewing
    this.spent.set(id, (this.spent.get(id) ?? 0) + (Date.now() - since) / 1000)
    this.viewing = null
  }

  private timeSpent(questionId: string) {
    const live = this.viewing?.id === questionId ? (Date.now() - this.viewing.since) / 1000 : 0
    return Math.min(3600, Math.round((this.spent.get(questionId) ?? 0) + live))
  }

  select(questionId: string, key: Key) {
    if (this.closed) return
    this.desired.set(questionId, key)
    this.hardError = false
    this.publish()
    void this.sync(questionId)
  }

  /** Cloze answers wait a moment so each keystroke is not its own request. */
  typeText(questionId: string, value: string) {
    if (this.closed) return
    this.desired.set(questionId, value.trim() ? value : null)
    this.hardError = false
    this.publish()
    const previous = this.textTimers.get(questionId)
    if (previous) {
      clearTimeout(previous)
      this.timers.delete(previous)
    }
    const timer = setTimeout(() => {
      this.textTimers.delete(questionId)
      this.timers.delete(timer)
      void this.sync(questionId)
    }, 400)
    this.textTimers.set(questionId, timer)
    this.timers.add(timer)
  }

  /** Resolves true when everything has been confirmed by the server (or false on timeout / closed attempt). */
  async flush(timeoutMs = 15_000): Promise<boolean> {
    for (const [id, timer] of this.textTimers) {
      clearTimeout(timer)
      this.timers.delete(timer)
      void this.sync(id)
    }
    this.textTimers.clear()
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (this.closed) return false
      if (this.dirtyIds().length === 0 && this.inflight.size === 0) return true
      if (Date.now() > deadline) return false
      for (const id of this.dirtyIds()) void this.sync(id)
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  activate() {
    this.disposed = false
  }

  dispose() {
    this.leave()
    this.disposed = true
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    this.listeners.clear()
  }

  private dirtyIds() {
    const ids: string[] = []
    for (const [id, key] of this.desired) if (this.saved.get(id) !== key) ids.push(id)
    return ids
  }

  private publish() {
    if (this.disposed) return
    const answers: Record<string, Key> = { ...this.snapshot.answers }
    for (const [id, key] of this.desired) answers[id] = key
    const pending = this.dirtyIds().length
    const status: SaveStatus = this.hardError ? 'error' : this.offline ? 'offline' : pending > 0 ? 'saving' : 'saved'
    this.snapshot = { answers, pending, status }
    for (const l of this.listeners) l()
  }

  private async sync(questionId: string): Promise<void> {
    if (this.disposed || this.closed || this.inflight.has(questionId)) return
    const wanted = this.desired.get(questionId)
    if (wanted === undefined || this.saved.get(questionId) === wanted) return

    this.inflight.add(questionId)
    try {
      await api(`/attempts/${this.attemptId}/answers/${questionId}`, {
        method: 'PUT',
        body: this.textIds.has(questionId)
          ? { answerText: wanted, timeSpentSeconds: this.timeSpent(questionId) }
          : { selectedKey: wanted, timeSpentSeconds: this.timeSpent(questionId) },
      })
      this.saved.set(questionId, wanted)
      this.retries.delete(questionId)
      this.offline = false
    } catch (err) {
      this.inflight.delete(questionId)
      if (err instanceof ApiError && err.code === ERROR_CODES.ATTEMPT_CLOSED) {
        this.closed = true
        this.publish()
        this.onClosed()
        return
      }
      const transient = err instanceof ApiError ? err.status === 0 || err.status >= 500 || err.status === 429 : true
      if (transient) {
        this.offline = true
        this.publish()
        this.scheduleRetry(questionId)
      } else {
        // 401 is handled globally (session lost); any other 4xx will not succeed by retrying.
        this.hardError = true
        this.saved.set(questionId, wanted)
        this.publish()
      }
      return
    }
    this.inflight.delete(questionId)
    this.publish()
    // A newer pick may have arrived while the request was in flight.
    void this.sync(questionId)
  }

  private scheduleRetry(questionId: string) {
    const n = (this.retries.get(questionId) ?? 0) + 1
    this.retries.set(questionId, n)
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (n - 1))
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      void this.sync(questionId)
    }, delay)
    this.timers.add(timer)
  }
}
