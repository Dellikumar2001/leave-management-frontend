CREATE TABLE IF NOT EXISTS "LeaveGroupCategory" (
    "leaveGroupId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "LeaveGroupCategory_pkey" PRIMARY KEY ("leaveGroupId", "categoryId"),
    CONSTRAINT "LeaveGroupCategory_leaveGroupId_fkey"
        FOREIGN KEY ("leaveGroupId") REFERENCES "LeaveGroup"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveGroupCategory_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "LeaveCategoryMaster"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LeaveGroupCategory_categoryId_idx"
    ON "LeaveGroupCategory"("categoryId");

INSERT INTO "LeaveGroupCategory" ("leaveGroupId", "categoryId")
SELECT "id", "categoryId"
FROM "LeaveGroup"
WHERE "categoryId" IS NOT NULL
ON CONFLICT ("leaveGroupId", "categoryId") DO NOTHING;
