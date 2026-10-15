-- CreateEnum
CREATE TYPE "OilCategory" AS ENUM ('Heavy', 'Medium', 'Light');

-- CreateEnum
CREATE TYPE "RGCategory" AS ENUM ('High', 'Medium', 'Low');

-- CreateEnum
CREATE TYPE "ShoeTier" AS ENUM ('Pro', 'Competitive', 'Entry_Level');

-- CreateEnum
CREATE TYPE "BagType" AS ENUM ('Tote', 'Wheeled');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('Draft', 'Sent', 'Approved', 'Deposit_Paid', 'In_Progress', 'Shipped', 'Fulfilled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductCategory" ADD VALUE 'BOWLING_BALLS';
ALTER TYPE "ProductCategory" ADD VALUE 'SHOES';
ALTER TYPE "ProductCategory" ADD VALUE 'BAGS';
ALTER TYPE "ProductCategory" ADD VALUE 'ACCESSORIES';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethod" ADD VALUE 'POS_CARD';
ALTER TYPE "PaymentMethod" ADD VALUE 'PAYPAL';
ALTER TYPE "PaymentMethod" ADD VALUE 'MERCADOPAGO';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "barcode" VARCHAR(100),
ADD COLUMN     "brand" VARCHAR(100),
ADD COLUMN     "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "model" VARCHAR(100),
ADD COLUMN     "supplier" VARCHAR(100);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "provider_id" TEXT,
ADD COLUMN     "provider_payment_id" TEXT,
ADD COLUMN     "receipt_token" UUID NOT NULL DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "TransactionItem" ADD COLUMN     "service_id" UUID,
ALTER COLUMN "product_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BowlingBallDetails" (
    "product_id" UUID NOT NULL,
    "weight" INTEGER NOT NULL,
    "oil_category" "OilCategory" NOT NULL,
    "rg_category" "RGCategory" NOT NULL,

    CONSTRAINT "BowlingBallDetails_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "ShoeDetails" (
    "product_id" UUID NOT NULL,
    "size" VARCHAR(20) NOT NULL,
    "style" VARCHAR(60) NOT NULL,
    "tier" "ShoeTier" NOT NULL,

    CONSTRAINT "ShoeDetails_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "BagDetails" (
    "product_id" UUID NOT NULL,
    "ball_capacity" INTEGER NOT NULL,
    "bag_type" "BagType" NOT NULL,

    CONSTRAINT "BagDetails_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBundle" (
    "bundle_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ServiceBundle_pkey" PRIMARY KEY ("bundle_id","service_id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254),
    "phone_whatsapp" VARCHAR(20),
    "notes" VARCHAR(5000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSpec" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "notes" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "deposit_amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'Draft',
    "approval_token" UUID NOT NULL,
    "carrier" VARCHAR(60),
    "tracking_number" VARCHAR(100),
    "deposit_reference" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvent" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "status" "ProposalStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" VARCHAR(200) NOT NULL,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSpec_customer_id_created_at_idx" ON "CustomerSpec"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_approval_token_key" ON "Proposal"("approval_token");

-- CreateIndex
CREATE INDEX "Proposal_customer_id_status_idx" ON "Proposal"("customer_id", "status");

-- CreateIndex
CREATE INDEX "ProposalEvent_proposal_id_created_at_idx" ON "ProposalEvent"("proposal_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_request_id_key" ON "StockMovement"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_receipt_token_key" ON "Transaction"("receipt_token");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_provider_id_key" ON "Transaction"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_provider_payment_id_key" ON "Transaction"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionItem_transaction_id_service_id_key" ON "TransactionItem"("transaction_id", "service_id");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BowlingBallDetails" ADD CONSTRAINT "BowlingBallDetails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoeDetails" ADD CONSTRAINT "ShoeDetails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BagDetails" ADD CONSTRAINT "BagDetails_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSpec" ADD CONSTRAINT "CustomerSpec_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvent" ADD CONSTRAINT "ProposalEvent_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants for all writers, including future clients.
ALTER TABLE "TransactionItem" ADD CONSTRAINT "TransactionItem_one_catalog_item" CHECK ((product_id IS NOT NULL)::int + (service_id IS NOT NULL)::int = 1);
ALTER TABLE "Service" ADD CONSTRAINT "Service_price_check" CHECK (price > 0 AND price <= 100000000);
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_valid" CHECK (quantity > 0 AND bundle_id <> service_id);
ALTER TABLE "BowlingBallDetails" ADD CONSTRAINT "Ball_weight_check" CHECK (weight BETWEEN 6 AND 16);
ALTER TABLE "BagDetails" ADD CONSTRAINT "Bag_capacity_check" CHECK (ball_capacity BETWEEN 1 AND 6);
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_amounts_check" CHECK (total_amount > 0 AND total_amount <= 99999999 AND deposit_amount BETWEEN 0 AND total_amount);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_check" CHECK (quantity > 0 AND quantity <= 10000);
CREATE INDEX "Product_store_idx" ON "Product" (category, brand) WHERE active AND stock_quantity > 0;
CREATE INDEX "Transaction_customer_idx" ON "Transaction" (customer_id, timestamp);
