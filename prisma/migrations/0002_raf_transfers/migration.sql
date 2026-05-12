-- CreateTable
CREATE TABLE "RafTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "fromCategoryId" TEXT NOT NULL,
    "toCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RafTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RafTransfer_userId_idx" ON "RafTransfer"("userId");

-- CreateIndex
CREATE INDEX "RafTransfer_periodId_idx" ON "RafTransfer"("periodId");

-- CreateIndex
CREATE INDEX "RafTransfer_fromCategoryId_idx" ON "RafTransfer"("fromCategoryId");

-- CreateIndex
CREATE INDEX "RafTransfer_toCategoryId_idx" ON "RafTransfer"("toCategoryId");

-- AddForeignKey
ALTER TABLE "RafTransfer" ADD CONSTRAINT "RafTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafTransfer" ADD CONSTRAINT "RafTransfer_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafTransfer" ADD CONSTRAINT "RafTransfer_fromCategoryId_fkey" FOREIGN KEY ("fromCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RafTransfer" ADD CONSTRAINT "RafTransfer_toCategoryId_fkey" FOREIGN KEY ("toCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
