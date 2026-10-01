import { describe, expect, it } from 'vitest'
import { resolveApiBase } from './api'

describe('resolveApiBase', () => {
  it('uses same-origin /api/v1 when unset or pointed at another host', () => {
    expect(resolveApiBase(undefined)).toBe('/api/v1')
    expect(resolveApiBase('')).toBe('/api/v1')
    expect(resolveApiBase('https://toeic-api-2jb7.onrender.com/api/v1')).toBe('/api/v1')
  })

  it('keeps a relative override', () => {
    expect(resolveApiBase('/api/v1/')).toBe('/api/v1')
  })
})
