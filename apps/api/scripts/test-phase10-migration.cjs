const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const migration = readFileSync(join(__dirname, '../../../prisma/migrations/20261016090000_phase10_notifications_master_data/migration.sql'),'utf8');
(async()=>{
 const db = new PGlite();
 try {
  await db.exec(`CREATE TYPE "LoadListStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'PARTIALLY_LOADED', 'COMPLETED', 'FINALIZED', 'CANCELLED');
    CREATE TABLE "Port" ("id" text primary key, "code" text, "name" text, "country" text, "city" text, "abbreviation" text, "deletedAt" timestamp);
    CREATE TABLE "Customer" ("id" text primary key, "type" text, "shortName" text, "taxId" text, "currency" text);
    CREATE TABLE "Cargo" ("id" text primary key, "chassis" text, "serial" text, "comment" text, "units" int,
      "chassisNumber" text, "serialNumber" text, "comments" text, "quantity" int, "arrivalDate" timestamp,
      "createdAt" timestamp not null default now(), "deletedAt" timestamp, "status" text);
    CREATE TABLE "Vessel" ("id" text primary key);
    CREATE TABLE "Voyage" ("id" text primary key);
    CREATE TABLE "User" ("id" text primary key);
    CREATE TABLE "LoadList" ("id" text primary key, "status" "LoadListStatus" not null default 'DRAFT');
    INSERT INTO "Customer" VALUES ('c1','SHIPPER','old','OLD-TRN','AED'), ('c2',null,null,null,null);
    INSERT INTO "Cargo" ("id", "chassis", "serial", "comment", "units", "status")
      VALUES ('g1','OLD1','S1','first',12,'REGISTERED');
    INSERT INTO "Cargo" ("id", "chassis", "serial", "comment", "units", "chassisNumber", "serialNumber", "comments", "quantity", "status")
      VALUES ('g2','LEG','OLD','older',3,'CANON','NEW','newer',9,'REGISTERED');
    INSERT INTO "Port" VALUES ('p1','P1','Hamriyah','UAE',null,null,null);
    INSERT INTO "LoadList" VALUES ('l1','IN_PROGRESS'),('l2','PARTIALLY_LOADED'),('l3','COMPLETED'),('l4','FINALIZED');`);
  await db.exec(migration);
  const q = async sql => (await db.query(sql)).rows;
  assert.deepEqual((await q('SELECT "legacyType", "shortName", "taxId", "currency" FROM "CustomerLegacyAttribute" WHERE "customerId" = \'c1\''))[0],
    {legacyType:'SHIPPER',shortName:'old',taxId:'OLD-TRN',currency:'AED'});
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM "CustomerLegacyAttribute"'))[0].n,1);
  for(const col of ['type','shortName','taxId','currency']) {
    assert.equal((await q(`SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = '${col}'`))[0].n,0);
  }
  const g1=(await q('SELECT "chassis", "chassisNumber", "serial", "serialNumber", "comment", "comments", "units", "quantity" FROM "Cargo" WHERE "id" = \'g1\''))[0];
  assert.deepEqual(g1,{chassis:'OLD1',chassisNumber:'OLD1',serial:'S1',serialNumber:'S1',comment:'first',comments:'first',units:12,quantity:12});
  const g2=(await q('SELECT "chassis", "chassisNumber", "serial", "serialNumber", "comment", "comments", "units", "quantity" FROM "Cargo" WHERE "id" = \'g2\''))[0];
  assert.deepEqual(g2,{chassis:'LEG',chassisNumber:'CANON',serial:'OLD',serialNumber:'NEW',comment:'older',comments:'newer',units:3,quantity:9});
  const archive=(await q('SELECT "chassis", "serial", "comment", "units" FROM "CargoLegacyAttribute" WHERE "cargoId" = \'g2\''))[0];
  assert.deepEqual(archive,{chassis:'LEG',serial:'OLD',comment:'older',units:3});
  assert.equal((await q('SELECT "city", "abbreviation" FROM "Port" WHERE "id" = \'p1\''))[0].city,null);
  assert.deepEqual((await q('SELECT "status"::text FROM "LoadList" ORDER BY "id"')).map(r=>r.status),['IN_PROGRESS','PARTIALLY_LOADED','COMPLETED','FINALIZED']);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM "NotificationRule"'))[0].n,0);
  assert.equal((await q('SELECT COUNT(*)::int AS n FROM "PortAlias"'))[0].n,0);
  assert.equal((await q("SELECT COUNT(*)::int AS n FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='LoadListStatus'"))[0].n,6);
  console.log('Phase 10 isolated PGlite fixture passed: archival, backfill/conflicts, historical Load List states, and no default rules or aliases.');
 } finally {await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
