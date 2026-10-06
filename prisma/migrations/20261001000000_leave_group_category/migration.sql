ALTER TABLE "LeaveGroup" ADD COLUMN "categoryId" INTEGER;

ALTER TABLE "LeaveGroup" ADD CONSTRAINT "LeaveGroup_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "LeaveCategoryDefinition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;