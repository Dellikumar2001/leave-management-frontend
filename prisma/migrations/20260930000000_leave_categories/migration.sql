CREATE TABLE "LeaveCategoryMaster" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveCategoryMaster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveCategoryMaster_code_key" ON "LeaveCategoryMaster"("code");