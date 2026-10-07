ALTER TABLE "leave_types"
    ALTER COLUMN "payment_type" DROP NOT NULL;

ALTER TABLE "StudentLeaveRequest"
    ADD COLUMN "paymentType" TEXT;
