CREATE TABLE "holiday_calendar" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "repeat_every_year" BOOLEAN NOT NULL DEFAULT false,
    "is_holiday" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "holiday_calendar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "holiday_calendar_date_idx" ON "holiday_calendar"("date");