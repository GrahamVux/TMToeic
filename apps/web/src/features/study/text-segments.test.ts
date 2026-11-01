import { describe, expect, it } from 'vitest'
import { textSegments } from './text-segments'

describe('textSegments', () => {
  it('wraps a phrase and leaves the rest plain', () => {
    const marks = [{ start: 4, end: 10, id: 'a' }]
    expect(textSegments('The annual report', marks)).toEqual([
      { text: 'The ', mark: null },
      { text: 'annual', mark: marks[0] },
      { text: ' report', mark: null },
    ])
  })

  it('keeps the earlier mark when two ranges overlap', () => {
    const first = { start: 0, end: 3, id: 'a' }
    const second = { start: 2, end: 5, id: 'b' }
    expect(textSegments('abcde', [second, first])).toEqual([
      { text: 'abc', mark: first },
      { text: 'de', mark: null },
    ])
  })
})
