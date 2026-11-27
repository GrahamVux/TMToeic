import { Button } from '@/components/ui/Button'
import { CornerNotice, flashError, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import {
  useClearGrammarPdf,
  useCommitVocab,
  useCreateGrammar,
  useCreateVocabEntry,
  useDeleteGrammar,
  useDeleteVocab,
  useGrammarLessons,
  usePreviewVocab,
  useUpdateVocab,
  useUploadGrammarPdf,
  useVocabCourse,
  useVocabSearch,
  useVocabUnitDetail,
} from '@/features/study/study.queries'
import { ApiError, downloadApiFile } from '@/lib/api'
import { cn } from '@/lib/cn'
import { UNASSIGNED_VOCAB_SET, type GrammarLessonDto, type VocabImportResult, type VocabPreviewRowDto, type VocabUnitWordDto } from '@toeic/shared'
import { Check, FileSpreadsheet, Layers, Plus, Save, Search, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useState } from 'react'

function importMessage(result: VocabImportResult) {
  const created = result.units > 0 ? ` Tạo ${result.units} unit mới.` : ''
  return `Đã đẩy vào DB: ${result.imported} từ mới, cập nhật ${result.updated} từ, bỏ qua ${result.skipped} dòng.${created}`
}

type StagingRow = VocabPreviewRowDto & { key: string }

export function AdminStudyPage() {
  const [tab, setTab] = useState<'staging' | 'browse'>('staging')
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  const lessons = useGrammarLessons()
  const createLesson = useCreateGrammar()
  const removeLesson = useDeleteGrammar()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [grammarNote, setGrammarNote] = useState<string | null>(null)

  if (lessons.isPending) return <PageLoading message="Đang tải học liệu…" />
  if (lessons.error) return <QueryErrorRedirect error={lessons.error} />

  return (
    <div className="space-y-8">
      <CornerNotice notice={notice} />
      <header>
        <p className="text-[13px] font-semibold tracking-[0.06em] text-gold-deep uppercase">Quản lý học liệu</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Từ vựng theo Unit & Ngữ pháp</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Kiểm tra và chỉnh sửa từng từ theo từng Unit ngay trên web trước khi đẩy vào Database, hoặc duyệt sửa trực tiếp kho từ hiện có.
        </p>
      </header>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold/25 pb-4">
          <div className="inline-flex rounded-xl border border-gold/35 bg-paper p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'staging'}
              onClick={() => setTab('staging')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
                tab === 'staging' ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              <UploadCloud className="size-3.5" /> Nhập Excel & Kiểm duyệt
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'browse'}
              onClick={() => setTab('browse')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
                tab === 'browse' ? 'bg-button text-button-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              <Layers className="size-3.5" /> Duyệt & Sửa theo Unit (DB)
            </button>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft px-3.5 py-1.5 text-xs font-semibold text-gold-deep transition hover:opacity-90"
            onClick={() => {
              void downloadApiFile('/study/vocab/template', 'mau-tu-vung.xlsx').catch((error: unknown) => {
                setNotice(flashError(error instanceof ApiError ? error.message : 'Không tải được file mẫu.'))
              })
            }}
          >
            <FileSpreadsheet className="size-3.5" /> Tải file Excel mẫu mới (kèm Câu mẫu)
          </button>
        </div>

        {tab === 'staging' ? (
          <VocabStagingPanel onNotice={setNotice} onSwitchBrowse={() => setTab('browse')} />
        ) : (
          <VocabUnitBrowserPanel onNotice={setNotice} />
        )}
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Chuyên đề ngữ pháp</h2>
        <p className="mt-2 text-sm text-ink-soft">Mỗi chuyên đề gắn được một file PDF. Học viên mở file ngay trong bài học.</p>
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            setGrammarNote(null)
            void createLesson.mutateAsync({ title, summary, body }).then(
              () => {
                setTitle('')
                setSummary('')
                setBody('')
                setNotice(flashNotice('Đã thêm chuyên đề thành công.'))
              },
              (error) => setGrammarNote(error instanceof ApiError ? error.message : 'Không thêm được chuyên đề.'),
            )
          }}
        >
          <input className="h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={title} placeholder="Tên chuyên đề" onChange={(event) => setTitle(event.target.value)} />
          <input className="h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={summary} placeholder="Tóm tắt ngắn" onChange={(event) => setSummary(event.target.value)} />
          <textarea className="min-h-28 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm" value={body} placeholder="Nội dung bài học" onChange={(event) => setBody(event.target.value)} />
          <Button type="submit" disabled={createLesson.isPending}>
            Thêm chuyên đề
          </Button>
          {grammarNote ? <p className="text-sm text-coral" role="alert">{grammarNote}</p> : null}
        </form>
        <ul className="mt-4 space-y-2">
          {(lessons.data ?? []).map((lesson) => (
            <li key={lesson.id} className="rounded-xl bg-paper px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{lesson.title}</p>
                  <p className="text-sm text-ink-soft">{lesson.summary}</p>
                </div>
                <button type="button" className="shrink-0 text-sm font-semibold text-coral underline underline-offset-4" onClick={() => void removeLesson.mutateAsync(lesson.id)}>
                  Xóa chuyên đề
                </button>
              </div>
              <GrammarPdf lesson={lesson} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function VocabStagingPanel({ onNotice, onSwitchBrowse }: { onNotice: (n: CornerNoticeState) => void; onSwitchBrowse: () => void }) {
  const course = useVocabCourse()
  const preview = usePreviewVocab()
  const commit = useCommitVocab()

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [topic, setTopic] = useState('TOEIC Công sở & Kinh doanh')
  const [title, setTitle] = useState('')
  const [setId, setSetId] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<StagingRow[]>([])
  const [skipped, setSkipped] = useState(0)
  const [activeUnit, setActiveUnit] = useState<number | 'all'>('all')
  const [err, setErr] = useState<string | null>(null)

  const namedSets = (course.data?.sets ?? []).filter((s) => s.id !== UNASSIGNED_VOCAB_SET)
  const unitList = [...new Set(rows.map((r) => r.unit))].sort((a, b) => a - b)
  const visibleRows = activeUnit === 'all' ? rows : rows.filter((r) => r.unit === activeUnit)

  function handleFile(files: File[]) {
    const file = files[0]
    if (!file) return
    setErr(null)
    void preview.mutateAsync(file).then(
      (res) => {
        setFileName(file.name)
        if (res.suggestedTopic) setTopic(res.suggestedTopic)
        if (res.suggestedTitle) setTitle(res.suggestedTitle)
        setSkipped(res.skipped)
        setRows(res.rows.map((r, i) => ({ ...r, key: `${Date.now()}-${i}-${Math.random()}` })))
        setActiveUnit('all')
        onNotice(flashNotice(`Đã đọc ${res.rows.length} từ từ file. Kiểm tra/chỉnh sửa bên dưới trước khi đẩy DB.`))
      },
      (e) => setErr(e instanceof ApiError ? e.message : 'Không đọc được file Excel.'),
    )
  }

  function updateRow(key: string, patch: Partial<StagingRow>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addDraftRow() {
    const unit = activeUnit === 'all' ? (unitList[unitList.length - 1] ?? 1) : activeUnit
    setRows((list) => [
      ...list,
      { key: `manual-${Date.now()}-${Math.random()}`, unit, word: '', partOfSpeech: 'noun', meaning: '', example: '', status: 'NEW' },
    ])
  }

  async function pushToDb() {
    setErr(null)
    if (rows.length === 0) {
      setErr('Chưa có dòng từ vựng nào để đẩy vào Database.')
      return
    }
    const invalid = rows.find((r) => !r.word.trim() || !r.partOfSpeech.trim() || !r.meaning.trim())
    if (invalid) {
      setErr('Vẫn còn dòng thiếu Từ vựng, Loại từ hoặc Nghĩa. Vui lòng điền đủ hoặc xóa dòng trống.')
      return
    }
    if (mode === 'new' && (topic.trim().length < 2 || title.trim().length < 2)) {
      setErr('Nhập Chủ đề và Tên bộ từ (tối thiểu 2 ký tự).')
      return
    }
    if (mode === 'existing' && !setId) {
      setErr('Chọn một bộ từ có sẵn để thêm/cập nhật.')
      return
    }
    try {
      const payload =
        mode === 'new'
          ? { mode: 'new' as const, topic: topic.trim(), title: title.trim(), rows }
          : { mode: 'existing' as const, setId, rows }
      const result = await commit.mutateAsync(payload)
      onNotice(flashNotice(importMessage(result)))
      setRows([])
      setFileName(null)
      onSwitchBrowse()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không lưu được vào Database.')
    }
  }

  const newCount = rows.filter((r) => r.status === 'NEW').length
  const updateCount = rows.length - newCount

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={mode === 'new' ? 'rounded-full bg-button px-4 py-1.5 text-xs font-semibold text-button-ink' : 'rounded-full bg-paper-2 px-4 py-1.5 text-xs font-semibold text-ink'}
          onClick={() => setMode('new')}
        >
          Tạo bộ từ mới (hoặc trùng tên để gộp)
        </button>
        <button
          type="button"
          className={mode === 'existing' ? 'rounded-full bg-button px-4 py-1.5 text-xs font-semibold text-button-ink' : 'rounded-full bg-paper-2 px-4 py-1.5 text-xs font-semibold text-ink'}
          onClick={() => setMode('existing')}
        >
          Đẩy vào bộ có sẵn
        </button>
      </div>

      {mode === 'new' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold">Chủ đề</span>
            <input className="mt-1 h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={topic} maxLength={80} placeholder="VD: TOEIC Công sở" onChange={(e) => setTopic(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Tên bộ từ vựng</span>
            <input className="mt-1 h-10 w-full rounded-xl border border-ink/12 px-3 text-sm" value={title} maxLength={120} placeholder="Tự động điền từ dòng Bộ đề trong Excel" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
      ) : (
        <label className="block text-sm">
          <span className="font-semibold">Chọn bộ từ</span>
          <select className="mt-1 h-10 w-full rounded-xl border border-ink/12 bg-cream px-3 text-sm" value={setId} onChange={(e) => setSetId(e.target.value)}>
            <option value="">{namedSets.length === 0 ? 'Chưa có bộ nào' : 'Chọn bộ từ'}</option>
            {namedSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {s.topic} ({s.units.length} Unit)
              </option>
            ))}
          </select>
        </label>
      )}

      <FilePick
        label={preview.isPending ? 'Đang phân tích file Excel…' : 'Tải file Excel (.xlsx) lên Bảng nháp kiểm duyệt'}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        chosen={fileName}
        disabled={preview.isPending}
        hint="Chưa ghi vào Database ngay — bạn có thể xem theo từng Unit, sửa nghĩa/câu mẫu rồi mới bấm Đẩy vào DB."
        onFiles={handleFile}
      />

      {err ? <p className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{err}</p> : null}

      {rows.length > 0 ? (
        <div className="space-y-4 rounded-2xl border border-gold/40 bg-paper p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-ink">
                Bảng nháp kiểm duyệt ({rows.length} từ · {unitList.length} Unit)
              </h3>
              <p className="text-xs text-ink-soft">
                <span className="font-semibold text-olive">{newCount} từ mới</span> ·{' '}
                <span className="font-semibold text-gold-deep">{updateCount} cập nhật nghĩa/câu mẫu</span>
                {skipped > 0 ? ` · bỏ qua ${skipped} dòng lỗi` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="paper" onClick={addDraftRow}>
                <Plus className="size-3.5" /> Thêm dòng
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setRows([]); setFileName(null) }}>
                Xóa bảng nháp
              </Button>
              <Button type="button" disabled={commit.isPending} onClick={() => void pushToDb()}>
                <Check className="size-4" /> {commit.isPending ? 'Đang lưu DB…' : `Đẩy ${rows.length} từ vào Database`}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveUnit('all')}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold', activeUnit === 'all' ? 'bg-button text-button-ink' : 'bg-cream text-ink-soft')}
            >
              Tất cả ({rows.length})
            </button>
            {unitList.map((u) => {
              const count = rows.filter((r) => r.unit === u).length
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setActiveUnit(u)}
                  className={cn('rounded-full px-3 py-1 text-xs font-semibold', activeUnit === u ? 'bg-button text-button-ink' : 'bg-cream text-ink-soft')}
                >
                  Unit {u} ({count})
                </button>
              )
            })}
          </div>

          <div className="max-h-[480px] overflow-auto rounded-xl border border-gold/25 bg-cream">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-paper-2 text-[13px] font-bold text-ink-soft uppercase">
                <tr>
                  <th className="w-20 px-2.5 py-2.5">Unit</th>
                  <th className="w-40 px-2.5 py-2.5">Từ vựng</th>
                  <th className="w-28 px-2.5 py-2.5">Loại từ</th>
                  <th className="w-56 px-2.5 py-2.5">Nghĩa</th>
                  <th className="px-2.5 py-2.5">Câu mẫu</th>
                  <th className="w-20 px-2.5 py-2.5 text-center">Trạng thái</th>
                  <th className="w-12 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/20">
                {visibleRows.map((row) => (
                  <tr key={row.key} className="align-top hover:bg-paper/60">
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={row.unit}
                        onChange={(e) => updateRow(row.key, { unit: Math.max(1, Math.trunc(Number(e.target.value) || 1)) })}
                        className="h-8 w-16 rounded-lg border border-gold/35 px-2 text-center font-semibold"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.word}
                        onChange={(e) => updateRow(row.key, { word: e.target.value })}
                        className="h-8 w-full rounded-lg border border-gold/35 px-2 font-semibold"
                        placeholder="word"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.partOfSpeech}
                        onChange={(e) => updateRow(row.key, { partOfSpeech: e.target.value })}
                        className="h-8 w-full rounded-lg border border-gold/35 px-2"
                        placeholder="noun/verb..."
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.meaning}
                        onChange={(e) => updateRow(row.key, { meaning: e.target.value })}
                        className="h-8 w-full rounded-lg border border-gold/35 px-2"
                        placeholder="Nghĩa tiếng Việt"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.example}
                        onChange={(e) => updateRow(row.key, { example: e.target.value })}
                        className="h-8 w-full rounded-lg border border-gold/35 px-2"
                        placeholder="Ví dụ minh họa..."
                      />
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[12px] font-bold', row.status === 'NEW' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                        {row.status === 'NEW' ? 'Mới' : 'Cập nhật'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button
                        type="button"
                        aria-label="Xóa dòng"
                        onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                        className="rounded-lg p-1 text-coral hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-gold/45 bg-paper/60 px-4 py-3 text-xs text-ink-soft">
          <span>Chưa tải file? Bạn cũng có thể tạo nhanh bảng nháp trống để tự nhập từng Unit ngay trên web.</span>
          <button type="button" onClick={addDraftRow} className="font-semibold text-gold-deep underline underline-offset-4">
            + Tạo bảng nháp thủ công
          </button>
        </div>
      )}
    </div>
  )
}

function VocabUnitBrowserPanel({ onNotice }: { onNotice: (n: CornerNoticeState) => void }) {
  const course = useVocabCourse()
  const sets = course.data?.sets ?? []
  const [selectedSetId, setSelectedSetId] = useState('')
  const effectiveSet = sets.find((s) => s.id === selectedSetId) ?? sets[0]
  const [unitIndex, setUnitIndex] = useState(1)

  useEffect(() => {
    if (effectiveSet && !effectiveSet.units.some((u) => u.index === unitIndex)) {
      setUnitIndex(effectiveSet.units[0]?.index ?? 1)
    }
  }, [effectiveSet, unitIndex])

  const unitDetail = useVocabUnitDetail(effectiveSet?.id ?? '', unitIndex, Boolean(effectiveSet))
  const createEntry = useCreateVocabEntry()
  const [newWord, setNewWord] = useState('')
  const [newPos, setNewPos] = useState('noun')
  const [newMeaning, setNewMeaning] = useState('')
  const [newExample, setNewExample] = useState('')

  const [draftQ, setDraftQ] = useState('')
  const [q, setQ] = useState('')
  const search = useVocabSearch(q)
  const removeVocab = useDeleteVocab()

  async function addWord(e: React.FormEvent) {
    e.preventDefault()
    if (!effectiveSet || effectiveSet.id === UNASSIGNED_VOCAB_SET) return
    try {
      await createEntry.mutateAsync({
        setId: effectiveSet.id,
        unit: unitIndex,
        word: newWord,
        partOfSpeech: newPos,
        meaning: newMeaning,
        example: newExample,
      })
      setNewWord('')
      setNewMeaning('')
      setNewExample('')
      onNotice(flashNotice(`Đã thêm từ vào Unit ${unitIndex}.`))
    } catch (err) {
      onNotice(flashError(err instanceof ApiError ? err.message : 'Không thêm được từ.'))
    }
  }

  return (
    <div className="mt-5 space-y-6">
      {sets.length === 0 ? (
        <p className="rounded-2xl bg-paper p-5 text-sm text-ink-soft">Chưa có bộ từ nào trong Database. Hãy nhập Excel ở tab bên cạnh.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[260px_1fr]">
            <label className="block text-sm">
              <span className="font-semibold">Bộ từ vựng</span>
              <select
                className="mt-1 h-10 w-full rounded-xl border border-gold/40 bg-cream px-3 text-sm"
                value={effectiveSet?.id ?? ''}
                onChange={(e) => setSelectedSetId(e.target.value)}
              >
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.topic}) · {s.wordCount} từ
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-semibold">Chọn Unit ({effectiveSet?.units.length ?? 0} Unit)</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(effectiveSet?.units ?? []).map((u) => (
                  <button
                    key={u.index}
                    type="button"
                    onClick={() => setUnitIndex(u.index)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      unitIndex === u.index ? 'bg-button text-button-ink' : 'bg-paper-2 text-ink-soft hover:text-ink',
                    )}
                  >
                    Unit {u.index} ({u.wordCount})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {effectiveSet && effectiveSet.id !== UNASSIGNED_VOCAB_SET ? (
            <form onSubmit={(e) => void addWord(e)} className="grid gap-2 rounded-2xl border border-gold/30 bg-paper p-3 sm:grid-cols-[1fr_110px_1.2fr_1.4fr_auto]">
              <input className="h-9 rounded-xl border border-gold/35 bg-cream px-2.5 text-xs font-semibold" value={newWord} onChange={(e) => setNewWord(e.target.value)} placeholder="Từ vựng mới" required />
              <input className="h-9 rounded-xl border border-gold/35 bg-cream px-2.5 text-xs" value={newPos} onChange={(e) => setNewPos(e.target.value)} placeholder="Loại từ" required />
              <input className="h-9 rounded-xl border border-gold/35 bg-cream px-2.5 text-xs" value={newMeaning} onChange={(e) => setNewMeaning(e.target.value)} placeholder="Nghĩa tiếng Việt" required />
              <input className="h-9 rounded-xl border border-gold/35 bg-cream px-2.5 text-xs" value={newExample} onChange={(e) => setNewExample(e.target.value)} placeholder="Câu mẫu (tuỳ chọn)" />
              <Button type="submit" disabled={createEntry.isPending} className="h-9 px-3 text-xs">
                <Plus className="size-3.5" /> Thêm vào Unit {unitIndex}
              </Button>
            </form>
          ) : null}

          {unitDetail.isPending ? (
            <p className="text-sm text-ink-soft">Đang tải từ trong Unit {unitIndex}…</p>
          ) : (
            <div className="space-y-2">
              {(unitDetail.data?.items ?? []).map((item) => (
                <EditableDbVocabRow key={item.id} item={item} currentUnit={unitIndex} canEditUnit={effectiveSet?.id !== UNASSIGNED_VOCAB_SET} onNotice={onNotice} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="border-t border-gold/30 pt-5">
        <p className="text-sm font-semibold">Tìm nhanh toàn kho ({search.data?.total ?? 0} từ)</p>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setQ(draftQ.trim())
          }}
        >
          <input className="h-10 min-w-0 flex-1 rounded-xl border border-ink/12 px-3 text-sm" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} placeholder="Tìm từ hoặc nghĩa…" />
          <Button type="submit" variant="navy">
            <Search className="size-3.5" /> Tìm
          </Button>
        </form>
        {q ? (
          <ul className="mt-3 divide-y divide-ink/8">
            {(search.data?.items ?? []).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <span className="font-semibold">{item.word}</span> <span className="text-ink-soft">({item.partOfSpeech})</span> — {item.meaning}
                  {item.example ? <p className="text-xs italic text-ink-soft">{item.example}</p> : null}
                  {item.set ? <p className="text-xs text-ink-soft">{item.set.topic} · {item.set.title} · Unit {item.set.unit}</p> : null}
                </div>
                <button type="button" className="font-semibold text-coral underline underline-offset-4" onClick={() => void removeVocab.mutateAsync(item.id)}>
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

function EditableDbVocabRow({
  item,
  currentUnit,
  canEditUnit,
  onNotice,
}: {
  item: VocabUnitWordDto
  currentUnit: number
  canEditUnit: boolean
  onNotice: (n: CornerNoticeState) => void
}) {
  const update = useUpdateVocab()
  const remove = useDeleteVocab()
  const [word, setWord] = useState(item.word)
  const [pos, setPos] = useState(item.partOfSpeech)
  const [meaning, setMeaning] = useState(item.meaning)
  const [example, setExample] = useState(item.example)
  const [unit, setUnit] = useState(currentUnit)

  const dirty = word !== item.word || pos !== item.partOfSpeech || meaning !== item.meaning || example !== item.example || unit !== currentUnit

  async function save() {
    try {
      await update.mutateAsync({
        id: item.id,
        word,
        partOfSpeech: pos,
        meaning,
        example,
        ...(canEditUnit ? { unit } : {}),
      })
      onNotice(flashNotice(`Đã lưu “${word}”.`))
    } catch (e) {
      onNotice(flashError(e instanceof ApiError ? e.message : 'Không cập nhật được.'))
    }
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-gold/30 bg-paper/70 p-3 sm:grid-cols-[72px_1fr_105px_1.1fr_1.4fr_auto] sm:items-center">
      {canEditUnit ? (
        <input
          type="number"
          min={1}
          max={500}
          value={unit}
          aria-label="Unit"
          onChange={(e) => setUnit(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
          className="h-9 rounded-lg border border-gold/35 bg-cream px-2 text-center text-xs font-bold"
        />
      ) : (
        <span className="text-center text-xs font-semibold text-ink-soft">U{currentUnit}</span>
      )}
      <input className="h-9 rounded-lg border border-gold/35 bg-cream px-2.5 text-xs font-bold" value={word} onChange={(e) => setWord(e.target.value)} />
      <input className="h-9 rounded-lg border border-gold/35 bg-cream px-2.5 text-xs" value={pos} onChange={(e) => setPos(e.target.value)} />
      <input className="h-9 rounded-lg border border-gold/35 bg-cream px-2.5 text-xs" value={meaning} onChange={(e) => setMeaning(e.target.value)} />
      <input className="h-9 rounded-lg border border-gold/35 bg-cream px-2.5 text-xs" value={example} placeholder="Câu mẫu…" onChange={(e) => setExample(e.target.value)} />
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant={dirty ? 'gold' : 'paper'}
          disabled={update.isPending || !dirty}
          onClick={() => void save()}
          className="h-9 px-2.5 text-xs"
        >
          <Save className="size-3.5" /> Lưu
        </Button>
        <button
          type="button"
          aria-label="Xóa từ"
          disabled={remove.isPending}
          onClick={() => void remove.mutateAsync(item.id)}
          className="rounded-lg p-2 text-coral hover:bg-red-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

function GrammarPdf({ lesson }: { lesson: GrammarLessonDto }) {
  const upload = useUploadGrammarPdf()
  const clear = useClearGrammarPdf()
  const [note, setNote] = useState<string | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  return (
    <div className="mt-3">
      <FilePick
        label={upload.isPending ? 'Đang tải PDF…' : lesson.pdf ? 'Đổi file PDF' : 'Thêm file PDF'}
        accept=".pdf,application/pdf"
        disabled={upload.isPending}
        chosen={lesson.pdf?.filename ?? null}
        hint="Tối đa 15MB. File mới thay file đang có."
        onFiles={(files) => {
          const file = files[0]
          if (!file) return
          setNote(null)
          void upload.mutateAsync({ id: lesson.id, file }).then(
            () => setNotice(flashNotice('Đã gắn file PDF.')),
            (error) => setNote(error instanceof ApiError ? error.message : 'Không tải được file PDF.'),
          )
        }}
      />
      {lesson.pdf ? (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-coral underline underline-offset-4"
          disabled={clear.isPending}
          onClick={() => {
            setNote(null)
            void clear.mutateAsync(lesson.id).then(
              () => setNotice(flashNotice('Đã gỡ file PDF.')),
              (error) => setNote(error instanceof ApiError ? error.message : 'Không gỡ được file PDF.'),
            )
          }}
        >
          Gỡ PDF
        </button>
      ) : null}
      {note ? <p className="mt-2 text-sm text-coral" role="alert">{note}</p> : null}
      <CornerNotice notice={notice} />
    </div>
  )
}
