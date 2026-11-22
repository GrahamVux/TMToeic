import { Card } from '@/components/ui/Primitives'
import { Button } from '@/components/ui/Button'
import { XP_PER_CORRECT, XP_PER_RANK, type HonorBoardDto, type HonorCenterEntry, type HonorStudentEntry, type StaffHonorDto } from '@toeic/shared'
import type { ReactNode } from 'react'
import { PodiumMark, RankBadge } from './RankBadge'

export function HonorBoards({ honor }: { honor: HonorBoardDto }) {
  if (!honor.enabled) return null
  const rank = honor.me.rank
  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Mỗi câu đúng +{XP_PER_CORRECT} EXP • mỗi {XP_PER_RANK} EXP lên một hạng</p>
        <h2 className="serif mt-1 text-2xl">Bảng vinh danh năm</h2>
        <p className="mt-1 text-sm text-ink/60">
          Cả bảng lớp và bảng trung tâm tính theo năm {honor.year}, về 0 vào ngày 1 tháng 1.
          {honor.className ? ` Lớp của bạn: ${honor.className}.` : ' Bạn chưa được xếp lớp.'}
        </p>
      </header>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <RankBadge rank={rank} size={48} />
        <p className="text-sm text-ink/70">
          {honor.me.yearlyXp} EXP trong năm
          {rank.toNext !== null ? ` • còn ${rank.toNext} EXP để lên hạng` : ' • hạng cao nhất'}
          {honor.me.weeklyXp > 0 ? ` • ${honor.me.weeklyXp} EXP tuần này` : ''}
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Board
          title="Vinh danh trong lớp"
          hint={classHint(honor.className, honor.year, honor.classBoard.resetAt)}
        >
          {!honor.className ? <Empty text="Khi được xếp vào một lớp, bạn sẽ thấy bảng của lớp đó." /> : null}
          {honor.className && honor.classBoard.entries.length === 0 ? <Empty text={classEmpty(honor.classBoard.resetAt)} /> : null}
          <ul className="space-y-3">
            {honor.classBoard.entries.map((row) => (
              <StudentRow key={row.place} row={row} xpLabel={honor.classBoard.resetAt ? 'từ lần reset' : 'trong năm'} />
            ))}
            {honor.classBoard.you && !honor.classBoard.entries.some((row) => row.you) ? (
              <>
                <li className="text-center text-xs text-ink/40" aria-hidden="true">⋯</li>
                <StudentRow row={honor.classBoard.you} xpLabel={honor.classBoard.resetAt ? 'từ lần reset' : 'trong năm'} />
              </>
            ) : null}
          </ul>
        </Board>

        <Board title="Vinh danh trong trung tâm" hint={`Xếp học viên của mọi lớp theo EXP năm ${honor.year}.`}>
          {honor.centerBoard.length === 0 ? <Empty text="Năm nay chưa có học viên nào hoàn thành bài." /> : null}
          <ul className="space-y-3">
            {honor.centerBoard.map((row) => (
              <CenterRow key={`${row.className}-${row.place}`} row={row} />
            ))}
          </ul>
        </Board>
      </div>
    </section>
  )
}

function Board({ title, hint, action, children }: { title: string; hint: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="serif text-xl">{title}</h3>
          <p className="mt-1 text-xs text-ink/55">{hint}</p>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-paper p-4 text-sm text-ink/60">{text}</p>
}

function StudentRow({ row, xpLabel = 'trong năm' }: { row: HonorStudentEntry; xpLabel?: string }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${row.you ? 'bg-gold/15' : 'bg-paper'}`}>
      <div className="flex min-w-0 items-center gap-3">
        {row.place <= 3 ? <PodiumMark place={row.place} /> : <span className="w-8 text-center text-sm font-semibold text-ink/45">{row.place}</span>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.name}{row.you ? ' (Bạn)' : ''}</p>
          <p className="text-xs text-ink/55">{row.yearlyXp} EXP {xpLabel} • {row.rank.label}</p>
        </div>
      </div>
      <RankBadge rank={row.rank} size={28} />
    </li>
  )
}

function classHint(className: string | null, year: number, resetAt: string | null) {
  if (!className) return 'Chưa có lớp'
  if (resetAt) return `Chỉ học viên ${className}. EXP tính từ lần reset ${resetWhen(resetAt)}.`
  return `Chỉ học viên ${className}. Xếp theo EXP năm ${year}.`
}

function classEmpty(resetAt: string | null) {
  return resetAt ? 'Chưa ai trong lớp hoàn thành bài kể từ lần reset.' : 'Năm nay chưa ai trong lớp hoàn thành bài.'
}

function resetWhen(iso: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export function StaffHonorBoards({
  honor,
  canReset = false,
  resettingId = null,
  onReset,
}: {
  honor: StaffHonorDto
  canReset?: boolean
  resettingId?: string | null
  onReset?: (classId: string, className: string) => void
}) {
  if (!honor.enabled) {
    return <p className="rounded-2xl bg-paper p-4 text-sm text-ink/60">Bảng vinh danh đang tắt.</p>
  }
  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-gold-deep uppercase">Mỗi câu đúng +{XP_PER_CORRECT} EXP • mỗi {XP_PER_RANK} EXP lên một hạng</p>
        <h2 className="serif mt-1 text-2xl">Bảng xếp hạng năm</h2>
        <p className="mt-1 text-sm text-ink/60">
          Mọi bảng tính theo năm {honor.year} và về 0 vào ngày 1 tháng 1.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        {honor.classes.length === 0 ? (
          <Board title="Vinh danh trong lớp" hint="Lớp bạn được giao">
            <Empty text="Bạn chưa được giao lớp nào. Bảng xếp hạng tổng vẫn hiện bên cạnh." />
          </Board>
        ) : (
          honor.classes.map((room) => (
            <Board
              key={room.classId}
              title={room.className}
              hint={room.resetAt ? `${room.participants} học viên có EXP từ lần reset ${resetWhen(room.resetAt)}.` : `${room.participants} học viên có EXP trong năm ${honor.year}.`}
              action={canReset ? (
                <Button type="button" variant="navy" className="shrink-0 px-3 py-1 text-xs" disabled={resettingId === room.classId} onClick={() => onReset?.(room.classId, room.className)}>
                  {resettingId === room.classId ? 'Đang reset…' : 'Reset bảng'}
                </Button>
              ) : null}
            >
              {room.entries.length === 0 ? <Empty text={classEmpty(room.resetAt)} /> : null}
              <ul className="space-y-3">
                {room.entries.map((row) => (
                  <StudentRow key={row.place} row={row} xpLabel={room.resetAt ? 'từ lần reset' : 'trong năm'} />
                ))}
              </ul>
            </Board>
          ))
        )}
        <Board title="Bảng xếp hạng tổng" hint={`Xếp học viên của mọi lớp theo EXP năm ${honor.year}.`}>
          {honor.centerBoard.length === 0 ? <Empty text="Năm nay chưa có học viên nào hoàn thành bài." /> : null}
          <ul className="space-y-3">
            {honor.centerBoard.map((row) => (
              <CenterRow key={`${row.className}-${row.place}`} row={row} />
            ))}
          </ul>
        </Board>
      </div>
    </section>
  )
}

function CenterRow({ row }: { row: HonorCenterEntry }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${row.you || row.yours ? 'bg-button-soft' : 'bg-paper'}`}>
      <div className="flex min-w-0 items-center gap-3">
        {row.place <= 3 ? <PodiumMark place={row.place} /> : <span className="w-8 text-center text-sm font-semibold text-ink/45">{row.place}</span>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.name}{row.you ? ' (Bạn)' : ''}</p>
          <p className="text-xs text-ink/55">{row.className} • {row.yearlyXp} EXP trong năm • {row.rank.label}</p>
        </div>
      </div>
      <RankBadge rank={row.rank} size={28} />
    </li>
  )
}
