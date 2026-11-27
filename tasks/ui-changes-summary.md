# Tổng hợp thay đổi UI đã hoàn thiện (Tasks 1–13)

Tài liệu tổng hợp toàn bộ các file đã chỉnh sửa và những cải thiện UI/UX đã hoàn thành cho **toàn bộ 13 task** (bao gồm cả các mục xác nhận modal/tương tác từng hoãn từ Tasks 6–8) theo kế hoạch [plan.md](./plan.md).

---

## 1. Các file đã thay đổi

Tổng cộng **61 file mã nguồn** trong `@toeic/web` đã được chỉnh sửa xuyên suốt Tasks 1–13 (đối chiếu từ commit `edafc36ba`, đợt Tasks 4–9 và đợt Tasks 10–13; chưa tính `tasks/plan.md`, `tasks/todo.md`).

### Tasks 1–3 (Token hệ thống, Component nền tảng & Layout chung — 11 file)
- `apps/web/src/index.css` *(cập nhật tiếp ở Task 10 & 11)*
- `apps/web/src/components/ui/Button.tsx`
- `apps/web/src/components/ui/Primitives.tsx` *(cập nhật tiếp ở Task 13)*
- `apps/web/src/components/ui/CornerNotice.tsx`
- `apps/web/src/components/ui/Modal.tsx` *(nâng cấp `createPortal` ở đợt này)*
- `apps/web/src/components/ui/CalendarDateTimePicker.tsx`
- `apps/web/src/components/layout/HeaderSearch.tsx`
- `apps/web/src/components/layout/ViewAsBanner.tsx`
- `apps/web/src/components/layout/NotificationBell.tsx`
- `apps/web/src/components/layout/Shell.tsx` *(cập nhật tiếp ở Task 9)*
- `apps/web/src/features/errors/ErrorPages.tsx`

### Task 4 (Auth, Dashboard, Progress, Settings & Assignments học viên — 8 file)
- `apps/web/src/features/dashboard/DashboardPage.tsx`
- `apps/web/src/features/dashboard/DailyGoalsCard.tsx` *(cập nhật tiếp ở Task 10–11)*
- `apps/web/src/features/settings/SettingsPage.tsx` *(cập nhật tiếp ở Task 10)*
- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/features/auth/ChangePasswordPage.tsx`
- `apps/web/src/features/assignments/AssignmentsPage.tsx`
- `apps/web/src/features/progress/ProgressPage.tsx` *(cập nhật tiếp ở Task 9, 11, 12)*
- `apps/web/src/features/progress/ProgressParts.tsx` *(cập nhật tiếp ở Task 12)*

### Task 5 (Phòng thi, Chữa đề & Luyện tập — 6 file)
- `apps/web/src/features/exams/ExamPlayerPage.tsx` *(cập nhật tiếp ở Task 11)*
- `apps/web/src/features/exams/AudioPlayer.tsx` *(cập nhật tiếp ở Task 10)*
- `apps/web/src/features/exams/ReviewPage.tsx`
- `apps/web/src/features/exams/ResultPage.tsx` *(cập nhật tiếp ở Task 11)*
- `apps/web/src/features/exams/ZoomableImage.tsx` *(cập nhật tiếp ở Task 11)*
- `apps/web/src/features/practice/PracticePage.tsx`

### Task 6 (Học từ vựng, Sổ tay, Vinh danh & Báo lỗi — 12 file, gồm `StaffHonorPage.tsx` hoàn thiện từ mục hoãn)
- `apps/web/src/features/study/FlashcardPage.tsx` *(cập nhật tiếp ở Task 12)*
- `apps/web/src/features/study/StudyPage.tsx`
- `apps/web/src/features/study/GrammarLessonPage.tsx` *(cập nhật tiếp ở Task 12)*
- `apps/web/src/features/study/VocabGamesPage.tsx` *(cập nhật tiếp ở Task 12)*
- `apps/web/src/features/study/VocabCourse.tsx` *(cập nhật tiếp ở Task 11)*
- `apps/web/src/features/study/SelectableText.tsx`
- `apps/web/src/features/vocabulary/NotebookPage.tsx` *(bổ sung modal xác nhận xóa + `.catch()` ở đợt này)*
- `apps/web/src/features/honor/FrameWardrobeModal.tsx`
- `apps/web/src/features/honor/HonorBoards.tsx` *(cập nhật tiếp ở Task 9 & 11)*
- `apps/web/src/features/honor/StaffHonorPage.tsx` *(bổ sung `<Modal>` thay `window.confirm` ở đợt này)*
- `apps/web/src/features/bugs/BugReportWidget.tsx` *(bổ sung phím `Esc` & flatten ở đợt này)*
- `apps/web/src/features/bugs/BugReportsPage.tsx` *(bổ sung `updatingId` ở Task 10)*

### Task 7 (Trang Giáo viên — Lớp học, Học sinh & Giao bài — 8 file)
- `apps/web/src/features/teacher/TeacherAssignmentsPage.tsx` *(bổ sung modal `Đóng bài` + skeleton + alert ở đợt này)*
- `apps/web/src/features/teacher/FillAssignForm.tsx`
- `apps/web/src/features/teacher/ClassRooms.tsx` *(bổ sung `<Modal>` thay `window.confirm` + skeleton ở đợt này)*
- `apps/web/src/features/teacher/StudentDialogs.tsx`
- `apps/web/src/features/teacher/StudentDetailPage.tsx` *(cập nhật tiếp ở Task 11–12)*
- `apps/web/src/features/teacher/TeacherDashboardPage.tsx` *(cập nhật tiếp ở Task 11–12)*
- `apps/web/src/features/teacher/ReportsPage.tsx` *(cập nhật tiếp ở Task 11–12)*
- `apps/web/src/features/teacher/ViewAsPage.tsx` *(cập nhật tiếp ở Task 10)*

### Task 8 (Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site — 6 file)
- `apps/web/src/features/teacher/ExamBundlePanel.tsx`
- `apps/web/src/features/teacher/ExamBankPage.tsx` *(bổ sung skeleton + `actingId` ở Task 10)*
- `apps/web/src/features/teacher/ImportReview.tsx`
- `apps/web/src/features/teacher/ListeningScanReview.tsx` *(mở rộng hit-area crop ở Task 11)*
- `apps/web/src/features/teacher/AdminStudyPage.tsx` *(bổ sung modal xác nhận xóa chuyên đề/từ vựng ở đợt này)*
- `apps/web/src/features/teacher/SiteSettingsPage.tsx` *(cập nhật tiếp ở Task 10 & 12)*

### Task 9 (Đồng bộ Semantic Tokens & sửa xung đột `.ui-card`/`.bg-white` — 2 file mới + cập nhật chéo)
- `apps/web/src/features/site/SkyBackdrop.tsx`
- `apps/web/src/features/honor/RankBadge.tsx`

### Tasks 10–13 (Primitives, Card Flattening, Responsive Grids, Typography & A11y — 8 file mới + cập nhật chéo)
- `apps/web/src/components/layout/UserMenu.tsx`
- `apps/web/src/components/ui/LoadingScreen.tsx`
- `apps/web/src/features/settings/AvatarSettings.tsx`
- `apps/web/src/features/auth/AdminRecoveryDialog.tsx`
- `apps/web/src/features/practice/PartDrills.tsx`
- `apps/web/src/features/practice/PracticeTabs.tsx`
- `apps/web/src/features/exams/SheetGallery.tsx`
- `apps/web/src/features/exams/PassageView.tsx`

---

## 2. Những điểm UI đã cải thiện

### Tasks 1–3: Nền tảng thiết kế, Dark Mode, Overlay & Điều hướng chung
- **Hệ token Dark Mode & CSS (`index.css`, `Button.tsx`, `Primitives.tsx`):** Bổ sung các token nền tối (`--color-button-soft`, `--color-teal-soft`, `--color-danger-fill`, `--color-success-fill`, `--color-crimson-fill`), sửa màu chữ nút accent (`--ux-accent-ink`), tăng tương phản placeholder input (`0.68` / `text-ink/60`), sửa tương phản badge ngày hiện tại/chữ trên lịch và tắt chuyển động `.fx-*` / `.sky-twinkle` khi bật `prefers-reduced-motion: reduce`. Tạo helper `buttonClasses()` để dùng thống nhất cho `<Link>`.
- **Feedback & Overlay (`CornerNotice.tsx`, `Modal.tsx`, `CalendarDateTimePicker.tsx`):** `CornerNotice` dùng nền đặc tương phản AA trên mobile; `Modal` cuộn dọc an toàn, có nút `X`, focus-trap, khôi phục focus và render qua `createPortal(..., document.body)` để không bị kẹt trong `<Card>` có `backdrop-filter`; `CalendarDateTimePicker` chuyển sang bottom-sheet trên mobile và hỗ trợ phím mũi tên.
- **Header & Shell (`HeaderSearch.tsx`, `NotificationBell.tsx`, `ViewAsBanner.tsx`, `Shell.tsx`, `ErrorPages.tsx`):** Search & NotificationBell khớp màn `390px` kèm loading/error; `ViewAsBanner` hết đè header/navigation; `Shell` đóng dropdown/drawer bằng `Esc`/click ngoài/đổi route, hiển thị ví điểm trong drawer và trạng thái pending khi đăng xuất.

### Tasks 4–6 (gồm các mục hoãn đã hoàn thiện)
- **Dashboard, Settings & Auth (`DashboardPage.tsx`, `DailyGoalsCard.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, `ChangePasswordPage.tsx`, `AssignmentsPage.tsx`):** Thêm error + retry bài tập ở Dashboard; skeleton + stepper `44px` ở mục tiêu ngày; sửa thumb `Toggle` ở dark mode; thay toàn bộ `<Link><Button>` bằng `buttonClasses()`.
- **Phòng thi & Luyện tập (`ExamPlayerPage.tsx`, `AudioPlayer.tsx`, `ReviewPage.tsx`, `ResultPage.tsx`, `ZoomableImage.tsx`, `PracticePage.tsx`):** Thu gọn header phòng thi trên mobile, `<Modal>` nộp bài, thu gọn audio sticky ở `ReviewPage`, sửa tương phản lightbox `ZoomableImage` (`onDark`) và `AudioPlayer` wrap trên `390px`.
- **Học từ vựng, Sổ tay, Vinh danh & Báo lỗi:** `FlashcardPage`, `VocabGamesPage`, `VocabCourse` đủ loading/error/empty; `NotebookPage` có `<Modal>` xác nhận xóa kèm `.catch()` báo lỗi; `StaffHonorPage` thay `window.confirm()` bằng `<Modal>` xác nhận chốt thưởng sớm; `BugReportWidget` hỗ trợ phím `Esc` đóng nhanh và gợi ý độ dài tối thiểu.

### Tasks 7–9: Trang Giáo viên, Ngân hàng đề & Semantic Tokens
- **Trang Giáo viên (`TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ClassRooms.tsx`, `StudentDialogs.tsx`, `StudentDetailPage.tsx`, `TeacherDashboardPage.tsx`, `ReportsPage.tsx`, `ViewAsPage.tsx`):** Sửa nút `"Giao cả bộ đề"` ở dark mode sang `bg-button text-button-ink`; chuyển `grid-cols-2` sang `grid-cols-1 sm:grid-cols-2`; thêm `<Modal>` xác nhận `Đóng bài` (hiển thị `closeError` khi thất bại) và thay `window.confirm()` ở `ClassRooms` bằng `<Modal>`; khóa đóng modal khi `isPending`; luôn hiện nút `Đóng` ở `AssignmentCheckModal`; chặn `<AttemptsTable>` nháy rỗng khi đang tải; nâng nút phân trang `size-10` kèm `aria-current="page"`.
- **Ngân hàng đề & Học liệu (`ExamBundlePanel.tsx`, `ExamBankPage.tsx`, `ImportReview.tsx`, `ListeningScanReview.tsx`, `AdminStudyPage.tsx`, `SiteSettingsPage.tsx`):** `ReviewDock` biến thành thanh sticky ngang trên `<md` (kèm `overflow-x-clip` ở `AdminShell`); thêm `<Modal>` xác nhận xóa chuyên đề ngữ pháp & xóa từ vựng ở `AdminStudyPage`, dùng `<Badge>` chuẩn thay màu cứng, bổ sung đủ loading/error/empty; `SiteSettingsPage` hiện `<PageLoading>`/`<QueryErrorRedirect>` khi chưa có dữ liệu.
- **Semantic Tokens (`ProgressPage.tsx`, `SkyBackdrop.tsx`, `RankBadge.tsx`, `HonorBoards.tsx`, `NotebookPage.tsx`, `Shell.tsx`):** Tách card `bg-teal-soft` khỏi `.ui-card !important`; giữ sao `SkyBackdrop` trắng ở dark mode bằng `#ffffff` inline; chuyển các màu `amber-*`/`orange-*`/`emerald-*`/`slate-*` về `warn`, `warn-soft`, `success`, `paper`, `bg-black/35 dark:bg-black/55`; chuẩn hóa chữ `RankBadge` về `text-ink`.

### Tasks 10–13: Đồng bộ Primitives, Làm phẳng Card, Responsive, Typography & A11y
- **Primitives, Alert & Per-Row Loading (Task 10):**
  - Bổ sung focus ring cho `DarkModeSwitch` (`.u447-b:focus-visible`), `UserMenu` menu item, `PracticeTabs`, `FilterChip`, `SheetGallery`, select `ExamBankPage`/`StaffHonorPage`, và khóa `AdminRecoveryDialog` khi đang submit (`dismissible={!busy}`).
  - Chuẩn hóa các thông báo lỗi sang box đồng nhất `rounded-xl border border-danger/25 bg-danger-soft text-danger`; chuyển các `<input>` tự viết ở `SettingsPage` và `StaffHonorPage` sang `<Input>` chuẩn.
  - Thêm nút `"Thử tải lại audio"` khôi phục playback có guard `recovering` + reload sau khi React cập nhật URL ở `AudioPlayer`; thêm skeleton thay `"Đang tải…"` trần ở `TeacherAssignmentsPage`, `ClassRooms`, `ExamBankPage`; theo dõi loading riêng từng thẻ/dòng ở `PartDrills`, `BugReportsPage`, `ExamBankPage`.
- **Làm phẳng Card & Responsive Grids (Task 11):**
  - Clamp `.exam-blank` (`width: min(8em, 100%); min-width: min(6.5em, 100%); max-width: 100%`) và tách nút `Nhóm trước`/`Nhóm tiếp` ra ngoài `.exam-scale` (giữ wrapper `min-w-0` cho lưới 2 cột ảnh nghe) để zoom chữ 300% trên mobile `390px` không bị tràn.
  - Làm phẳng card lồng nhiều lớp ở `YesterdayCorner` (`DailyGoalsCard`), Top 3 (`HonorBoards`), `PassageView` và `BugReportWidget`.
  - Đổi các lưới 4 KPI (`ProgressPage`, `ResultPage`, `TeacherDashboardPage`, `StudentDetailPage`, `ReportsPage`) sang `grid-cols-2 md:grid-cols-4` / `grid-cols-2 sm:grid-cols-4`; đổi Top 3 Honor (`HonorBoards`) sang `grid-cols-1 sm:grid-cols-3`; bỏ badge `position: absolute` dễ đè tiêu đề ở `UnitCard` (`VocabCourse`); mở rộng vùng chạm nút `ZoomableImage` lên `40px` và tay kéo khung cắt `ListeningScanReview` lên `h-4`/`w-4` trong suốt.
- **Typography Scale, `tabular-nums`, Heading & Chống tràn (Task 12):**
  - Chuẩn hóa cỡ chữ tùy biến (`text-[13px]`, `text-[17px]`) về thang chuẩn (`text-xs`, `text-base`); sửa nhảy cấp heading `h3` -> `h2` ở `StudentDetailPage`.
  - Bổ sung `tabular-nums` cho mọi chỉ số KPI, tỷ lệ đúng và bộ đếm điểm; thêm `w-full max-w-full break-words` chống tràn từ dài ở `FlashcardPage` & `VocabGamesPage`; bỏ `w-36` cố định ở `SiteSettingsPage` và căn đều đáy nút `PartDrills` bằng `mt-auto pt-4`.
- **A11y, Empty State phụ & Tối ưu nhỏ (Task 13):**
  - Thêm `role="progressbar"`, `aria-label` mặc định/tùy chỉnh, `aria-valuenow/min/max` (kèm bảo vệ `Number.isFinite`) cho `ProgressBar` (`Primitives.tsx`).
  - Thêm `motion-reduce:animate-none` cho spinner, bỏ nền cứng `bg-[#ffffff]` + `p-1.5` trên logo (chuyển `bg-cream`) và dùng `bg-crimson-fill` cho badge slogan ở `LoadingScreen.tsx`.
  - Lấy `brandName` và `phone` từ `useSite()` cho câu hỗ trợ ở `ErrorPages.tsx`, bỏ text hardcode `"Thầy Minh"`.
  - Bổ sung empty state khi chưa có chuyên đề ngữ pháp ở `AdminStudyPage.tsx`; bọc thông báo hết giờ đang nộp bài ở `ExamPlayerPage.tsx` trong `<Card>` có spinner và màu chữ `text-ink`/`text-ink-soft` tương phản tốt cả Light & Dark Mode; giảm tần suất cập nhật `SkyBackdrop.tsx` từ `1s` xuống `30s`.
