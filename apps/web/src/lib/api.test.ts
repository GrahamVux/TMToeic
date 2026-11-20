import { describe, expect, it } from 'vitest'
import { resolveApiBase } from './api'

describe('resolveApiBase', () => {
  it('stays same-origin for local and an explicit relative base', () => {
    expect(resolveApiBase(undefined, 'localhost')).toBe('/api/v1')
    expect(resolveApiBase('', 'localhost')).toBe('/api/v1')
    expect(resolveApiBase('/api/v1/', 'toeic-prod.pages.dev')).toBe('/api/v1')
  })

  it('calls Render directly from the production Pages host', () => {
    expect(resolveApiBase(undefined, 'toeic-prod.pages.dev')).toBe('https://toeic-api-prod.onrender.com/api/v1')
    expect(resolveApiBase(undefined, 'abc.toeic-prod.pages.dev')).toBe('https://toeic-api-prod.onrender.com/api/v1')
    expect(resolveApiBase(undefined, 'toeic.vercel.app')).toBe('/api/v1')
  })

  it('honours an absolute override', () => {
    expect(resolveApiBase('https://toeic-api-dev.onrender.com/api/v1/', 'toeic-prod.pages.dev')).toBe('https://toeic-api-dev.onrender.com/api/v1')
  })
})
