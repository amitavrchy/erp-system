-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "invoiceEmailBody" TEXT NOT NULL DEFAULT 'Thank you for your business. Please find your invoice details attached.',
ADD COLUMN     "invoiceEmailSubject" TEXT NOT NULL DEFAULT 'Invoice {{number}} from {{organization}}';
