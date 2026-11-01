import { Button } from '@/components/ui/Button'
import { CornerNotice, flashNotice, type CornerNoticeState } from '@/components/ui/CornerNotice'
import { FilePick } from '@/components/ui/FilePick'
import { Card, Input } from '@/components/ui/Primitives'
import { useCreateFillAssignment } from '@/features/assignments/assignments.queries'
import { ApiError } from '@/lib/api'
import { countBlanks, createFillAssignmentSchema } from '@toeic/shared'
import { useState } from 'react'

type Item = { prompt: string; answers: string[]; explanation: string }
type RosterUser = { id: string; fullName: string; studentCode: string | null }

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function withPrompt(item: Item, prompt: string): Item {
  const blanks = countBlanks(prompt)
  return { prompt, answers: Array.from({ length: blanks }, (_, index) => item.answers[index] ?? ''), explanation: item.explanation }
}

export function FillAssignForm({ roster }: { roster: RosterUser[] }) {
  const create = useCreateFillAssignment()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [minutes, setMinutes] = useState(15)
  const [dueAt, setDueAt] = useState(() => toLocalInput(new Date(Date.now() + 3 * 86_400_000)))
  const [allStudents, setAllStudents] = useState(true)
  const [picked, setPicked] = useState<string[]>([])
  const [items, setItems] = useState<Item[]>([{ prompt: '', answers: [], explanation: '' }])
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<CornerNoticeState | null>(null)

  const blankTotal = items.reduce((sum, item) => sum + countBlanks(item.prompt), 0)
  const [jsonName, setJsonName] = useState<string | null>(null)

  async function loadJson(file: File) {
    setFormError(null)
    try {
      const parsed = createFillAssignmentSchema.safeParse(JSON.parse(await file.text()))
      if (!parsed.success) {
        setJsonName(null)
        setFormError(parsed.error.issues.map((issue) => issue.message).join(' '))
        return
      }
      const draft = parsed.data
      setTitle(draft.title)
      setDescription(draft.description ?? '')
      setMinutes(Math.max(1, Math.round(draft.durationSeconds / 60)))
      if (draft.dueAt) setDueAt(toLocalInput(new Date(draft.dueAt)))
      setItems(
        draft.items.map((item) => ({
          prompt: item.prompt,
          answers: item.answers,
          explanation: item.explanation ?? '',
        })),
      )
      setJsonName(file.name)
      setNotice(flashNotice('Đã mở file. Kiểm tra câu hỏi, đáp án và lời giải, rồi bấm Giao bài điền từ.'))
    } catch {
      setJsonName(null)
      setFormError('File JSON không hợp lệ.')
    }
  }

  function update(index: number, next: Item) {
    setItems((rows) => rows.map((row, i) => (i === index ? next : row)))
  }

  async function submit() {
    setFormError(null)
    if (title.trim().length < 3) {
      setFormError('Nhập tiêu đề bài tập.')
      return
    }
    if (!dueAt) {
      setFormError('Chọn hạn nộp.')
      return
    }
    if (items.some((item) => countBlanks(item.prompt) === 0)) {
      setFormError('Mỗi câu cần ít nhất một chỗ trống, viết bằng ___.')
      return
    }
    if (items.some((item) => item.answers.some((answer) => !answer.trim()))) {
      setFormError('Điền đáp án cho mọi chỗ trống.')
      return
    }
    if (!allStudents && picked.length === 0) {
      setFormError('Chọn ít nhất một học viên.')
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        durationSeconds: Math.max(60, minutes * 60),
        dueAt: new Date(dueAt).toISOString(),
        studentIds: allStudents ? undefined : picked,
        publish: true,
        items: items.map((item) => ({
          prompt: item.prompt.trim(),
          answers: item.answers.map((answer) => answer.trim()),
          explanation: item.explanation.trim() || undefined,
        })),
      })
      setTitle('')
      setDescription('')
      setItems([{ prompt: '', answers: [], explanation: '' }])
      setNotice(flashNotice('Đã giao bài điền từ thành công. Có thể lưu vào bộ đề ở danh sách bên dưới.'))
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Không giao được bài điền từ.')
    }
  }

  return (
    <Card className="p-5">
      <h2 className="serif text-2xl">Soạn bài điền từ</h2>
      <p className="mt-1 text-sm text-ink/55">Viết ___ tại mỗi chỗ trống. Nhiều đáp án đúng thì cách nhau bằng dấu |, ví dụ color | colour.</p>
      <a className="mt-2 inline-block text-sm font-semibold text-gold-deep underline" href="/mau-import-dien-tu.json" download>
        Tải file mẫu
      </a>
      <div className="mt-3">
        <FilePick
          label="Chọn file JSON"
          accept="application/json,.json"
          chosen={jsonName}
          hint="Mở vào form để sửa trước khi giao. Chưa lưu bài."
          onFiles={(files) => {
            const file = files[0]
            if (file) void loadJson(file)
          }}
        />
      </div>
      <label className="mt-4 block text-sm font-medium" htmlFor="fill-title">Tiêu đề</label>
      <Input id="fill-title" className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Điền từ tuần 12" />
      <label className="mt-3 block text-sm font-medium" htmlFor="fill-desc">Ghi chú cho học viên</label>
      <Input id="fill-desc" className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Không bắt buộc" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="fill-min">Thời gian làm (phút)</label>
          <Input id="fill-min" className="mt-1" type="number" min={1} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="fill-due">Hạn nộp</label>
          <Input id="fill-due" className="mt-1" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="rounded-2xl bg-paper p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Câu {index + 1}</p>
              {items.length > 1 ? (
                <button type="button" className="text-xs font-semibold text-coral" onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}>
                  Xóa câu
                </button>
              ) : null}
            </div>
            <textarea
              value={item.prompt}
              onChange={(e) => update(index, withPrompt(item, e.target.value))}
              rows={3}
              placeholder="The meeting was ___ because the train was late."
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
            />
            {item.answers.length === 0 ? <p className="mt-2 text-xs text-ink/45">Chưa có chỗ trống.</p> : null}
            <div className="mt-2 grid gap-2">
              {item.answers.map((answer, blank) => (
                <label key={blank} className="block text-sm">
                  Đáp án chỗ trống {blank + 1}
                  <Input className="mt-1" value={answer} onChange={(e) => update(index, { ...item, answers: item.answers.map((value, i) => (i === blank ? e.target.value : value)) })} placeholder="cancelled | canceled" />
                </label>
              ))}
              <label className="mt-2 block text-sm">
                Lời giải thích
                <textarea
                  value={item.explanation}
                  onChange={(e) => update(index, { ...item, explanation: e.target.value })}
                  rows={2}
                  placeholder="Vì sao đáp án này đúng. Học viên thấy sau khi nộp bài."
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="paper" className="mt-3" onClick={() => setItems((rows) => [...rows, { prompt: '', answers: [], explanation: '' }])}>
        Thêm câu
      </Button>
      <p className="mt-3 text-sm text-ink/55">{blankTotal} chỗ trống</p>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allStudents} onChange={(e) => setAllStudents(e.target.checked)} />
        Giao cả lớp (học viên đang hoạt động)
      </label>
      {!allStudents ? (
        <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gold/30 p-2">
          {roster.map((u) => (
            <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper">
              <input type="checkbox" checked={picked.includes(u.id)} onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))} />
              {u.fullName} <span className="text-ink/45">{u.studentCode}</span>
            </label>
          ))}
        </div>
      ) : null}
      {formError ? <p className="mt-3 rounded-xl bg-[#f8dcd8] px-3 py-2 text-sm text-coral" role="alert">{formError}</p> : null}
      <CornerNotice notice={notice} />
      <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => void submit()}>
        {create.isPending ? 'Đang giao…' : 'Giao bài điền từ'}
      </Button>
    </Card>
  )
}
