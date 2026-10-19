import { Button } from '@/components/ui/Button'
import { FilePick } from '@/components/ui/FilePick'
import { Card, Input } from '@/components/ui/Primitives'
import { partName } from '@/features/exams/exams.queries'
import type { ImportAuthoredExamInput } from '@toeic/shared'
import { useState } from 'react'

type Draft = ImportAuthoredExamInput

function problemsOf(draft: Draft): string[] {
  const problems: string[] = []
  if (draft.title.trim().length < 3) problems.push('Tiêu đề cần ít nhất 3 ký tự.')
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(draft.code.trim())) problems.push('Mã đề chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.')
  draft.questions.forEach((question) => {
    const correct = question.options.filter((option) => option.correct).length
    if (correct !== 1) problems.push(`Câu ${question.number}: chọn đúng một đáp án.`)
    if (question.options.some((option) => !option.text.trim())) problems.push(`Câu ${question.number}: mỗi lựa chọn cần có chữ.`)
  })
  return problems
}

export function ImportReview({
  draft,
  busy,
  error,
  audioName,
  onAudio,
  onCancel,
  onSave,
}: {
  draft: Draft
  busy: boolean
  error: string | null
  audioName?: string | null
  onAudio?: (file: File | null) => void
  onCancel: () => void
  onSave: (next: Draft) => void
}) {
  const [form, setForm] = useState<Draft>(draft)
  const problems = problemsOf(form)
  const missingExplanation = form.questions.filter((question) => !question.explanation?.trim()).length

  function patchQuestion(index: number, next: Draft['questions'][number]) {
    setForm((current) => ({ ...current, questions: current.questions.map((question, i) => (i === index ? next : question)) }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.18em] text-gold-deep uppercase">Chưa lưu vào ngân hàng</p>
          <h2 className="serif mt-1 text-3xl">Kiểm tra đề trước khi thêm</h2>
          <p className="mt-1 text-sm text-ink/60">Sửa câu hỏi, đáp án và lời giải. Học viên chỉ thấy lời giải sau khi nộp bài.</p>
        </div>
        <Button type="button" variant="paper" onClick={onCancel}>
          Chọn file khác
        </Button>
      </div>

      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">
            Mã đề
            <Input className="mt-1" value={form.code} onChange={(e) => setForm((current) => ({ ...current, code: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium">
            Tên đề
            <Input className="mt-1" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            Mô tả
            <Input className="mt-1" value={form.description ?? ''} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          </label>
          <label className="block text-sm font-medium">
            Thời gian (phút)
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={240}
              value={Math.round(form.durationSeconds / 60)}
              onChange={(e) => setForm((current) => ({ ...current, durationSeconds: Math.max(60, (Number(e.target.value) || 1) * 60) }))}
            />
          </label>
          <p className="self-end text-sm text-ink/55">
            {form.questions.length} câu
            {form.parts.map((part) => ` • ${partName(part.partCode).split(' — ')[0]}`).join('')}
          </p>
        </div>
      </Card>

      {form.groups.map((group, groupIndex) => (
        <Card key={group.key} className="p-5">
          <p className="text-sm font-semibold">Nhóm {group.key} • {partName(group.partCode).split(' — ')[0]}</p>
          <label className="mt-3 block text-sm">
            Hướng dẫn
            <textarea
              value={group.instructions ?? ''}
              rows={2}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  groups: current.groups.map((item, i) => (i === groupIndex ? { ...item, instructions: e.target.value } : item)),
                }))
              }
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
            />
          </label>
          {group.passages.map((passage, passageIndex) => (
            <label key={passage.label} className="mt-3 block text-sm">
              Đoạn {passage.label}{passage.title ? ` • ${passage.title}` : ''}
              <textarea
                value={passage.content}
                rows={4}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    groups: current.groups.map((item, i) =>
                      i === groupIndex
                        ? { ...item, passages: item.passages.map((row, j) => (j === passageIndex ? { ...row, content: e.target.value } : row)) }
                        : item,
                    ),
                  }))
                }
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
              />
            </label>
          ))}
        </Card>
      ))}

      {onAudio ? (
        <Card className="p-5">
          <h3 className="font-semibold">File nghe</h3>
          <div className="mt-3">
            <FilePick
              label="Chọn file nghe"
              accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
              chosen={audioName ?? null}
              hint="Gắn cho cả phần nghe khi lưu đề."
              onFiles={(files) => onAudio(files[0] ?? null)}
            />
          </div>
        </Card>
      ) : null}

      {form.questions.map((question, index) => (
        <Card key={`${question.partCode}-${question.number}`} className="p-5">
          <p className="text-sm text-ink/50">
            {partName(question.partCode).split(' — ')[0]} • Câu {question.number}
            {question.groupKey ? ` • nhóm ${question.groupKey}` : ''}
          </p>
          <label className="mt-3 block text-sm font-medium">
            Đề bài
            <textarea
              value={question.prompt}
              rows={2}
              onChange={(e) => patchQuestion(index, { ...question, prompt: e.target.value })}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="mt-3 grid gap-2">
            {question.options.map((option) => (
              <label key={option.key} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={option.correct}
                  onChange={() => patchQuestion(index, { ...question, options: question.options.map((item) => ({ ...item, correct: item.key === option.key })) })}
                />
                <span className="w-5 font-bold">{option.key}</span>
                <Input value={option.text} onChange={(e) => patchQuestion(index, { ...question, options: question.options.map((item) => (item.key === option.key ? { ...item, text: e.target.value } : item)) })} />
              </label>
            ))}
          </div>
          <label className="mt-3 block text-sm font-medium">
            Lời giải thích
            <textarea
              value={question.explanation ?? ''}
              rows={3}
              placeholder="Vì sao đáp án này đúng."
              onChange={(e) => patchQuestion(index, { ...question, explanation: e.target.value })}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
            />
          </label>
        </Card>
      ))}

      {missingExplanation > 0 ? <p className="text-sm text-ink/55">{missingExplanation} câu chưa có lời giải thích. Vẫn có thể lưu.</p> : null}
      {problems.length > 0 ? (
        <ul className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="rounded-xl bg-[#f8dcd8] p-3 text-sm text-coral" role="alert">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Hủy</Button>
        <Button type="button" disabled={busy || problems.length > 0} onClick={() => onSave(form)}>
          {busy ? 'Đang lưu…' : 'Thêm đề vào ngân hàng'}
        </Button>
      </div>
    </div>
  )
}
