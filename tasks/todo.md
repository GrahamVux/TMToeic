# UI Audit & Remediation Checklist (`@toeic/web`)

Kế hoạch chi tiết xem tại [plan.md](./plan.md).

## Phase 1: P0 — Lỗi hiển thị, tương phản & UX nghiêm trọng

- [x] **Task 1: Sửa hệ token Dark Mode, Reduced Motion và tạo helper `buttonClasses`**
  - Files: `apps/web/src/index.css`, `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Primitives.tsx`, `apps/web/src/components/ui/CornerNotice.tsx`
  - [x] Bổ sung dark mode cho `--color-button-soft`, `--color-teal-soft`, `--ux-accent-ink`, `[aria-current="date"]`, `.u432-br`
  - [x] Tắt `.fx-*` và `.sky-twinkle` trong `@media (prefers-reduced-motion: reduce)`
  - [x] Xuất `buttonClasses` từ `Button.tsx`; sửa `CornerNotice` đạt AA + vừa 390px + nút đóng 40px
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web`

- [x] **Task 2: Nâng cấp `Modal`, `CalendarDateTimePicker` và `FilePick` cho Mobile & Bàn phím**
  - Files: `apps/web/src/components/ui/Modal.tsx`, `apps/web/src/components/ui/CalendarDateTimePicker.tsx`, `apps/web/src/components/ui/FilePick.tsx`
  - [x] `Modal` có cuộn dọc nội bộ, nút đóng `X`, focus-trap và khôi phục focus
  - [x] `CalendarDateTimePicker` căn lề responsive ở 390px, nâng kích thước chạm, hỗ trợ focus phím mũi tên
  - [x] `FilePick` có `focus-visible` ring rõ trên dropzone
  - [x] Verify: `npm run build -w @toeic/web` + test bàn phím & 390px

- [x] **Task 3: Sửa Header Mobile, `HeaderSearch`, `ViewAsBanner`, `NotificationBell` & `Shell`**
  - Files: `apps/web/src/components/layout/Shell.tsx`, `apps/web/src/components/layout/HeaderSearch.tsx`, `apps/web/src/components/layout/ViewAsBanner.tsx`, `apps/web/src/components/layout/NotificationBell.tsx`, `apps/web/src/features/errors/ErrorPages.tsx`
  - [x] `HeaderSearch` không làm tràn header 390px, dropdown khớp màn hình, hiển thị pending/error
  - [x] `ViewAsBanner` hết đè header/dropdown/BugReportWidget, sửa tương phản dark mode
  - [x] `Shell` có `focus-visible`, đóng dropdown/drawer bằng Esc/outside/route, thêm nút điểm thưởng vào drawer, pending khi đăng xuất
  - [x] `NotificationBell` có loading/error; `ErrorPages` bỏ `<Link><Button>`
  - [x] Verify: `npm run build -w @toeic/web` + test 390px & 1440px

- [x] **Checkpoint 1: After Tasks 1–3**
  - [x] `npm run build -w @toeic/web && npm run test -w @toeic/web` pass

- [x] **Task 4: Sửa lỗi P0 tại Auth, Dashboard, Progress, Settings & Assignments**
  - Files: `DashboardPage.tsx`, `DailyGoalsCard.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, `ChangePasswordPage.tsx`, `AssignmentsPage.tsx`, `ProgressPage.tsx`, `ProgressParts.tsx`
  - [x] Sửa thumb `Toggle` ở dark mode + mở rộng vùng chạm + `focus-visible`
  - [x] `DashboardPage` hiển thị `homework.isError` + nút thử lại; `DailyGoalsCard` có skeleton chống CLS + stepper 44px
  - [x] Thay toàn bộ `<Link><Button>` bằng `buttonClasses`; thêm `focus-visible` & `aria-pressed` ở Auth/Assignments
  - [x] Verify: `npm run build && npm run lint && npm run test` (phần kiểm tra Tab/mô phỏng lỗi API do người dùng tự kiểm tra trên trình duyệt)

- [x] **Task 5: Sửa lỗi P0 tại Phòng thi, Chữa đề & Luyện tập**
  - Files: `ExamPlayerPage.tsx`, `AudioPlayer.tsx`, `ReviewPage.tsx`, `ResultPage.tsx`, `ZoomableImage.tsx`, `PracticePage.tsx`
  - [x] Sửa tương phản lightbox (`onDark`) và nút `"Làm đề mới nhất"` dark mode
  - [x] Thu gọn sticky audio ở `ReviewPage`; `AudioPlayer` wrap trên 390px với play `size-11` + `focus-visible`
  - [x] `ExamPlayerPage`: thêm `focus-visible` radio/bảng câu hỏi, nâng cỡ ô mobile, dùng `<Modal>` nộp bài
  - [x] Bỏ `<Link><Button>` ở `ResultPage`, `ReviewPage`, `PracticePage`
  - [x] Verify: `npm run build && npm run lint && npm run test` (test trực quan 390px/1440px trên trình duyệt)

- [x] **Task 6: Sửa lỗi P0 tại Học từ vựng, Sổ tay, Vinh danh & Báo lỗi**
  - Files: `FlashcardPage.tsx`, `StudyPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`, `VocabCourse.tsx`, `SelectableText.tsx`, `NotebookPage.tsx`, `FrameWardrobeModal.tsx`, `HonorBoards.tsx`, `StaffHonorPage.tsx`, `BugReportWidget.tsx`, `BugReportsPage.tsx`
  - [x] `FlashcardPage` check lỗi trước `cards === null`, thêm `focus-visible`/`aria-pressed` và disable khi fetching
  - [x] `VocabGamesPage` & `VocabCourse` có loading/error/empty; `SelectableText`, `FrameWardrobeModal`, `HonorBoards` chống tràn 390px
  - [x] `NotebookPage` mở rộng vùng chạm + tách hàng bảng màu chống ép cột 390px
  - [x] `NotebookPage` xác nhận xóa qua `<Modal>` + `.catch()`; `StaffHonorPage` bỏ `window.confirm` dùng `<Modal>`; `BugReportWidget` thêm phím `Esc`
  - [x] `BugReportWidget` & `BugReportsPage` có gợi ý nhập tối thiểu, loading/error, `focus-visible`; bỏ `<Link><Button>`
  - [x] Verify: `npm run build && npm run lint && npm run test` (test bàn phím & 390px trên trình duyệt)

- [x] **Task 7: Sửa lỗi P0 tại Trang Giáo viên — Lớp học, Học sinh & Giao bài**
  - Files: `TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ClassRooms.tsx`, `StudentDialogs.tsx`, `StudentDetailPage.tsx`, `TeacherDashboardPage.tsx`, `ReportsPage.tsx`, `ViewAsPage.tsx`
  - [x] Sửa tương phản dark mode ở `TeacherAssignmentsPage`, `ViewAsPage`, `ClassRooms`
  - [x] `grid-cols-1 sm:grid-cols-2` cho form giao bài; `ClassRooms` có `classes.isError`; `StudentDetailPage` không flash `<AttemptsTable>`
  - [x] `StudentDialogs` khóa đóng khi pending; `AssignmentCheckModal` luôn hiện nút `Đóng` khi loading/error
  - [x] `TeacherAssignmentsPage` có modal xác nhận `Đóng bài` + xử lý lỗi; `ClassRooms` bỏ `window.confirm` dùng `<Modal>`
  - [x] `TeacherDashboardPage` & `ReportsPage` bỏ `<Link><Button>`, thêm `focus-visible` và nâng nút phân trang
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web` (test trực quan Dark Mode & 390px trên trình duyệt)

- [x] **Task 8: Sửa lỗi P0 tại Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site**
  - Files: `ExamBundlePanel.tsx`, `ExamBankPage.tsx`, `ImportReview.tsx`, `ListeningScanReview.tsx`, `AdminStudyPage.tsx`, `SiteSettingsPage.tsx`
  - [x] `ExamBundlePanel`: `grid-cols-1 sm:grid-cols-2` + loading/error + `min-h` nút chọn đề
  - [x] `ImportReview` & `ListeningScanReview`: `ReviewDock` ngang sticky trên `<md`
  - [x] `AdminStudyPage`: modal xác nhận xóa chuyên đề & từ vựng, badge dark-safe (`<Badge>`), loading/error/empty vocab, nút chạm ≥ 40px + `aria-label` + disable khi pending
  - [x] `SiteSettingsPage`: chặn form rỗng lúc đang tải (`remote.isPending && !remote.data`); `ExamBankPage`: empty state + bỏ `<Link><Button>`
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`

- [x] **Checkpoint 2: Hoàn tất toàn bộ P0**
  - [x] `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web` pass
  - [ ] Rà soát 390px & 1440px, Light & Dark Mode *(cần người dùng tự kiểm tra trên trình duyệt)*

## Phase 2: P1 — Thẩm mỹ, đồng bộ hệ thống thiết kế & tối ưu Responsive

- [x] **Task 9: Đồng bộ màu sắc về Semantic Tokens & sửa xung đột `.ui-card`/`.bg-white`**
  - Files: `ProgressPage.tsx`, `SkyBackdrop.tsx`, `HonorBoards.tsx`, `RankBadge.tsx`, `NotebookPage.tsx`, `Shell.tsx`, `SiteSettingsPage.tsx`, `ListeningScanReview.tsx`
  - [x] Thay màu Tailwind ngoài hệ / hex cứng bằng semantic tokens (`warn`, `warn-soft`, `success`, `paper`, `cream`, `bg-black/35 dark:bg-black/55`)
  - [x] Sửa `ProgressPage` card `bg-teal-soft`, sao `SkyBackdrop`, tương phản chữ `RankBadge` và `overflow-x-clip` ở `AdminShell`
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`

- [x] **Task 10: Đồng bộ Primitives (`Input`, `Badge`, Alert lỗi, Modal xác nhận) & Loading theo dòng**
  - Files: `Modal.tsx`, `index.css`, `UserMenu.tsx`, `SettingsPage.tsx`, `AvatarSettings.tsx`, `AdminRecoveryDialog.tsx`, `PartDrills.tsx`, `PracticeTabs.tsx`, `SheetGallery.tsx`, `AudioPlayer.tsx`, `ClassRooms.tsx`, `TeacherAssignmentsPage.tsx`, `ViewAsPage.tsx`, `SiteSettingsPage.tsx`, `ExamBankPage.tsx`, `BugReportsPage.tsx`, `BugReportWidget.tsx`, `DailyGoalsCard.tsx`, `StaffHonorPage.tsx`
  - [x] `Modal` render qua `createPortal(..., document.body)` tránh kẹt trong `<Card>` `backdrop-filter`; thay `<input>` tự viết bằng `<Input>` ở `SettingsPage` / `StaffHonorPage`; đồng nhất alert lỗi `bg-danger-soft text-danger border-danger/25`
  - [x] Bỏ `window.confirm()` ở `ClassRooms` & `StaffHonorPage`; thêm nút `"Thử tải lại audio"` ở `AudioPlayer`; thêm skeleton thay chữ trần ở `TeacherAssignmentsPage`, `ClassRooms`, `ExamBankPage`
  - [x] Theo dõi loading theo từng thẻ/dòng (`PartDrills`, `BugReportsPage`, `ExamBankPage`); bổ sung `focus-visible` cho `.u447-b`, `UserMenu`, `PracticeTabs`, `FilterChip`, `SheetGallery` và khóa `AdminRecoveryDialog` khi pending
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`

- [x] **Task 11: Tinh gọn bố cục Card lồng nhau & tối ưu lưới Responsive (Mobile/Tablet)**
  - Files: `ExamPlayerPage.tsx`, `PassageView.tsx`, `ZoomableImage.tsx`, `DailyGoalsCard.tsx`, `ProgressPage.tsx`, `ResultPage.tsx`, `HonorBoards.tsx`, `VocabCourse.tsx`, `TeacherDashboardPage.tsx`, `StudentDetailPage.tsx`, `ReportsPage.tsx`, `ListeningScanReview.tsx`, `BugReportWidget.tsx`, `index.css`
  - [x] Làm phẳng card lồng > 2 tầng (`YesterdayCorner`, `HonorBoards`, `PassageView`, `BugReportWidget`)
  - [x] Tách Prev/Next ra ngoài `.exam-scale` (giữ wrapper `min-w-0` cho lưới 2 cột ảnh nghe), clamp `width`/`min-width` cho `.exam-blank` ở zoom 300%
  - [x] Thêm `grid-cols-2` cho KPI 4 cột, `grid-cols-1 sm:grid-cols-3` cho Top 3 Honor, bố cục flex sạch cho header `UnitCard`, mở rộng nút `ZoomableImage` lên `40px` và hit-area kéo crop `ListeningScanReview` (`h-4`/`w-4`)
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web` (test 390px, 768px, 1440px trên trình duyệt)

- [x] **Checkpoint 3: Hoàn tất P1**
  - [x] `npm run build -w @toeic/web` & `npm run lint -w @toeic/web` pass không cảnh báo mới.

## Phase 3: P2 — Tinh chỉnh nhỏ

- [x] **Task 12: Chuẩn hóa Typography Scale, `tabular-nums` & Thứ tự Heading**
  - Files: `ProgressPage.tsx`, `ProgressParts.tsx`, `PartDrills.tsx`, `PassageView.tsx`, `FlashcardPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`, `StudentDetailPage.tsx`, `TeacherDashboardPage.tsx`, `ReportsPage.tsx`, `SiteSettingsPage.tsx`, `HonorBoards.tsx`, `VocabCourse.tsx`, `ZoomableImage.tsx`, `StaffHonorPage.tsx`
  - [x] Chuẩn hóa `text-[13px]`/`text-[17px]` về `text-xs`/`text-base`, sửa nhảy cấp heading `h3` -> `h2` ở `StudentDetailPage`, thêm `tabular-nums` cho các số KPI/điểm/tỉ lệ
  - [x] Chống tràn từ vựng dài trên `FlashcardPage` & `VocabGamesPage`, bỏ `w-36` cố định ở `SiteSettingsPage` và căn đáy nút card `PartDrills` bằng `mt-auto pt-4`
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`

- [x] **Task 13: Tinh chỉnh A11y, Empty State phụ & Tối ưu nhỏ**
  - Files: `Primitives.tsx`, `LoadingScreen.tsx`, `ErrorPages.tsx`, `AdminStudyPage.tsx`, `SkyBackdrop.tsx`, `ExamPlayerPage.tsx`
  - [x] ARIA `progressbar` (`role`, `aria-label`, `aria-valuenow/min/max` + guard `NaN`), `motion-reduce:animate-none` cho `LoadingScreen` + `bg-cream`/`bg-crimson-fill`, lấy tên thương hiệu/hotline từ `useSite()` ở `ErrorPages`
  - [x] Empty state ngữ pháp ở `AdminStudyPage`, `<Card>` overlay hết giờ có spinner & tương phản sáng/tối ở `ExamPlayerPage`, giảm `SkyBackdrop` interval xuống `30_000ms`
  - [x] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`
