# TOEIC Platform — MR. MINH TOEIC

Cổng luyện thi TOEIC nội bộ (Listening + Reading, Vocabulary + Grammar, quản lý học viên/giáo viên). Thiết kế và backlog: xem `TOEIC_Platform_Backlog.md`.

## Cấu trúc monorepo

```text
apps/
  web/        React + TS + Vite + Tailwind (UI/UX đã hoàn thiện, đang nối dần vào API)
  api/        NestJS + Drizzle ORM + PostgreSQL (Supabase / PGlite khi dev)
packages/
  shared/     Types, hằng số, Zod schema dùng chung web + api (@toeic/shared)
```

## Chạy local

```bash
npm install
npm run dev          # build shared → chạy API (:3001) + web (:5173, proxy /api → API)
```

- Không cần cài Postgres: khi `DATABASE_URL` trống, API dùng **PGlite** (Postgres thật chạy in-process, lưu ở `apps/api/.data/pglite`). Migration tự chạy khi khởi động.
- Lần đầu API tạo tài khoản admin: `admin` / `ChangeMe123` (chỉ ở môi trường dev; bắt buộc đổi mật khẩu khi đăng nhập lần đầu). Đặt `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` để đổi.
- Admin quên mật khẩu: trên màn đăng nhập chọn "Quên mật khẩu quản trị?" và nhập `ADMIN_RECOVERY_CODE` của đúng môi trường (local trong `apps/api/.env`, production trên Render `toeic-api-prod`, dev trên Render `toeic-api-dev`). Mã sai nhiều lần sẽ khóa tài khoản như đăng nhập sai. Học viên và giáo viên không dùng được mã này.

## Deploy

Hai môi trường tách database, tách API, tách kho file. Site cũ (`toeic-api-2jb7`) giữ nguyên cho đến khi bản mới đăng nhập được.

| | Production | Dev |
| --- | --- | --- |
| Nhánh | `main` | `dev-version` |
| Web | Cloudflare Pages | Vercel (`vercel.json`, Production Branch = `dev-version`) |
| API | Render `toeic-api-prod` (`render.yaml`) | Render `toeic-api-dev` |
| Database | Supabase project mới | Supabase project mới khác |
| File | bucket R2 riêng | bucket R2 riêng |

Web gọi `/api` cùng tên miền. Pages dùng `functions/api/[[path]].js` (đặt `API_ORIGIN` = URL Render production). Vercel dùng `api/[...path].js` (đặt `API_ORIGIN` = URL Render dev). API tự chạy migration khi khởi động (`AUTO_MIGRATE`). `DATABASE_URL` lấy chuỗi **Session pooler**, cổng **5432**.
- Cấu hình: copy `apps/api/.env.example` → `apps/api/.env` (API tự nạp `.env` trong thư mục `apps/api`; biến môi trường thật luôn được ưu tiên).

## Tài khoản & phân quyền

- Không có tự đăng ký. Admin/Teacher tạo học viên qua `POST /api/v1/users/students` → hệ thống sinh **mã học viên** (`TM-1000`, …) + **mật khẩu tạm** (hiển thị một lần). Học viên đăng nhập bằng mã học viên và **bắt buộc đổi mật khẩu**.
- Role: `STUDENT`, `TEACHER` (chỉ thấy/quản lý học viên), `ADMIN` (toàn quyền, tạo giáo viên/admin).
- Access token (JWT 15 phút) + refresh token xoay vòng (14 ngày) trong cookie HttpOnly; phát hiện dùng lại refresh token cũ → thu hồi phiên. Khóa tài khoản sau N lần sai, rate limit đăng nhập, audit log, CSRF header.

## API (prefix `/api/v1`)

| Method | Path | Quyền |
| --- | --- | --- |
| POST | `/auth/login`, `/auth/refresh`, `/auth/logout` | public |
| GET | `/auth/me`, `/auth/sessions` · DELETE `/auth/sessions/:id` | đã đăng nhập |
| POST | `/auth/change-password` | đã đăng nhập (kể cả khi đang dùng mật khẩu tạm) |
| GET | `/users`, `/users/:id` | TEACHER, ADMIN |
| POST | `/users/students`, `/users/:id/reset-password`, `/users/:id/disable`, `/users/:id/enable` | TEACHER, ADMIN |
| POST | `/users/staff` | ADMIN |
| GET | `/skills` (kèm parts) | đã đăng nhập |
| GET | `/exams`, `/exams/:id` (học viên chỉ thấy đề PUBLISHED) | đã đăng nhập |
| POST | `/exams` · GET/PUT `/exams/:id/content` (có đáp án) · POST `/exams/:id/publish`, `/exams/:id/archive` | TEACHER, ADMIN |
| POST | `/exams/:id/attempts` (bắt đầu hoặc tiếp tục bài đang làm; `mode`: PRACTICE, TIMED, FULL_TEST, PART_DRILL) | STUDENT |
| GET | `/attempts`, `/attempts/:id` (đề không kèm đáp án, kèm đáp án đã chọn) | STUDENT (chỉ bài của mình) |
| PUT | `/exams/:id/audio` (`{ assetId, partCode? }`; `assetId: null` để gỡ; không có `partCode` = audio nghe đầy đủ cả đề) | TEACHER, ADMIN |
| GET | `/attempts/:id/audio` (cấp lại URL audio đã ký khi link cũ hết hạn) | STUDENT (chỉ bài của mình) |
| PUT | `/attempts/:id/answers/:questionId` (autosave, `selectedKey: null` để bỏ chọn) | STUDENT |
| POST | `/attempts/:id/submit` (idempotent) · GET `/attempts/:id/result`, `/attempts/:id/review` (đáp án chỉ lộ sau khi nộp) | STUDENT |

| GET | `/me/dashboard` (chuỗi rèn luyện, điểm mock gần nhất + lịch sử, khoảng cách tới mục tiêu, thống kê theo kỹ năng, bảng vinh danh tuần) | STUDENT |
| GET | `/me/progress` (điểm theo thời gian, độ chính xác + thời gian/câu theo Part, Part yếu nhất, bài gần đây) | STUDENT |
| GET | `/students/:id/progress` (cùng dữ liệu, xem một học viên; id không phải học viên → 404) | TEACHER, ADMIN |
| GET | `/reports/class` (hoạt động tuần, tỷ lệ đúng 30 ngày, học viên ≥7 ngày không làm bài) | TEACHER, ADMIN |
| PATCH | `/me/goal` (`targetScore`: bội số của 5 trong 10–990, hoặc `null` để bỏ) | STUDENT |

Trang chủ học viên chỉ hiển thị dữ liệu thật: tài khoản mới thấy 0 ngày, "—" cho điểm, "Chưa đặt" cho mục tiêu và bảng vinh danh trống. "Hôm nay"/"tuần này" tính theo giờ Việt Nam (`Asia/Ho_Chi_Minh`). Bảng vinh danh xếp theo số câu đã làm trong tuần và chỉ chia sẻ tên hiển thị. Rate limit tính theo tài khoản (đã đăng nhập) thay vì IP, để cả lớp dùng chung Wi‑Fi không chặn nhau khi autosave.

**Đề mẫu (dev):** khi chạy `NODE_ENV=development`, API tự seed đề `DEMO-READING-01` (Part 5–7, 19 câu, đã publish) để thử luồng học viên. Tắt/bật bằng `SEED_DEMO_EXAM=false|true`. Tạo học viên ở `/admin` → đăng nhập bằng mã học viên + mật khẩu tạm → `/practice`.

**Chấm điểm:** đáp án chỉ lưu ở server; bài hết hạn (`deadlineAt` + 5s grace) tự đóng ở lần truy cập kế tiếp và chấm là `EXPIRED`. Điểm quy đổi 5–495/section chỉ tính khi bài phủ đủ 100 câu của section đó (có thể cấu hình bảng quy đổi riêng theo đề qua `scoringConfig`); bài luyện từng phần chỉ trả số câu đúng và độ chính xác theo Part.
| GET | `/health` | public |

## Database

```bash
npm run db:generate   # sinh migration SQL từ apps/api/src/db/schema.ts (drizzle-kit)
npm run db:migrate    # áp migration lên DATABASE_URL (dùng trong pipeline deploy)
```

Production: đặt `DATABASE_URL` (Supabase Postgres), `JWT_ACCESS_SECRET` (≥ 32 ký tự), `COOKIE_SECURE=true`, `CORS_ORIGINS`. Mọi bảng bật RLS để PostgREST/anon key của Supabase không đọc được dữ liệu; API kết nối bằng role `postgres`.

## Test & build

```bash
npm test         # e2e API trên PGlite (auth, RBAC, lockout, refresh rotation, audit…)
npm run build    # shared + api + web
npm run lint
```

### Audio Listening (Cloudflare R2)

- File nằm trong bucket R2 **riêng tư**; DB chỉ lưu đường dẫn (bảng ssets). API ký URL đọc có hạn 3 giờ (AUDIO_URL_TTL_SECONDS) cho đúng chủ bài làm, không bao giờ trả về bucket/đường dẫn gốc.
- Audio gắn theo đề (exams.audio_asset_id, file nghe đầy đủ Part 1–4) hoặc theo Part (exam_parts.audio_asset_id, file tách; một file Part 1+2 gắn vào cả hai Part). Audio của Part luôn được ưu tiên.
- File nghe đầy đủ chỉ dùng khi bài làm gồm **tất cả** Part Listening; luyện riêng một Part cần audio riêng của Part đó.
- Mọi file tải lên (audio, ảnh, JSON đề) đi chung một đường `AssetStoreService`: ghi dòng `assets` trạng thái `PENDING` → đẩy file sang R2 → `STORED` (hoặc `FAILED` kèm lý do). Chỉ file `STORED` mới được gắn vào đề và phát cho học viên. JSON gốc của đề lưu tại `exams/{examId}/source/` và liên kết qua `exams.source_asset_id`.
- Thi thử (FULL_TEST): không tua, không đổi tốc độ. Các chế độ khác và màn chữa đề: đầy đủ điều khiển.
- Nạp file: `npm run assets:upload -w @toeic/api -- "<file.zip>"` (đọc thẳng từ zip, chạy lại được) rồi `npm run assets:sync -w @toeic/api -- content/<collection>.manifest.json`. Cần R2_* trong pps/api/.env.
