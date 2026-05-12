-- CreateEnum
CREATE TYPE "ImportedTransactionReviewStatus" AS ENUM ('UNASSIGNED', 'CATEGORIZED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PlaidConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institutionName" TEXT,
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedBankTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidItemId" TEXT NOT NULL,
    "plaidAccountId" TEXT NOT NULL,
    "plaidTransactionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "merchantName" TEXT,
    "name" TEXT NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "ImportedTransactionReviewStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "includeInRaf" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedBankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaidConnection_userId_key" ON "PlaidConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidConnection_itemId_key" ON "PlaidConnection"("itemId");

-- CreateIndex
CREATE INDEX "PlaidConnection_userId_idx" ON "PlaidConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedBankTransaction_plaidTransactionId_key" ON "ImportedBankTransaction"("plaidTransactionId");

-- CreateIndex
CREATE INDEX "ImportedBankTransaction_userId_idx" ON "ImportedBankTransaction"("userId");

-- CreateIndex
CREATE INDEX "ImportedBankTransaction_date_idx" ON "ImportedBankTransaction"("date");

-- CreateIndex
CREATE INDEX "ImportedBankTransaction_reviewStatus_idx" ON "ImportedBankTransaction"("reviewStatus");

-- CreateIndex
CREATE INDEX "ImportedBankTransaction_includeInRaf_idx" ON "ImportedBankTransaction"("includeInRaf");

-- CreateIndex
CREATE INDEX "ImportedBankTransaction_categoryId_idx" ON "ImportedBankTransaction"("categoryId");

-- AddForeignKey
ALTER TABLE "PlaidConnection" ADD CONSTRAINT "PlaidConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedBankTransaction" ADD CONSTRAINT "ImportedBankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedBankTransaction" ADD CONSTRAINT "ImportedBankTransaction_plaidItemId_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "PlaidConnection"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedBankTransaction" ADD CONSTRAINT "ImportedBankTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
