# Business Processes — End-to-End

> **Purpose:** The operational and commercial processes as the employer describes them, in sequence.
> Each step names the requirement IDs that apply and the source statements it is built from.
>
> This is the employer's *as-described* process. Where the current system diverges, see
> [`../05-current-project/legacy-vs-current-comparison.md`](../05-current-project/legacy-vs-current-comparison.md).

---

## Process A — Standard marine movement (Duna's core business)

The flow the employer narrates from `EMP-001` to `EMP-053`.

```
A1  Customer exists                       (REQ-011 – REQ-014, REQ-018)
A2  Cargo arrives at a port / yard        (REQ-060 – REQ-064, REQ-069)
A3  Yard inventory updated                (REQ-035, REQ-036)
A4  Customs documents prepared            (REQ-063)
A5  Inspection booked & performed         (REQ-080, REQ-081)
A6  Destination filter → vessel decision  (REQ-094)
A7  Load List built & printed             (REQ-090, REQ-091, REQ-082 gate)
A8  Load List amended next day if needed  (REQ-092)
A9  Operators load; results recorded      (REQ-070 loading date)
A10 Unloaded cargo returns to yard        (REQ-093)
A11 Bill of Lading drafted                (REQ-100, REQ-101, REQ-104)
A12 B/L sent to customer for review       (REQ-105)
A13 B/L finalised                         (REQ-104)
A14 Manifest consolidated                 (REQ-110 – REQ-112)
A15 Manifest printed+stamped for captain  (REQ-113, REQ-122)
A16 Manifest PDF to destination agent     (REQ-113)
A17 Invoices generated                    (REQ-140, REQ-141)
A18 Invoice posted as Debit               (REQ-150)
A19 Vessel sails, reaches destination     —
A20 Discharge at destination              —
A21 Customer pays (full / partial / none) (REQ-149, REQ-163 – REQ-165)
A22 Release Order issued                  (REQ-180 – REQ-182)
A23 Agent sees release, hands documents   (REQ-187)
A24 Unpaid release → alert                (REQ-184)
```

### Notes on Process A

- **A6 is a management decision, not a system action.** The employer describes himself looking at
  counts per destination and choosing where to send the vessel (`EMP-094`–`EMP-097`). The system's
  job is to make those counts available.
- **A9 → A10 is the only "undo" in the flow.** Cargo planned for a vessel but not loaded must return
  to inventory, not disappear (`EMP-534`–`EMP-537`).
- **A11 precedes A14.** B/Ls first, then the manifest consolidates them (`EMP-024`–`EMP-027`,
  `EMP-567`, `EMP-568`). This ordering matters: it is the opposite of the legacy Laravel system
  (see `../03-legacy-laravel-system/workflows.md`).
- **A17 is triggered by issued B/Ls**, not by the manifest (`EMP-608`, `EMP-623`, `REQ-140`).

---

## Process B — ETOZ / ETDZ (end-to-end handling)

From `EMP-054`–`EMP-067`, `EMP-403`–`EMP-408`, `EMP-411`–`EMP-414`, `EMP-603`–`EMP-605`.

```
B1  Customer instructs Duna (often by phone only)      (REQ-018)
B2  Job opened; Job Number assigned                    (REQ-130, REQ-135)
B3  Goods collected at origin (e.g. Australia / China) (REQ-020)
B4  Shipped to a UAE port (e.g. Jebel Ali)             —
B5  Customs clearance paid & performed                 (REQ-132)
B6  Low-bed / inland transport to loading port         (REQ-132)
B7  Repair or mechanical work if needed                (REQ-132)
B8  Every cost noted against the Job Number            (REQ-133)
    ↳ ad-hoc facts also written into the Cargo Comment (REQ-065 – REQ-067)
B9  Storage accrues while waiting                      (REQ-070)
B10 Continue with Process A from A5 onward             —
B11 Invoice drafted and matched against Job Numbers    (REQ-134, REQ-141)
B12 Invoice issued to the Customer (not the document
    parties)                                           (REQ-018, EMP-415 – EMP-421)
```

### Notes on Process B

- **B2 and B8 are the whole point of the Job Number.** Expenses are irregular and spread over weeks
  or months; the accountant must be able to reconstruct the spend stage by stage
  (`EMP-064`, `EMP-065`, `EMP-176`–`EMP-178`).
- **B12:** the invoice is issued to the *internal customer* even though the B/L names different
  parties (`EMP-415`–`EMP-421`). This is the clearest practical consequence of `REQ-018`.

---

## Process C — Inbound cargo and Delivery Order

From `EMP-162`, `EMP-163`, `EMP-665`–`EMP-672`.

```
C1  Inbound cargo arrives and is discharged at a Duna port
C2  Delivery Order created (number, date, customer, port)
C3  D/O printed and stamped
C4  D/O handed to the customer together with the other documents
C5  Consignee clears the cargo and collects it
```

Only five steps are given. The eligibility rule for C2 is **not stated** — see
`open-questions.md` DO-01.

---

## Process D — Cash: receipts and payments

From `EMP-130`–`EMP-134`, `EMP-654`–`EMP-664`, `EMP-703`–`EMP-720`.

```
D1  Invoice issued                    → Debit on customer ledger   (REQ-150)
D2  Customer pays                     → Receipt Voucher            (REQ-163)
D3  Allocate to a specific invoice / B/L (optional)                (REQ-164)
D3' No allocation                     → posts as Credit anyway     (REQ-165)
D4  Balance = Debit − Credit                                        (REQ-161)
D5  Customer asks for a statement      → Ledger Statement by range  (REQ-162)
D6  Duna pays someone                  → Payment Voucher            (REQ-163)
D6a ID card captured front & back      + recipient signature        (REQ-168)
D6b Money paid out                     → Debit on that party        (REQ-166)
D7  Non-customer spend (office, daily) → recorded in the same ledger (REQ-167)
D8  Loans / non-invoice movements      → General Journal entry      (REQ-166)
```

### Notes on Process D

- **D3′ is a requirement, not a gap.** Unallocated payment must post as Credit without error
  (`EMP-660`). Do not add validation here.
- **D6a is unusual and easy to miss.** ID-card capture is required for Payment Vouchers *and* for
  Salary Slips (`EMP-703`–`EMP-712`) — the employer brings it up twice, in two separate clips.
- **D7 exists for tax reasons**, not for customer accounting: office expenses must be recorded so
  they can be deducted at year end (`EMP-720`).

---

## Process E — Payroll

From `EMP-651`–`EMP-653`, `EMP-708`–`EMP-712`.

```
E1  Employees defined
E2  One or two days before month end: Salary Slip prepared
E3  Employee ID card captured front and back (upload or camera)
E4  Slip printed, ID card images included
E5  Employee signs the printed slip
```

Whether E5 posts anything to a ledger is **not stated** (`open-questions.md` SAL-01).

---

## Process F — Periodic reporting and control

From `EMP-126`–`EMP-129`, `EMP-617`–`EMP-622`, `EMP-693`–`EMP-702`.

```
F1  Per manifest (per vessel trip to a destination):
      costs   = charter + Port Use + Handling + Lashing + misc
      income  = Σ invoices issued against that manifest's B/Ls
      result  = income − costs                              (REQ-190 – REQ-192)
F2  Quarterly: VAT report (VAT collected vs VAT paid)       (REQ-194)
F3  Annually: filters over F1 → annual P&L for tax          (REQ-193)
F4  Continuously: overdue-invoice alarm                     (REQ-154)
F5  Continuously: unpaid-release alert                      (REQ-184)
```

---

## Process G — Document production (applies to every printable document)

From `EMP-037`–`EMP-040`, `EMP-169`–`EMP-172`, `EMP-575`–`EMP-586`, `EMP-721`–`EMP-725`.

```
G1  Choose output: PDF | Excel | Print
G2  PDF   → stamps, marks and signature ARE applied
G3  Excel → raw data, for manual correction before issue
G4  Print → stamps, marks and signature are REMOVED, so a live
            physical stamp can be applied to the paper
G5  Layout follows a company-supplied template per document type
```

**G4 is the step most likely to be "fixed" by mistake.** It is a deliberate requirement
(`EMP-172`, `EMP-582`, `REQ-122`).

---

## Hand-off points between roles

| From | To | Artefact | Requirement |
|---|---|---|---|
| Operations | Operations | Cargo record + Comment | REQ-061, REQ-065 |
| Operations | Accounting | Cargo Comment (read at invoicing) | REQ-067 |
| Operations | Operations | Job Number cost notes | REQ-130, REQ-133 |
| Operations | Yard crew | Printed Load List | REQ-090 |
| Operations | Captain | Printed + stamped Manifest | REQ-113 |
| Operations | Customer | Draft B/L for review | REQ-104, REQ-105 |
| Operations | Destination Agent | Manifest PDF | REQ-113 |
| Accounting | Customer | Invoice (Tax Invoice) | REQ-146 |
| Accounting | Customer | Receipt Voucher | REQ-163 |
| Accounting | Recipient | Payment Voucher + ID record | REQ-168 |
| Accounting | Agent | Release Order notification | REQ-180 |
| Operations | Customer | Delivery Order | REQ-185 |
