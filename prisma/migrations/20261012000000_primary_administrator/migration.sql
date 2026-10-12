-- DEC-116 — Primary administrator (the company owner).
--
-- Adds the identity flag described in confirmed-decisions.md DEC-116.
--
-- Why a PARTIAL unique index rather than a plain unique index:
--   A plain UNIQUE("isPrimaryAdmin") would permit only ONE row with true AND only
--   ONE row with false, which is wrong — there must be exactly one primary
--   administrator and arbitrarily many non-primary users.
--   A partial unique index constrains only the rows where isPrimaryAdmin = true,
--   which is precisely "at most one primary administrator".
--
-- "Exactly one" (rather than "at most one") is additionally enforced in the
-- application layer by UsersService, because a database cannot require a row to
-- exist. UsersService.assertCanMutatePrimaryAdmin + transferPrimaryAdmin cover
-- removal, deactivation, deletion and succession.
ALTER TABLE "User" ADD COLUMN "isPrimaryAdmin" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "User_isPrimaryAdmin_key"
  ON "User"("isPrimaryAdmin")
  WHERE "isPrimaryAdmin" = true;
