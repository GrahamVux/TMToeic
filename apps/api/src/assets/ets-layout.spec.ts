import { classifyEtsPath, slugify } from './ets-layout'

describe('classifyEtsPath', () => {
  const c = (p: string) => classifyEtsPath(p)

  it('classifies full audio by test number', () => {
    expect(c('ETS 2018/Audio File/05-Test5.mp3')).toMatchObject({ role: 'FULL_AUDIO', testNo: 5, objectKey: 'ets-2018/test-05/audio/full.mp3', mimeType: 'audio/mpeg' })
    expect(c('ETS 2018/Audio File/10-Test10.mp3')).toMatchObject({ testNo: 10, objectKey: 'ets-2018/test-10/audio/full.mp3' })
  })

  it('treats the same full audio inside a test folder as the same object key', () => {
    expect(c('ETS 2018/bài tập tách ra/Đề 2 chia nhỏ/02-Test2.mp3')?.objectKey).toBe('ets-2018/test-02/audio/full.mp3')
  })

  it('part audio, question PDFs, transcripts and answer keys use the folder test number', () => {
    expect(c('ETS 2018/bài tập tách ra/đỀ 1 CHIA NHỎ/P1 và P2.mp3')).toMatchObject({ role: 'PART_AUDIO', testNo: 1, objectKey: 'ets-2018/test-01/audio/p1-va-p2.mp3' })
    expect(c('ETS 2018/bài tập tách ra/Đề 7/Đề 7.pdf')).toMatchObject({ role: 'QUESTION_PDF', testNo: 7, objectKey: 'ets-2018/test-07/questions/de-7.pdf' })
    expect(c('ETS 2018/bài tập tách ra/Đề 7/Transcript Đề 7.pdf')).toMatchObject({ role: 'TRANSCRIPT', testNo: 7 })
    expect(c('ETS 2018/bài tập tách ra/Đề 5/TRANSC~2.PDF')).toMatchObject({ role: 'TRANSCRIPT', testNo: 5 })
    expect(c('ETS 2018/bài tập tách ra/Đề 5/Transcritpt P1, 2.pdf')).toMatchObject({ role: 'TRANSCRIPT' })
    expect(c('ETS 2018/bài tập tách ra/Đề 7/Key Test 7.docx')).toMatchObject({ role: 'ANSWER_KEY', testNo: 7 })
    expect(c('ETS 2018/bài tập tách ra/Đề 9/Đáp án Đề 9.docx')).toMatchObject({ role: 'ANSWER_KEY', testNo: 9 })
    expect(c('ETS 2018/bài tập tách ra/đỀ 1 CHIA NHỎ/Đáp án P3.xlsx')).toMatchObject({ role: 'ANSWER_KEY', testNo: 1 })
    expect(c('ETS 2018/bài tập tách ra/đỀ 1 CHIA NHỎ/Đáp án tổng 4P.pdf')).toMatchObject({ role: 'ANSWER_KEY', testNo: 1 })
    expect(c('ETS 2018/bài tập tách ra/đỀ 1 CHIA NHỎ/Đề nghe P3.pdf')).toMatchObject({ role: 'QUESTION_PDF', testNo: 1 })
  })

  it('books and archives are not attached to a test', () => {
    expect(c('ETS 2018/New Economy TOEIC LC 1000.pdf')).toMatchObject({ role: 'BOOK', testNo: null, objectKey: 'ets-2018/books/new-economy-toeic-lc-1000.pdf' })
    expect(c('ETS 2018/Audio File.rar')).toMatchObject({ role: 'ARCHIVE', testNo: null, mimeType: 'application/vnd.rar' })
  })

  it('skips directories and yields ASCII-only keys', () => {
    expect(c('ETS 2018/Audio File/')).toBeNull()
    const k = c('ETS 2018/bài tập tách ra/Đề 3 chia nhỏ/Bài nghe P1, 2.mp3')!.objectKey
    expect(k).toMatch(/^[a-z0-9/.-]+$/)
  })

  it('slugify', () => {
    expect(slugify('Đáp án Đề 10')).toBe('dap-an-de-10')
  })
})
