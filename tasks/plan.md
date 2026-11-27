# Implementation Plan: UI Audit & Remediation (`@toeic/web`)

## Overview

Báo cáo audit toàn bộ giao diện UI (`apps/web/src`) theo 4 tiêu chí:
1. Bố cục (layout), phân cấp thị giác (visual hierarchy) và khoảng cách (spacing).
2. Màu sắc, độ tương phản (contrast) và typography.
3. Trạng thái tương tác (hover, focus, loading, empty state, error state).
4. Khả năng hiển thị responsive trên mobile (390px) và desktop (1440px).

### 4 nguyên nhân gốc xuyên suốt codebase
1. **Hổng hệ thống Dark Mode & Token (`apps/web/src/index.css`)**:
   - `--color-button-soft` (`#e6ecf8`) và `--color-teal-soft` (`#eaf0fb`) không có giá trị dark mode, trong khi `--color-ink`, `--color-gold-deep`, `--color-navy` chuyển sang màu sáng → chữ sáng trên nền sáng (~1.1–1.9:1, không đọc được).
   - Hệ `--ux-*` đặt `--ux-accent-ink: #0B1218` trên `--ux-accent: #143899` ở dark mode (~1.9:1).
   - Rule `[data-theme="dark"] :is(.bg-white, .bg-cream) { background-color: ... !important }` ghi đè ngoài ý muốn lên nút gạt `Toggle`, CTA `PracticePage`, card `bg-teal-soft` ở `ProgressPage`, và 66 ngôi sao ở `SkyBackdrop`.
2. **Lồng `<Link><Button>` và bỏ qua Primitive (`Button`/`Input`)**:
   - `<Link><Button>` lặp lại ở 14+ file (HTML không hợp lệ, tạo 2 điểm dừng Tab liên tiếp).
   - Nhiều `<button>`, `<input>`, `<select>`, `<textarea>` viết tay bị mất vòng `focus-visible`, mất `aria-pressed`, và vùng chạm chỉ 14–36px (< 44px chuẩn mobile).
3. **Thiếu trạng thái Loading / Error / Empty / Pending**:
   - Một số màn hình nuốt lỗi thành trạng thái rỗng giả hoặc kẹt loading vĩnh viễn (`FlashcardPage`, `DashboardPage`, `NotificationBell`, `VocabGamesPage`, `ClassRooms`, `ExamBundlePanel`, `AdminStudyPage`, `SiteSettingsPage`).
   - Một số thao tác xóa/đóng quan trọng chưa có xác nhận hoặc thiếu chặn double-submit.
4. **Lỗi hiển thị Responsive trên Mobile (390px)**:
   - Modal không cuộn nội bộ, thanh tìm kiếm / popover tràn viền trái, `ViewAsBanner` đè lên header, thanh audio sticky ở `ReviewPage` chiếm nửa màn hình, các lưới `grid-cols-2` không có breakpoint mobile và `ReviewDock` cố định chiếm 116px.

---

## Architecture Decisions

- **Sửa nền tảng Token & Primitives trước (`Task 1–2`)**: Khắc phục triệt để các biến dark mode (`--color-button-soft`, `--color-teal-soft`, `--ux-accent-ink`), quy tắc `prefers-reduced-motion`, nâng cấp `Modal`, `CalendarDateTimePicker`, `FilePick` và `Input` trước khi chỉnh từng trang.
- **Chuẩn hóa điều hướng dạng nút bằng `buttonClasses` / `LinkButton`**: Xuất helper `buttonClasses(variant, className)` từ `apps/web/src/components/ui/Button.tsx` để thay thế toàn bộ cặp `<Link><Button>` không hợp lệ trên 14+ file mà vẫn giữ nguyên kiểu dáng và vòng focus.
- **Triển khai theo 3 Phase ưu tiên (P0 → P1 → P2)**:
  - **Phase 1 (P0)**: Lỗi hiển thị/tương phản nặng, hỏng responsive 390px, treo loading/ẩn lỗi, mất focus bàn phím ở luồng chính, thao tác xóa/đóng thiếu xác nhận.
  - **Phase 2 (P1)**: Đồng bộ semantic tokens, thay thế `<input>`/`window.confirm`/alert tự chế bằng primitives, làm phẳng card lồng > 2 tầng, tối ưu lưới tablet/mobile.
  - **Phase 3 (P2)**: Chuẩn hóa typography scale, `tabular-nums`, thứ tự heading và tinh chỉnh A11y/hiệu năng nhỏ.

---

## Findings Breakdown (theo 4 tiêu chí)

### 1. Bố cục (Layout), Phân cấp thị giác & Khoảng cách (Spacing)
- **P1** `apps/web/src/features/dashboard/DailyGoalsCard.tsx:L58-L193` — `YesterdayCorner` lồng viền bo góc 3–4 tầng (`Card` → `aside` → `Link` → `span`).
- **P1** `apps/web/src/features/exams/ExamPlayerPage.tsx:L229`, `apps/web/src/features/exams/PassageView.tsx:L13` — Lồng 2 lớp card trắng (`Card` bọc `article` có nền/viền/padding `p-5`), làm hẹp vùng đọc trên mobile; các card cùng hàng trộn lẫn `p-4`/`p-5`/`p-6`.
- **P1** `apps/web/src/features/honor/HonorBoards.tsx:L295-L407`, `apps/web/src/features/honor/StaffHonorPage.tsx:L147-L188` — Lồng 3 tầng card có viền bo góc.
- **P1** `apps/web/src/features/study/VocabCourse.tsx:L136-L149` — Số thứ tự Unit đặt `absolute bottom-3` đè lên tên bộ từ dài 2 dòng; số `%` hoàn thành dùng chung màu `text-ink-soft` với nhãn nên mờ phân cấp.
- **P1** `apps/web/src/features/teacher/ExamBundlePanel.tsx:L39-L51` — Chiều cao cố định `h-[4.875rem] overflow-hidden` (78px) cắt mất dòng chữ thứ 3 do thang chữ của dự án đã phóng to.
- **P1** `apps/web/src/features/bugs/BugReportWidget.tsx:L113`, `apps/web/src/features/teacher/ClassRooms.tsx:L213` — Item `bg-cream` nằm trong container `bg-cream` không viền, hòa lẫn vào nền.
- **P1** `apps/web/src/features/teacher/TeacherAssignmentsPage.tsx:L279-L282` — Nhiều `<Badge>` đặt sát nhau không có wrapper `flex-wrap gap-1.5`.
- **P2** `apps/web/src/features/progress/ProgressPage.tsx:L25-L67`, `apps/web/src/features/settings/SettingsPage.tsx:L138-L244`, `apps/web/src/features/practice/PartDrills.tsx:L52-L98`, `apps/web/src/features/teacher/StudentDetailPage.tsx:L36-L115` — Cấp tiêu đề `h1`/`h2`/`h3` không đồng nhất (có nơi `h2` bằng cỡ body 18px, có nơi bỏ qua `h2` nhảy xuống `h3`, nút cuối card không dùng `mt-auto` nên lệch hàng).

### 2. Màu sắc, Độ tương phản (Contrast) & Typography
- **P0** `apps/web/src/index.css:L101-L135`, `apps/web/src/components/ui/CalendarDateTimePicker.tsx:L243-L256`, `apps/web/src/components/ui/FilePick.tsx:L191-L194` — Ở dark mode, chữ trên ngày đang chọn/hôm nay và link `"chọn file từ máy"` chỉ đạt ~1.8–1.9:1.
- **P0** `apps/web/src/features/teacher/ViewAsPage.tsx:L84-L88`, `apps/web/src/features/teacher/ClassRooms.tsx:L80-L191`, `apps/web/src/features/teacher/TeacherAssignmentsPage.tsx:L514` — `bg-teal-soft`, `bg-button-soft` và `bg-navy text-white` bị mất tương phản nghiêm trọng ở dark mode (~1.1–1.7:1).
- **P0** `apps/web/src/features/settings/SettingsPage.tsx:L32` — Nút tròn `Toggle` dùng `bg-white` bị `index.css:L122` đè thành màu tối trong dark mode (tối trên nền tối).
- **P0** `apps/web/src/features/practice/PracticePage.tsx:L88-L95` — Nút `"Làm đề mới nhất"` dùng `.bg-cream` kèm `dark:bg-sky-400`, bị `!important` trong `index.css` đè ngược lại làm hỏng tương phản nút CTA chính.
- **P0** `apps/web/src/features/exams/ZoomableImage.tsx:L188-L225` — Lightbox nền tối `bg-slate-950/92` nhưng nhãn `"Zoom đề"` dùng `text-ink-soft` (`#1c3564`, ~1.7:1 ở light mode).
- **P0** `apps/web/src/components/layout/ViewAsBanner.tsx:L33-L36` — Icon dùng `text-button-soft` trên `bg-slate-900/95` mất tương phản ở dark mode.
- **P0** `apps/web/src/components/ui/CornerNotice.tsx:L10-L99` — Hardcode `#3cb85c` cho chữ/icon đếm ngược chỉ đạt ~2.6:1 (dưới chuẩn WCAG AA 4.5:1).
- **P0** `apps/web/src/features/teacher/AdminStudyPage.tsx:L407-L657` — Hardcode `bg-emerald-100`, `bg-amber-100`, `hover:bg-red-50` gây chói/lệch màu trong dark mode.
- **P1** `apps/web/src/components/ui/Primitives.tsx:L45`, `apps/web/src/features/practice/PracticePage.tsx:L81-L86`, `apps/web/src/features/practice/PartDrills.tsx:L58-L63` — `placeholder:text-ink/45` chỉ đạt ~2.9–3.1:1 trên nền trắng.
- **P1** `apps/web/src/features/progress/ProgressPage.tsx:L66`, `apps/web/src/features/site/SkyBackdrop.tsx:L166-L178` — `.ui-card` và `.bg-white` bị rule `!important` trong `index.css` ghi đè.
- **P1** `apps/web/src/features/honor/HonorBoards.tsx:L54-L600`, `apps/web/src/features/honor/RankBadge.tsx:L10-L36`, `apps/web/src/features/vocabulary/NotebookPage.tsx:L22-L27`, `apps/web/src/components/layout/Shell.tsx:L187-L190`, `apps/web/src/components/ui/Button.tsx:L11`, `apps/web/src/features/teacher/SiteSettingsPage.tsx:L346-L377` — Trộn lẫn màu Tailwind ngoài hệ (`amber-*`, `orange-*`, `rose-*`, `red-600`, `#0b1218`, `border-black/15`) thay vì semantic token.
- **P2** Nhiều file dùng cỡ chữ tùy ý `text-[12px]`, `text-[13px]`, `text-[15px]`, `text-[17px]` thay vì thang chuẩn (`text-xs` = 14px, `text-sm` = 16px, `text-base` = 18px) và thiếu `tabular-nums` ở các con số KPI/đếm giờ.

### 3. Trạng thái tương tác (Hover, Focus, Loading, Empty, Error)
- **P0** `apps/web/src/features/study/FlashcardPage.tsx:L62-L63` — Check `query.isPending || cards === null` đặt trước `query.error` → lỗi API sẽ treo mãi màn hình loading, không bao giờ chuyển trang lỗi.
- **P0** `DashboardPage.tsx:L38-L79`, `NotificationBell.tsx:L100-L143`, `VocabGamesPage.tsx:L58-L258`, `ClassRooms.tsx:L129-L333`, `ExamBundlePanel.tsx:L37-L130`, `AdminStudyPage.tsx:L440-L580`, `SiteSettingsPage.tsx:L48-L81`, `VocabCourse.tsx:L310-L355` — Thiếu kiểm tra `isPending` / `isError` / empty state, khiến lỗi mạng hiển thị nhầm là `"Đã hoàn thành"` hoặc `"Chưa có dữ liệu"`, hoặc cho lưu form rỗng khi chưa tải xong.
- **P0** `DailyGoalsCard.tsx:L45`, `StudentDetailPage.tsx:L117-L127` — `DailyGoalsCard` trả `null` khi loading gây nhảy bố cục (CLS ~400px); `StudentDetailPage` render `<AttemptsTable attempts={[]} />` ngay khi đang tải.
- **P0** 14+ file lồng `<Link><Button>` (`ErrorPages`, `DashboardPage`, `DailyGoalsCard`, `ProgressPage`, `ProgressParts`, `ResultPage`, `ReviewPage`, `PracticePage`, `StudyPage`, `GrammarLessonPage`, `FlashcardPage`, `NotebookPage`, `HonorBoards`, `TeacherDashboardPage`, `ReportsPage`, `ExamBankPage`).
- **P0** Thiếu `focus-visible` & Escape/backdrop close trên các điều khiển cốt lõi: `ExamPlayerPage`, `Shell`, `LoginPage`, `ChangePasswordPage`, `AssignmentsPage`, `FlashcardPage`, `VocabGamesPage`, `BugReportWidget`, `BugReportsPage`, `TeacherDashboardPage`.
- **P0** Thiếu xác nhận / chống double-submit / nuốt lỗi khi thao tác nhạy cảm: `AdminStudyPage` (xóa chuyên đề/từ), `NotebookPage` (xóa thẻ), `TeacherAssignmentsPage` (`Đóng bài`), `StudentDialogs` (cho đóng modal khi đang gửi request), `Shell` & `ChangePasswordPage` (đăng xuất không có trạng thái pending).
- **P0** `apps/web/src/index.css:L294-L311` — 9 hiệu ứng `.fx-*` và `.sky-twinkle` không tắt khi người dùng bật `prefers-reduced-motion: reduce`.
- **P1** Nhiều nút hành động disable toàn bộ danh sách khi `isPending` mà không hiện trạng thái theo đúng mục đang bấm; `ClassRooms` & `StaffHonorPage` còn dùng `window.confirm()`.

### 4. Khả năng hiển thị Responsive (Mobile 390px & Desktop)
- **P0** `Modal.tsx:L25-L35` — Modal không có `max-h-[calc(100dvh-2rem)] overflow-y-auto` và thiếu nút đóng `X` / focus-trap → nội dung dài bị cắt mất trên mobile.
- **P0** `HeaderSearch.tsx:L77-L114` — Mở ô tìm kiếm `w-56` làm tràn header 390px; dropdown `w-[22rem] right-0` bị cắt mép trái màn hình.
- **P0** `ViewAsBanner.tsx:L33-L36` — Desktop `lg:top-[62px] z-[90]` đè lên header 67px và dropdown; mobile `bottom-20` đè `BugReportWidget`.
- **P0** `Shell.tsx:L94-L250` — Header 390px nhồi 6 nút; nút điểm thưởng bị ẩn (`hidden sm:inline-flex`) nhưng không có trong menu mobile.
- **P0** `ReviewPage.tsx:L66-L72`, `AudioPlayer.tsx:L131-L179` — Nhiều audio xếp dọc trong `sticky top-2` chiếm nửa màn hình; `AudioPlayer` 1 hàng không wrap làm thanh trượt còn ~75px trên 390px.
- **P0** `SelectableText.tsx:L195-L280`, `FrameWardrobeModal.tsx:L93-L147`, `HonorBoards.tsx:L298-L341` — Toolbar highlight, tab modal tủ khung và tablist bảng vinh danh tràn ngang ở 390px.
- **P0** `ExamBundlePanel.tsx:L127-L130`, `TeacherAssignmentsPage.tsx:L196-L209`, `FillAssignForm.tsx:L140-L149` — Dùng `grid-cols-2` không có `grid-cols-1 sm:grid-cols-2`, bóp 2 cột còn ~150px trên mobile.
- **P0** `ImportReview.tsx:L65-L173`, `ListeningScanReview.tsx:L70-L366` — `ReviewDock` cố định chiếm 116px bề ngang trên 390px, chỉ còn ~220px cho form & khung crop ảnh.
- **P0** Vùng chạm (tap target) < 44px ở các nút dùng thường xuyên trên mobile: `NotebookPage` (14px/28px), `CornerNotice` (16px), `CalendarDateTimePicker` (30–32px), `SettingsPage` `Toggle` (24px), `DailyGoalsCard` (36px), `ExamPlayerPage` bảng số câu (36px), `AdminStudyPage` (24–32px), `ProgressParts` (32px).
- **P1** `ExamPlayerPage` (nút Trước/Sau nằm trong `.exam-scale`, header 390px cao ~220px), `DashboardPage` `SkillCard` thiếu `flex-wrap`, `HonorBoards` Top 3 dùng `grid-cols-3` không breakpoint, các lưới KPI 4 cột thiếu bước `grid-cols-2`, `ListeningScanReview` thanh kéo crop dày 8px.

---

## Task List

### Phase 1: P0 — Lỗi hiển thị, tương phản & UX nghiêm trọng

#### Task 1: Sửa hệ token Dark Mode, Reduced Motion và tạo helper `buttonClasses`
- **Description:** Khắc phục các biến màu dark mode thiếu hoặc sai tương phản trong `index.css`, thêm rule `prefers-reduced-motion` cho các hiệu ứng nền, xuất helper `buttonClasses` từ `Button.tsx` để thay `<Link><Button>`, nâng tương phản placeholder ở `Input` và sửa màu/kích thước chạm ở `CornerNotice`.
- **Acceptance criteria:**
  - [ ] Mọi token soft (`bg-button-soft`, `bg-teal-soft`) và widget `--ux-*` đạt tương phản ≥ 4.5:1 ở cả Light và Dark mode.
  - [ ] `buttonClasses` sẵn sàng thay thế `<Link><Button>` trên toàn app.
  - [ ] Bật `prefers-reduced-motion: reduce` tắt toàn bộ `.fx-*` và `.sky-twinkle`.
  - [ ] `CornerNotice` đạt chuẩn tương phản WCAG AA, vừa màn hình 390px và nút đóng ≥ 40px có `focus-visible`.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Lint passes: `npm run lint -w @toeic/web`
  - [ ] Manual check: Kiểm tra Light/Dark trên Calendar, FilePick, CornerNotice.
- **Dependencies:** None
- **Files likely touched:**
  - `apps/web/src/index.css`
  - `apps/web/src/components/ui/Button.tsx`
  - `apps/web/src/components/ui/Primitives.tsx`
  - `apps/web/src/components/ui/CornerNotice.tsx`
- **Estimated scope:** Medium (4 files)

#### Task 2: Nâng cấp `Modal`, `CalendarDateTimePicker` và `FilePick` cho Mobile & Bàn phím
- **Description:** Bổ sung cuộn dọc, nút đóng `X` và focus-trap/khôi phục focus cho `Modal`; chỉnh popover `CalendarDateTimePicker` không tràn mép trái ở 390px, nâng kích thước chạm và hỗ trợ focus bằng phím mũi tên; thêm `focus-visible` cho dropzone `FilePick`.
- **Acceptance criteria:**
  - [ ] Modal nội dung dài cuộn được trên 390×844 và đóng được bằng nút `X`/Esc.
  - [ ] Popover lịch không bị cắt mép trái ở 390px và điều hướng được bằng bàn phím.
  - [ ] Dropzone `FilePick` hiển thị vòng focus rõ khi Tab tới.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Test bàn phím (Tab/Esc/Arrow) & viewport 390px trên Modal và CalendarDateTimePicker.
- **Dependencies:** Task 1
- **Files likely touched:**
  - `apps/web/src/components/ui/Modal.tsx`
  - `apps/web/src/components/ui/CalendarDateTimePicker.tsx`
  - `apps/web/src/components/ui/FilePick.tsx`
- **Estimated scope:** Small (3 files)

#### Task 3: Sửa Header Mobile, `HeaderSearch`, `ViewAsBanner`, `NotificationBell` & `Shell`
- **Description:** Khắc phục lỗi tràn header và cắt mép dropdown tìm kiếm trên 390px, chuyển `ViewAsBanner` hết đè lên header/BugReportWidget, hoàn thiện đóng bằng Esc/click ngoài/đổi route và `focus-visible` cho `Shell`, đưa nút điểm thưởng vào drawer mobile, thêm loading/error cho `NotificationBell` và bỏ `<Link><Button>` ở `ErrorPages`.
- **Acceptance criteria:**
  - [ ] Header 390px không tràn ngang khi mở `HeaderSearch`; `ViewAsBanner` không che header, dropdown hay `BugReportWidget`.
  - [ ] Mọi dropdown/drawer trong `Shell` điều hướng và đóng được bằng bàn phím; đăng xuất có trạng thái pending.
  - [ ] `NotificationBell` hiển thị trạng thái tải/lỗi thay vì báo rỗng giả.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Kiểm tra 390px & 1440px (Light/Dark, cả StudentShell và AdminShell).
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/components/layout/Shell.tsx`
  - `apps/web/src/components/layout/HeaderSearch.tsx`
  - `apps/web/src/components/layout/ViewAsBanner.tsx`
  - `apps/web/src/components/layout/NotificationBell.tsx`
  - `apps/web/src/features/errors/ErrorPages.tsx`
- **Estimated scope:** Medium (5 files)

#### Checkpoint 1: After Tasks 1–3
- [ ] `npm run build -w @toeic/web` và `npm run test -w @toeic/web` pass.
- [ ] Khung giao diện chung (Shell, Modal, Search, Toast, Dark Mode tokens) hoạt động ổn định trước khi sửa từng trang.

#### Task 4: Sửa lỗi P0 tại Auth, Dashboard, Progress, Settings & Assignments
- **Description:** Sửa `Toggle` mất tương phản dark mode và quá nhỏ ở `SettingsPage`, xử lý `homework.isError` ở `DashboardPage`, thêm skeleton cho `DailyGoalsCard` để hết CLS và mở rộng stepper lên 44px, bổ sung `focus-visible`/pending/ARIA cho `LoginPage`, `ChangePasswordPage`, `AssignmentsPage`, và thay toàn bộ `<Link><Button>` bằng `buttonClasses`. (Chia thành 2 lượt sửa nhỏ ≤ 5 file nếu cần.)
- **Acceptance criteria:**
  - [ ] `Toggle` hiển thị rõ ở dark mode và đạt vùng chạm chuẩn; `DailyGoalsCard` không làm giật trang khi tải.
  - [ ] Không còn `<Link><Button>` trong các trang Auth/Dashboard/Progress; lỗi API bài tập hiển thị cảnh báo + nút thử lại.
  - [ ] Tab lọc ở `AssignmentsPage` và nút ở `LoginPage`/`ChangePasswordPage` có `focus-visible` và kích thước chạm hợp lệ.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Điều hướng bằng Tab và mô phỏng lỗi API ở Dashboard.
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/features/dashboard/DashboardPage.tsx`
  - `apps/web/src/features/dashboard/DailyGoalsCard.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx`
  - `apps/web/src/features/auth/LoginPage.tsx`
  - `apps/web/src/features/auth/ChangePasswordPage.tsx`
  - `apps/web/src/features/assignments/AssignmentsPage.tsx`
  - `apps/web/src/features/progress/ProgressPage.tsx`
  - `apps/web/src/features/progress/ProgressParts.tsx`
- **Estimated scope:** Medium (tách 2 đợt, mỗi đợt ≤ 4 files)

#### Task 5: Sửa lỗi P0 tại Phòng thi, Chữa đề & Luyện tập (Exams & Practice)
- **Description:** Sửa tương phản lightbox ở `ZoomableImage` (`onDark`), bỏ `.bg-cream` + `dark:bg-sky-400` hỏng dark mode ở `PracticePage`, thu gọn thanh audio sticky ở `ReviewPage`, cho phép wrap `AudioPlayer` trên 390px với nút play 44px, thêm `focus-visible` và tăng cỡ ô câu hỏi mobile ở `ExamPlayerPage`, thay dialog nộp bài tự viết bằng `<Modal>`, và bỏ `<Link><Button>` ở `ResultPage`/`ReviewPage`/`PracticePage`.
- **Acceptance criteria:**
  - [ ] Làm bài thi & nghe audio trơn tru trên 390px và bằng bàn phím; lightbox zoom đọc rõ ở cả Light/Dark.
  - [ ] Thanh audio sticky ở `ReviewPage` không che nội dung câu hỏi.
  - [ ] Modal nộp bài đóng được bằng Esc/click ngoài và giữ focus đúng chuẩn.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Chạy 1 lượt làm đề & xem chữa đề ở 390px và 1440px.
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/features/exams/ExamPlayerPage.tsx`
  - `apps/web/src/features/exams/AudioPlayer.tsx`
  - `apps/web/src/features/exams/ReviewPage.tsx`
  - `apps/web/src/features/exams/ResultPage.tsx`
  - `apps/web/src/features/exams/ZoomableImage.tsx`
  - `apps/web/src/features/practice/PracticePage.tsx`
- **Estimated scope:** Medium (tách 2 đợt nếu cần, mỗi đợt ≤ 4 files)

#### Task 6: Sửa lỗi P0 tại Học từ vựng, Sổ tay, Vinh danh & Báo lỗi
- **Description:** Sửa thứ tự check lỗi trước `cards === null` ở `FlashcardPage`, guard lỗi & trạng thái lưu ở `VocabGamesPage` và `WordSearch`/`UnitWordListModal`, chống tràn 390px cho toolbar `SelectableText`, `FrameWardrobeModal` và `HonorBoards`, mở rộng vùng chạm + xác nhận xóa ở `NotebookPage`, bỏ `window.confirm` ở `StaffHonorPage`, cải thiện `BugReportWidget`/`BugReportsPage`, và thay `<Link><Button>` bằng `buttonClasses`.
- **Acceptance criteria:**
  - [ ] Lỗi API không còn làm kẹt `FlashcardPage` hoặc hiện empty state sai ở `VocabGamesPage`/`WordSearch`/`FrameWardrobeModal`.
  - [ ] Toolbar highlight, modal tủ khung, tab bảng vinh danh không tràn 390px; nút sổ tay đạt chuẩn chạm ≥ 40–44px và có xác nhận khi xóa.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Kiểm thử bàn phím & 390px trên Study, Notebook, Honor, BugReport.
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/features/study/FlashcardPage.tsx`
  - `apps/web/src/features/study/StudyPage.tsx`
  - `apps/web/src/features/study/GrammarLessonPage.tsx`
  - `apps/web/src/features/study/VocabGamesPage.tsx`
  - `apps/web/src/features/study/VocabCourse.tsx`
  - `apps/web/src/features/study/SelectableText.tsx`
  - `apps/web/src/features/vocabulary/NotebookPage.tsx`
  - `apps/web/src/features/honor/FrameWardrobeModal.tsx`
  - `apps/web/src/features/honor/HonorBoards.tsx`
  - `apps/web/src/features/honor/StaffHonorPage.tsx`
  - `apps/web/src/features/bugs/BugReportWidget.tsx`
  - `apps/web/src/features/bugs/BugReportsPage.tsx`
- **Estimated scope:** Medium (chia 3 nhóm nhỏ theo module: Study, Notebook/Honor, Bugs)

#### Task 7: Sửa lỗi P0 tại Trang Giáo viên — Lớp học, Học sinh & Giao bài
- **Description:** Sửa tương phản dark mode cho `TeacherAssignmentsPage`, `ViewAsPage`, `ClassRooms`; thêm breakpoint `grid-cols-1 sm:grid-cols-2` cho form giao bài; thêm `classes.isError` ở `ClassRooms`; chặn flash `<AttemptsTable>` khi loading ở `StudentDetailPage`; khóa đóng modal khi mutation pending ở `StudentDialogs`; thêm modal xác nhận `Đóng bài` + xử lý lỗi ở `TeacherAssignmentsPage`; sửa focus/phân trang/`<Link><Button>` ở `TeacherDashboardPage` và `ReportsPage`.
- **Acceptance criteria:**
  - [ ] Trang quản lý lớp/học sinh/giao bài đọc rõ ở Dark Mode và không bóp cột ở 390px.
  - [ ] Không đóng nhầm modal khi đang gửi request; thao tác `Đóng bài` có xác nhận và hiện lỗi nếu thất bại.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Kiểm tra Dark Mode và 390px với tài khoản admin/teacher.
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/features/teacher/TeacherAssignmentsPage.tsx`
  - `apps/web/src/features/teacher/FillAssignForm.tsx`
  - `apps/web/src/features/teacher/ClassRooms.tsx`
  - `apps/web/src/features/teacher/StudentDialogs.tsx`
  - `apps/web/src/features/teacher/StudentDetailPage.tsx`
  - `apps/web/src/features/teacher/TeacherDashboardPage.tsx`
  - `apps/web/src/features/teacher/ReportsPage.tsx`
  - `apps/web/src/features/teacher/ViewAsPage.tsx`
- **Estimated scope:** Medium (chia 2 nhóm nhỏ: Lớp/Học sinh/Dashboard và Giao bài/ViewAs/Reports)

#### Task 8: Sửa lỗi P0 tại Ngân hàng đề, Import/Scan, Quản trị Học liệu & Cài đặt Site
- **Description:** Sửa `grid-cols-2` tràn 390px và thêm loading/error ở `ExamBundlePanel`; chuyển `ReviewDock` thành thanh ngang sticky dưới `md` ở `ImportReview` & `ListeningScanReview`; thêm `<Modal>` xác nhận xóa, badge dark-safe, loading/error/empty và tăng kích thước chạm ở `AdminStudyPage`; chặn form rỗng lúc đang tải ở `SiteSettingsPage`; thêm empty state & bỏ `<Link><Button>` ở `ExamBankPage`.
- **Acceptance criteria:**
  - [ ] Không thể vô tình lưu đè cài đặt site rỗng hoặc xóa học liệu không xác nhận.
  - [ ] `ExamBundlePanel`, `ImportReview`, `ListeningScanReview` hiển thị gọn, thao tác được ở 390px.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Lint passes: `npm run lint -w @toeic/web`
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/features/teacher/ExamBundlePanel.tsx`
  - `apps/web/src/features/teacher/ExamBankPage.tsx`
  - `apps/web/src/features/teacher/ImportReview.tsx`
  - `apps/web/src/features/teacher/ListeningScanReview.tsx`
  - `apps/web/src/features/teacher/AdminStudyPage.tsx`
  - `apps/web/src/features/teacher/SiteSettingsPage.tsx`
- **Estimated scope:** Medium (chia 2 nhóm nhỏ ≤ 4 files/nhóm)

#### Checkpoint 2: Hoàn tất toàn bộ P0
- [ ] `npm run build -w @toeic/web`, `npm run lint -w @toeic/web`, `npm run test -w @toeic/web` đều pass.
- [ ] Rà soát toàn bộ ứng dụng ở 390px & 1440px, Light & Dark Mode: không còn lỗi tương phản, tràn ngang, treo loading hay `<Link><Button>`.

---

### Phase 2: P1 — Thẩm mỹ, đồng bộ hệ thống thiết kế & tối ưu Responsive

#### Task 9: Đồng bộ màu sắc về Semantic Tokens & sửa xung đột `.ui-card`/`.bg-white`
- **Description:** Thay toàn bộ màu Tailwind ngoài hệ (`amber-*`, `orange-*`, `emerald-*`, `rose-*`, `slate-950/35`, `#0b1218`, `border-black/15`, `bg-[#ffffff]`) bằng semantic tokens; sửa `ProgressPage` card `bg-teal-soft`, sửa 66 ngôi sao `SkyBackdrop` khỏi bị `.bg-white !important` làm tối, và đảm bảo tương phản chữ ở `RankBadge`.
- **Acceptance criteria:**
  - [ ] Không còn màu Tailwind ngoài hệ gây lệch tone hoặc vỡ dark mode trên các trang chính.
  - [ ] `SkyBackdrop` giữ sao trắng trong dark mode; `RankBadge` đủ độ tương phản ở mọi cấp bậc.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Kiểm tra Light/Dark trên Progress, Honor, Notebook, SkyBackdrop, SiteSettings.
- **Dependencies:** Task 1
- **Files likely touched:**
  - `apps/web/src/features/progress/ProgressPage.tsx`
  - `apps/web/src/features/site/SkyBackdrop.tsx`
  - `apps/web/src/features/honor/HonorBoards.tsx`
  - `apps/web/src/features/honor/RankBadge.tsx`
  - `apps/web/src/features/vocabulary/NotebookPage.tsx`
  - `apps/web/src/components/layout/Shell.tsx`
  - `apps/web/src/features/teacher/SiteSettingsPage.tsx`
  - `apps/web/src/features/teacher/ListeningScanReview.tsx`
- **Estimated scope:** Medium (chia 2 đợt ≤ 4 files/đợt)

#### Task 10: Đồng bộ Primitives (`Input`, `Badge`, Alert lỗi, Modal xác nhận) & trạng thái Loading theo dòng
- **Description:** Thay các `<input>` tự viết (`fieldCls`) bằng `<Input>`; chuẩn hóa thông báo lỗi sang `bg-danger-soft text-danger border-danger/25`; thay `window.confirm()` ở `ClassRooms` bằng `<Modal>`; thêm nút thử lại lỗi ở `AudioPlayer` và skeleton thay chữ `"Đang tải…"` trần; theo dõi `pendingId` theo từng dòng cho các nút hành động; bổ sung `focus-visible` & `aria-pressed` cho tab/chip/select/textarea còn lại và `DarkModeSwitch`.
- **Acceptance criteria:**
  - [ ] Form, thông báo lỗi và nút loading đồng nhất giữa luồng Học sinh và Giáo viên.
  - [ ] Không còn `window.confirm()` trong toàn bộ ứng dụng.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Test tương tác form, loading theo từng thẻ/dòng và điều khiển bàn phím.
- **Dependencies:** Task 1, Task 2
- **Files likely touched:**
  - `apps/web/src/components/ui/DarkModeSwitch.tsx`
  - `apps/web/src/components/layout/UserMenu.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx` & `AvatarSettings.tsx`
  - `apps/web/src/features/auth/AdminRecoveryDialog.tsx` & `PasswordFields.tsx` & `LoginPage.tsx`
  - `apps/web/src/features/practice/PracticePage.tsx`, `PartDrills.tsx`, `PracticeTabs.tsx`
  - `apps/web/src/features/assignments/AssignmentsPage.tsx`, `features/exams/ResultPage.tsx`, `ReviewPage.tsx`, `SheetGallery.tsx`, `AudioPlayer.tsx`
  - `apps/web/src/features/teacher/ClassRooms.tsx`, `StudentDialogs.tsx`, `TeacherAssignmentsPage.tsx`, `FillAssignForm.tsx`, `ViewAsPage.tsx`, `SiteSettingsPage.tsx`, `ExamBankPage.tsx`
- **Estimated scope:** Medium (chia nhỏ theo từng module ≤ 4 files/lượt)

#### Task 11: Tinh gọn bố cục Card lồng nhau & tối ưu lưới Responsive (Mobile/Tablet)
- **Description:** Làm phẳng card lồng 3–4 tầng (`DailyGoalsCard`, `PassageView`, `HonorBoards`, `ClassRooms`, `BugReportWidget`); tách nút Trước/Sau ở `ExamPlayerPage` ra ngoài `.exam-scale` và thêm `max-w-full` cho `.exam-blank`; thêm bước `grid-cols-2` cho lưới 4 KPI và `grid-cols-1 sm:grid-cols-3` cho Top 3 `HonorBoards`; mở rộng hit-area kéo crop ở `ListeningScanReview` và nút ở `ReviewDock`/`ZoomableImage`/`VocabCourse`.
- **Acceptance criteria:**
  - [ ] Không còn card lồng > 2 tầng; mọi lưới KPI & form hiển thị cân đối ở 390px, 768px và 1440px.
  - [ ] Tăng zoom chữ 200–300% trong phòng thi không làm tràn nút điều hướng.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Manual check: Kiểm tra trực quan ở 390px, 768px, 1440px và zoom chữ 300% ở phòng thi.
- **Dependencies:** Task 5, Task 8
- **Files likely touched:**
  - `apps/web/src/features/exams/ExamPlayerPage.tsx`, `PassageView.tsx`, `ResultPage.tsx`, `ZoomableImage.tsx`
  - `apps/web/src/features/dashboard/DashboardPage.tsx`, `DailyGoalsCard.tsx`
  - `apps/web/src/features/progress/ProgressPage.tsx`, `ProgressParts.tsx`
  - `apps/web/src/features/honor/HonorBoards.tsx`, `features/study/VocabCourse.tsx`
  - `apps/web/src/features/teacher/TeacherDashboardPage.tsx`, `StudentDetailPage.tsx`, `ReportsPage.tsx`, `ExamBankPage.tsx`, `ExamBundlePanel.tsx`, `ListeningScanReview.tsx`, `ImportReview.tsx`
  - `apps/web/src/features/bugs/BugReportsPage.tsx`
- **Estimated scope:** Medium (chia nhỏ theo module ≤ 4 files/lượt)

#### Checkpoint 3: Hoàn tất P1
- [ ] `npm run build -w @toeic/web` & `npm run lint -w @toeic/web` pass không cảnh báo mới.

---

### Phase 3: P2 — Tinh chỉnh nhỏ

#### Task 12: Chuẩn hóa Typography Scale, `tabular-nums` & Thứ tự Heading
- **Description:** Thay các cỡ chữ tùy ý `text-[12px]`/`text-[13px]`/`text-[15px]`/`text-[17px]` về thang chuẩn (`text-xs`/`text-sm`/`text-base`); thống nhất `h1`/`h2` và sửa lỗi nhảy cấp `h3` ở `StudentDetailPage`; thêm `tabular-nums` cho các số KPI/điểm; chống tràn từ vựng dài trên `FlashcardPage`; bỏ `w-36` cố định ở `SiteSettingsPage` và thêm `mt-auto pt-4` cho nút card ở `PartDrills`.
- **Acceptance criteria:**
  - [ ] Hệ chữ và cấp heading đồng nhất trên toàn app; từ vựng dài không tràn thẻ flashcard ở 390px.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
- **Dependencies:** Task 11
- **Files likely touched:**
  - `apps/web/src/features/progress/ProgressPage.tsx` & `ProgressParts.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx`
  - `apps/web/src/features/practice/PartDrills.tsx` & `features/exams/PassageView.tsx`
  - `apps/web/src/features/study/FlashcardPage.tsx`, `GrammarLessonPage.tsx`, `VocabGamesPage.tsx`
  - `apps/web/src/features/teacher/StudentDetailPage.tsx`, `SiteSettingsPage.tsx`
- **Estimated scope:** Medium (chia 2 đợt ≤ 5 files/đợt)

#### Task 13: Tinh chỉnh A11y, Empty State phụ & Tối ưu nhỏ
- **Description:** Thêm `role="progressbar"` + `aria-valuenow/min/max` cho `ProgressBar`; tôn trọng `prefers-reduced-motion` ở `LoadingScreen` và bỏ `bg-[#ffffff]`; lấy tên thương hiệu/SĐT từ `useSite()` ở `ErrorPages`; thêm empty state khi danh sách ngữ pháp rỗng ở `AdminStudyPage`; bọc overlay hết giờ ở `ExamPlayerPage` trong `<Card>` có spinner; giảm tần suất `setInterval` của `SkyBackdrop` xuống `30_000ms`.
- **Acceptance criteria:**
  - [ ] `ProgressBar` đạt chuẩn ARIA; `SkyBackdrop` không re-render mỗi giây; không còn text thương hiệu hardcode.
- **Verification:**
  - [ ] Build succeeds: `npm run build -w @toeic/web`
  - [ ] Lint & tests pass: `npm run lint -w @toeic/web && npm run test -w @toeic/web`
- **Dependencies:** None
- **Files likely touched:**
  - `apps/web/src/components/ui/Primitives.tsx`
  - `apps/web/src/components/ui/LoadingScreen.tsx`
  - `apps/web/src/features/errors/ErrorPages.tsx`
  - `apps/web/src/features/teacher/AdminStudyPage.tsx`
  - `apps/web/src/features/site/SkyBackdrop.tsx`
  - `apps/web/src/features/exams/ExamPlayerPage.tsx`
- **Estimated scope:** Small (6 files, chia 2 nhóm nhỏ nếu cần)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Quy tắc `!important` trong `index.css` ảnh hưởng nhiều component sử dụng `.bg-white`/`.bg-cream` | High | Kiểm tra kỹ mọi component dùng `.bg-white`/`.bg-cream` khi bật Dark Mode; dùng biến token (`bg-button-ink`, `#ffffff` inline cho sao) ở chỗ không phải card. |
| Thay `<Link><Button>` làm lệch padding/align ở một số chỗ | Med | Xuất `buttonClasses(variant, className)` trực tiếp từ `Button.tsx` để tái sử dụng 100% style gốc. |
| Thay đổi lớn cùng lúc khó kiểm soát hồi quy (regression) | Med | Thực hiện từng Phase, dừng ở các Checkpoint để build + test + kiểm tra trực quan 390px và 1440px. |

## Open Questions

1. Triển khai theo từng Phase (làm xong P0 để duyệt trên trình duyệt rồi mới làm P1 → P2) hay chạy liền mạch toàn bộ?
2. Có màn hình hoặc hiệu ứng nào muốn giữ nguyên thiết kế hiện tại (ví dụ hiệu ứng `.fx-*` hoặc bảng màu riêng của một trang cụ thể) không?
