ALTER TABLE "leave_types"
ADD COLUMN "category_master_id" INTEGER;

CREATE INDEX "leave_types_category_master_id_idx"
ON "leave_types"("category_master_id");

ALTER TABLE "leave_types"
ADD CONSTRAINT "leave_types_category_master_id_fkey"
FOREIGN KEY ("category_master_id") REFERENCES "LeaveCategoryMaster"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
