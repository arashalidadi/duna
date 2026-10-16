'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Phase 11 reviewed API privilege inventory. Model names, NOT SQL identifiers.
// S=SELECT (including Prisma RETURNING/relations), I=INSERT, U=UPDATE, D=DELETE.
// AuditLog is deliberately separate; no UPDATE/DELETE/TRUNCATE on it. Never use
// ALL TABLES/ALL PRIVILEGES. The migration journal is not an API model.
const GROUPS = Object.freeze({
  SIU: `User RefreshToken Role CompanySettings CurrencyRate Currency Port Yard Customer Shipper
    Consignee Agent AgentDestination Cargo Inspection Vessel Voyage VoyageDestination LoadList
    ActualLoading Discharge BookingRequest Manifest BlLifecycleLabel BillOfLading Invoice
    InvoiceCorrection Proforma Quotation Employee SalaryRecord Voucher VoucherAllocation Account
    GeneralJournal DeliveryOrder ReleaseOrder Letter Job NumberingSequence FileAttachment
    DocumentTemplate DocumentTemplateVersion DocumentAsset VoyageCostCategory SavedReport
    ConfigOptionList ConfigOption ConfigField ConfigFieldValue ConfigDocumentType ConfigDocument
    ConfigWorkflow ConfigApproval NotificationRule NotificationEvent NotificationInbox
    NotificationDelivery`,
  SI: `CargoIntakeDocument BillOfLadingRevision VoucherAmountAdjustment CustomerPosting
    JournalLine AuditLog DocumentTemplateAssignment DocumentIssuedSnapshot DocumentRenderedOutput
    VoyageCost ExpenseInputTax CustomerStatementIssue ConfigFieldRevision ConfigFieldValueRevision
    ConfigDocumentVersion ConfigDocumentEvent ConfigWorkflowVersion`,
  SID: `RolePermission UserRole PortAlias LoadListItem InvoiceJob InvoiceBill`,
  S: `Permission CustomerLegacyAttribute CargoLegacyAttribute`,
  SIUD: `YardInventory ActualLoadingItem ManifestItem BillOfLadingItem InvoiceItem
    ProformaItem QuotationItem JobCostItem`,
  SU: `DischargeItem`,
});
const OPS = Object.freeze({ S: 'SELECT', I: 'INSERT', U: 'UPDATE', D: 'DELETE' });
const METHODS = Object.freeze({
  count: 'S', aggregate: 'S', groupBy: 'S', findFirst: 'S', findFirstOrThrow: 'S',
  findUnique: 'S', findUniqueOrThrow: 'S', findMany: 'S',
  create: 'SI', createMany: 'I', createManyAndReturn: 'SI', upsert: 'SIU',
  update: 'SU', updateMany: 'U', updateManyAndReturn: 'SU',
  delete: 'SD', deleteMany: 'D',
});
// These rights come from *nested* Prisma operations or relation reads; they
// cannot be found by grepping for a directly called model delegate. Each
// assertion below pins the evidence to a source file and stops on source drift.
const NESTED = Object.freeze({
  UserRole: { S: ['modules/auth/auth.service.ts', /roles:\s*\{\s*include:/] },
  PortAlias: {
    I: ['modules/ports/ports.service.ts', /aliases:\s*\{\s*create:/],
    D: ['modules/ports/ports.service.ts', /aliases:\s*\{\s*deleteMany:/],
  },
  CargoLegacyAttribute: { S: ['modules/cargo/cargo.service.ts', /legacyAttributes:\s*\{\s*select:/] },
  CargoIntakeDocument: {
    S: ['modules/cargo/cargo.service.ts', /intakeDocuments:\s*\{\s*select:/],
    I: ['modules/cargo/cargo.service.ts', /intakeDocuments:[\s\S]{0,80}\{\s*create:/],
  },
  InvoiceBill: { S: ['modules/invoice/invoice.service.ts', /billLinks:\s*\{\s*select:/] },
  VoucherAmountAdjustment: { S: ['modules/voucher/voucher.service.ts', /adjustments:\s*\{\s*orderBy:/] },
  JournalLine: { I: ['modules/accounting/accounting.service.ts', /lines:\s*\{\s*create:/] },
  NotificationDelivery: { I: ['modules/notifications/notification-worker.service.ts', /deliveries:\s*\{\s*create:/] },
});

function modelsInSchema(root) {
  const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const models = new Map();
  for (const [, name, body] of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const mapped = body.match(/@@map\("([^"]+)"\)/);
    models.set(name, mapped ? mapped[1] : name);
  }
  return models;
}

function reviewedPlan(root) {
  const models = modelsInSchema(root);
  const planned = new Map();
  for (const [letters, names] of Object.entries(GROUPS)) {
    for (const model of names.trim().split(/\s+/)) {
      if (planned.has(model) || !models.has(model)) throw new Error('Unreviewed or duplicate Phase 11 model: ' + model);
      planned.set(model, new Set(letters));
    }
  }
  if (models.size !== planned.size || new Set(models.values()).size !== models.size || !planned.has('AuditLog')) {
    throw new Error('Prisma models/tables changed; review Phase 11 privilege inventory before running');
  }
  const srcRoot = path.join(root, 'apps/api/src');
  const sources = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.ts')) sources.push(fs.readFileSync(file, 'utf8'));
    }
  }
  walk(srcRoot);
  const joined = sources.join('\n');
  if (/\$(?:executeRaw(?:Unsafe)?|queryRawUnsafe)\b|\b(?:prisma|tx)\s*\[/.test(joined)) {
    throw new Error('Dynamic/raw API database access appeared; review the Phase 11 privilege plan manually');
  }
  const seed = fs.readFileSync(path.join(root, 'prisma/seed/phase11-permissions.ts'), 'utf8');
  // A one-time *owner* seed is used; do NOT leave INSERT on Permission for the
  // ordinary API role merely to accommodate a deployment-time seed.
  if (!/tx\.permission\.create\(/.test(seed) || planned.get('Permission').has('I')) {
    throw new Error('The incremental seed/Permission boundary has changed');
  }
  const byTable = {};
  for (const [model, table] of models) {
    const found = new Set();
    const delegate = model[0].toLowerCase() + model.slice(1);
    for (const [, method] of joined.matchAll(new RegExp('\\.' + delegate + '\\.(\\w+)\\s*\\(', 'g'))) {
      if (!METHODS[method]) throw new Error(`Unreviewed Prisma call ${model}.${method}`);
      for (const op of METHODS[method]) found.add(op);
    }
    for (const [op, [file, pattern]] of Object.entries(NESTED[model] || {})) {
      if (!pattern.test(fs.readFileSync(path.join(srcRoot, file), 'utf8'))) {
        throw new Error(`Nested ${model} ${op} evidence changed; review the plan`);
      }
      found.add(op);
    }
    for (const op of found) if (!planned.get(model).has(op)) {
      throw new Error(`New ${model} ${OPS[op]} API use requires review of Phase 11 privileges`);
    }
    // A table with no API or nested usage is not an acceptable grant just
    // because its model happens to exist in Prisma.
    if (!found.size) throw new Error(`No API evidence for table ${table}`);
    // SELECT on a write-only delegate is needed by Prisma's RETURNING; all
    // other SELECT permissions must have a direct/nested read site.
    if (!found.has('S') && !found.has('I') && !found.has('U') && !found.has('D')) {
      throw new Error(`Unjustified SELECT on ${table}`);
    }
    byTable[table] = Object.fromEntries(Object.entries(OPS).map(([letter, op]) =>
      [op, planned.get(model).has(letter)]));
  }
  if (Object.keys(byTable).length !== 93 ||
    JSON.stringify(byTable.AuditLog) !== JSON.stringify({ SELECT: true, INSERT: true, UPDATE: false, DELETE: false })) {
    throw new Error('AuditLog or reviewed table count changed; stop for review');
  }
  return Object.freeze(Object.fromEntries(Object.entries(byTable).sort(([a], [b]) => a.localeCompare(b))));
}

module.exports = { OPS, reviewedPlan, modelsInSchema };
