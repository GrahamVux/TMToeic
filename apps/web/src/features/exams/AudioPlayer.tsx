import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { AttemptAudioDto, AudioTrackDto, ExamMode } from '@toeic/shared'
import { Headphones, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { audioControls, MAX_AUDIO_REFRESHES, PLAYBACK_RATES, trackForPart } from './audio'
import { formatClock } from './exams.queries'

type Props = {
  attemptId: string
  tracks: AudioTrackDto[]
  /** Part of the question on screen; decides which recording's controls are shown. */
  partCode: string
  mode: ExamMode | 'REVIEW'
}

/**
 * One `<audio>` element per recording, all kept mounted so the position survives moving between questions.
 * Only the recording covering the current part is visible; leaving it pauses playback.
 */
export function AudioPlayer({ attemptId, tracks, partCode, mode }: Props) {
  const current = trackForPart(tracks, partCode)
  const [urls, setUrls] = useState<Record<string, string>>({})

  // Signed URLs expire; ask the server for fresh ones (same ownership checks as the player payload).
  const refreshUrls = useCallback(async () => {
    const fresh = await api<AttemptAudioDto>(`/attempts/${attemptId}/audio`)
    setUrls(Object.fromEntries(fresh.audio.map((t) => [t.id, t.url])))
  }, [attemptId])

  return (
    <>
      {tracks.map((t) => (
        <TrackAudio key={t.id} track={t} url={urls[t.id] ?? t.url} active={current?.id === t.id} mode={mode} refreshUrls={refreshUrls} />
      ))}
    </>
  )
}

function TrackAudio({
  track,
  url,
  active,
  mode,
  refreshUrls,
}: {
  track: AudioTrackDto
  url: string
  active: boolean
  mode: ExamMode | 'REVIEW'
  refreshUrls: () => Promise<void>
}) {
  const { seekable, speedControl } = audioControls(mode)
  const ref = useRef<HTMLAudioElement>(null)
  const resume = useRef<{ at: number; play: boolean } | null>(null)
  const refreshes = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState<number>(1)
  const [failed, setFailed] = useState(false)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!active) ref.current?.pause()
  }, [active])

  function toggle() {
    const el = ref.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setFailed(true))
    else el.pause()
  }

  async function onError() {
    const el = ref.current
    if (!el || recovering) return
    if (refreshes.current >= MAX_AUDIO_REFRESHES) {
      setFailed(true)
      return
    }
    refreshes.current += 1
    resume.current = { at: el.currentTime, play: !el.paused || playing }
    setRecovering(true)
    try {
      await refreshUrls()
    } catch {
      setFailed(true)
    } finally {
      setRecovering(false)
    }
  }

  function onLoadedMetadata() {
    const el = ref.current
    if (!el) return
    setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    el.playbackRate = rate
    const r = resume.current
    if (r) {
      resume.current = null
      el.currentTime = r.at
      if (r.play) void el.play().catch(() => undefined)
    }
    setFailed(false)
  }

  const remaining = Math.max(0, duration - time)

  return (
    <>
      <audio
        ref={ref}
        src={url}
        preload={active ? 'auto' : 'none'}
        onPlay={(e) => {
          setPlaying(true)
          // One recording at a time (the review screen can show several players).
          document.querySelectorAll('audio').forEach((other) => {
            if (other !== e.currentTarget) other.pause()
          })
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={onLoadedMetadata}
        onError={() => void onError()}
      />
      {active ? (
        <div className="rounded-2xl bg-teal-soft px-4 py-3" role="group" aria-label="Trình phát audio">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={toggle}
              disabled={failed}
              aria-label={playing ? 'Tạm dừng' : 'Phát audio'}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-button text-button-ink transition hover:bg-button-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50 disabled:opacity-40"
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <div className="order-last w-full sm:order-none sm:min-w-0 sm:flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-teal uppercase">
                <Headphones className="size-4" /> Listening • {track.label}
              </p>
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.min(Math.floor(time), Math.max(1, Math.floor(duration)))}
                disabled={!seekable || failed || duration === 0}
                onChange={(e) => {
                  const el = ref.current
                  if (el) el.currentTime = Number(e.target.value)
                }}
                aria-label="Vị trí audio"
                className={cn(
                  'mt-1 h-1.5 w-full rounded accent-gold-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50',
                  !seekable && 'cursor-not-allowed opacity-70',
                )}
              />
            </div>
            <span className="font-mono text-xs text-ink-soft tabular-nums" aria-label="Thời gian">
              {formatClock(time)} / {duration ? formatClock(duration) : '--:--'}
            </span>
            {speedControl ? (
              <select
                aria-label="Tốc độ phát"
                value={rate}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setRate(next)
                  if (ref.current) ref.current.playbackRate = next
                }}
                className="min-h-10 rounded-lg border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-button/50"
              >
                {PLAYBACK_RATES.map((r) => (
                  <option key={r} value={r}>{r}x</option>
                ))}
              </select>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-ink-soft" role="status" aria-live="polite">
            {failed
              ? 'Không phát được audio (link hết hạn hoặc mất kết nối). Hãy tải lại trang rồi thử lại — đáp án của bạn vẫn được lưu.'
              : recovering
                ? 'Đang kết nối lại audio…'
                : !seekable
                  ? 'Chế độ thi thử: audio phát liền mạch, không tua lại hay đổi tốc độ. Bấm ▶ để bắt đầu nghe.'
                  : playing || time > 0
                    ? duration ? `Còn ${formatClock(remaining)}` : ''
                    : 'Bấm ▶ để bắt đầu nghe.'}
          </p>
        </div>
      ) : null}
    </>
  )
}
