import type { AudioTrackDto, ExamMode } from '@toeic/shared'

/** The recording that covers a part, or undefined (Reading parts, or a Listening part without audio). */
export function trackForPart(tracks: AudioTrackDto[], partCode: string): AudioTrackDto | undefined {
  return tracks.find((t) => t.partCodes.includes(partCode))
}

/**
 * Exam conditions: a real TOEIC recording cannot be rewound or slowed down, so FULL_TEST plays straight through.
 * Practice, timed and part-drill modes keep full controls.
 */
export function audioControls(mode: ExamMode | 'REVIEW'): { seekable: boolean; speedControl: boolean } {
  const examConditions = mode === 'FULL_TEST'
  return { seekable: !examConditions, speedControl: !examConditions }
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const

/** After a media error (usually an expired signed URL) we ask for fresh URLs a few times before giving up. */
export const MAX_AUDIO_REFRESHES = 3
