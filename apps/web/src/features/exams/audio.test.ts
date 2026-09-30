import type { AudioTrackDto } from '@toeic/shared'
import { describe, expect, it } from 'vitest'
import { audioControls, trackForPart } from './audio'

const track = (id: string, partCodes: string[]): AudioTrackDto => ({ id, label: id, partCodes, url: `https://r2/${id}`, expiresAt: '2030-01-01T00:00:00Z' })

describe('trackForPart', () => {
  const tracks = [track('a', ['PART_1', 'PART_2']), track('b', ['PART_3'])]

  it('finds the recording covering a part', () => {
    expect(trackForPart(tracks, 'PART_2')?.id).toBe('a')
    expect(trackForPart(tracks, 'PART_3')?.id).toBe('b')
  })

  it('returns undefined for Reading parts or uncovered Listening parts', () => {
    expect(trackForPart(tracks, 'PART_5')).toBeUndefined()
    expect(trackForPart([], 'PART_1')).toBeUndefined()
  })
})

describe('audioControls', () => {
  it('locks seeking and speed only under full-test conditions', () => {
    expect(audioControls('FULL_TEST')).toEqual({ seekable: false, speedControl: false })
    for (const mode of ['PRACTICE', 'TIMED', 'PART_DRILL', 'REVIEW'] as const) {
      expect(audioControls(mode)).toEqual({ seekable: true, speedControl: true })
    }
  })
})
