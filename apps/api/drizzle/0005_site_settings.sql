CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_name" text NOT NULL,
	"slogan" text NOT NULL,
	"login_headline" text NOT NULL,
	"login_intro" text NOT NULL,
	"footer_about" text NOT NULL,
	"support_heading" text NOT NULL,
	"support_detail" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"hours" text NOT NULL,
	"channel_heading" text NOT NULL,
	"channel_detail" text NOT NULL,
	"legal_note" text NOT NULL,
	"copyright" text NOT NULL,
	"logo_data_url" text,
	"favicon_data_url" text,
	"theme_primary" text NOT NULL,
	"theme_primary_soft" text NOT NULL,
	"theme_paper" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "site_settings" (
	"id", "brand_name", "slogan", "login_headline", "login_intro",
	"footer_about", "support_heading", "support_detail", "phone", "address", "hours",
	"channel_heading", "channel_detail", "legal_note", "copyright",
	"theme_primary", "theme_primary_soft", "theme_paper"
) VALUES (
	'default',
	'MR. MINH TOEIC',
	'Lớp học nội bộ',
	'Cổng học viên nội bộ lớp TOEIC 800+',
	'Tài khoản do Thầy Minh cấp phát — không đăng ký công khai. Luyện Listening, Reading, từ vựng, ngữ pháp và theo dõi tiến độ theo lộ trình lớp K42.',
	'Cổng luyện đề và học tập trực tuyến độc quyền cho học viên khoá TOEIC 800+. Tài khoản do Thầy Minh cấp phát và quản lý học vụ.',
	'Hỗ trợ học tập & trợ giảng',
	'Thầy Minh (Trực tiếp): giải đáp bài khó & chữa đề chuyên sâu',
	'0988.xxx.888',
	'',
	'8:00 – 22:00',
	'Kênh trao đổi lớp học',
	'Group Zalo Lớp K42 (Nhận thông báo)
Kho tài liệu Drive độc quyền Thầy Minh',
	'Mã bảo mật lớp: TM-K42-INTERNAL • Hệ thống phân tích chuẩn ETS',
	'© 2026 MR. MINH TOEIC Academy • Cổng học viên nội bộ lớp học.',
	'#2b8a9c',
	'#b9e4ec',
	'#f7fbfd'
);
