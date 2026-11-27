# Tổng hợp thay đổi UI đã hoàn thiện (Tasks 1–9)

Tài liệu tổng hợp toàn bộ các file giao diện đã chỉnh sửa và những cải thiện UI/UX đã hoàn thành từ **Task 1 đến Task 9** trong kế hoạch [plan.md](./plan.md).

---

## 1. Các file đã thay đổi

Tổng cộng **52 file mã nguồn** trong `@toeic/web` đã được chỉnh sửa (đối chiếu trực tiếp từ commit `edafc36ba` của Tasks 1–3 và `git status` của Tasks 4–9; chưa tính các file kế hoạch `tasks/plan.md`, `tasks/todo.md`).

### Tasks 1–3 (Token hệ thống, Component nền tảng & Layout chung — 11 file)
- `apps/web/src/index.css`
- `apps/web/src/components/ui/Button.tsx`
- `apps/web/src/components/ui/Primitives.tsx`
- `apps/web/src/components/ui/CornerNotice.tsx`
- `apps/web/src/components/ui/Modal.tsx`
- `apps/web/src/components/ui/CalendarDateTimePicker.tsx`
- `apps/web/src/components/layout/HeaderSearch.tsx`
- `apps/web/src/components/layout/ViewAsBanner.tsx`
- `apps/web/src/components/layout/NotificationBell.tsx`
- `apps/web/src/components/layout/Shell.tsx` *(cập nhật tiếp ở Task 9)*
- `apps/web/src/features/errors/ErrorPages.tsx`

### Task 4 (Auth, Dashboard, Progress, Settings & Assignments học viên — 8 file)
- `apps/web/src/features/dashboard/DashboardPage.tsx`
- `apps/web/src/features/dashboard/DailyGoalsCard.tsx`
- `apps/web/src/features/settings/SettingsPage.tsx`
- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/features/auth/ChangePasswordPage.tsx`
- `apps/web/src/features/assignments/AssignmentsPage.tsx`
- `apps/web/src/features/progress/ProgressPage.tsx` *(cập nhật tiếp ở Task 9)*
- `apps/web/src/features/progress/ProgressParts.tsx`

### Task 5 (Phòng thi, Chữa đề & Luyện tập — 6 file)
- `apps/web/src/features/exams/ExamPlayerPage.tsx`
- `apps/web/src/features/exams/AudioPlayer.tsx`
- `apps/web/src/features/exams/ReviewPage.tsx`
- `apps/web/src/features/exams/ResultPage.tsx`
- `apps/web/src/features/exams/ZoomableImage.tsx`
- `apps/web/src/features/practice/PracticePage.tsx`

### Task 6 (Học từ vựng, Sổ tay, Vinh danh & Báo lỗi — 11 file)
- `apps/web/src/features/study/FlashcardPage.tsx`
- `apps/web/src/features/study/StudyPage.tsx`
- `apps/web/src/features/study/GrammarLessonPage.tsx`
- `apps/web/src/features/study/VocabGamesPage.tsx`
- `apps/web/src/features/study/VocabCourse.tsx`
- `apps/web/src/features/study/SelectableText.tsx`
- `apps/web/src/features/vocabulary/NotebookPage.tsx` *(cập nhật tiếp ở Task 9)*
- `apps/web/src/features/honor/FrameWardrobeModal.tsx`
- `apps/web/src/features/honor/HonorBoards.tsx` *(cập nhật tiếp ở Task 9)*
- `apps/web/src/features/bugs/BugReportWidget.tsx`
- `apps/web/src/features/bugs/BugReportsPage.tsx`

### Task 7 (Trang Giáo viên — Lớp học, Học sinh & Giao bài — 8 file)
- `apps/web/src/features/teacher/TeacherAssignmentsPage.tsx`
- `apps/web/src/features/teacher/FillAssignForm.tsx`
- `apps/web/src/features/teacher/ClassRooms.tsx`
- `apps/web/src/features/teacher/StudentDialogs.tsx`
- `apps/web/src/features/teacher/StudentDetailPage.tsx`
- `apps/web/src/features/teacher/TeacherDashboardPage.tsx`
- `apps/web/src/features/teacher/ReportsPage.tsx`
- `apps/web/src/features/teacher/ViewAsPage.tsx`

### Task 8 (Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site — 6 file)
- `apps/web/src/features/teacher/ExamBundlePanel.tsx`
- `apps/web/src/features/teacher/ExamBankPage.tsx`
- `apps/web/src/features/teacher/ImportReview.tsx`
- `apps/web/src/features/teacher/ListeningScanReview.tsx`
- `apps/web/src/features/teacher/AdminStudyPage.tsx`
- `apps/web/src/features/teacher/SiteSettingsPage.tsx`

### Task 9 (Đồng bộ Semantic Tokens & sửa xung đột `.ui-card`/`.bg-white` — 6 file, gồm 4 file cập nhật bổ sung + 2 file mới)
- `apps/web/src/features/site/SkyBackdrop.tsx`
- `apps/web/src/features/honor/RankBadge.tsx`
- `apps/web/src/features/progress/ProgressPage.tsx` *(bổ sung sau Task 4)*
- `apps/web/src/features/honor/HonorBoards.tsx` *(bổ sung sau Task 6)*
- `apps/web/src/features/vocabulary/NotebookPage.tsx` *(bổ sung sau Task 6)*
- `apps/web/src/components/layout/Shell.tsx` *(bổ sung sau Tasks 1–3)*

---

## 2. Những điểm UI đã cải thiện

### Tasks 1–3: Nền tảng thiết kế, Dark Mode, Overlay & Điều hướng chung
- **Hệ token Dark Mode & CSS (`index.css`, `Button.tsx`, `Primitives.tsx`):** Bổ sung các token nền tối (`--color-button-soft`, `--color-teal-soft`, `--color-danger-fill`, `--color-success-fill`, `--color-crimson-fill`), sửa màu chữ nút accent (`--ux-accent-ink`), tăng tương phản placeholder input (`0.68` / `text-ink/60`), sửa tương phản badge ngày hiện tại/chữ trên lịch và tắt chuyển động `.fx-*` / `.sky-twinkle` khi bật `prefers-reduced-motion: reduce`. Tạo helper `buttonClasses()` để dùng thống nhất cho `<Link>`.
- **Feedback & Overlay (`CornerNotice.tsx`, `Modal.tsx`, `CalendarDateTimePicker.tsx`):** `CornerNotice` dùng nền đặc tương phản AA trên mobile (`max-w-[min(28rem,calc(100vw-2rem))]`) với nút đóng `size-10` có focus ring. `Modal` cuộn dọc an toàn (`max-h-[calc(100dvh-2rem)] overflow-y-auto`), có nút `X`, focus-trap bằng phím Tab và khôi phục focus sau khi đóng. `CalendarDateTimePicker` chuyển sang bottom-sheet trên mobile, hỗ trợ điều hướng mũi tên trên lịch và vùng chạm `h-10`–`min-h-10`.
- **Header & Shell (`HeaderSearch.tsx`, `NotificationBell.tsx`, `ViewAsBanner.tsx`, `Shell.tsx`, `ErrorPages.tsx`):** Ô tìm kiếm và chuông thông báo bung vừa chiều rộng mobile (`390px`) kèm trạng thái loading/error; `ViewAsBanner` dùng màu `bg-banner text-banner-ink` và đặt vị trí tránh che header/drawer/thanh điều hướng đáy; `Shell` bổ sung focus ring đầy đủ, đóng menu/drawer bằng `Esc`/click ngoài/đổi route, hiển thị ví điểm thưởng trong drawer mobile, trạng thái pending khi đăng xuất và chấm báo lỗi ở mục "Xem thêm"; `ErrorPages` bỏ `<Link><Button>` lồng nhau.

### Task 4: Auth, Dashboard, Tiến độ, Cài đặt & Bài tập học viên
- **Dashboard & Mục tiêu ngày (`DashboardPage.tsx`, `DailyGoalsCard.tsx`):** Bổ sung thông báo lỗi tải bài tập kèm nút thử lại; thêm skeleton khi đang tải mục tiêu ngày tránh giật bố cục (CLS) và nâng kích thước chạm nút stepper lên `44px`.
- **Tài khoản & Cài đặt (`SettingsPage.tsx`, `LoginPage.tsx`, `ChangePasswordPage.tsx`):** Sửa thumb của `Toggle` để nhìn rõ trong dark mode, mở rộng vùng chạm và bổ sung `focus-visible`; bổ sung focus ring cho nút chọn track mục tiêu và nút hiện/ẩn mật khẩu.
- **Tiến độ & Bài tập (`AssignmentsPage.tsx`, `ProgressPage.tsx`, `ProgressParts.tsx`):** Thay toàn bộ `<Link><Button>` lồng nhau bằng `buttonClasses()`; bổ sung `focus-visible` và `aria-pressed` cho bộ lọc và tab trong trang Bài tập/Tiến độ.

### Task 5: Phòng thi, Chữa đề & Luyện tập
- **Phòng thi (`ExamPlayerPage.tsx`):** Thu gọn header phòng thi trên mobile, bổ sung `focus-visible` cho đáp án radio và lưới chuyển câu, tăng kích thước ô câu hỏi trên mobile và chuyển hộp thoại xác nhận nộp bài sang `<Modal>` chuẩn có focus-trap.
- **Audio & Chữa đề (`AudioPlayer.tsx`, `ReviewPage.tsx`, `ZoomableImage.tsx`, `ResultPage.tsx`, `PracticePage.tsx`):** `AudioPlayer` cho phép wrap xuống dòng hợp lý ở `390px` với nút play `size-11` và `focus-visible`; thu gọn thanh audio sticky ở `ReviewPage` để không chiếm quá nhiều chiều cao màn hình; sửa tương phản nút/chú thích trên nền tối của lightbox xem ảnh (`ZoomableImage`); thay `<Link><Button>` bằng `buttonClasses()` ở `ResultPage`, `ReviewPage`, `PracticePage`.

### Task 6: Học từ vựng, Sổ tay, Vinh danh & Báo lỗi
- **Flashcard & Từ vựng (`FlashcardPage.tsx`, `StudyPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`, `VocabCourse.tsx`, `SelectableText.tsx`):** `FlashcardPage` ưu tiên hiển thị trạng thái lỗi trước khi kiểm tra dữ liệu rỗng, khóa thao tác khi đang refetch, bổ sung `focus-visible`/`aria-pressed`; `VocabGamesPage` và `VocabCourse` có đủ trạng thái loading/error/empty; `SelectableText` và `FrameWardrobeModal` chống tràn ngang trên `390px`.
- **Sổ tay & Vinh danh (`NotebookPage.tsx`, `FrameWardrobeModal.tsx`, `HonorBoards.tsx`):** Mở rộng vùng chạm ở bảng màu sổ tay và tách hàng hợp lý để không ép cột trên mobile; đồng bộ focus ring và chống tràn cho tab/bảng xếp hạng.
- **Báo lỗi (`BugReportWidget.tsx`, `BugReportsPage.tsx`):** Thêm gợi ý số ký tự tối thiểu, hiển thị rõ loading/error/empty và `focus-visible`, bỏ `<Link><Button>` lồng nhau.

### Task 7: Trang Giáo viên — Lớp học, Học sinh & Giao bài
- **Tương phản Dark Mode & Lưới Responsive (`TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ClassRooms.tsx`):** Đổi nút `"Giao cả bộ đề"` từ `bg-navy text-white` (bị chói/mất tương phản khi `--color-navy` đổi màu sáng ở dark mode) sang `bg-button text-button-ink`; chuyển lưới 2 cột chật (`grid-cols-2`) sang `grid-cols-1 sm:grid-cols-2` ở form thời gian/hạn nộp; làm dịu thẻ giáo viên lồng nhau từ `bg-cream` sang `bg-paper`; bọc nhóm `<Badge>` trong `flex-wrap`.
- **Trạng thái Loading, Error & Empty (`ClassRooms.tsx`, `TeacherAssignmentsPage.tsx`, `StudentDialogs.tsx`, `StudentDetailPage.tsx`, `ViewAsPage.tsx`):** Bổ sung alert lỗi kèm nút thử lại cho danh sách lớp (`ClassRooms`, `TeacherClassPanels`), danh sách giáo viên (`TeacherAccessPanel`), tài khoản giả lập (`ViewAsPage`); thêm empty state cho danh sách bài đã giao và danh sách giáo viên; chặn `<AttemptsTable>` không nháy empty state khi `sittings` đang tải hoặc lỗi; luôn giữ nút `Đóng` trong `AssignmentCheckModal` khi đang tải/lỗi; khóa đóng modal và disable nút Hủy/Đóng khi mutation đang `isPending` trong `StudentDialogs` và `CreateClassButton`.
- **A11y & Kích thước chạm (`TeacherDashboardPage.tsx`, `ReportsPage.tsx`, `FillAssignForm.tsx`, `ViewAsPage.tsx`):** Thay `<Link><Button>` bằng `buttonClasses()`; nâng nút phân trang lên `size-10` kèm `aria-current="page"`; bổ sung `aria-pressed`, `min-h-10`, `aria-label` và `focus-visible` cho tab/chip lọc/ô tìm kiếm/textarea/select.

### Task 8: Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site
- **Responsive ReviewDock & Ghép bộ đề (`ImportReview.tsx`, `ListeningScanReview.tsx`, `ExamBundlePanel.tsx`):** Ở màn hình `<md`, chuyển `ReviewDock` từ cột cố định `116px` ép hẹp toàn bộ form câu hỏi thành thanh sticky ngang phía trên (`sticky top-[4.5rem]`) và giữ dock cố định bên trái ở `md+`; bảo vệ hàm đo vị trí `place()` khi cột desktop ẩn; sửa lưới ghép bộ đề sang `grid-cols-1 sm:grid-cols-2`, bỏ cắt xén `h-[4.875rem] overflow-hidden` sang `min-h-[4.875rem]`, bổ sung loading/error + thử lại cho `ExamBundlePanel`.
- **Ngân hàng đề & Cài đặt Site (`ExamBankPage.tsx`, `SiteSettingsPage.tsx`):** Thêm empty state cho `ExamList`, bỏ `<Link><Button>`, sửa lưới builder sang `sm:grid-cols-2`, thêm focus ring và `aria-pressed`; ở `SiteSettingsPage`, hiển thị `<PageLoading>` / `<QueryErrorRedirect>` khi chưa có dữ liệu để tránh hiện form rỗng lúc đang tải, thay `#0b1218` và `border-black/15` bằng `var(--color-paper)` và `border-ink/15`.
- **Quản trị Học liệu (`AdminStudyPage.tsx`):** Thay badge màu cứng `bg-emerald-100`/`bg-amber-100` và `hover:bg-red-50` bằng `<Badge tone="olive"|"warn">` và `hover:bg-danger-soft`; bổ sung đầy đủ trạng thái loading/error/empty cho `useVocabCourse`, `useVocabUnitDetail` và `useVocabSearch`; nâng các input/nút trong bảng kiểm duyệt và dòng sửa DB lên `h-10`/`size-10` kèm `aria-label`, `aria-pressed`, `focus-visible` và `disabled={isPending}` cho nút xóa.

### Task 9: Đồng bộ Semantic Tokens & sửa xung đột `.ui-card` / `.bg-white`
- **Gỡ xung đột `!important` ở Dark Mode (`ProgressPage.tsx`, `SkyBackdrop.tsx`, `Shell.tsx`):** Thay `<Card className="bg-teal-soft">` bằng `<section className="rounded-2xl border border-gold/35 bg-teal-soft p-6">` để `.ui-card !important` không ghi đè mất nền nhấn; bỏ class `.bg-white` trên các ngôi sao của `SkyBackdrop` và đặt `backgroundColor: '#ffffff'` trực tiếp để sao giữ được màu trắng; đổi `overflow-x-hidden` ở `AdminShell` sang `overflow-x-clip` để `position: sticky` hoạt động đúng; đổi nền che drawer tối thành `bg-black/35 dark:bg-black/55` thay vì `bg-slate-950/35`.
- **Thống nhất bảng màu ngữ nghĩa (`HonorBoards.tsx`, `RankBadge.tsx`, `NotebookPage.tsx`, `Shell.tsx`):** Thay các class màu Tailwind ngoài hệ (`amber-*`, `orange-*`, `emerald-*`, `slate-900/*`) bằng token chuẩn (`warn`, `warn-soft`, `success`, `paper`, `paper-2`, `gold`, `gold-deep`); chuẩn hóa chữ nhãn hạng trên `RankBadge` và `PodiumMark` dùng `text-ink` để đảm bảo độ tương phản ở cả Light Mode lẫn Dark Mode.

---

### Các mục giữ lại theo ràng buộc chỉ chỉnh sửa UI (UI-only)
Vì không thay đổi state management hay logic nghiệp vụ trong đợt này, các hộp thoại xác nhận mới hoặc chuyển `window.confirm()` sang modal state vẫn được giữ nguyên trạng thái hoãn (đã ghi chú trong [todo.md](./todo.md)):
- Thêm hộp thoại xác nhận xóa / xử lý lỗi `.catch()` ở `NotebookPage.tsx`.
- Thay `window.confirm()` bằng `<Modal>` xác nhận ở `StaffHonorPage.tsx` và `ClassRooms.tsx`.
- Thêm phím `Esc` đóng widget ở `BugReportWidget.tsx`.
- Thêm modal xác nhận cho nút `"Đóng bài"` ở `TeacherAssignmentsPage.tsx` và các nút xóa ở `AdminStudyPage.tsx`.
