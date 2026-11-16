CREATE TYPE "public"."TitipanDirection" AS ENUM('IN', 'OUT');--> statement-breakpoint
CREATE TABLE "pengadaan_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_no" text NOT NULL,
	"client_id" uuid NOT NULL,
	"po_number" text,
	"issued_date" text NOT NULL,
	"notes" text,
	"items" jsonb NOT NULL,
	"total_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pengadaan_issues_issue_no_unique" UNIQUE("issue_no")
);
--> statement-breakpoint
CREATE TABLE "titipan_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "titipan_clients_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "titipan_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"direction" "TitipanDirection" NOT NULL,
	"quantity" integer NOT NULL,
	"doc_no" text NOT NULL,
	"doc_date" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "titipan_moves_qty_pos" CHECK ("titipan_moves"."quantity" > 0)
);
--> statement-breakpoint
INSERT INTO "titipan_clients" ("code", "name") VALUES ('RMP', 'PT Ray Mitra Perkasa') ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
ALTER TABLE "pengadaan_invoices" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "pengadaan_receipts" ADD COLUMN "client_id" uuid;--> statement-breakpoint
UPDATE "pengadaan_invoices" SET "client_id" = (SELECT "id" FROM "titipan_clients" WHERE "code" = 'RMP');--> statement-breakpoint
UPDATE "pengadaan_receipts" SET "client_id" = (SELECT "id" FROM "titipan_clients" WHERE "code" = 'RMP');--> statement-breakpoint
ALTER TABLE "pengadaan_invoices" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pengadaan_receipts" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pengadaan_issues" ADD CONSTRAINT "pengadaan_issues_client_id_titipan_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."titipan_clients"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "titipan_moves" ADD CONSTRAINT "titipan_moves_client_id_titipan_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."titipan_clients"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "titipan_moves" ADD CONSTRAINT "titipan_moves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "pengadaan_issues_created_idx" ON "pengadaan_issues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "titipan_moves_client_product_idx" ON "titipan_moves" USING btree ("client_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "titipan_moves_doc_uq" ON "titipan_moves" USING btree ("doc_no","product_id","direction");--> statement-breakpoint
ALTER TABLE "pengadaan_invoices" ADD CONSTRAINT "pengadaan_invoices_client_id_titipan_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."titipan_clients"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pengadaan_receipts" ADD CONSTRAINT "pengadaan_receipts_client_id_titipan_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."titipan_clients"("id") ON DELETE restrict ON UPDATE cascade;