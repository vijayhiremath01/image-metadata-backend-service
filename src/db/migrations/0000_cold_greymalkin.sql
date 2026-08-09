CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"cover_photo_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"original_url" varchar(500) NOT NULL,
	"display_url" varchar(500) NOT NULL,
	"thumbnail_url" varchar(500) NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"blur_hash" varchar(100),
	"hex_color" varchar(7),
	"size_bytes" integer NOT NULL,
	"file_format" varchar(20) NOT NULL,
	"camera_make" varchar(100),
	"camera_model" varchar(100),
	"views_count" integer DEFAULT 0 NOT NULL,
	"downloads_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_categories" (
	"photo_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_categories_photo_id_category_id_pk" PRIMARY KEY("photo_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "photo_tags" (
	"photo_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "photo_tags_photo_id_tag_id_pk" PRIMARY KEY("photo_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "photo_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"downloaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photo_categories" ADD CONSTRAINT "photo_categories_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_categories" ADD CONSTRAINT "photo_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tags" ADD CONSTRAINT "photo_tags_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tags" ADD CONSTRAINT "photo_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_views" ADD CONSTRAINT "photo_views_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_downloads" ADD CONSTRAINT "photo_downloads_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_is_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "photos_created_at_idx" ON "photos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "photos_views_count_idx" ON "photos" USING btree ("views_count");--> statement-breakpoint
CREATE INDEX "photos_downloads_count_idx" ON "photos" USING btree ("downloads_count");--> statement-breakpoint
CREATE INDEX "photos_likes_count_idx" ON "photos" USING btree ("likes_count");--> statement-breakpoint
CREATE INDEX "photos_is_active_idx" ON "photos" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "photo_categories_category_id_idx" ON "photo_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "photo_tags_tag_id_idx" ON "photo_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "photo_likes_photo_id_idx" ON "photo_likes" USING btree ("photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_likes_photo_id_ip_idx" ON "photo_likes" USING btree ("photo_id","ip_address");--> statement-breakpoint
CREATE INDEX "photo_views_photo_id_idx" ON "photo_views" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photo_views_viewed_at_idx" ON "photo_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "photo_downloads_photo_id_idx" ON "photo_downloads" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photo_downloads_downloaded_at_idx" ON "photo_downloads" USING btree ("downloaded_at");