-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('REACTIVE_RESIN', 'URETHANE', 'GRIPS', 'TAPE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'STRIPE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('IMPORTED');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "price" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "total_amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "stripe_session_id" TEXT,
    "payment_url" TEXT,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionItem" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_at_sale" INTEGER NOT NULL,
    "name_at_sale" TEXT NOT NULL,

    CONSTRAINT "TransactionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLog" (
    "id" UUID NOT NULL,
    "upload_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor" VARCHAR(100) NOT NULL,
    "invoice_number" VARCHAR(100) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'IMPORTED',
    "content_hash" TEXT NOT NULL,
    "rows_imported" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotency_key_key" ON "Transaction"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_session_id_key" ON "Transaction"("stripe_session_id");

-- CreateIndex
CREATE INDEX "Transaction_status_completed_at_payment_method_idx" ON "Transaction"("status", "completed_at", "payment_method");

-- CreateIndex
CREATE INDEX "TransactionItem_product_id_idx" ON "TransactionItem"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionItem_transaction_id_product_id_key" ON "TransactionItem"("transaction_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLog_vendor_invoice_number_key" ON "InvoiceLog"("vendor", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLog_vendor_content_hash_key" ON "InvoiceLog"("vendor", "content_hash");

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants Prisma does not express in its schema DSL.
ALTER TABLE "Product"
 ADD CONSTRAINT "product_money_nonnegative" CHECK (price > 0 AND cost >= 0),
 ADD CONSTRAINT "product_stock_nonnegative" CHECK (stock_quantity >= 0 AND low_stock_threshold >= 0),
 ADD CONSTRAINT "product_version_nonnegative" CHECK (version >= 0),
 ADD CONSTRAINT "product_sku_normalized" CHECK (sku = upper(trim(sku)) AND length(sku) > 0);
ALTER TABLE "Transaction"
 ADD CONSTRAINT "transaction_total_positive" CHECK (total_amount > 0),
 ADD CONSTRAINT "transaction_completion_consistent" CHECK ((status = 'COMPLETE') = (completed_at IS NOT NULL)),
 ADD CONSTRAINT "transaction_cash_complete" CHECK (payment_method <> 'CASH' OR status = 'COMPLETE');
ALTER TABLE "TransactionItem"
 ADD CONSTRAINT "item_quantity_positive" CHECK (quantity > 0),
 ADD CONSTRAINT "item_price_positive" CHECK (price_at_sale > 0);
ALTER TABLE "InvoiceLog"
 ADD CONSTRAINT "invoice_rows_positive" CHECK (rows_imported > 0);
