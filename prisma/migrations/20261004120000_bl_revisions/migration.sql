-- P4-U5 — ADR-045 decision 4 (B/L revisions): additive only.
--  * bills_of_lading.revision: the label the NEXT frozen revision receives
--    (snapshots are numbered 1, 2, 3, ... ; counter starts at 1).
--  * bills_of_lading_revisions: immutable snapshots {billId, revisionNumber, note?,
--    snapshot (JSONB), createdById, createdAt}; @@unique(billId, revisionNumber) is the
--    DB backstop behind the row-lock used by the service.
-- Both FKs are ON DELETE CASCADE (a bill or user removal drops its revision rows —
-- keeps test cleanups working). No column drops, no enum changes.
ALTER TABLE "bills_of_lading" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "bills_of_lading_revisions" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "note" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_of_lading_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bills_of_lading_revisions_billId_idx" ON "bills_of_lading_revisions"("billId");

CREATE UNIQUE INDEX "bills_of_lading_revisions_billId_revisionNumber_key" ON "bills_of_lading_revisions"("billId", "revisionNumber");

ALTER TABLE "bills_of_lading_revisions" ADD CONSTRAINT "bills_of_lading_revisions_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills_of_lading"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bills_of_lading_revisions" ADD CONSTRAINT "bills_of_lading_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
