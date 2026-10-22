import { Prisma, type PrismaClient } from '@prisma/client';
import type { SeedCoreResult } from './core';
import { referencePorts } from './phase10-ports';

/**
 * Phase X (documents demo) — OPTIONAL demonstration data, reached only through
 * the SEED_DEMO_DATA=true gate in prisma/seed.ts (called from seedDemo).
 *
 * This module mirrors the company's REAL shipment documents —
 *   • CARGO MANIFEST `DSMAN/KHO-26-006` (voyage 02/26, BARGE - MEHDI 11 with
 *     TUG - LAYAN GULF, POL Hamriya Dubai UAE → POD Khorramshahr Iran; 45 cargo
 *     rows on 32 B/L numbers, printed totals: TOTAL 32 UNITS AND 79 PKGS /
 *     UNIT+PKGS 111 / GROSS WEIGHT 991,886 KGS)
 *   • BILL OF LADING `KHS/26-110` (shipper RAS AL KHAIMAH MACHINERIES LLC,
 *     consignee JOINT MECHANIC CO — National ID 10100670462, notify party
 *     "SAME AS CONSIGNEE", destination agent BADBAN ARVAND ROOD SHIPPING CO,
 *     freight prepaid, issued in Dubai on 29-AUG-26, one original, cargo
 *     "USED KOMATSU D155A BULLDOZER CH.NO: KMT0D105EMC088308 (ON DECK)",
 *     marks "1 UNIT", 42,000 KGS)
 * as clearly-marked DEMO fixtures. All names/masters are suffixed " (DEMO)";
 * document numbers themselves stay verbatim so the demo dashboard reproduces
 * the real company documents.
 *
 * SAFETY: exactly like demo.ts — idempotent upsert-by-unique-key with
 * `update: {}` (never overwrites anything), masters are never silently
 * reactivated and any conflicting linkage throws. Never enable on production.
 */

const DEMO_DEMO_PREFIX = 'DEMO';

/* ------------------------------------------------------------------ */
/* Party masters (verbatim document names, DEMO-marked)               */
/* ------------------------------------------------------------------ */

interface DocumentDemoParty {
  slug: string;
  name: string;
  address?: string;
  taxId?: string;
  // Documented only where the document identifies the party as a natural person;
  // company masters remain LEGAL by construction (Consignee has no such column).
  personKind?: CustomerPersonKindText;
}
type CustomerPersonKindText = 'LEGAL' | 'NATURAL';

const DEMO_SHIPPERS: readonly DocumentDemoParty[] = [
  { slug: 'RAKM', name: 'RAS AL KHAIMAH MACHINERIES LLC', address: 'DUBAI, UAE' },
  { slug: 'GALADARI', name: 'GALADARI TRUCKS & HEAVY EQUIPMENTS CO' },
  { slug: 'DUNA', name: 'DUNA SHIPPING LLC', address: 'HAMRIYA, DUBAI, UAE' },
  { slug: 'GRANDCRANE', name: 'GRAND CRANE TRADING LLC' },
  { slug: 'SANDYHILL', name: 'SANDY HILL HEAVY EQUIPMENT AND MOTOR TRADING LLC FZ' },
  { slug: 'ROSE', name: 'ROSE MINE GENERAL TRADING LLC' },
  { slug: 'NEWAUTO', name: 'NEW AUTO FZCO' },
  { slug: 'MARINO', name: 'MARINO USED HEAVY EQUIPMENT AND MACHINERY TRADING LLC' },
  { slug: 'EHSAN', name: 'EHSAN INTERNATIONAL' },
  { slug: 'ALDA', name: 'ALDA CONSTRUCTION EQUIPMENT & MACHINERY TRADING LLC' },
];

const DEMO_CONSIGNEES: readonly DocumentDemoParty[] = [
  { slug: 'JOINT', name: 'JOINT MECHANIC CO', personKind: 'LEGAL', taxId: '10100670462' },
  { slug: 'BADBAN', name: 'BADBAN ARVAND ROOD SHIPPING CO', personKind: 'LEGAL' },
  { slug: 'BANDAR', name: 'BANDAR RAHE CASPIAN CO', personKind: 'LEGAL' },
  { slug: 'SEDAGHAT', name: 'SEDAGHAT TEJARAT ARVANDAN COMPANY', personKind: 'LEGAL' },
  { slug: 'NASSIR', name: 'MR. HOJAT NASSIR', personKind: 'NATURAL' },
  { slug: 'KANDOVAN', name: 'KANDOVAN PARS CONSTRUCTION CO', personKind: 'LEGAL' },
  { slug: 'SHAKIBA', name: 'MR. JALAL AMIRI SHAKIBA', personKind: 'NATURAL' },
  { slug: 'SHAHVARAEI', name: 'MR. SHAHROKH SHAHVARAEI', personKind: 'NATURAL' },
  { slug: 'KASHCO', name: 'KARIZ SHAHR MINES COMPANY (KASHCO)', personKind: 'LEGAL' },
  { slug: 'BAYMANI', name: 'MR. IMAN BAYMANI NEZHAD', personKind: 'NATURAL' },
  { slug: 'POUR', name: 'MR. SEYED ALI MOHAMMAD POUR', personKind: 'NATURAL' },
  { slug: 'KEYHAN', name: 'KEYHAN TEJARAT MEHVAR ARVAND CO', personKind: 'LEGAL' },
  { slug: 'TAHA', name: 'TAHA POUYESH KISH', personKind: 'LEGAL' },
  { slug: 'NIKAN', name: 'NIKAN SERAJ ARJANR ARVAND', personKind: 'LEGAL' },
];

const DEMO_AGENT = {
  code: 'AGT-DEMO-BADBAN',
  name: 'BADBAN ARVAND ROOD SHIPPING CO',
  address: 'KHORRAM SHAHR, IRAN',
  phone: '+98 9365855027',
  email: 'a.mahmoodiani_bar@yahoo.com',
} as const;

/* ------------------------------------------------------------------ */
/* Cargo manifest rows — verbatim from manifest.md (45 rows)           */
/* ------------------------------------------------------------------ */

export type DemoCargoType = 'HEAVY_LIFT' | 'VEHICLE' | 'GENERAL';

export interface DemoCargoRow {
  seq: number; // manifest row number (#) 1..45
  bl: string; // document B/L number on this row (KHS/26-xxx or forwarder NES...)
  consignee: string;
  shipper: string;
  cargoType: DemoCargoType;
  goods: string[]; // description lines WITHOUT the serial/chassis line
  chassis?: string; // "CH.NO" values
  vin?: string; // rows 24/25 brand-new cars: the document "CH.NO" is a vehicle VIN
  serial?: string; // "S.NO" values
  quantity: number | null; // units ("1 UNIT" lines)
  packages?: number | null; // extra "+ N PKGS" packages; PKGS-only rows carry the pkg count here
  packageType?: string | null; // verbatim words of package-only rows (PALLET / PCS / WOODEN BOX)
  weight: number; // gross weight KGS (document value)
}

const DEMO_CARGO_ROWS: DemoCargoRow[] = [
  { seq: 1, bl: 'KHS/26-110', consignee: 'JOINT', shipper: 'RAKM', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155A-6 BULLDOZER'], chassis: 'KMT0D105EMC088308', quantity: 1, weight: 42_000 },
  { seq: 2, bl: 'KHS/26-111', consignee: 'JOINT', shipper: 'RAKM', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155-6 BULLDOZER'], chassis: 'KMT0D105CNC088926', quantity: 1, weight: 42_000 },
  { seq: 3, bl: 'KHS/26-112', consignee: 'JOINT', shipper: 'RAKM', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155-6 BULLDOZER'], chassis: 'KMT0D105ANC088919', quantity: 1, weight: 42_000 },
  { seq: 4, bl: 'KHS/26-113', consignee: 'JOINT', shipper: 'RAKM', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155-6 BULLDOZER'], chassis: 'KMT0D105HMC088498', quantity: 1, weight: 42_000 },
  { seq: 5, bl: 'KHS/26-114', consignee: 'JOINT', shipper: 'RAKM', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU WA470 WHEEL LOADER'], chassis: 'KMTWA114CRA015704', quantity: 1, weight: 23_000 },
  { seq: 6, bl: 'KHS/26-115', consignee: 'JOINT', shipper: 'GALADARI', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU WA380-6 WHEEL LOADER'], chassis: 'KMTWA095HSA070060', quantity: 1, weight: 17_000 },
  { seq: 7, bl: 'KHS/26-116', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155A-2 BULLDOZER'], chassis: 'KMT0D038P02072324', quantity: 1, weight: 38_000 },
  { seq: 8, bl: 'KHS/26-117', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU D155A-2 BULLDOZER'], chassis: 'KMT0D038A02072735', quantity: 1, weight: 38_000 },
  { seq: 9, bl: 'KHS/26-118', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU GD705A-4 GRADER'], chassis: 'KMTGD019T01024398', quantity: 1, weight: 22_800 },
  { seq: 10, bl: 'KHS/26-119', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU GD705A-4 GRADER'], chassis: 'KMTGD019C01025413', quantity: 1, weight: 22_800 },
  { seq: 11, bl: 'KHS/26-120', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU GD705A-4 GRADER'], chassis: 'KMTGD019K01025585', quantity: 1, weight: 22_800 },
  { seq: 12, bl: 'KHS/26-121', consignee: 'BADBAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU GD705A-4 GRADER'], chassis: 'KMTGD019C01025436', quantity: 1, weight: 22_800 },
  { seq: 13, bl: 'KHS/26-122', consignee: 'BANDAR', shipper: 'GRANDCRANE', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED HYDRAULIC TRUCK CRANE (TWO CABINS)', 'TYPE: NK400-E, CAPACITY: 40 TONS, TARIFF NO: 87051010'],
    chassis: 'K354-B00179', quantity: 1, weight: 38_000 },
  { seq: 14, bl: 'KHS/26-123', consignee: 'SEDAGHAT', shipper: 'GRANDCRANE', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED TEREX DEMAG ALL TERRAIN CRANE (TWO CABINS) + 5 PKGS', 'TYPE: AC200-1, CAPACITY: 200 TONS, TARIFF NO: 87051010'],
    chassis: 'WMG5312604Z000059', quantity: 1, packages: 5, weight: 75_000 },
  { seq: 15, bl: 'KHS/26-124', consignee: 'NASSIR', shipper: 'SANDYHILL', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED FORKLIFT KOMATSU', 'TYPE: FD200-7, CAPACITY: 20 TONS, TARIFF NO: 84272012'],
    chassis: 'M180-2337', quantity: 1, weight: 29_600 },
  { seq: 16, bl: 'KHS/26-125', consignee: 'NASSIR', shipper: 'SANDYHILL', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED FORKLIFT KOMATSU', 'TYPE: FD100-7, CAPACITY: 10 TONS, TARIFF NO: 84272012'],
    chassis: 'M156-5736', quantity: 1, weight: 16_460 },
  { seq: 17, bl: 'KHS/26-126', consignee: 'NASSIR', shipper: 'SANDYHILL', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED FORKLIFT KOMATSU', 'TYPE: FD150E-8, CAPACITY: 15 TONS, TARIFF NO: 84272012'],
    chassis: 'M247-8352', quantity: 1, weight: 18_600 },
  { seq: 18, bl: 'KHS/26-127', consignee: 'NASSIR', shipper: 'SANDYHILL', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED KATO ROUGH TERRAIN CRANE (ONE CABIN) + 2 PKGS', 'TYPE: KR50H, CAPACITY: 50 TONS, TARIFF NO: 84264100'],
    chassis: 'KR512-1279', quantity: 1, packages: 2, weight: 38_500 },
  { seq: 19, bl: 'KHS/26-128', consignee: 'KANDOVAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED WIRTGEN TCM TEXTURE CURING MACHINE FOR CONCRETE PAVEMENT', 'HS CODE:84791029'],
    chassis: '02BA090C120180017', quantity: 1, weight: 10_000 },
  { seq: 20, bl: 'KHS/26-129', consignee: 'KANDOVAN', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED WIRTGEN SP BETON PAVER + 38 PKGS', 'HS CODE: 84791029'],
    chassis: '05SP090119530034', quantity: 1, packages: 38, weight: 38_000 },
  { seq: 21, bl: 'KHS/26-130', consignee: 'SHAKIBA', shipper: 'DUNA', cargoType: 'HEAVY_LIFT',
    goods: ['USED WIRTGEN W200 ASPHALT PLANER', 'HS Code: 84791090'],
    chassis: '0620140072860545', quantity: 1, weight: 29_000 },
  { seq: 22, bl: 'KHS/26-131', consignee: 'SHAHVARAEI', shipper: 'GRANDCRANE', cargoType: 'HEAVY_LIFT',
    goods: ['ONE UNIT OF USED TADANO ROUGH TERRAIN CRANE (ONE CABIN)', 'TYPE: TR350M , CAPACITY: 35 TONS, TARIFF NO: 84264100'],
    chassis: 'TR351-0112', quantity: 1, weight: 32_000 },
  { seq: 23, bl: 'KHS/26-132', consignee: 'KASHCO', shipper: 'ROSE', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU PC450-8 EXCAVATOR'], chassis: 'KMTPC192CGSCZ1093', quantity: 1, weight: 45_000 },
  { seq: 24, bl: 'KHS/26-133', consignee: 'BAYMANI', shipper: 'NEWAUTO', cargoType: 'VEHICLE',
    goods: ['BRAND NEW MITSUBISHI OUTLANDER CAR'], vin: 'JE4M4W186TZ713097', quantity: 1, weight: 1_690 },
  { seq: 25, bl: 'KHS/26-134', consignee: 'POUR', shipper: 'NEWAUTO', cargoType: 'VEHICLE',
    goods: ['BRAND NEW MITSUBISHI OUTLANDER CAR'], vin: 'JE4MW182TZ713095', quantity: 1, weight: 1_690 },
  { seq: 26, bl: 'KHS/26-135', consignee: 'KASHCO', shipper: 'ROSE', cargoType: 'HEAVY_LIFT',
    goods: ['USED KOMATSU PC400-8R EXCAVATOR'], chassis: 'KMTPC192PRMBK0526', quantity: 1, weight: 42_000 },
  { seq: 27, bl: 'KHS/26-136', consignee: 'KEYHAN', shipper: 'MARINO', cargoType: 'HEAVY_LIFT',
    goods: ['USED TADANO TR350 CRANE'], chassis: 'T0010013', quantity: 1, weight: 30_000 },
  { seq: 28, bl: 'KHS/26-137', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'HEAVY_LIFT',
    goods: ['NOV HYDRA RIG TRUCK MOUNTED NITROGEN PUMPING UNIT', 'HS CODE: 84135090'],
    serial: '2H9NC3FA15C070159', quantity: 1, weight: 74_750 },
  { seq: 29, bl: 'KHS/26-138', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['UNUSED CATERPILLAR 3412 GENERATOR + 4 PKGS'], serial: 'CAT00000JRTY04568',
    quantity: 1, packages: 4, weight: 15_000 },
  { seq: 30, bl: 'KHS/26-138', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['UNUSED CATERPILLAR 3412 GENERATOR'], serial: 'CAT00000VRTY04573', quantity: 1, weight: 15_000 },
  { seq: 31, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['CUMMINS 300 KVA GENERATOR'], serial: '0022', quantity: 1, weight: 2_000 },
  { seq: 32, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['CAT 3508 ENGINE'], serial: '0376', quantity: 1, weight: 5_000 },
  { seq: 33, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['CUMMINS QSK60 ENGINE'], quantity: 1, weight: 5_000 },
  { seq: 34, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['LEROY ALTERNATOR ENGINE'], serial: '1364', quantity: 1, weight: 2_000 },
  { seq: 35, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['PEKINS 200 KVA GENERATOR'], serial: '2200', quantity: 1, weight: 2_000 },
  { seq: 36, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['CUMMINS 200 KVA GENERATOR'], serial: '0017', quantity: 1, weight: 2_000 },
  { seq: 37, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['ATLAS COPCO GA132 ELECTRIC AIR COMPRESSOR'], serial: '9527', quantity: 1, weight: 3_000 },
  { seq: 38, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['PALLETS INCLUDING 24 PCS NTN BALL BEARING'], quantity: null, packages: 6,
    packageType: 'PALLET', weight: 1_500 },
  { seq: 39, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['PCS UNUSED ELECTRODE AND WIRES'], quantity: null, packages: 12,
    packageType: 'PCS', weight: 8_000 },
  { seq: 40, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['PALLET INCLUDING 8 PCS AIR HOSE'], quantity: null, packages: 1,
    packageType: 'PALLET', weight: 500 },
  { seq: 41, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['PALLET INCLUDING 8 PCS CONVEYANCING HOSE AND REDUCER HOSE'], quantity: null, packages: 1,
    packageType: 'PALLET', weight: 100 },
  { seq: 42, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['WOODEN BOX INCLUDING CLAMP COUPLING, CLEARING BALL, VBALL VALVE,'], quantity: null, packages: 1,
    packageType: 'WOODEN BOX', weight: 150 },
  { seq: 43, bl: 'KHS/26-139', consignee: 'TAHA', shipper: 'EHSAN', cargoType: 'GENERAL',
    goods: ['WOODEN BOX INCLUDING PUMP(HUSKY 3300P)'], quantity: null, packages: 2,
    packageType: 'WOODEN BOX', weight: 106 },
  { seq: 44, bl: 'NES260900266', consignee: 'NIKAN', shipper: 'ALDA', cargoType: 'HEAVY_LIFT',
    goods: ['1 UNIT KOMATSU WA380-6 WHEEL LOADER'], chassis: 'KMTWA095TTA070114', quantity: 1, weight: 17_520 },
  { seq: 45, bl: 'NES260900267', consignee: 'NIKAN', shipper: 'ALDA', cargoType: 'HEAVY_LIFT',
    goods: ['1 UNIT KOMATSU WA380-6 WHEEL LOADER'], chassis: 'KMTWA095PTA070115', quantity: 1, weight: 17_520 },
];

/*
 * billNumber -> cargo row (manifest # sequence) mapping derived from the
 * document: KHS/26-110..137 one row each in row order, KHS/26-138 rows
 * 29–30, KHS/26-139 rows 31–43, NES260900266/267 rows 44–45.
 */
export function deriveDemoBlGroups(): Array<{ billNumber: string; rows: number[] }> {
  const map = new Map<string, number[]>();
  for (const row of DEMO_CARGO_ROWS) {
    const list = map.get(row.bl) ?? [];
    list.push(row.seq);
    map.set(row.bl, list);
  }
  return [...map.entries()].map(([billNumber, rows]) => ({ billNumber, rows }));
}

/* Document-level identifiers/totals (verbatim). */
export const DOCUMENT_DEMO_MANIFEST = {
  manifestNumber: 'MAN-DEMO-KHO-26-006',
  voyageLabel: '02/26',
  rowTotalWeight: DEMO_CARGO_ROWS.reduce((sum, r) => sum + r.weight, 0), // 991,886
  rowTotalQuantity: DEMO_CARGO_ROWS.reduce((sum, r) => sum + (r.quantity ?? 0), 0),
  rowTotalPackages: DEMO_CARGO_ROWS.reduce((sum, r) => sum + (r.packages ?? 0), 0),
  printedPositionedTotal: 'TOTAL 32 UNITS AND 79 PKGS', // as PRINTED (see note)
} as const;
export const DOCUMENT_DEMO_BILL_KHS_110 = { billNumber: 'BOL-DEMO-KHS-26-110', rowSeq: 1 } as const;

const MANIFEST_DATE = new Date('2026-09-05T09:00:00Z'); // doc "DATE: 05-Sep-26"
const ARRIVAL_AT_POL_DATE = new Date('2026-08-26T09:00:00Z'); // cargo received at POL before sailing
const BL_ISSUE_DATE = new Date('2026-08-29T09:00:00Z'); // doc "29-AUG-26"
const DEMO_MARK = ` (DEMO)`;
const DEMO_NOTE =
  'DEMO fixture mirroring REAL company documents (CARGO MANIFEST DSMAN/KHO-26-006 + B/L KHS/26-110). ' +
  'Not issued through any document workflow — exists only because SEED_DEMO_DATA=true was set.';

/** Guards shared by every master upsert in this module (demo.ts pattern). */
const assertActiveMaster = (
  label: string,
  row: { isActive: boolean; deletedAt: Date | null } | null | undefined
) => {
  if (!row || !row.isActive || row.deletedAt) {
    throw new Error(`${label} is missing, inactive or deleted; the document demo will not silently reactivate it`);
  }
};

/** Resolve a master id built earlier in this transaction; fail loudly on a gap. */
const requireId = (
  map: Map<string | number, string>,
  slug: string | number,
  label: string
): string => {
  const id = map.get(slug);
  if (!id) throw new Error(`Demo ${label} master '${slug}' did not resolve; inspect the row table`);
  return id;
};

/** Port lookup limited to the canonical reference list (DEC-117/DEC-065). */
const canonicalPort = (code: string) => {
  const spec = referencePorts.find((p) => p.code === code);
  if (!spec) throw new Error(`Port code ${code} is not in the canonical reference list`);
  return spec;
};

const decimalToNumber = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : v.toNumber();
};

/**
 * The Manifest aggregate columns are recomputed by the API on every write. The
 * seed sets them at create time and afterwards heals ONLY a mismatch against
 * the item sums (a partially written earlier run) — an owner-reviewable
 * document body is never modified by this helper.
 */
async function reconcileManifestTotals(
  tx: Prisma.TransactionClient,
  manifestId: string
): Promise<void> {
  const [aggregate, manifest] = await Promise.all([
    tx.manifestItem.aggregate({
      where: { manifestId },
      _sum: { weight: true, quantity: true, packages: true },
    }),
    tx.manifest.findUnique({
      where: { id: manifestId },
      select: { totalWeight: true, totalQuantity: true, totalPackages: true },
    }),
  ]);
  if (!manifest) return;
  if (
    decimalToNumber(aggregate._sum.weight) === decimalToNumber(manifest.totalWeight) &&
    (aggregate._sum.quantity ?? 0) === manifest.totalQuantity &&
    (aggregate._sum.packages ?? 0) === manifest.totalPackages
  ) {
    return;
  }
  await tx.manifest.update({
    where: { id: manifestId },
    data: {
      totalWeight: decimalToNumber(aggregate._sum.weight),
      totalQuantity: aggregate._sum.quantity ?? 0,
      totalPackages: aggregate._sum.packages ?? 0,
    },
  });
}

export async function seedDocumentDemo(prisma: PrismaClient, ctx: SeedCoreResult): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      /* ---------------- ports (reuse canonical reference rows) ------- */
      const port = async (code: string) => {
        const spec = canonicalPort(code);
        const row = await tx.port.upsert({ where: { code }, update: {},
          create: { code: spec.code, name: spec.name, country: spec.country,
            city: spec.city, abbreviation: spec.abbreviation, isActive: true } });
        if (row.deletedAt || row.country !== spec.country) {
          throw new Error(`Port ${spec.name} has a conflicting country or is archived; inspect before demo seeding`);
        }
        return row;
      };
      const hamriyah = await port('HAMRIYAH'); // POL: HAMRIYA, DUBAI, UAE
      const khorramshahr = await port('KHORRAMSHAHR'); // POD: KHORRAM SHAHR, IRAN

      /* ---------------- vessels: barge + tug ------------------------- */
      const barge = await tx.vessel.upsert({ where: { code: 'BARGE-DEMO-MEHDI11' },
        update: {},
        create: { code: 'BARGE-DEMO-MEHDI11', name: `MEHDI 11${DEMO_MARK}`,
          flag: 'UAE', vesselType: 'BARGE', notes: DEMO_NOTE } });
      const tug = await tx.vessel.upsert({ where: { code: 'TUG-DEMO-LAYAN-GULF' },
        update: {},
        create: { code: 'TUG-DEMO-LAYAN-GULF', name: `LAYAN GULF${DEMO_MARK}`,
          flag: 'UAE', vesselType: 'TUG', notes: DEMO_NOTE } });
      assertActiveMaster('Demo barge MEHDI 11', barge);
      assertActiveMaster('Demo tug LAYAN GULF', tug);

      /* ---------------- voyage 02/26 ---------------------------------- */
      const voyage = await tx.voyage.upsert({ where: { voyageNumber: 'VOY-DEMO-KHO-0226' },
        update: {},
        create: {
          voyageNumber: 'VOY-DEMO-KHO-0226',
          vesselId: barge.id, // cargo-carrying chief vessel = the barge
          bargeVesselId: barge.id, // BARGE - MEHDI 11
          tugVesselId: tug.id, // TUG - LAYAN GULF
          status: 'COMPLETED', // historical shipment (documents dated Aug/Sep 2026)
          originPortId: hamriyah.id,
          destinationPortId: khorramshahr.id,
          plannedDepartureAt: MANIFEST_DATE,
          plannedArrivalAt: new Date('2026-09-08T08:00:00Z'),
          notes: `${DEMO_MARK} — voyage label "${DOCUMENT_DEMO_MANIFEST.voyageLabel}"; ${DEMO_NOTE}`,
          createdById: ctx.adminUser.id,
        } });
      if (voyage.bargeVesselId !== barge.id || voyage.tugVesselId !== tug.id ||
          voyage.originPortId !== hamriyah.id || voyage.destinationPortId !== khorramshahr.id) {
        throw new Error('VOY-DEMO-KHO-0226 belongs to different vessels/ports; no demo document was changed');
      }
      const leg = await tx.voyageDestination.findFirst({
        where: { voyageId: voyage.id, deletedAt: null } });
      if (!leg) {
        await tx.voyageDestination.create({ data: {
          voyageId: voyage.id,
          destinationPortId: khorramshahr.id,
          numberingVesselId: barge.id,
          legNumber: 2, // document voyage label 02/26
          voyageNumber: DOCUMENT_DEMO_MANIFEST.voyageLabel,
        } });
      } else if (leg.destinationPortId !== khorramshahr.id ||
                 leg.numberingVesselId !== barge.id ||
                 leg.voyageNumber !== DOCUMENT_DEMO_MANIFEST.voyageLabel) {
        throw new Error('VOY-DEMO-KHO-0226 has a conflicting destination leg');
      }

      /* ---------------- shippers / consignees / agent / customers ---- */
      const shipperIds = new Map<string, string>();
      for (const spec of DEMO_SHIPPERS) {
        const row = await tx.shipper.upsert({
          where: { code: `SPH-DEMO-${spec.slug}` },
          update: {},
          create: { code: `SPH-DEMO-${spec.slug}`, name: `${spec.name}${DEMO_MARK}`,
            address: spec.address ?? null, notes: DEMO_NOTE } });
        assertActiveMaster(`Demo shipper ${spec.name}`, row);
        shipperIds.set(spec.slug, row.id);
      }
      const consigneeIds = new Map<string, string>();
      for (const spec of DEMO_CONSIGNEES) {
        const row = await tx.consignee.upsert({
          where: { code: `CSG-DEMO-${spec.slug}` },
          update: {},
          create: { code: `CSG-DEMO-${spec.slug}`, name: `${spec.name}${DEMO_MARK}`,
            taxId: spec.taxId ?? null, notes: DEMO_NOTE } });
        assertActiveMaster(`Demo consignee ${spec.name}`, row);
        consigneeIds.set(spec.slug, row.id);
      }
      const badban = await tx.agent.upsert({
        where: { code: DEMO_AGENT.code },
        update: {},
        create: { code: DEMO_AGENT.code, name: `${DEMO_AGENT.name}${DEMO_MARK}`,
          address: DEMO_AGENT.address, phone: DEMO_AGENT.phone, email: DEMO_AGENT.email, notes: DEMO_NOTE } });
      assertActiveMaster('Demo destination agent BADBAN', badban);
      await tx.agentDestination.upsert({
        where: { agentId_portId: { agentId: badban.id, portId: khorramshahr.id } },
        update: {},
        create: { agentId: badban.id, portId: khorramshahr.id, isActive: true } });

      const customerIds = new Map<string, string>();
      for (const spec of DEMO_CONSIGNEES) {
        const row = await tx.customer.upsert({
          where: { code: `CUS-DEMO-${spec.slug}` },
          update: {},
          create: { code: `CUS-DEMO-${spec.slug}`, name: `${spec.name}${DEMO_MARK}`,
            personKind: spec.personKind, isActive: true, notes: DEMO_NOTE } });
        assertActiveMaster(`Demo customer ${spec.name}`, row);
        customerIds.set(spec.slug, row.id);
      }

      /* ---------------- cargo rows (45) ------------------------------ */
      const cargoIds = new Map<number, string>();
      for (const row of DEMO_CARGO_ROWS) {
        // The commercial Customer is the row consignee; party masters carry
        // the document shipper/consignee per row.
        const customerId = requireId(customerIds, row.consignee, 'Customer');
        const rowShipperId = requireId(shipperIds, row.shipper, 'Shipper');
        const rowConsigneeId = requireId(consigneeIds, row.consignee, 'Consignee');
        const rowCargo = await tx.cargo.upsert({
          where: { reference: `CRG-DEMO-KHO02-${String(row.seq).padStart(2, '0')}` },
          update: {},
          create: {
            reference: `CRG-DEMO-KHO02-${String(row.seq).padStart(2, '0')}`,
            customerId,
            portId: hamriyah.id,
            destinationPortId: khorramshahr.id,
            pol: 'HAMRIYA, DUBAI, UAE',
            pod: 'KHORRAM SHAHR, PERSIAN GULF, IRAN',
            shipperId: rowShipperId,
            consigneeId: rowConsigneeId,
            description: row.goods.join('\n'),
            cargoType: row.cargoType,
            serialNumber: row.serial, chassisNumber: row.chassis, vin: row.vin,
            weight: row.weight, weightUnit: 'KG',
            quantity: row.quantity,
            packages: row.packages ?? null, packageType: row.packageType ?? null,
            arrivalDate: ARRIVAL_AT_POL_DATE,
            arrivalReference: row.bl,
            inspectionStatus: 'DONE', loadingStatus: 'LOADED',
            manifestNumber: DOCUMENT_DEMO_MANIFEST.manifestNumber,
            status: 'DELIVERED', // discharged at POD (historical shipment)
            comments: DEMO_NOTE,
            createdById: ctx.adminUser.id,
          } });
        // Cargo has no isActive column: only soft-delete can invalidate it here.
        if (!rowCargo || rowCargo.deletedAt) {
          throw new Error(`Demo cargo row ${row.seq} (${row.bl}) is deleted; demo seed will not silently restore it`);
        }
        if (rowCargo.customerId !== customerId) {
          throw new Error(`Cargo ${rowCargo.reference} belongs to another Customer; inspect before demo seeding`);
        }
        cargoIds.set(row.seq, rowCargo.id);
      }

      /* ---------------- the CARGO MANIFEST (DSMAN/KHO-26-006) -------- */
      const manifest = await tx.manifest.upsert({
        where: { manifestNumber: DOCUMENT_DEMO_MANIFEST.manifestNumber },
        update: {},
        create: {
          manifestNumber: DOCUMENT_DEMO_MANIFEST.manifestNumber,
          voyageId: voyage.id,
          status: 'APPROVED',
          vesselName: `BARGE - MEHDI 11${DEMO_MARK}`,
          polPortId: hamriyah.id,
          podPortId: khorramshahr.id,
          agentId: badban.id,
          // Multi-party manifest: shipper/consignee per ITEM (12+ shippers),
          // never one header party — per-item rows below carry the parties.
          description: `TUG - LAYAN GULF${DEMO_MARK}`,
          manifestDate: MANIFEST_DATE,
          submittedById: ctx.adminUser.id, submittedAt: MANIFEST_DATE,
          approvedById: ctx.adminUser.id, approvedAt: MANIFEST_DATE,
          totalWeight: DOCUMENT_DEMO_MANIFEST.rowTotalWeight,
          totalQuantity: DOCUMENT_DEMO_MANIFEST.rowTotalQuantity,
          totalPackages: DOCUMENT_DEMO_MANIFEST.rowTotalPackages,
          notes: `${DEMO_NOTE} Printed total row says "${DOCUMENT_DEMO_MANIFEST.printedPositionedTotal}" while the rows recompute to ${DOCUMENT_DEMO_MANIFEST.rowTotalQuantity} units + ${DOCUMENT_DEMO_MANIFEST.rowTotalPackages} packages = 111 UNIT/PKGS, gross weight ${DOCUMENT_DEMO_MANIFEST.rowTotalWeight} KGS.`,
          createdById: ctx.adminUser.id,
        } });
      if (manifest.voyageId !== voyage.id || manifest.agentId !== badban.id || manifest.deletedAt) {
        throw new Error('DSMAN/KHO-26-006 belongs to a different voyage or Agent; inspect before demo seeding');
      }

      /* ---------------- manifest items (45) --------------------------- */
      for (const row of DEMO_CARGO_ROWS) {
        const rowCargoId = requireId(cargoIds, row.seq, 'cargo row');
        await tx.manifestItem.upsert({
          where: { manifestId_cargoId: { manifestId: manifest.id, cargoId: rowCargoId } },
          update: {},
          create: {
            manifestId: manifest.id,
            cargoId: rowCargoId,
            sequence: row.seq,
            blNumber: row.bl,
            weight: row.weight,
            quantity: row.quantity,
            packages: row.packages ?? null,
            packageType: row.packageType ?? null,
            shipperId: requireId(shipperIds, row.shipper, 'Shipper'),
            consigneeId: requireId(consigneeIds, row.consignee, 'Consignee'),
          } });
      }
      // Totals are recomputed server-side on every write; self-heal a partial
      // history after a crash without touching administrator-visible content.
      await reconcileManifestTotals(tx, manifest.id);

      /* ---------------- BILL OF LADING KHS/26-110 (verbatim B/L) ------ */
      const bill = await tx.billOfLading.upsert({
        where: { billNumber: DOCUMENT_DEMO_BILL_KHS_110.billNumber },
        update: {},
        create: {
          billNumber: DOCUMENT_DEMO_BILL_KHS_110.billNumber,
          manifestId: manifest.id,
          voyageId: voyage.id,
          destinationPortId: khorramshahr.id,
          status: 'APPROVED',
          billType: 'MASTER', // DUNA letters the document and signs "AS AGENT" for the master
          vesselName: `MEHDI 11${DEMO_MARK}`,
          shipperId: requireId(shipperIds, 'RAKM', 'Shipper'),
          consigneeId: requireId(consigneeIds, 'JOINT', 'Consignee'),
          notifyParty: 'SAME AS CONSIGNEE',
          freightTerms: 'PREPAID',
          carrierName: `DUNA SHIPPING LLC${DEMO_MARK}`,
          placeOfIssue: 'DUBAI',
          dateOfIssue: BL_ISSUE_DATE,
          originals: 1,
          goodsDescription: 'USED KOMATSU D155A BULLDOZER\nCH.NO: KMT0D105EMC088308\n(ON DECK)',
          shipmentMarks: '1 UNIT',
          totalPackages: 1, totalGrossWeight: 42_000,
          notes: `${DEMO_NOTE} DESTINATION AGENT: BADBAN ARVAND ROOD SHIPPING CO, KHORRAM SHAHR, IRAN.`,
          createdById: ctx.adminUser.id,
        } });
      if (bill.voyageId !== voyage.id || bill.destinationPortId !== khorramshahr.id ||
          bill.manifestId !== manifest.id || bill.deletedAt) {
        throw new Error('KHS/26-110 belongs to different master records; inspect before demo seeding');
      }
      /* ---------------- B/L item (row 1) ------------------------------ */
      const firstRow = DEMO_CARGO_ROWS.find((r) => r.seq === DOCUMENT_DEMO_BILL_KHS_110.rowSeq);
      if (!firstRow) throw new Error('Demo B/L row (seq 1) missing');
      const firstCargoId = requireId(cargoIds, firstRow.seq, 'cargo row');
      const firstManifestItem = await tx.manifestItem.findUnique({
        where: { manifestId_cargoId: { manifestId: manifest.id, cargoId: firstCargoId } },
        select: { id: true, billOfLadingItemId: true },
      });
      if (!firstManifestItem) throw new Error('Demo manifest item for B/L row 1 missing');
      const existingBillItem = await tx.billOfLadingItem.findFirst({
        where: { billOfLadingId: bill.id, cargoId: firstCargoId },
      });
      let billItemId: string;
      if (existingBillItem) {
        if (existingBillItem.manifestItemId !== firstManifestItem.id) {
          throw new Error('KHS/26-110 item already consolidated from a different manifest line; inspect before demo seeding');
        }
        billItemId = existingBillItem.id;
      } else {
        const billItem = await tx.billOfLadingItem.create({
          data: {
            billOfLadingId: bill.id,
            manifestItemId: firstManifestItem.id,
            cargoId: firstCargoId,
            sequence: 1,
            goodsDescription: 'USED KOMATSU D155A BULLDOZER\nCH.NO: KMT0D105EMC088308\n(ON DECK)',
            marksAndNumbers: '1 UNIT',
            packages: 1,
            grossWeight: 42_000,
          } });
        billItemId = billItem.id;
      }
      // Stamp only an empty consolidation reference on the manifest line —
      // never reassign one that already belongs to another B/L item.
      if (firstManifestItem.billOfLadingItemId === null) {
        await tx.manifestItem.update({
          where: { id: firstManifestItem.id },
          data: { billOfLadingItemId: billItemId },
        });
      } else if (firstManifestItem.billOfLadingItemId !== billItemId) {
        throw new Error('Manifest line 1 already points at another B/L item; demo seed will not reassign it');
      }
    },
    { timeout: 240_000 }
  );

  const blGroups = deriveDemoBlGroups();
  console.log(
    `  Document demo: manifest DSMAN/KHO-26-006 (voyage 02/26, BARGE - MEHDI 11 + TUG - LAYAN GULF; ` +
    `${DEMO_CARGO_ROWS.length} cargo rows on ${blGroups.length} B/L numbers; totals ${DOCUMENT_DEMO_MANIFEST.rowTotalQuantity}` +
    ` units + ${DOCUMENT_DEMO_MANIFEST.rowTotalPackages} pkgs / 991,886 KGS) and B/L KHS/26-110 — all DEMO fixtures`
  );
}
