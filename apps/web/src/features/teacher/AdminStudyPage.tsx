import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Card } from '@/components/ui/Primitives'
import { PageLoading } from '@/components/ui/LoadingScreen'
import { QueryErrorRedirect } from '@/features/errors/ErrorPages'
import { ApiError, downloadApiFile } from '@/lib/api'
import { useState } from 'react'
import { useClearGrammarPdf, useCreateGrammar, useDeleteGrammar, useDeleteVocab, useGrammarLessons, useImportVocab, useUploadGrammarPdf, useVocabSearch } from '@/features/study/study.queries'
import type { GrammarLessonDto } from '@toeic/shared'

export function AdminStudyPage() {
  const [q, setQ] = useState('')
  const vocab = useVocabSearch(q)
  const lessons = useGrammarLessons()
  const importVocab = useImportVocab()
  const removeVocab = useDeleteVocab()
  const createLesson = useCreateGrammar()
  const removeLesson = useDeleteGrammar()
  const [note, setNote] = useState<string | null>(null)
  const [grammarNote, setGrammarNote] = useState<string | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')

  if (vocab.isPending || lessons.isPending) return <PageLoading message="Đang tải học liệu…" />
  if (vocab.error) return <QueryErrorRedirect error={vocab.error} />
  if (lessons.error) return <QueryErrorRedirect error={lessons.error} />

  return (
    <div className="space-y-8">
      <CornerNotice notice={notice} />
      <header>
        <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Học liệu</p>
        <h1 className="serif mt-2 text-3xl sm:text-4xl">Từ vựng và ngữ pháp</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/60">File Excel gồm cột từ vựng, loại từ và nghĩa. Học viên học các từ này bằng flashcard và có thể lưu vào sổ tay.</p>
      </header>

      <Card className="p-6">
        <h2 className="serif text-2xl">Nhập từ vựng từ Excel</h2>
        <p className="mt-2 text-sm text-ink/60">Dòng đầu có thể là tiêu đề: Từ vựng, Loại từ, Nghĩa. Nếu không có tiêu đề, ba cột đầu được hiểu theo thứ tự đó.</p>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-gold-deep underline underline-offset-4"
          onClick={() => {
            setNote(null)
            void downloadApiFile('/study/vocab/template', 'mau-tu-vung.xlsx').catch((error: unknown) => {
              setNote(error instanceof ApiError ? error.message : 'Không tải được file mẫu.')
            })
          }}
        >
          Tải file mẫu
        </button>
        <div className="mt-4">
          <FilePick
            label={importVocab.isPending ? 'Đang nhập…' : 'Chọn file .xlsx'}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={importVocab.isPending}
            hint="Tối đa 8MB, 2000 từ. Từ trùng sẽ được cập nhật nghĩa."
            onFiles={(files) => {
              const file = files[0]
              if (!file) return
              setNote(null)
              void importVocab.mutateAsync(file).then(
                (result) => setNotice(flashNotice(`Đã thêm ${result.imported} từ, cập nhật ${result.updated} từ, bỏ qua ${result.skipped} dòng.`)),
                (error) => {
                  setNote(error instanceof ApiError ? error.message : 'Không nhập được file.')
                },
              )
            }}
          />
        </div>
        {note ? <p className="mt-3 text-sm text-coral" role="alert">{note}</p> : null}
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const field = new FormData(event.currentTarget).get('q')
            setQ(typeof field === 'string' ? field.trim() : '')
          }}
        >
          <input name="q" className="h-10 min-w-0 flex-1 rounded-xl border border-ink/12 px-3 text-sm" placeholder="Tìm từ đã nhập" />
          <Button type="submit" variant="navy">
            Tìm
          </Button>
        </form>
        <p className="mt-3 text-sm text-ink/55">{vocab.data?.total ?? 0} từ trong kho</p>
        <ul className="mt-2 divide-y divide-ink/8">
          {(vocab.data?.items ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-semibold">{item.word}</span> <span className="text-ink/50">{item.partOfSpeech}</span> — {item.meaning}
              </span>
              <button type="button" className="font-semibold text-coral underline underline-offset-4" onClick={() => void removeVocab.mutateAsync(item.id)}>
                Xóa
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="serif text-2xl">Chuyên đề ngữ pháp</h2>
        <p className="mt-2 text-sm text-ink/60">Mỗi chuyên đề gắn được một file PDF. Học viên mở file ngay trong bài học.</p>
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
                  <p className="text-sm text-ink/55">{lesson.summary}</p>
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
