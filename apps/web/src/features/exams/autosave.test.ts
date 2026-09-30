import { ApiError, api } from '@/lib/api'
import { ERROR_CODES } from '@toeic/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutosaveStore } from './autosave'

vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), api: vi.fn() }))
const apiMock = vi.mocked(api)

type Deferred = { resolve: () => void; reject: (e: unknown) => void }
/** Makes each api() call hang until the test settles it, so ordering/concurrency can be asserted. */
function manual() {
  const calls: Array<{ path: string; body: { selectedKey: string | null }; d: Deferred }> = []
  const impl = (...args: unknown[]) => {
    const [path, opts] = args as [string, { body: { selectedKey: string | null } }]
    return new Promise<void>((resolve, reject) => {
      calls.push({ path, body: opts.body, d: { resolve, reject } })
    })
  }
  apiMock.mockImplementation(impl as never)
  return calls
}
const tick = () => new Promise((r) => setTimeout(r, 0))

describe('AutosaveStore', () => {
  // Braces matter: returning the mock from a hook would make vitest call it as a teardown function.
  beforeEach(() => {
    apiMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the pick immediately and confirms it after the server accepts it', async () => {
    const calls = manual()
    const store = new AutosaveStore('a1', { q1: null }, vi.fn())
    store.select('q1', 'B')
    expect(store.getSnapshot()).toMatchObject({ answers: { q1: 'B' }, pending: 1, status: 'saving' })
    expect(calls[0].path).toBe('/attempts/a1/answers/q1')
    calls[0].d.resolve()
    await tick()
    expect(store.getSnapshot()).toMatchObject({ pending: 0, status: 'saved' })
  })

  it('keeps one request in flight per question and never lets an older pick overwrite a newer one', async () => {
    const calls = manual()
    const store = new AutosaveStore('a1', { q1: null }, vi.fn())
    store.select('q1', 'A')
    store.select('q1', 'B')
    store.select('q1', 'C')
    expect(calls).toHaveLength(1) // A is in flight; B and C are coalesced
    calls[0].d.resolve()
    await tick()
    expect(calls).toHaveLength(2)
    expect(calls[1].body.selectedKey).toBe('C') // B was skipped, latest wins
    calls[1].d.resolve()
    await tick()
    expect(store.getSnapshot()).toMatchObject({ answers: { q1: 'C' }, pending: 0, status: 'saved' })
  })

  it('sends different questions in parallel', () => {
    const calls = manual()
    const store = new AutosaveStore('a1', {}, vi.fn())
    store.select('q1', 'A')
    store.select('q2', 'D')
    expect(calls.map((c) => c.path)).toEqual(['/attempts/a1/answers/q1', '/attempts/a1/answers/q2'])
  })

  it('does not call the server when the pick equals the saved value', async () => {
    const calls = manual()
    const store = new AutosaveStore('a1', { q1: 'A' }, vi.fn())
    store.select('q1', 'A')
    await tick()
    expect(calls).toHaveLength(0)
    expect(store.getSnapshot().status).toBe('saved')
  })

  it('supports clearing an answer (null)', async () => {
    const calls = manual()
    const store = new AutosaveStore('a1', { q1: 'A' }, vi.fn())
    store.select('q1', null)
    expect(calls[0].body.selectedKey).toBeNull()
    calls[0].d.resolve()
    await tick()
    expect(store.getSnapshot().answers.q1).toBeNull()
  })

  it('retries network failures with backoff and recovers without losing the answer', async () => {
    vi.useFakeTimers()
    apiMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline')).mockRejectedValueOnce(new ApiError(503, ERROR_CODES.INTERNAL, 'down')).mockResolvedValue(undefined as never)
    const store = new AutosaveStore('a1', {}, vi.fn())
    store.select('q1', 'B')
    await vi.advanceTimersByTimeAsync(0)
    expect(store.getSnapshot()).toMatchObject({ status: 'offline', pending: 1, answers: { q1: 'B' } })
    await vi.advanceTimersByTimeAsync(1500) // 1st retry → fails again
    expect(apiMock).toHaveBeenCalledTimes(2)
    expect(store.getSnapshot().status).toBe('offline')
    await vi.advanceTimersByTimeAsync(3000) // 2nd retry (backoff doubled) → succeeds
    expect(apiMock).toHaveBeenCalledTimes(3)
    expect(store.getSnapshot()).toMatchObject({ status: 'saved', pending: 0 })
  })

  it('stops and reports when the attempt has closed (deadline/submitted elsewhere)', async () => {
    const onClosed = vi.fn()
    apiMock.mockRejectedValue(new ApiError(409, ERROR_CODES.ATTEMPT_CLOSED, 'closed'))
    const store = new AutosaveStore('a1', {}, onClosed)
    store.select('q1', 'A')
    await tick()
    expect(onClosed).toHaveBeenCalledTimes(1)
    store.select('q1', 'B') // ignored after close
    await tick()
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(await store.flush(50)).toBe(false)
  })

  it('does not retry permanent client errors forever and surfaces an error state', async () => {
    apiMock.mockRejectedValue(new ApiError(400, ERROR_CODES.VALIDATION_FAILED, 'bad'))
    const store = new AutosaveStore('a1', {}, vi.fn())
    store.select('q1', 'A')
    await tick()
    expect(store.getSnapshot().status).toBe('error')
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(await store.flush(500)).toBe(true) // must not hang the submit button
  })

  it('flush waits for in-flight saves, and times out while the network is down', async () => {
    const calls = manual()
    const store = new AutosaveStore('a1', {}, vi.fn())
    store.select('q1', 'A')
    let done = false
    const p = store.flush(5000).then((ok) => {
      done = ok
      return ok
    })
    await new Promise((r) => setTimeout(r, 200))
    expect(done).toBe(false)
    calls[0].d.resolve()
    expect(await p).toBe(true)

    apiMock.mockReset()
    apiMock.mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'))
    const offline = new AutosaveStore('a2', {}, vi.fn())
    offline.select('q1', 'A')
    expect(await offline.flush(400)).toBe(false)
    offline.dispose()
  })

  it('reports time spent on the question being viewed', async () => {
    vi.useFakeTimers()
    const calls = manual()
    const store = new AutosaveStore('a1', {}, vi.fn())
    store.enter('q1')
    vi.setSystemTime(Date.now() + 12_000)
    store.select('q1', 'A')
    expect(calls[0].body).toMatchObject({ selectedKey: 'A', timeSpentSeconds: 12 })
  })
})
