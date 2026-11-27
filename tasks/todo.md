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

- [ ] **Task 4: Sửa lỗi P0 tại Auth, Dashboard, Progress, Settings & Assignments**
  - Files: `DashboardPage.tsx`, `DailyGoalsCard.tsx`, `SettingsPage.tsx`, `LoginPage.tsx`, `ChangePasswordPage.tsx`, `AssignmentsPage.tsx`, `ProgressPage.tsx`, `ProgressParts.tsx`
  - [ ] Sửa thumb `Toggle` ở dark mode + mở rộng vùng chạm + `focus-visible`
  - [ ] `DashboardPage` hiển thị `homework.isError`; `DailyGoalsCard` có skeleton chống CLS + stepper 44px
  - [ ] Thay toàn bộ `<Link><Button>` bằng `buttonClasses`; thêm `focus-visible` & `aria-pressed` ở Auth/Assignments
  - [ ] Verify: `npm run build -w @toeic/web` + kiểm tra Tab và mô phỏng lỗi API

- [ ] **Task 5: Sửa lỗi P0 tại Phòng thi, Chữa đề & Luyện tập**
  - Files: `ExamPlayerPage.tsx`, `AudioPlayer.tsx`, `ReviewPage.tsx`, `ResultPage.tsx`, `ZoomableImage.tsx`, `PracticePage.tsx`
  - [ ] Sửa tương phản lightbox (`onDark`) và nút `"Làm đề mới nhất"` dark mode
  - [ ] Thu gọn sticky audio ở `ReviewPage`; `AudioPlayer` wrap trên 390px với play `size-11` + `focus-visible`
  - [ ] `ExamPlayerPage`: thêm `focus-visible` radio/bảng câu hỏi, nâng cỡ ô mobile, dùng `<Modal>` nộp bài
  - [ ] Bỏ `<Link><Button>` ở `ResultPage`, `ReviewPage`, `PracticePage`
  - [ ] Verify: `npm run build -w @toeic/web` + test làm đề & chữa đề ở 390px/1440px

- [ ] **Task 6: Sửa lỗi P0 tại Học từ vựng, Sổ tay, Vinh danh & Báo lỗi**
  - Files: `FlashcardPage.tsx`, `StudyPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`, `VocabCourse.tsx`, `SelectableText.tsx`, `NotebookPage.tsx`, `FrameWardrobeModal.tsx`, `HonorBoards.tsx`, `StaffHonorPage.tsx`, `BugReportWidget.tsx`, `BugReportsPage.tsx`
  - [ ] `FlashcardPage` check lỗi trước `cards === null`, thêm `focus-visible`/`aria-pressed` và disable khi fetching
  - [ ] `VocabGamesPage` & `VocabCourse` có loading/error/empty; `SelectableText`, `FrameWardrobeModal`, `HonorBoards` chống tràn 390px
  - [ ] `NotebookPage` mở rộng vùng chạm + xác nhận xóa + `.catch()`; `StaffHonorPage` bỏ `window.confirm`
  - [ ] `BugReportWidget` & `BugReportsPage` có gợi ý nhập tối thiểu, Esc đóng, loading/error, `focus-visible`; bỏ `<Link><Button>`
  - [ ] Verify: `npm run build -w @toeic/web` + test bàn phím & 390px

- [ ] **Task 7: Sửa lỗi P0 tại Trang Giáo viên — Lớp học, Học sinh & Giao bài**
  - Files: `TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ClassRooms.tsx`, `StudentDialogs.tsx`, `StudentDetailPage.tsx`, `TeacherDashboardPage.tsx`, `ReportsPage.tsx`, `ViewAsPage.tsx`
  - [ ] Sửa tương phản dark mode ở `TeacherAssignmentsPage`, `ViewAsPage`, `ClassRooms`
  - [ ] `grid-cols-1 sm:grid-cols-2` cho form giao bài; `ClassRooms` có `classes.isError`; `StudentDetailPage` không flash `<AttemptsTable>`
  - [ ] `StudentDialogs` khóa đóng khi pending; `TeacherAssignmentsPage` có modal xác nhận `Đóng bài` + xử lý lỗi
  - [ ] `TeacherDashboardPage` & `ReportsPage` bỏ `<Link><Button>`, thêm `focus-visible` và nâng nút phân trang
  - [ ] Verify: `npm run build -w @toeic/web` + test Dark Mode & 390px

- [ ] **Task 8: Sửa lỗi P0 tại Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site**
  - Files: `ExamBundlePanel.tsx`, `ExamBankPage.tsx`, `ImportReview.tsx`, `ListeningScanReview.tsx`, `AdminStudyPage.tsx`, `SiteSettingsPage.tsx`
  - [ ] `ExamBundlePanel`: `grid-cols-1 sm:grid-cols-2` + loading/error
  - [ ] `ImportReview` & `ListeningScanReview`: `ReviewDock` ngang sticky trên `<md`
  - [ ] `AdminStudyPage`: modal xác nhận xóa, badge dark-safe, loading/error/empty vocab, nút chạm ≥ 44px + `aria-label`
  - [ ] `SiteSettingsPage`: chặn form rỗng lúc đang tải; `ExamBankPage`: empty state + bỏ `<Link><Button>`
  - [ ] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web`

- [ ] **Checkpoint 2: Hoàn tất toàn bộ P0**
  - [ ] `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web` pass
  - [ ] Rà soát 390px & 1440px, Light & Dark Mode

## Phase 2: P1 — Thẩm mỹ, đồng bộ hệ thống thiết kế & tối ưu Responsive

- [ ] **Task 9: Đồng bộ màu sắc về Semantic Tokens & sửa xung đột `.ui-card`/`.bg-white`**
  - Files: `ProgressPage.tsx`, `SkyBackdrop.tsx`, `HonorBoards.tsx`, `RankBadge.tsx`, `NotebookPage.tsx`, `Shell.tsx`, `SiteSettingsPage.tsx`, `ListeningScanReview.tsx`
  - [ ] Thay màu Tailwind ngoài hệ / hex cứng bằng semantic tokens
  - [ ] Sửa `ProgressPage` card `bg-teal-soft`, sao `SkyBackdrop` và tương phản chữ `RankBadge`
  - [ ] Verify: `npm run build -w @toeic/web`

- [ ] **Task 10: Đồng bộ Primitives (`Input`, `Badge`, Alert lỗi, Modal xác nhận) & Loading theo dòng**
  - Files: `DarkModeSwitch.tsx`, `UserMenu.tsx`, `SettingsPage.tsx`, `AvatarSettings.tsx`, `LoginPage.tsx`, `AdminRecoveryDialog.tsx`, `PasswordFields.tsx`, `PracticePage.tsx`, `PartDrills.tsx`, `PracticeTabs.tsx`, `AssignmentsPage.tsx`, `ResultPage.tsx`, `ReviewPage.tsx`, `SheetGallery.tsx`, `AudioPlayer.tsx`, `ClassRooms.tsx`, `StudentDialogs.tsx`, `TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ViewAsPage.tsx`, `SiteSettingsPage.tsx`, `ExamBankPage.tsx`
  - [ ] Thay `<input>` tự viết bằng `<Input>`; đồng nhất alert lỗi `bg-danger-soft text-danger`
  - [ ] Bỏ `window.confirm()` ở `ClassRooms`; thêm nút thử lại `AudioPlayer`; thêm skeleton thay chữ trần
  - [ ] Theo dõi `pendingId` cho nút trong danh sách; bổ sung `focus-visible` & `aria-pressed` còn lại
  - [ ] Verify: `npm run build -w @toeic/web`

- [ ] **Task 11: Tinh gọn bố cục Card lồng nhau & tối ưu lưới Responsive (Mobile/Tablet)**
  - Files: `ExamPlayerPage.tsx`, `PassageView.tsx`, `ResultPage.tsx`, `ZoomableImage.tsx`, `DashboardPage.tsx`, `DailyGoalsCard.tsx`, `ProgressPage.tsx`, `ProgressParts.tsx`, `HonorBoards.tsx`, `VocabCourse.tsx`, `TeacherDashboardPage.tsx`, `StudentDetailPage.tsx`, `ReportsPage.tsx`, `ExamBankPage.tsx`, `ExamBundlePanel.tsx`, `ListeningScanReview.tsx`, `ImportReview.tsx`, `BugReportsPage.tsx`
  - [ ] Làm phẳng card lồng > 2 tầng
  - [ ] Tách Prev/Next ra ngoài `.exam-scale`, thêm `max-w-full` cho `.exam-blank`, gom gọn header thi 390px
  - [ ] Thêm `grid-cols-2` cho KPI, `sm:grid-cols-3` cho Top 3 Honor, `flex-wrap` cho `SkillCard`, mở rộng hit-area crop/dock
  - [ ] Verify: `npm run build -w @toeic/web` + test 390px, 768px, 1440px

- [ ] **Checkpoint 3: Hoàn tất P1**
  - [ ] `npm run build -w @toeic/web && npm run lint -w @toeic/web` pass

## Phase 3: P2 — Tinh chỉnh nhỏ

- [ ] **Task 12: Chuẩn hóa Typography Scale, `tabular-nums` & Thứ tự Heading**
  - Files: `ProgressPage.tsx`, `ProgressParts.tsx`, `SettingsPage.tsx`, `PartDrills.tsx`, `PassageView.tsx`, `FlashcardPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`, `StudentDetailPage.tsx`, `SiteSettingsPage.tsx`
  - [ ] Chuẩn hóa `text-[Npx]` về scale, thống nhất `h1`/`h2`, thêm `tabular-nums`, chống tràn từ dài ở `FlashcardPage`
  - [ ] Verify: `npm run build -w @toeic/web`

- [ ] **Task 13: Tinh chỉnh A11y, Empty State phụ & Tối ưu nhỏ**
  - Files: `Primitives.tsx`, `LoadingScreen.tsx`, `ErrorPages.tsx`, `AdminStudyPage.tsx`, `SkyBackdrop.tsx`, `ExamPlayerPage.tsx`
  - [ ] ARIA `progressbar`, `motion-reduce` cho `LoadingScreen`, bỏ hardcode `"Thầy Minh"` ở `ErrorPages`
  - [ ] Empty state ngữ pháp ở `AdminStudyPage`, `<Card>` overlay hết giờ ở `ExamPlayerPage`, throttle `SkyBackdrop` xuống `30_000ms`
  - [ ] Verify: `npm run build -w @toeic/web && npm run lint -w @toeic/web && npm run test -w @toeic/web`
