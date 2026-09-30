export const currentStudent = {
  fullName: 'Nguyễn Thảo Linh',
  studentCode: 'TM-852',
  className: 'TOEIC 800+ K42',
  targetScore: 850,
  currentScore: 785,
  latestTestScore: 810,
  listening: 420,
  reading: 390,
  streak: 12,
  studyHours: 46.5,
  remainingToTarget: 65,
  predictedRange: '785 – 820',
  courseProgress: 76,
  sessionsDone: 19,
  sessionsTotal: 25,
}

export const scoreHistory = [
  { label: 'Giai đoạn 1', test: 'Test 01', score: 620, date: '10/10' },
  { label: 'Giai đoạn 2', test: 'Test 02', score: 710, date: '24/10' },
  { label: 'Test 03', test: 'Test 03', score: 740, date: '08/11' },
  { label: 'Test 04', test: 'Test 04', score: 775, date: '22/11' },
  { label: 'Hiện tại', test: 'Test 05', score: 785, date: 'Hôm qua' },
]

export const progressScoreHistory = [
  { test: 'Test 01', score: 650, date: '10/10' },
  { test: 'Test 02', score: 710, date: '24/10' },
  { test: 'Test 03', score: 740, date: '08/11' },
  { test: 'Test 04', score: 775, date: '22/11' },
  { test: 'Test 05', score: 810, date: 'Hôm qua' },
]

export const assignments = [
  {
    id: 'a1',
    title: 'Bài tập về nhà Buổi 12: Chuyên đề Part 5 — Mệnh đề quan hệ rút gọn & 30 câu bẫy từ vựng',
    teacher: 'Thầy Minh',
    status: 'DUE_SOON' as const,
    dueLabel: 'SẮP HẾT HẠN • 23:59 HÔM NAY',
    description: 'Chấm điểm tự động và có video Thầy Minh chữa chi tiết các bẫy đảo ngữ hay gặp.',
    progress: '0 / 30 câu (Chưa làm)',
    eta: 'Ước lượng: 30 phút',
    cta: 'Làm bài ngay',
  },
  {
    id: 'a2',
    title: 'Mock Test Mini Listening Part 2 & 3 (Bộ ETS 2024 Test 02 trích đoạn)',
    teacher: 'Thầy Minh',
    status: 'IN_PROGRESS' as const,
    dueLabel: 'HẠN CHÓT: 20:00 NGÀY MAI',
    description: 'Rèn phản xạ câu hỏi gián tiếp Yes/No và kỹ năng bám keyword trong đoạn đối thoại.',
    progress: '15 / 40 câu (Đang làm dở)',
    eta: 'Audio chuẩn giọng ETS',
    cta: 'Làm tiếp',
  },
  {
    id: 'a3',
    title: 'Flashcard ôn tập 50 từ vựng chuyên ngành Hợp đồng & Pháp lý (Tuần 3)',
    teacher: 'Thầy Minh',
    status: 'COMPLETED' as const,
    dueLabel: 'ĐÃ HOÀN THÀNH • HẠN 23:59 CN',
    description: 'Ghi nhớ 50 collocations trọng tâm xuất hiện dày đặc trong đề thi Part 7 song ngữ.',
    progress: 'Đạt 48 / 50 từ (96%)',
    eta: 'Lời phê: “Nắm rất vững!”',
    cta: 'Xem kết quả',
  },
]

export const leaderboard = [
  { rank: 1, name: 'Minh Quân', note: 'Streak 15 ngày', badge: 'Top chuyên cần' },
  { rank: 2, name: 'Thảo Linh', note: 'Bứt phá tuần (+45đ)', badge: 'Huy hiệu vàng', you: true },
  { rank: 3, name: 'Hồng Hạnh', note: 'Siêu chăm chỉ (18 đề)', badge: 'Huy hiệu bạc' },
  { rank: 4, name: 'Tuấn Anh', note: 'Hoàn thành 100% BT', badge: 'Kim cương' },
]

export const grammarTopics = [
  { id: 'g1', order: '01', title: 'Các thì cơ bản và mở rộng trong TOEIC (Tenses & Voice)', status: 'DONE', progress: 100, note: 'Quy tắc nhận biết dấu hiệu thời gian, sự phối thì khi, while, since, by the time...' },
  { id: 'g2', order: '02', title: 'Mệnh đề quan hệ & Rút gọn mệnh đề quan hệ', status: 'DONE', progress: 100, note: 'Phân biệt V-ing / V-ed khi rút gọn, đại từ quan hệ đi kèm giới từ.' },
  { id: 'g3', order: '03', title: 'Câu điều kiện và Hiện tượng Đảo ngữ', status: 'LEARNING', progress: 65, note: 'Đảo ngữ Should / Were / Had, Provided that, As long as, Unless...' },
  { id: 'g4', order: '04', title: 'Thể bị động đặc biệt & Thể giả định', status: 'LOCKED', progress: 0, note: 'Suggest, recommend, mandatory, vital + (should) V nguyên thể.' },
  { id: 'g5', order: '05', title: 'Danh từ đếm được, không đếm được & Lượng từ', status: 'LOCKED', progress: 0, note: 'Information/Equipment vs Items, Much/Little vs Many/Few.' },
  { id: 'g6', order: '06', title: 'Bẫy Tính từ & Trạng từ thường gặp', status: 'LOCKED', progress: 0, note: 'Timely, costly, friendly; vị trí trạng từ xen kẽ trợ động từ.' },
]

export const dailyVocabPlan = [
  { day: 1, title: 'Môi trường công sở & Giao tiếp phòng ban', words: 'Colleagues, memo, deadline...', status: 'DONE', count: 20 },
  { day: 2, title: 'Nhân sự & Tuyển dụng ứng viên', words: 'Applicant, qualified, interview...', status: 'DONE', count: 18 },
  { day: 3, title: 'Đàm phán & Ký kết kinh doanh', words: 'Negotiate, term, consensus...', status: 'DONE', count: 15 },
  { day: 4, title: 'Hội nghị, Hội thảo & Lịch trình', words: 'Agenda, itinerary, keynote...', status: 'DONE', count: 20 },
  { day: 5, title: 'Vận chuyển, Đơn hàng & Giao hàng', words: 'Consignment, fragile, dispatch...', status: 'DONE', count: 16 },
  { day: 6, title: 'Tài chính doanh nghiệp & Kế toán', words: 'Substantial, audit, deficit...', status: 'TODAY', count: 20, done: 14 },
  { day: 7, title: 'Bán hàng, Khuyến mãi & Marketing', words: 'Campaign, target audience...', status: 'LOCKED', count: 20 },
  { day: 8, title: 'Nhà hàng & Dịch vụ ăn uống', words: 'Beverage, banquet, reservation...', status: 'LOCKED', count: 18 },
  { day: 9, title: 'Du lịch, Hàng không & Khách sạn', words: 'Boarding pass, accommodation...', status: 'LOCKED', count: 18 },
]

export const vocabTopics = [
  { id: 'v1', title: 'Hợp đồng & Pháp lý', progress: '50/50', mastery: 98, status: 'DONE' },
  { id: 'v2', title: 'Văn phòng & Nhân sự', progress: '60/60', mastery: 95, status: 'DONE' },
  { id: 'v3', title: 'Tài chính & Ngân hàng', progress: '32/45', mastery: 71, status: 'LEARNING' },
  { id: 'v4', title: 'Marketing & Quảng cáo', progress: '0/55', mastery: 0, status: 'NEW' },
  { id: 'v5', title: 'Vận tải & Xuất nhập khẩu', progress: '0/40', mastery: 0, status: 'NEW' },
  { id: 'v6', title: 'Nhà hàng & Khách sạn', progress: '0/35', mastery: 0, status: 'NEW' },
]

export const notebookWords = [
  {
    word: 'Substantial',
    ipa: '/səbˈstæn.ʃəl/',
    pos: 'ADJ',
    meaning: 'Đáng kể, quan trọng, lớn lao',
    collocations: ['substantial increase', 'substantial evidence'],
    tip: "Bẫy Part 5 hay chọn trạng từ 'substantially' bổ nghĩa cho động từ tăng/giảm.",
    tag: 'REVIEW',
  },
  {
    word: 'Mandatory',
    ipa: '/ˈmæn.də.tər.i/',
    pos: 'ADJ',
    meaning: 'Bắt buộc (= compulsory, required)',
    collocations: ['mandatory training', 'mandatory attendance'],
    tip: 'Cấu trúc giả định: It is mandatory that S + (should) V-inf. Hay ra Part 5.',
    tag: 'REVIEW',
  },
  {
    word: 'Negotiate',
    ipa: '/nəˈɡoʊ.ʃi.eɪt/',
    pos: 'VERB',
    meaning: 'Đàm phán, thương lượng',
    collocations: ['negotiate contract terms', 'negotiate with sb'],
    tip: 'Danh từ Negotiation, người đại diện đàm phán là Negotiator.',
    tag: 'MASTERED',
  },
  {
    word: 'Feasible',
    ipa: '/ˈfiː.zə.bəl/',
    pos: 'ADJ',
    meaning: 'Khả thi, có thể thực hiện được (= viable)',
    collocations: ['feasible alternative', 'feasible solution'],
    tip: 'Phân biệt feasible (tính từ) vs feasibility (danh từ) trong Part 5 & 7.',
    tag: 'WEAK',
  },
  {
    word: 'Complimentary',
    ipa: '/ˌkɑːm.pləˈmen.tər.i/',
    pos: 'ADJ',
    meaning: 'Miễn phí (dịch vụ kèm theo)',
    collocations: ['complimentary breakfast', 'complimentary shuttle'],
    tip: 'Tránh nhầm Complementary (bổ sung). Trong TOEIC 95% nghĩa MIỄN PHÍ.',
    tag: 'MASTERED',
  },
  {
    word: 'Incur',
    ipa: '/ɪnˈkɜːr/',
    pos: 'VERB',
    meaning: 'Gánh chịu, phát sinh (chi phí, nợ, phí phạt)',
    collocations: ['incur additional fees', 'incur expenses'],
    tip: 'Từ then chốt Part 7 dạng biên lai, thông báo phạt chậm thanh toán.',
    tag: 'REVIEW',
  },
]

export const exams = [
  {
    id: 'ets-2024-01',
    title: 'ETS TOEIC 2024 — Test 01 (Full 200 câu)',
    status: 'DONE',
    score: 810,
    listening: 420,
    reading: 390,
    minutes: 120,
    questions: 200,
  },
  {
    id: 'ets-2024-02',
    title: 'ETS TOEIC 2024 — Test 02 (Full 200 câu)',
    status: 'IN_PROGRESS',
    progress: 57.5,
    current: 'Part 5 — Câu 115 / 200',
    remaining: 'Còn 51 phút 24 giây',
    minutes: 120,
    questions: 200,
  },
  {
    id: 'ets-2024-03',
    title: 'ETS TOEIC 2024 — Test 03 (Full 200 câu)',
    status: 'FOCUS',
    note: 'Trọng tâm Thầy Minh khuyên luyện Target 800+ trước khi thi thật.',
    minutes: 120,
    questions: 200,
  },
  {
    id: 'ets-2024-04',
    title: 'ETS TOEIC 2024 — Test 04 (Full 200 câu)',
    status: 'NEW',
    note: 'Độ khó chuẩn: bám sát đề thi thật, bẫy Part 3-4 và Part 7 đoạn ba.',
    minutes: 120,
    questions: 200,
  },
  {
    id: 'ets-2023-05',
    title: 'ETS TOEIC 2023 — Test 05 (Full 200 câu)',
    status: 'TODO',
    note: 'Chứa trọn bộ bẫy Part 2 gián tiếp & Part 7 suy luận logic.',
    minutes: 120,
    questions: 200,
  },
  {
    id: 'ets-2023-06',
    title: 'ETS TOEIC 2023 — Test 06 (Full 200 câu)',
    status: 'TODO',
    note: 'Trọng tâm từ vựng đàm phán hợp đồng, tài chính và logistics.',
    minutes: 120,
    questions: 200,
  },
]

export const listeningDrills = [
  { id: 'p1', part: 'PART 1 DRILL', minutes: 10, title: 'Mini Test Part 1: Phản xạ 10 tranh chân thực & đồ vật', meta: '10 câu hỏi • Giọng Mỹ - Anh', tip: 'Bẫy thì bị động đang diễn ra (is being VpII) và vị trí đồ vật tĩnh.' },
  { id: 'p2', part: 'PART 2 DRILL', minutes: 15, title: 'Part 2: Bẫy âm tương tự & câu trả lời gián tiếp', meta: '25 câu hỏi • Target 800+', tip: 'Loại ngay đáp án lặp từ phát âm giống câu hỏi (Same Sound Trap).' },
  { id: 'p3', part: 'PART 3 SPEED CHECK', minutes: 20, title: 'Part 3: Bắt keyword & đồ họa bảng biểu', meta: '12 câu hỏi • Kèm hình ảnh chart', tip: 'Đọc trước câu hỏi và gạch chân 3 keyword trước khi audio vang lên.' },
  { id: 'p4', part: 'PART 4 SHORT TALK', minutes: 20, title: 'Part 4 Mini Test: Talks & voice messages công sở', meta: '15 câu hỏi • 5 bài nói độc thoại', tip: 'Xác định danh tính người nói ngay ở 1-2 câu mở đầu (Purpose/Topic).' },
]

export const readingDrills = [
  { id: 'r5', part: 'PART 5 SPEED', minutes: 15, title: 'Part 5: 30 câu bẫy từ loại & liên từ', meta: '30 câu • ≤ 20s/câu', tip: 'Nhìn đuôi từ trước, đừng dịch cả câu.' },
  { id: 'r6', part: 'PART 6 CONTEXT', minutes: 20, title: 'Part 6: Điền câu theo mạch văn bản công sở', meta: '16 câu • 4 đoạn', tip: 'Đọc câu trước/sau chỗ trống để bắt cohesion.' },
  { id: 'r7s', part: 'PART 7 SINGLE', minutes: 20, title: 'Part 7: Đoạn đơn — email, thông báo, tin tức', meta: '15 câu', tip: 'Gạch keyword câu hỏi trước khi đọc passage.' },
  { id: 'r7t', part: 'PART 7 TRIPLE', minutes: 25, title: 'Part 7: Đoạn ba — quét chéo 3 văn bản', meta: '15 câu • Target 800+', tip: 'Map nguồn A/B/C trước, rồi mới suy luận ý ngầm.' },
]

export const pendingImports = [
  { id: 'imp1', title: 'ETS 2024 — Test 05 (Full RC+LC)', meta: '200 câu hỏi • 4 audio tracks • Bóc tách 100%', status: 'WAITING_REVIEW' },
  { id: 'imp2', title: 'Hackers TOEIC Actual Test 08', meta: 'Bộ đề bẫy chuyên sâu Part 5 & 7', status: 'WAITING_REVIEW' },
]

export const teachingAssistants = [
  { id: 'ta1', name: 'TA Thảo My (945 TOEIC)', focus: 'Đang kèm Part 7', students: 'Phạm Tuấn Anh, Vũ Thu Trang' },
  { id: 'ta2', name: 'TA Huy Quang (960 TOEIC)', focus: 'Luyện Drill Part 5', students: 'Đặng Đình Khôi' },
]

export const partAnalytics = [
  { code: 'P1', name: 'Part 1 — Hình ảnh', detail: 'Mô tả tranh chân dung & đồ vật', accuracy: 92, note: 'Thành thạo — xuất sắc' },
  { code: 'P2', name: 'Part 2 — Hỏi đáp', detail: 'Phản xạ câu hỏi gián tiếp & Why/How', accuracy: 88, note: 'Rất tốt — nắm chắc ngữ pháp' },
  { code: 'P3', name: 'Part 3 — Hội thoại ngắn', detail: 'Bắt keyword & phân tích đồ họa kèm', accuracy: 82, note: 'Khá tốt — cần luyện thêm bẫy ngụ ý' },
  { code: 'P4', name: 'Part 4 — Bài nói chuyện', detail: 'Talks: thông báo, phát thanh, tin nhắn thoại', accuracy: 85, note: 'Tốt — giữ vững phong độ' },
  { code: 'P5', name: 'Part 5 — Hoàn thành câu', detail: 'Từ loại, ngữ pháp cốt lõi & liên từ', accuracy: 88, note: 'Rất tốt — nắm chắc ngữ pháp' },
  { code: 'P6', name: 'Part 6 — Điền đoạn văn', detail: 'Điền câu theo ngữ cảnh & từ vựng', accuracy: 78, note: 'Khá — đọc trước câu hỏi cần nhanh hơn' },
  { code: 'P7', name: 'Part 7 — Đọc hiểu', detail: 'Đoạn đơn, đoạn đôi & đoạn ba', accuracy: 70, note: 'Cần cải thiện — thiếu 5-7 câu cuối' },
]

export const students = [
  { id: 's1', name: 'Nguyễn Thảo Linh', code: 'TM-852', className: 'K42 Target 800+', group: 'EXCELLENT', homework: '20/20', score: 850, delta: 45, weak: 'Part 2 bẫy gián tiếp', lc: 440, rc: 410 },
  { id: 's2', name: 'Phạm Tuấn Anh', code: 'TM-841', className: 'K42 Target 800+', group: 'AT_RISK', homework: '9/20', score: 620, delta: -65, weak: 'Part 7 đoạn ba thiếu 15 phút', lc: 310, rc: 310 },
  { id: 's3', name: 'Trần Minh Quân', code: 'TM-819', className: 'K41 Nước rút', group: 'EXCELLENT', homework: '20/20', score: 875, delta: 35, weak: 'Từ vựng cấp quản lý Part 7', lc: 465, rc: 410 },
  { id: 's4', name: 'Vũ Thu Trang', code: 'TM-867', className: 'K42 Target 800+', group: 'AT_RISK', homework: '7/20', score: 650, delta: -50, weak: 'Đọc hiểu suy luận ý ngầm', lc: 340, rc: 310 },
  { id: 's5', name: 'Hoàng Kim Chi', code: 'TM-833', className: 'K42 Target 800+', group: 'NEEDS_ATTENTION', homework: '15/20', score: 760, delta: 0, weak: 'Part 3 đoạn thoại 3 người', lc: 390, rc: 370 },
  { id: 's6', name: 'Lê Hoàng Nam', code: 'TM-890', className: 'K42 Target 800+', group: 'NORMAL', homework: '18/20', score: 830, delta: 25, weak: 'Ngữ pháp mệnh đề quan hệ rút gọn', lc: 430, rc: 400 },
  { id: 's7', name: 'Đặng Đình Khôi', code: 'TM-804', className: 'K43 Nền tảng 750', group: 'AT_RISK', homework: '8/20', score: 610, delta: -40, weak: 'Part 5 <48% • câu bị động', lc: 320, rc: 290 },
]

export const examQuestions = [
  {
    id: 'q101',
    number: 101,
    part: 'Part 5',
    prompt: 'The marketing team reported a _____ increase in quarterly sales after the campaign launch.',
    options: [
      { key: 'A', text: 'substantially' },
      { key: 'B', text: 'substantial' },
      { key: 'C', text: 'substance' },
      { key: 'D', text: 'substantiate' },
    ],
  },
  {
    id: 'q102',
    number: 102,
    part: 'Part 5',
    prompt: 'It is mandatory that every employee _____ the safety training before operating the equipment.',
    options: [
      { key: 'A', text: 'attends' },
      { key: 'B', text: 'attended' },
      { key: 'C', text: 'attend' },
      { key: 'D', text: 'attending' },
    ],
  },
  {
    id: 'q103',
    number: 103,
    part: 'Part 5',
    prompt: 'The two companies agreed to _____ the contract terms before signing the final agreement.',
    options: [
      { key: 'A', text: 'negotiate' },
      { key: 'B', text: 'negotiation' },
      { key: 'C', text: 'negotiator' },
      { key: 'D', text: 'negotiable' },
    ],
  },
  {
    id: 'q104',
    number: 104,
    part: 'Part 5',
    prompt: 'Guests at the hotel receive a _____ breakfast as part of the weekend package.',
    options: [
      { key: 'A', text: 'complementary' },
      { key: 'B', text: 'complimentary' },
      { key: 'C', text: 'compliment' },
      { key: 'D', text: 'completing' },
    ],
  },
  {
    id: 'q105',
    number: 105,
    part: 'Part 5',
    prompt: 'Late payments may cause the client to _____ additional fees according to the invoice policy.',
    options: [
      { key: 'A', text: 'incur' },
      { key: 'B', text: 'incurring' },
      { key: 'C', text: 'incurrence' },
      { key: 'D', text: 'incurable' },
    ],
  },
]
