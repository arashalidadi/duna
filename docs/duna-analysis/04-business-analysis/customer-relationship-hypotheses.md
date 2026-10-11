# Customer-Relationship Hypotheses

> Phase 9. Every hypothesis anyone has advanced — or could advance — about **how Customer relates to
> the other parties**, tested against the evidence.
>
> This matters because it is the single structural decision that the legacy system got wrong
> (customers **were** users) and the current system got right (Customer is its own entity).

---

## 0. The employer's own statement (authoritative)

`REQ-018`, `REQ-020`:

> A Customer is an **internal commercial counterparty**: the party Duna invoices and whose ledger Duna
> maintains. It is **not necessarily** the Shipper or the Consignee on any document.

And the worked example (`EMP-394`–`EMP-408`):

> A customer in Australia buys a machine; Duna moves it Australia → Jebel Ali (clearance) → Hamriyah →
> Khorramshahr. **The Australian seller is the Shipper. The destination party is the Consignee. Only
> the Australian buyer is Duna's Customer.**

---

## 1. Hypothesis register

| # | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| **H1** | Customer **is** the Shipper | ❌ **Rejected** | `REQ-018`, `REQ-020`; B/L `KHS/26-110` shows `RAS AL KHAIMAH MACHINERIES LLC` as Shipper and a different party as Customer |
| **H2** | Customer **is** the Consignee | ❌ **Rejected** | `REQ-020` — the consignee is chosen by the customer/destination party, not by Duna (`REQ-054`) |
| **H3** | Customer is always one of Shipper / Consignee / Notify | ❌ **Rejected** | `REQ-018` — "not necessarily". In the Australian example the Customer is the buyer, who is neither Shipper nor Consignee |
| **H4** | Customer is a **User** account in the system | ❌ **Rejected for the new system** | This is what the **legacy** system did (`level='User'`). The employer never said it. The current system correctly separates `Customer` from `User` |
| **H5** | Every Shipper / Consignee is also a Customer | ❌ **Rejected** | `REQ-018`; real documents show shipper/consignee names that never appear as customers |
| **H6** | A Customer can be a natural person **or** a legal entity | ✅ **Accepted** | `REQ-019`. Real evidence: Tax Invoice `DSINV/26-172` is billed to `MR. SHAHOKH SHAHVARAEI` — a person |
| **H7** | A Customer has one ledger, spanning all their jobs | ✅ **Accepted** | `REQ-160`, `REQ-161`; the real SOA is a per-account ledger with a running balance |
| **H8** | Several Customers could be the same real-world party under different names | ⚠️ **Unresolved** | No evidence either way. Risk: the employer's customer list may contain duplicates (the SOA and invoices show person names, not company names) |
| **H9** | An Agent can also be a Customer | ⚠️ **Unresolved** | Agents are destination representatives (`REQ-055`, `REQ-056`). Nothing says they cannot also be customers |
| **H10** | The Customer is who the **invoice** is addressed to | ✅ **Accepted** | `REQ-146` + every real invoice/quotation/proforma is addressed to a named individual |
| **H11** | The Customer is who the **voucher** is raised against | ✅ **Accepted** | `REQ-164`; the real SOA is an account for `DUNA SHIPPING` at `RUKN ALHMREYA TRANSPORT` |
| **H12** | Agents should see **all** customers' data for their destination | ❌ **Rejected** | `REQ-187` — agents see **their own destination's** data. The scoping axis is the **destination**, not the customer |
| **H13** | A Customer record needs Type / Currency / TRN / Short Name | ❌ **Rejected — explicitly** | `REQ-017` — the employer explicitly **removed** these fields |
| **H14** | Customer credit limits exist | ⚠️ **Unresolved** | `REQ-017` removed Type/Currency/TRN/Short Name but said nothing about credit. Multi-currency was raised elsewhere (Q85). See `open-questions.md` CUST-02 |
| **H15** | One Customer → many Jobs → many Cargos | ✅ **Accepted** | `REQ-130`, `REQ-135`; the Job carries a Customer |
| **H16** | One Cargo belongs to exactly one Customer | ✅ **Accepted** | `REQ-060` — cargo registration **begins** with Customer selection |
| **H17** | A single Manifest can carry several different Customers | ✅ **Accepted** | `REQ-115`. Proved by the real manifest, whose 45 rows carry different shippers and consignees |
| **H18** | A single Invoice can cover several B/Ls (possibly of different customers?) | 🟡 **Partly accepted** | `REQ-141` — an invoice can cover several B/Ls. Whether those B/Ls may belong to **different customers** is **not stated** — an invoice has one customer, so presumably not |

---

## 2. The accepted model

```
                    ┌──────────────────────────────────────────┐
                    │  Customer  (commercial counterparty)     │
                    │  • name is the ONLY mandatory field      │
                    │  • system-generated code                 │
                    │  • optional contact / email / address    │
                    │  • NOT Shipper, NOT Consignee, NOT User  │
                    └───┬───────────┬──────────┬───────────┬───┘
                        │           │          │           │
                 1..n   │    1..n   │   1..n   │    1..n   │
              ┌─────────▼┐  ┌───────▼──┐ ┌─────▼────┐ ┌───▼──────┐
              │   Job    │  │  Cargo   │ │ Invoice  │ │  Ledger  │
              │ (cost    │  │ (operat- │ │ (money   │ │ (Dr − Cr │
              │  note)   │  │  ional)  │ │  in)     │ │  = bal)  │
              └──────────┘  └─────┬────┘ └──────────┘ └──────────┘
                                  │
                          ┌───────▼────────┐
                          │  B/L / Manifest│
                          │  ── Shipper    │  ← independent parties
                          │  ── Consignee  │
                          │  ── Notify     │
                          │  ── Agent      │
                          └────────────────┘
```

**The one sentence to remember:** *Customer is who pays; Shipper, Consignee, Notify and Agent are who
appear on the transport documents. They are different axes and must never be merged.*

---

## 3. Consequences if the hypotheses are got wrong

| Mistake | Consequence |
|---|---|
| Merging Customer with Shipper | Invoices go to the wrong party; the ledger balances against the wrong entity |
| Merging Customer with User | Every customer needs a login; agents and customers are conflated; scoping breaks |
| Deriving parties from the Manifest (the legacy mistake) | Co-loading (`REQ-107`) becomes impossible; a manifest cannot carry two shippers |
| Scoping the agent portal by Customer instead of Destination | Agents see the wrong data — the exact problem `REQ-188` exists to solve |
| Adding Type / Currency / TRN to Customer | Direct violation of `REQ-017`; the employer will notice immediately |

---

## 4. Open questions that remain

| ID | Question | Why it matters |
|---|---|---|
| **H-Q1** | Can two Customer records refer to the same real-world party? | The real documents use **person names** (`MR. SHAHOKH SHAHVARAEI`, `MR. RAMIN AHMADABADI`, `MR. SHADMAN MEABADI`). Person-based customer records invite duplicates |
| **H-Q2** | If a Customer is a natural person, what is the "name"? | `REQ-011` says name-only-mandatory; `REQ-019` says a person or an entity. Real invoices use `MR. <Firstname> <Lastname>` |
| **H-Q3** | Is there any notion of customer **credit** or payment terms? | `REQ-182` mentions releasing cargo "on credit" — which implies a credit concept exists somewhere |
| **H-Q4** | Can an Agent be a Customer? | Affects whether the agent portal and the customer portal share an identity model |
| **H-Q5** | Can one invoice span B/Ls belonging to **different** customers? | `REQ-141` says an invoice can cover several B/Ls; it does not say the customers must match |

All five are recorded in
[`../01-employer-statements/open-questions.md`](../01-employer-statements/open-questions.md).

---

## 5. How the two systems compare on this

| | Legacy | Current |
|---|---|---|
| Customer is a User | ✅ (it *was*) | ❌ (correctly separated) |
| Shipper/Consignee masters | ✅ | ✅ and **active** |
| Parties per B/L | ❌ (inherited from manifest) | ✅ |
| Several customers per manifest | ✅ | ✅ |
| Agent scoping | ❌ none | 🟡 foundation; destination scoping is Phase 8 |
| Customer 360 (cargo, jobs, invoices, ledger) | ❌ | ⏳ Phase 8 |

The legacy system's single worst modelling decision — **customers are users** — has been undone.
Everything else in this file is either already correct in the current system or is a Phase 8 item.
