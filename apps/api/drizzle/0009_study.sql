CREATE TABLE "vocab_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" text NOT NULL,
	"word_key" text NOT NULL,
	"part_of_speech" text NOT NULL,
	"meaning" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vocab_entries" ADD CONSTRAINT "vocab_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_entries_word_pos_uq" ON "vocab_entries" USING btree ("word_key","part_of_speech");
--> statement-breakpoint
CREATE INDEX "vocab_entries_word_idx" ON "vocab_entries" USING btree ("word_key");
--> statement-breakpoint
CREATE TABLE "notebook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"word" text NOT NULL,
	"word_key" text NOT NULL,
	"part_of_speech" text DEFAULT '' NOT NULL,
	"meaning" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"vocab_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notebook_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD CONSTRAINT "notebook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notebook_entries" ADD CONSTRAINT "notebook_entries_vocab_entry_id_vocab_entries_id_fk" FOREIGN KEY ("vocab_entry_id") REFERENCES "public"."vocab_entries"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "notebook_entries_user_word_uq" ON "notebook_entries" USING btree ("user_id","word_key","part_of_speech");
--> statement-breakpoint
CREATE INDEX "notebook_entries_user_idx" ON "notebook_entries" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE TABLE "card_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vocab_entry_id" uuid,
	"notebook_entry_id" uuid,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_reviews_one_target" CHECK (("vocab_entry_id" IS NOT NULL AND "notebook_entry_id" IS NULL) OR ("vocab_entry_id" IS NULL AND "notebook_entry_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "card_reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_vocab_entry_id_vocab_entries_id_fk" FOREIGN KEY ("vocab_entry_id") REFERENCES "public"."vocab_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_notebook_entry_id_notebook_entries_id_fk" FOREIGN KEY ("notebook_entry_id") REFERENCES "public"."notebook_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "card_reviews_vocab_uq" ON "card_reviews" USING btree ("user_id","vocab_entry_id") WHERE "vocab_entry_id" is not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "card_reviews_notebook_uq" ON "card_reviews" USING btree ("user_id","notebook_entry_id") WHERE "notebook_entry_id" is not null;
--> statement-breakpoint
CREATE INDEX "card_reviews_due_idx" ON "card_reviews" USING btree ("user_id","due_at");
--> statement-breakpoint
CREATE TABLE "grammar_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grammar_lessons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE INDEX "grammar_lessons_order_idx" ON "grammar_lessons" USING btree ("display_order");
--> statement-breakpoint
CREATE TABLE "grammar_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grammar_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
ALTER TABLE "grammar_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_lesson_id_grammar_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."grammar_lessons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "grammar_progress_user_lesson_uq" ON "grammar_progress" USING btree ("user_id","lesson_id");
--> statement-breakpoint
INSERT INTO "grammar_lessons" ("id", "title", "summary", "body", "display_order") VALUES
('11111111-1111-4111-8111-111111111101', 'Hiện tại đơn và hiện tại tiếp diễn', 'Phân biệt thói quen với việc đang xảy ra — bẫy thì rất hay gặp ở Part 5.', 'Hiện tại đơn diễn tả việc lặp lại, lịch, hoặc sự thật. Dấu hiệu: always, usually, every day, often.
Ví dụ: The manager reviews the report every Monday.

Hiện tại tiếp diễn diễn tả việc đang xảy ra quanh thời điểm nói. Dấu hiệu: now, at the moment, currently, right now.
Ví dụ: The committee is reviewing the proposal at the moment.

Khi hai đáp án khác nhau ở thì, hãy tìm trạng từ chỉ thời gian trước khi chọn.', 1),
('11111111-1111-4111-8111-111111111102', 'Hiện tại hoàn thành', 'Dùng cho việc bắt đầu trong quá khứ và còn liên quan tới hiện tại.', 'Hiện tại hoàn thành nhấn mạnh kết quả còn lại đến bây giờ. Dấu hiệu: since, for, already, yet, recently, so far.
Ví dụ: She has worked here since 2019.
Ví dụ: The company has already shipped the order.

Không dùng hiện tại hoàn thành với một mốc quá khứ đã kết thúc (yesterday, in 2020, last week). Những mốc đó đi với quá khứ đơn.', 2),
('11111111-1111-4111-8111-111111111103', 'Câu bị động', 'Part 5 thường bắt chọn giữa chủ động và bị động khi chủ ngữ là vật chịu tác động.', 'Bị động: be + quá khứ phân từ. Người gây hành động, nếu có, đứng sau by.
Ví dụ: The invoice was sent yesterday.
Ví dụ: All applications must be submitted by Friday.

Nếu chủ ngữ không tự làm việc đó (the report, the meeting, the package), hãy nghĩ tới bị động trước khi chọn động từ.', 3),
('11111111-1111-4111-8111-111111111104', 'Mệnh đề quan hệ', 'Who, which, that nối danh từ với mệnh đề bổ nghĩa phía sau.', 'Who dùng cho người. Which dùng cho vật. That dùng được cho cả hai trong mệnh đề xác định.
Ví dụ: The employee who called this morning left a message.
Ví dụ: The report which you requested is on your desk.

Nếu sau chỗ trống là một động từ và phía trước là danh từ cần bổ nghĩa, đáp án thường là đại từ quan hệ chứ không phải giới từ.', 4),
('11111111-1111-4111-8111-111111111105', 'Giới từ hay gặp trong Part 5', 'Nhiều câu chỉ khác nhau ở một giới từ. Học cụm, đừng dịch từng chữ.', 'interested in, responsible for, familiar with, depend on, apply for, comply with, in charge of, according to.
Ví dụ: She is responsible for training new staff.
Ví dụ: According to the schedule, the seminar starts at nine.

Khi bốn đáp án đều là giới từ, hãy đọc danh từ hoặc động từ ngay trước chỗ trống — đó là từ quyết định giới từ.', 5),
('11111111-1111-4111-8111-111111111106', 'Liên từ nối ý', 'Although, because, so that và however không đứng cùng một vị trí trong câu.', 'Although / even though + mệnh đề, dù ý đối lập. Because + mệnh đề, nêu lý do. So that + mệnh đề, nêu mục đích.
Ví dụ: Although the price increased, sales remained strong.
Ví dụ: The office was closed so that the floors could be cleaned.

However và therefore đứng tách câu, thường sau dấu chấm hoặc dấu chấm phẩy, không thay cho although ở đầu một mệnh đề dính liền.', 6)
ON CONFLICT ("id") DO NOTHING;
