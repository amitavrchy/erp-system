-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "DocStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_purchaseOrderId_key" ON "Bill"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Bill_organizationId_status_idx" ON "Bill"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_organizationId_number_key" ON "Bill"("organizationId", "number");
