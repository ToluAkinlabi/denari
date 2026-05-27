-- CreateTable
CREATE TABLE "PeriodRafAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rafPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodRafAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodRafAllocation_userId_idx" ON "PeriodRafAllocation"("userId");

-- CreateIndex
CREATE INDEX "PeriodRafAllocation_periodId_idx" ON "PeriodRafAllocation"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodRafAllocation_periodId_categoryId_key" ON "PeriodRafAllocation"("periodId", "categoryId");

-- AddForeignKey
ALTER TABLE "PeriodRafAllocation" ADD CONSTRAINT "PeriodRafAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRafAllocation" ADD CONSTRAINT "PeriodRafAllocation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodRafAllocation" ADD CONSTRAINT "PeriodRafAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
