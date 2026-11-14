CREATE TYPE "public"."PengadaanInvoiceStatus" AS ENUM('MENDATANG', 'LUNAS', 'DIBATALKAN');--> statement-breakpoint
CREATE TABLE "pengadaan_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"issued_date" text NOT NULL,
	"due_date" text NOT NULL,
	"total_amount" integer NOT NULL,
	"status" "PengadaanInvoiceStatus" DEFAULT 'MENDATANG' NOT NULL,
	"notes" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pengadaan_invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "pengadaan_invoices_total_nonneg" CHECK ("pengadaan_invoices"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pengadaan_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_no" text NOT NULL,
	"po_number" text,
	"received_date" text NOT NULL,
	"notes" text,
	"items" jsonb NOT NULL,
	"total_qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pengadaan_receipts_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE INDEX "pengadaan_invoices_status_due_idx" ON "pengadaan_invoices" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "pengadaan_receipts_created_idx" ON "pengadaan_receipts" USING btree ("created_at");