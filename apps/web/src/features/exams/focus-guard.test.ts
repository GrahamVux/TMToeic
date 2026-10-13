import { describe, expect, it } from 'vitest'
import { FocusGuard } from './focus-guard'

function guardWith(post: (state: 'away' | 'back') => Promise<{ recorded: boolean }>) {
  const posts: Array<'away' | 'back'> = []
  const guard = new FocusGuard(async (state) => {
    posts.push(state)
    return post(state)
  })
  return { guard, posts }
}

describe('FocusGuard', () => {
  it('counts one absence when blur and a later return both fire', async () => {
    const { guard, posts } = guardWith(async (state) => ({ recorded: state === 'back' }))
    guard.setAway(true)
    guard.setAway(true)
    guard.setAway(false)
    await guard.idle()
    expect(posts).toEqual(['away', 'back'])
    expect(guard.getSnapshot().notice).toBe('Bạn vừa rời màn hình. Lần này đã được ghi lại.')
  })

  it('stays quiet when the server drops a short absence', async () => {
    const { guard, posts } = guardWith(async () => ({ recorded: false }))
    guard.setAway(true)
    guard.setAway(false)
    await guard.idle()
    expect(posts).toEqual(['away', 'back'])
    expect(guard.getSnapshot().notice).toBeNull()
  })

  it('sends back after away even if the student returns before the first post finishes', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { guard, posts } = guardWith(async (state) => {
      if (state === 'away') await gate
      return { recorded: true }
    })
    guard.setAway(true)
    guard.setAway(false)
    await Promise.resolve()
    expect(posts).toEqual(['away'])
    release()
    await guard.idle()
    expect(posts).toEqual(['away', 'back'])
    expect(guard.getSnapshot().notice).toContain('rời màn hình')
  })

  it('closes an open absence on dispose without a banner', async () => {
    const { guard, posts } = guardWith(async () => ({ recorded: true }))
    guard.setAway(true)
    await guard.idle()
    guard.dispose()
    await guard.idle()
    expect(posts).toEqual(['away', 'back'])
    expect(guard.getSnapshot().notice).toBeNull()
  })

  it('dismiss clears the banner', async () => {
    const { guard } = guardWith(async (state) => ({ recorded: state === 'back' }))
    guard.setAway(true)
    guard.setAway(false)
    await guard.idle()
    guard.dismiss()
    expect(guard.getSnapshot().notice).toBeNull()
  })
})
