# Employer Original Statements — Complete English Source Record

> **Status:** Primary evidence document. Read this first if you need to know what the employer
> actually said, in the order they said it.
>
> **Purpose:** This is a *faithful, complete English rendering* of every employer statement
> available in this repository. It is deliberately **not** a specification and **not** a summary.
> Repetitions, self-corrections, vague phrasing, and apparent contradictions are preserved on
> purpose, so that a future reader can interpret the employer's meaning independently instead of
> inheriting a previous model's interpretation.
>
> **Companion documents:**
> - [`employer-requirements-analysis.md`](employer-requirements-analysis.md) — domain-grouped analysis (interpretation layer).
> - [`requirements-catalog.md`](requirements-catalog.md) — stable `REQ-*` catalogue.
> - [`open-questions.md`](open-questions.md) — ambiguities and unanswered questions.
> - [`../07-traceability/source-inventory.md`](../07-traceability/source-inventory.md) — inventory of the raw files.

---

## 0. How to read this document

### 0.1 Source files and how they are referenced

Every statement below carries a stable ID of the form `EMP-nnn`. IDs are assigned sequentially
across the whole document, so `EMP-001` is the earliest retained statement and the highest number
is the last. Each source file also gets a **segment reference** of the form `[SRC-file-key ¶n]`
where `¶n` is the paragraph index inside the original Persian file (paragraphs are separated by
blank lines in the originals).

| Source key | Original file (under `docs/duna-analysis/requirements/`) | Ordering evidence | Size |
|---|---|---|---|
| `SRC-A1` | `part1_0-15.txt` | Filename: minutes 0–15 of a long recording | 17,180 bytes |
| `SRC-A2` | `part2_15-end.txt` | Filename: minutes 15–end; text continues mid-sentence from `SRC-A1` | 16,199 bytes |
| `SRC-B01` … `SRC-B18` | `audio_2026-09-14_HH-MM-SS.txt` (18 files) | Filename timestamp, 2026-09-14 04:57:33 → 05:07:52 | 877–19,707 bytes |

**Group A** (`SRC-A1` + `SRC-A2`) is one continuous recording, split into two files at the
15-minute mark. This is *provable from the text*: `SRC-A1` ends mid-sentence
("…which customer this machine belongs to, what it is, what its Chassis Number is, blah…") and
`SRC-A2` begins mid-sentence ("What is it? The gear, the city of the goods, how much it weighs…").

**Group B** (the 18 `audio_*` files) is a separate batch of short voice clips recorded on
2026-09-14 between 04:57:33 and 05:07:52. Their internal order is certain (timestamps in the
filenames).

### 0.2 Ordering between Group A and Group B — documented uncertainty

> **The relative chronological order of Group A and Group B cannot be established reliably from
> the available metadata.** No file carries a creation timestamp other than the `audio_*` filenames,
> and no statement in either group explicitly references the other.

The arrangement chosen here puts **Group A first**, for these reasons, all of which are stated as
*inference*, not fact:

1. `docs/duna-analysis/existing-analysis/duna_source_pack.md` (§1.1) lists the two `part*` files as
   "Voice Group A — Main operational/accounting explanation" and lists the Overview/sidebar and
   Shipper/Consignee/Agent/Yard material *after* them. That is a previous model's judgement, not
   primary evidence, but it is the only prior attempt at ordering.
2. Group A is a pure business narrative. It never refers to "this app", a sidebar, or any screen.
   Group B repeatedly refers to the application's left-hand sidebar
   ("the left side of this app that says **Overview**"). It is therefore likely that Group B was
   recorded while a dashboard existed and Group A was recorded as a general business briefing.
3. `SRC-A2` closes with "we'll go into the details later", which reads as the end of a
   first, high-level pass.

**Alternative hypothesis (not excluded):** Group B could have been recorded first (a UI sketch
walk-through) and Group A afterwards. If the distinction ever matters for a business decision,
confirm it with the employer. Nothing in this knowledge base depends on which group came first,
because no statement in either group contradicts a statement in the other on a matter of business
rule.

### 0.3 Translation conventions

- **Bold** marks an English term the employer spoke in English inside Persian speech
  (e.g. **Overview**, **Master Data**, **Job Number**, **VAT**).
- `[inaudible]` marks a passage the transcript itself flags as unintelligible
  (`[نامفهوم]` / `[بخش نامشخص است]`).
- A **TN (translator's note)** block marks an editorial clarification added by the translator.
  Translator's notes are **never** employer statements.
- Persian-only business words are given with the original on first use, e.g. Nagle (نقل).
- The employer sometimes states a code format and then restates it differently within the same
  breath (e.g. `CUST 3-3-1`, then `CUST 3SF-2`, then `CUST 3.1`). All variants are preserved
  verbatim; the conflict is recorded in
  [`../04-business-analysis/contradictions-register.md`](../04-business-analysis/contradictions-register.md).

### 0.4 Completeness statement

All 20 transcript files present in `docs/duna-analysis/requirements/` have been read end-to-end and
are rendered below. No transcript has been replaced by a summary.

### 0.5 Repeated content is intentional

The employer restates the same requirement several times across the clips. Examples: the internal
nature of Customer recurs in `SRC-B01` and `SRC-B10`; the "print without stamp / PDF with stamp"
rule recurs in `SRC-A1`, `SRC-A2` and `SRC-B11`. These repeats are retained because each
restatement adds or shifts detail, and because a faithful record must show the employer's own
emphasis.

---

## GROUP A — Long business explanation (2 files)

### Source `SRC-A1` — `part1_0-15.txt` (recording minutes 0:00–15:00)

---

**EMP-001** — `[SRC-A1 ¶1]`
"Look, the part I want to explain to you: we are a shipping company and our head office is in
Dubai, United Arab Emirates."

**EMP-002** — `[SRC-A1 ¶2]`
"Hamriyah Port, Dubai port, Hamriyah port, Dubai port."

**EMP-003** — `[SRC-A1 ¶3]`
"Okay, the way it works is, for example, the vessels are either our own — meaning they are under
our own ownership — or we rent the vessel. Now, either we charter it per trip, or Time Charter, we
rent it for a period of time. Okay, that's that."

**EMP-004** — `[SRC-A1 ¶4]`
"Now in between, we have a set of activities, which is the transport of machinery, civil,
construction, Shipping in general, anything, moving for instance from one point to another point
by sea."

**EMP-005** — `[SRC-A1 ¶5]`
"Now, when we want to — suppose — take delivery of a machine today at the port, first of all we
must know which customer it is connected to. So look, the customer is the main pillar for us —
which of our customers this machine belongs to."

**EMP-006** — `[SRC-A1 ¶6]`
"Then this customer must also be given a dedicated code. For example, the thing we currently write
by hand — suppose one of our customers is Arash Alidadi. Okay, Arash Alidadi — now we wrote his
name, we wrote his email, we wrote his mobile number too. Now we wrote his information and Details."

**EMP-007** — `[SRC-A1 ¶7]`
"Now either it is a Company, meaning a company, or it is a natural person — meaning for example
either an individual or a company — our customer. A company too, in the same way, we register a set
of Details for them; the name is obvious of course."

**EMP-008** — `[SRC-A1 ¶8]`
"Then it gives it a random code, it gives some code. For example, the way we used to write it by
hand, we would assign a dedicated number to a customer — Customer, for example CUSD, for example
33431. The next one, the same Customer, for example 332334 — in order, like that, for every new
customer that gets registered."

> **TN:** The employer is describing the *manual, historical* coding habit, and the two examples
> (`CUSD 33431`, `332334`) are inconsistent with each other. This is a description of past practice,
> not necessarily a requested format. See also `EMP-205`–`EMP-235`, where different Customer code
> formats are requested for the new system.

**EMP-009** — `[SRC-A1 ¶9]`
"Okay, now this customer is registered — that, for example, such-and-such machine was delivered
to us."

**EMP-010** — `[SRC-A1 ¶10]`
"Now we must have a Load List — meaning warehouse inventory. We must have a warehouse inventory,
so we can see, for example, what these Details are; whose machine it is, what it was, what date it
entered, which port it entered — Port Rashid, Port Hamriyah, Port Jebel Ali — and where its
destination is."

**EMP-011** — `[SRC-A1 ¶11]`
"Okay, where its destination is, what their date is, with what kind of documents — what documents
it has, for example it has Export Paper, I don't know, it has an R.D.A., it has Import Paper, it
has an Export Certificate — with what Mode whatever was imported."

> **TN:** "آر‌دی‌ای" (R.D.A.) is spoken letter-by-letter and its meaning is not established by
> the transcript. It may be a mis-hearing of another document acronym. Recorded as unresolved
> (see `open-questions.md`, DOC-01).

**EMP-012** — `[SRC-A1 ¶12]`
"Then, suppose, when our vessel arrives — or when we want to make a decision about which loading
we assign this vessel to — for example we say, let's put it for Port Hamriyah, for the machines
bound for Khorramshahr, for instance."

**EMP-013** — `[SRC-A1 ¶13]`
"Okay, we have an empty vessel, we want to do this job; the machines that are for Khorramshahr
are in Hamriyah, we want to load them."

**EMP-014** — `[SRC-A1 ¶14]`
"After the inspection is confirmed, we then prepare a Load List. We prepare a Load List — for
example now 20 machines, 30 machines, 40 machines, whatever it is — we prepare it and we Print
these, we hand them to the Operator guys."

**EMP-015** — `[SRC-A1 ¶15]`
"The Operator guys — that, for example, this vessel must load this number of machines into this
vessel. Okay, they start loading."

**EMP-016** — `[SRC-A1 ¶16]`
"All of a sudden you see that during loading, for example, one machine doesn't get loaded. Now
either it doesn't fit, or it breaks down, you don't load it, for whatever reason. One machine out
of this list we handed them remains."

**EMP-017** — `[SRC-A1 ¶17]`
"Okay, this machine automatically goes back again into the warehouse inventory and stays for,
for example, the next trip. Meaning at first — yes, right — it goes back, it is removed from the
list, it goes back into the main system, into an inventory list, so we put it aside for the next
Shift, for the next vessel that we want to load."

**EMP-018** — `[SRC-A1 ¶18]`
"Okay, now the machine we loaded — its loading date is also specified now. Look, its arrival date
is specified, which Yard it was discharged into, what date it was discharged, and what documents
it has."

**EMP-019** — `[SRC-A1 ¶19]`
"Okay, the loading date is also specified here. Now, for example, you take delivery of a machine
today, its loading date is one month later. Once we do the loading, we also enter the loading
dates — so what happens here? Here the number of days it has been in the port also becomes
specified."

**EMP-020** — `[SRC-A1 ¶20]`
"For example, for the warehousing we want to pay to DP, here it becomes the loading date minus the
arrival date — for example the number of days it has been in the port."

> **TN:** "DP" is spoken as letters. In context (a port authority charge) it most likely refers to
> the port operator (Dubai Ports / DP World). Not confirmed by the transcript.

**EMP-021** — `[SRC-A1 ¶21]`
"Here we understand, for example, how many days this machine, this Shipment, this goods has stayed
in the port, so we can go and calculate its warehousing, to know how much it is. Okay, that's
that."

**EMP-022** — `[SRC-A1 ¶22]`
"Now the vessel has been loaded, the vessel has been loaded — we must specify how many of these
machines that we gave to the Operators in the Load List have been loaded. For example, we gave
them 20, 19 were loaded. That one goes back again into the warehouse inventory."

**EMP-023** — `[SRC-A1 ¶23]`
"Okay, Yard inventory."

**EMP-024** — `[SRC-A1 ¶24]`
"Okay, out of those 19 that were loaded, now we must prepare the vessel's Manifest."

**EMP-025** — `[SRC-A1 ¶25]`
"The vessel's Manifest too, as is known — for example the vessel name, Manifest number, port of
loading, destination port, and a set of other Details."

**EMP-026** — `[SRC-A1 ¶26]`
"Okay, then in the Manifest it numbers the rows — one, two, three, four, five, six."

**EMP-027** — `[SRC-A1 ¶27]`
"Okay, then in order it assigns a Bill of Lading number to each of them."

**EMP-028** — `[SRC-A1 ¶28]`
"Then Shipper, Shipper and Chassis, whatever information is needed in the Manifest, you enter it."

**EMP-029** — `[SRC-A1 ¶29]`
"Then it is issued in the name of Consignee, Shipper, quantity, weight — which must also give a
Total."

**EMP-030** — `[SRC-A1 ¶30]`
"For example Total — for example thirty machines were loaded, plus, say, twenty Nagle. Nagle means
it is not a machine, meaning [inaudible] in the port."

> **TN:** "Nagle" (نقل) is the employer's own term for loose/accompanying pieces that are not
> complete machines — pallets, boxes, bundles, spare parts. See the glossary.

**EMP-031** — `[SRC-A1 ¶31]`
"For example thirty machines, plus, say, ninety Nagle loaded."

**EMP-032** — `[SRC-A1 ¶32]`
"With the total weight — which you then enter."

**EMP-033** — `[SRC-A1 ¶33]`
"This becomes the Manifest. Meaning, for example, a form so that the captain and Crew know that
this many machines have been loaded and the list is in their hands."

**EMP-034** — `[SRC-A1 ¶34]`
"Okay, now each of these goods that has been loaded gets a dedicated Bill of Lading. It's called a
Bill of Lading."

**EMP-035** — `[SRC-A1 ¶35]`
"This Bill of Lading is for one of those goods that is now specified; for example its Shipper is
specified, its Consignee is specified, its Notify Party — and it's a standard Bill of Lading whose
formats we have, I'll send them to you."

**EMP-036** — `[SRC-A1 ¶36]`
"Okay, for every goods item that we load onto the vessel, there is a Bill of Lading — in a sense
unique to itself — and we must send this Bill of Lading to the customer, that, look, this is your
Bill of Lading and, for example, the machine is now moving from Hamriyah towards Khorramshahr."

**EMP-037** — `[SRC-A1 ¶37]`
"Okay, now that we've Printed the Manifest, these outputs must be given to us — for example give
us an output that becomes PDF, we take a Print, or for example give Excel, give Excel so that we
can then manually make a set of corrections or something specific in it, stamp it, hand it to
[inaudible], hand it to the captain."

**EMP-038** — `[SRC-A1 ¶38]`
"These Bills of Lading also get Printed — for example it Prints out, it gives PDF out so we take a
Print."

**EMP-039** — `[SRC-A1 ¶39]`
"Now we physically stamp it there. We physically put the stamp on the ones that need to be
Printed."

**EMP-040** — `[SRC-A1 ¶40]`
"The ones we take as PDF — well, the stamp is already applied on it; meaning this stamp of theirs
must be saved in it automatically, so that when you take a PDF, the Stamp itself is the default."

**EMP-041** — `[SRC-A1 ¶41]`
"Okay, this is up to here in the process."

**EMP-042** — `[SRC-A1 ¶42]`
"So it came to pass that we had our warehouse inventory, and then, which vessel we want to assign
to where, to which destination to assign it, also became clear."

**EMP-043** — `[SRC-A1 ¶43]`
"Then we apply a set of filters on our inventory. For example we enter Khorramshahr, Port
Hamriyah."

**EMP-044** — `[SRC-A1 ¶44]`
"Okay, when we enter Port Hamriyah, we enter Khorramshahr, for example, out of the total 120
machines we currently have in inventory, for example 20 of them are for Khorramshahr."

**EMP-045** — `[SRC-A1 ¶45]`
"These 20 must be filtered and come up — filtered and come up."

**EMP-046** — `[SRC-A1 ¶46]`
"Now which of them do we want to load? For example, 19 of them are eligible for loading. We select
those 19."

**EMP-047** — `[SRC-A1 ¶47]`
"Okay, this must be Printed as a Load List — that, for example, these 19 machines with this vessel
are handed to the Operator; we take a Print, PDF, hand it to the Operators inside the yard, and
they start loading."

**EMP-048** — `[SRC-A1 ¶48]`
"Now, however many of this list we gave them they managed to load — its loading dates they also
write for us by hand and give to the office staff. The office staff enter them."

**EMP-049** — `[SRC-A1 ¶49]`
"Whatever they could not load, for whatever reason — breakdown, or no space, or whatever — that
remaining number must also go back in the system into the Yard inventory, so we know, for example,
we still have this many machines for Khorramshahr, so it's there for later decision-making."

**EMP-050** — `[SRC-A1 ¶50]`
"Okay, that's the end of the operations stage, and the Manifest likewise."

**EMP-051** — `[SRC-A1 ¶51]`
"Now, however many machines were loaded onto the vessel — then these, as PDF output, PDF or Excel
it gives out — then we send each Bill of Lading to the customers."

**EMP-052** — `[SRC-A1 ¶52]`
"Okay, now this stage is finished, we move on to the next stage — the accounting stage."

**EMP-053** — `[SRC-A1 ¶53]`
"So the Operation stage is done. The Bill of Lading and Manifest stage is done too. We move to the
accounting stage."

**EMP-054** — `[SRC-A1 ¶54]`
"Accounting stage. Now look, for example, there are a set of goods where we also do the clearance
work ourselves — like the ETOZ case."

> **TN:** "ETOZ" / "ETDZ" is spoken as an acronym the employer uses for end-to-end handling: Duna
> collects the goods abroad, clears it, moves it, and delivers it. It is spelled inconsistently in
> the transcripts (`ETOZ` in `SRC-A1`, `ETDZ` in `SRC-B13`). See glossary.

**EMP-055** — `[SRC-A1 ¶55]`
"Okay, this work that we are doing as ETOZ. For example, we picked up a machine for a customer from
China, brought it to, for example, Jebel Ali."

**EMP-056** — `[SRC-A1 ¶56]`
"We cleared it from Jebel Ali."

**EMP-057** — `[SRC-A1 ¶57]`
"Then we took a low-bed trailer. The low-bed took it from Jebel Ali and brought it to Hamriyah."

**EMP-058** — `[SRC-A1 ¶58]`
"Hamriyah, for example, discharged it."

**EMP-059** — `[SRC-A1 ¶59]`
"Now suppose, for example, mechanical work was done on it, blah blah, go on. This is an ETOZ
process."

**EMP-060** — `[SRC-A1 ¶60]`
"Technically, because during the process — for example, a set of expenses are incurred for the
machine or Cargo or whatever — this is technically called a Job Number."

**EMP-061** — `[SRC-A1 ¶61]`
"Meaning the petty expenses incurred from the beginning to the end for one Cargo or, for example,
Shipment — so that at the end, when the accountant wants to issue an Invoice, they look at this Job
Number."

**EMP-062** — `[SRC-A1 ¶62]`
"It's like having a note, that, look, I spent a thousand dirhams on it here in China."

**EMP-063** — `[SRC-A1 ¶63]`
"Then again, I paid, say, ten thousand dollars freight for it to come to Jebel Ali."

**EMP-064** — `[SRC-A1 ¶64]`
"Okay, these don't happen daily. For example, that thousand dirhams you spent in China — maybe its
loading is two weeks later."

**EMP-065** — `[SRC-A1 ¶65]`
"Then two weeks later you pay another freight for it, it comes to Jebel Ali, then again maybe it
takes a month to reach Jebel Ali."

**EMP-066** — `[SRC-A1 ¶66]`
"Now for example the state [inaudible] of this Job Number."

**EMP-067** — `[SRC-A1 ¶67]`
"For example, for one goods item a dedicated Job Number is assigned — so that afterwards, when you
want to enter it and do its accounting, you see this Job Number there — how much has been spent on
it from this ETOZ."

**EMP-068** — `[SRC-A1 ¶68]`
"Okay, now when the vessel has departed and its Manifest is closed — this Manifest, look, it's
possible that partner companies and Forwarders also load onto our vessels."

**EMP-069** — `[SRC-A1 ¶69]`
"Now, after all, we allocate a bit of space between them."

**EMP-070** — `[SRC-A1 ¶70]`
"For example, out of a total of 30 machines, 20 machines were mine — belonged to our own company —
for example 5 of them belonged to another company, 5 of them belonged to another company."

**EMP-071** — `[SRC-A1 ¶71]`
"Their Bill of Lading format is also different from ours."

**EMP-072** — `[SRC-A1 ¶72]`
"Their Bill of Lading numbering format is different from ours."

**EMP-073** — `[SRC-A1 ¶73]`
"Okay, we must be able to — we must be able to — add their Bills of Lading to the Manifest too."

**EMP-074** — `[SRC-A1 ¶74]`
"Meaning it must have this Option, because there is only one Manifest and we are the ones who must
issue it."

**EMP-075** — `[SRC-A1 ¶75]`
"Okay, once the Manifest is closed — this is an important point that Arash should always keep in
mind — from the moment we take delivery of the machine, the guys want to do Data Entry, that,
look, which customer this machine belongs to, what it is, what its Chassis Number is, blah…"

*(End of `SRC-A1`. The sentence continues in `SRC-A2`.)*

---
### Source `SRC-A2` — `part2_15-end.txt` (recording minutes 15:00–end)

---

**EMP-076** — `[SRC-A2 ¶1]` *(continuation of EMP-075)*
"What is it? The gear, the city of the goods, how much it weighs, how many Nagle accompany it,
which Yard it was discharged into, what date it was discharged, what the type of its documents is."

**EMP-077** — `[SRC-A2 ¶2]`
"And that, for example, when we want to take a print and hand it to the operations guys, its
Inspection, for example, should be specified — that, look, the Inspection has been done; meaning
it should be ticked, that these are allowed to load, that it can come into the loading list."

**EMP-078** — `[SRC-A2 ¶3]`
"Meaning this loading Load List — you must consider a set of conditions for it, that, look, one of
the most important of them is this Inspection. Its Inspection must definitely be ticked; meaning
the guys have done the Inspection, it is ticked, and it is eligible to be selected and go into the
Load List, and that Operator…"

**EMP-079** — `[SRC-A2 ¶4]`
"Now I want to know this — for every machine we take delivery of, every goods item we want to take
delivery of, also put a Comment, a place for a Comment, for these."

**EMP-080** — `[SRC-A2 ¶5]`
"Why? Because, for example, sometimes a set of expenses are incurred for one machine, one customer,
and when it is brought into the Comment, this prevents it from being forgotten."

**EMP-081** — `[SRC-A2 ¶6]`
"Then these Comments, for example, where are they useful? For when we want to issue the customer's
statement in the Accounting section."

**EMP-082** — `[SRC-A2 ¶7]`
"That accountant sees these Comments."

**EMP-083** — `[SRC-A2 ¶8]`
"For example, they see that, look, this machine that came — we paid its Transport cost, we paid its
customs cost, for example."

**EMP-084** — `[SRC-A2 ¶9]`
"If it needed repairs inside the Port, for example, we did it, we paid for it."

**EMP-085** — `[SRC-A2 ¶10]`
"This, the operations guys write in the Comment section — meaning the employee who is responsible
for these tasks writes it in that Comment."

**EMP-086** — `[SRC-A2 ¶11]`
"And then that accountant, automatically, when they want to issue their statements, can read these
Comments."

**EMP-087** — `[SRC-A2 ¶12]`
"And there is no longer any need to ask questions, and, for example, running around here and there
and making inquiries and, you know, those things."

**EMP-088** — `[SRC-A2 ¶13]`
"These Comments."

**EMP-089** — `[SRC-A2 ¶14]`
"Okay, then once we've entered this data, the Cargo is Registered."

**EMP-090** — `[SRC-A2 ¶15]`
"For example, it comes into this List of the Cargos themselves."

**EMP-091** — `[SRC-A2 ¶16]`
"Okay, now that this Cargo List is written and it's specified that, look, now we have a List, for
example our Customers — who are they? Arash Alidadi, Kianoush Jowkar."

**EMP-092** — `[SRC-A2 ¶17]`
"Well, then it's specified — look, this machine is such-and-such, its Chassis Number is
such-and-such."

**EMP-093** — `[SRC-A2 ¶18]`
"Suppose, for example, Hamriyah to Khorramshahr."

**EMP-094** — `[SRC-A2 ¶19]`
"Okay, these must have a set of Filters inside them."

**EMP-095** — `[SRC-A2 ¶20]`
"Why? Because when, for example, I as management want to decide which destination to assign this
vessel, this craft to — meaning, for example, where to load and which destination to assign it to
— this must specify for me that, look, we have 30 machines for Khorramshahr."

**EMP-096** — `[SRC-A2 ¶21]`
"For example, for destination Bushehr, suppose we have 10 machines. For destination Bandar Abbas,
for example, we have 10 machines."

**EMP-097** — `[SRC-A2 ¶22]`
"Okay, so it's natural that I immediately assign the vessel to Khorramshahr."

**EMP-098** — `[SRC-A2 ¶23]`
"Okay, now we come to invoicing — issuing the statement."

**EMP-099** — `[SRC-A2 ¶24]`
"Okay, every expense, whatever has been incurred — if it has a Job Number, that specifies what the
expense is; if not, if the guys wrote it in those Comments, then this accountant sees it."

**EMP-100** — `[SRC-A2 ¶25]`
"Okay, whenever they want to issue this Bill, again the customer must be specified."

**EMP-101** — `[SRC-A2 ¶26]`
"For example, look, such-and-such Bill of Lading that we issued from the very beginning — its
customer was specified; meaning it went into that customer's profile."

**EMP-102** — `[SRC-A2 ¶27]`
"Now they come and issue its statement."

**EMP-103** — `[SRC-A2 ¶28]`
"Your statement, for example row one, two, three, four — a set of information and Details related
to the machine and the Bill of Lading number and so on; we specify the details of, for example,
what the Bill, the statement is being issued for, and so on."

**EMP-104** — `[SRC-A2 ¶29]`
"And then, whatever expense has been incurred — for example vessel freight, crane operation,
low-bed cost, clearance cost, whatever it is — these must come."

**EMP-105** — `[SRC-A2 ¶30]`
"Okay, this Invoice must also have different sections."

**EMP-106** — `[SRC-A2 ¶31]`
"From the top, it must be a **Tax Invoice**, because this is the UAE law — that, for example,
Address and mobile number and Contact Number and Email and these things…"

**EMP-107** — `[SRC-A2 ¶32]`
"On the other side too, on the right — now I'll send you the format of these Invoices."

**EMP-108** — `[SRC-A2 ¶33]`
"On the right too is this Invoice Number and the date of this Invoice and the maximum payment
deadline and blah and so on."

**EMP-109** — `[SRC-A2 ¶34]`
"Then we also have a **TRN Number**. Now we'll see that TRN in the format, in the Details."

**EMP-110** — `[SRC-A2 ¶35]`
"Okay, then this Invoice — for example two rows, three rows, four rows must be addable, so it can
be written."

**EMP-111** — `[SRC-A2 ¶36]`
"Okay, this row — one row of its own, one, two, three, four."

**EMP-112** — `[SRC-A2 ¶37]`
"Okay, then we get to the Description stage — description, Rate or now Fee — then we get to
Quantity or QTY."

**EMP-113** — `[SRC-A2 ¶38]`
"Okay, then here we also have another row here, **Value Added Tax**, value added."

**EMP-114** — `[SRC-A2 ¶39]`
"Here the row must take a percentage."

**EMP-115** — `[SRC-A2 ¶40]`
"For example, if in this row I write five for VAT, it means five percent of this transaction
includes VAT."

**EMP-116** — `[SRC-A2 ¶41]`
"The VAT amount is also written separately."

**EMP-117** — `[SRC-A2 ¶42]`
"Another row, for example VAT… and this row — now the VAT amount is specified."

**EMP-118** — `[SRC-A2 ¶43]`
"The next row is where you write its Amount — meaning Rate multiplied by quantity, plus the VAT
percentage — it sits in that row."

**EMP-119** — `[SRC-A2 ¶44]`
"Now you'd know its shape — I'll send you the statement format so you know."

**EMP-120** — `[SRC-A2 ¶45]`
"Okay, once you've issued this invoice, this automatically, for example, goes under the title
**Sales** into that customer's section, it sits in that customer's profile."

**EMP-121** — `[SRC-A2 ¶46]`
"It sits in their account as **Debit**."

**EMP-122** — `[SRC-A2 ¶47]`
"Okay, for this Manifest — now for example 20, 30, 40, however many Bills of Lading we have — we
issue these Invoices."

**EMP-123** — `[SRC-A2 ¶48]`
"And each Invoice that is linked goes and sits in the Ledger account — or the same customer's
general account."

**EMP-124** — `[SRC-A2 ¶49]`
"That's how it is."

**EMP-125** — `[SRC-A2 ¶50]`
"Okay, this is now specified. These Invoices are finished."

**EMP-126** — `[SRC-A2 ¶51]`
"Okay, now here we must specify: this vessel that, for example, went for us on trip **1-26** from
Hamriyah to Khorramshahr must give us a report."

**EMP-127** — `[SRC-A2 ¶52]`
"So that, now for example, we enter a set of data for it, it must give us a set of reports that,
look, how much has been spent on this vessel, how much income there has been — now for example how
much profit or loss resulted from this trip this vessel made — it should specify that too."

**EMP-128** — `[SRC-A2 ¶53]`
"Okay, okay, then after these invoices have been issued and these expenses have been incurred and,
for example, Port Handling and Port Use and so on have been paid, the vessel has gone out — I'm
saying this data must be entered and it must specify how much profit and loss this vessel had."

**EMP-129** — `[SRC-A2 ¶54]`
"Okay, that's that."

**EMP-130** — `[SRC-A2 ¶55]`
"Now these Invoices that were issued go and sit in the customers' subsidiary accounts."

**EMP-131** — `[SRC-A2 ¶56]`
"That subsidiary account or the customers' general account — for example, that's their thing — for
example their **Customer Ledger**."

**EMP-132** — `[SRC-A2 ¶57]`
"Now they make a payment, we give them a receipt, it automatically goes into the system to the Sub
Customer and sits as **Credit**."

**EMP-133** — `[SRC-A2 ¶58]`
"Now this Credit, Debit — they get added and subtracted from each other, the Balance is obtained."

**EMP-134** — `[SRC-A2 ¶59]`
"That, look, how much a customer owes us, or for example how much they are owed, or their Balance
is simply zero — it should specify."

**EMP-135** — `[SRC-A2 ¶60]`
"Okay, now when we issue an Invoice, the Invoice issue date must also be specified."

**EMP-136** — `[SRC-A2 ¶61]`
"Or for example, now, why do we want to see this? How long does it take for, look, the customer to
pay this money?"

**EMP-137** — `[SRC-A2 ¶62]`
"This should either give an Alarm, or give us a report."

**EMP-138** — `[SRC-A2 ¶63]`
"Okay, now after these Invoices have been issued, have come and sat in the customer's account and
so on, we get to Releasing — in a sense, the documents — the **Release Order**."

**EMP-139** — `[SRC-A2 ¶64]`
"Okay, once, look, the vessel has reached the destination and the destination has discharged and so
on, then the customer now, suppose, wants to go and take delivery of their machine."

**EMP-140** — `[SRC-A2 ¶65]`
"Okay, they call us: how much has this become, its cost is blah. We've also sent them its invoice."

**EMP-141** — `[SRC-A2 ¶66]`
"Now suppose they want to pay."

**EMP-142** — `[SRC-A2 ¶67]`
"Now either they want to pay a part of this Invoice, or they want to pay all of it, or they say,
look, give it to them on credit — for example they'll pay one week later, ten days later."

**EMP-143** — `[SRC-A2 ¶68]`
"Okay, when we want to give them Release, we must specify — it should put an Option there for it in
the system — what? That, look, we took the money for this, it's settled, and we gave the Release
Order to our agent in Khorramshahr."

**EMP-144** — `[SRC-A2 ¶69]`
"Or, for example, they've paid a part of it, a portion of it."

**EMP-145** — `[SRC-A2 ¶70]`
"Or they haven't paid at all — they want to take it on credit."

**EMP-146** — `[SRC-A2 ¶71]`
"Okay, this Release Order that we issue, that we approve — this must give us a report."

**EMP-147** — `[SRC-A2 ¶72]`
"Ah — so that afterwards we know which, look, in this Manifest we sent, or in this Bill of Lading
we sent, it specifies for us which of them are Released and Paid — paid; which of them were
Released and were Partial Payment — they paid a part of them; which ones were Released and are
simply Unpaid — meaning not paid."

**EMP-148** — `[SRC-A2 ¶73]`
"It should specify these for us and set an Alarm, put a Notice, that, look, such-and-such document
has now been Released for one week but no money has been paid."

**EMP-149** — `[SRC-A2 ¶74]`
"Or, for example, such-and-such document — we gave Release for it one month ago — and, for example,
they still haven't paid 20% of it."

**EMP-150** — `[SRC-A2 ¶75]`
"Like that."

**EMP-151** — `[SRC-A2 ¶76]`
"Now this really needs a fine detail that I'll tell you later."

**EMP-152** — `[SRC-A2 ¶77]`
"I'm saying these in general."

**EMP-153** — `[SRC-A2 ¶78]`
"Now when the destination — meaning Khorramshahr, Bushehr, Bandar Abbas, wherever it's going to
discharge — the Agents there call us, they say, look, has such-and-such Bill of Lading been
Released or not?"

**EMP-154** — `[SRC-A2 ¶79]`
"For example, they should have access in the Release Order section and to the Bills of Lading
related to themselves."

**EMP-155** — `[SRC-A2 ¶80]`
"Meaning look — Khorramshahr only sees what belongs to Khorramshahr, Bushehr only sees what belongs
to Bushehr, Bandar Abbas only sees what belongs to Bandar Abbas."

**EMP-156** — `[SRC-A2 ¶81]`
"There they see that, look, if a document is Released, then there's no need to call at all."

**EMP-157** — `[SRC-A2 ¶82]`
"For example, they themselves have a Login, they go and see there — for example Bill of Lading
such-and-such — there it says, for example, it is not Released, the Bill of Lading is not there."

**EMP-158** — `[SRC-A2 ¶83]`
"There, they themselves directly tell the customer: look, the Bill of Lading is not Released; go
and coordinate with the shipping company of origin — for example with Dubai — and see what your
problem is."

**EMP-159** — `[SRC-A2 ¶84]`
"Or, if it is Released, they themselves see it in the system — so they don't have to keep calling
me."

**EMP-160** — `[SRC-A2 ¶85]`
"Like that."

**EMP-161** — `[SRC-A2 ¶86]`
"Okay, that was the general outline that I have."

**EMP-162** — `[SRC-A2 ¶87]`
"Now there are also a set of cargos that come in — meaning we must bring them here and discharge
them, and after we've discharged them we give a **Delivery Order** — meaning we give a Delivery
Order."

**EMP-163** — `[SRC-A2 ¶88]`
"This too is a section that you must fit in there."

**EMP-164** — `[SRC-A2 ¶89]`
"Now among the Options I told you — the Option, for example, Loading was, operations, that, now, we
specify how many Yard inventories I have, in which Ports, to which destination, how many, what we
gave, this has come in, its customer is specified too."

**EMP-165** — `[SRC-A2 ¶90]`
"Then these — the eligible ones — come into the Load List."

**EMP-166** — `[SRC-A2 ¶91]`
"The Load List gets printed, we give it to, for example, the Operators so they do the loading."

**EMP-167** — `[SRC-A2 ¶92]`
"Then we come and enter the Bill of Lading and Manifest issuing stage."

**EMP-168** — `[SRC-A2 ¶93]`
"Now those that are Final and have been loaded come into the Manifest list."

**EMP-169** — `[SRC-A2 ¶94]`
"Manifest — now PDF output, Excel, whatever it gives, let it give."

**EMP-170** — `[SRC-A2 ¶95]`
"We take a Print."

**EMP-171** — `[SRC-A2 ¶96]`
"If it gives PDF, let it give it together with Mark/Stamp."

**EMP-172** — `[SRC-A2 ¶97]`
"And if we want to take a Print, well, it should remove those Stamps; we take a Print and put the
original Stamp — meaning we put a live Stamp, a live stamp — both for the Manifest and for the
Bill of Lading."

**EMP-173** — `[SRC-A2 ¶98]`
"Okay, then we enter the stage… let me add some Options here — for example Delivery Order, let me
tell you Release Order — we should consider these things."

**EMP-174** — `[SRC-A2 ¶99]`
"Then we also enter the Accounting section."

**EMP-175** — `[SRC-A2 ¶100]`
"I mean accounting."

**EMP-176** — `[SRC-A2 ¶101]`
"Now, for example, always keep in mind those Comments, or that Job Number — the ETOZ that we are
doing for one single Shipment — it may take one month, two months."

**EMP-177** — `[SRC-A2 ¶102]`
"This accountant should know that, look, this machine for which we hit Start one month ago — how
much has been spent on it step by step."

**EMP-178** — `[SRC-A2 ¶103]`
"So that when they come to issue an Invoice, they know not to write something wrong, or for
example not to lose track of it and forget to include it."

**EMP-179** — `[SRC-A2 ¶104]`
"That's that."

**EMP-180** — `[SRC-A2 ¶105]`
"Then these statements that are issued automatically go and sit in the customer's account."

**EMP-181** — `[SRC-A2 ¶106]`
"And the customer's payments too — their receipt, the **Payment Voucher** — those should also be
specified."

**EMP-182** — `[SRC-A2 ¶107]`
"Now, what detailed Options each of them should have, what things we should do in that Receipt
Voucher and Payment Voucher, what its shape and form should be."

**EMP-183** — `[SRC-A2 ¶108]`
"For example, this Invoice that you issue — what its Details should be and so on — which I'll tell
you in full."

**EMP-184** — `[SRC-A2 ¶109]`
"We'll go into the details later."

*(End of Group A.)*

---

## GROUP B — Timestamped voice clips, 2026-09-14 04:57:33 → 05:07:52 (18 files)

---

### Source `SRC-B01` — `audio_2026-09-14_04-57-33.txt` (04:57:33) — Sidebar structure, Master Data, Customers

---

**EMP-185** — `[SRC-B01 ¶1]`
"Look, on the left side — the data — meaning the left side of this app that says **Overview** — we
have 1, 2, 3, 4, 5, 6; we have six general sections, and they must be in this order."

**EMP-186** — `[SRC-B01 ¶2]`
"For example, the first section must be **Overview**, then it must be **Operations**, then **B/L and
Manifest**, then **Accounting**, then that **Master Data**, and finally **Access Control**."

**EMP-187** — `[SRC-B01 ¶3]`
"Each of these, when we click on them, must open their Options in a drop-down (accordion) way."

**EMP-188** — `[SRC-B01 ¶4]`
"Okay, now what we want is to start from **Master Data**. We want to start. Okay, there is a set of
data that we must enter from the beginning, and it stays fixed in the system."

**EMP-189** — `[SRC-B01 ¶5]`
"And when in various places — for example like **Operations**, or issuing a **Bill of Lading**, or
issuing a **Manifest**, or now issuing a statement — when we want to issue these, we need a set of
pre-determined Data, and there we must only Select them."

**EMP-190** — `[SRC-B01 ¶6]`
"Now, for Selecting them — so that, for example, that Operator doesn't have to enter them manually
again and, for example, make errors or enter them wrongly — we come and enter these in the Master
Data section."

**EMP-191** — `[SRC-B01 ¶7]`
"Now Master Data has a set of sub-items — it has a drop-down state."

**EMP-192** — `[SRC-B01 ¶8]`
"So what did it become now? It became that Master Data section."

**EMP-193** — `[SRC-B01 ¶9]`
"Yes, yes — the Master Data section became:"

**EMP-194** — `[SRC-B01 ¶10]`
"**Customers, Ports, Yards, Vessels, Shippers, Consignees, Agents**"

**EMP-195** — `[SRC-B01 ¶11]`
"Okay, each of these must have a set of…"

**EMP-196** — `[SRC-B01 ¶12]`
"For example, now we go into the **Customers** section."

**EMP-197** — `[SRC-B01 ¶13]`
"Okay, now Customer — for us to want to create a **New Customer** — because everything of ours is
based on Customer."

**EMP-198** — `[SRC-B01 ¶14]`
"Okay, Customer may be a person whose name is not in the Bill of Lading specifications and so on at
all. Meaning it is our own private customer — it is Internal — meaning it is internal to us; we
ourselves know this is our customer."

**EMP-199** — `[SRC-B01 ¶15]`
"It may be a natural person at all, it may be a legal entity, but its name is neither in the Bill
of Lading, nor in Shipper, nor in Consignee. Meaning it is a separate thing."

**EMP-200** — `[SRC-B01 ¶16]`
"Okay, now for entering, for example, a Customer — what Options do we need?"

**EMP-201** — `[SRC-B01 ¶17]`
"For example, first of all there is **Name** — Name is either a personal name, for example Arash
Alidadi, or a legal one, company such-and-such."

**EMP-202** — `[SRC-B01 ¶18]`
"**Contact Number**."

**EMP-203** — `[SRC-B01 ¶19]`
"For example, now we go to Name — Arash Alidadi."

**EMP-204** — `[SRC-B01 ¶20]`
"Then, now, a Contact Number, one Email, one Address."

**EMP-205** — `[SRC-B01 ¶21]`
"Now this one — the system itself should give it a Code."

**EMP-206** — `[SRC-B01 ¶22]`
"What should the format of giving the Code be? For example:"

**EMP-207** — `[SRC-B01 ¶23]`
"**CUST 3-3-1**"

**EMP-208** — `[SRC-B01 ¶24]`
"Okay, the next name we write — for example, let's say Kianoush Jowkar."

**EMP-209** — `[SRC-B01 ¶25]`
"Okay, only that Name should be starred, okay — meaning the rest of the Fields should not be
mandatory. If there is something to fill, they fill it; if not, it doesn't matter — meaning it
shouldn't give an Error. Only that Name is important."

**EMP-210** — `[SRC-B01 ¶26]`
"Okay, for example, the next name becomes Kianoush Jowkar."

**EMP-211** — `[SRC-B01 ¶27]`
"I want to add a new Customer named Kianoush Jowkar."

**EMP-212** — `[SRC-B01 ¶28]`
"The system itself gives it the next number:"

**EMP-213** — `[SRC-B01 ¶29]`
"**CUST 3SF-2**"

**EMP-214** — `[SRC-B01 ¶30]`
"Next, for example, Siroos such-and-such, Ali Mahmoudi."

**EMP-215** — `[SRC-B01 ¶31]`
"The system itself automatically gives it another number, gives it a Code:"

**EMP-216** — `[SRC-B01 ¶32]`
"**CUST 3SF-3**"

**EMP-217** — `[SRC-B01 ¶33]`
"And so on in order — the Customers go up and get numbered."

**EMP-218** — `[SRC-B01 ¶34]`
"Okay, we said Customers — what Options are needed for that **Data Entry**?"

**EMP-219** — `[SRC-B01 ¶35]`
"One is Name — only it should be starred, that's it."

**EMP-220** — `[SRC-B01 ¶36]`
"That Code too — the system gives it automatically."

**EMP-221** — `[SRC-B01 ¶37]`
"Contact Number and Email and Address should also be among the Options — meaning filling them is
not obligatory."

**EMP-222** — `[SRC-B01 ¶38]`
"**CUST 2SF-1** — now **2SF-1, 3SF-1** — whatever it writes, and the next one **3SF-2**, the next
**3SF-3**, **3SF-4**, **3SF-5** — and so on, up to for example a thousand Customers, two thousand,
three thousand, whatever you have — this gets registered and then it comes into the List."

**EMP-223** — `[SRC-B01 ¶39]`
"Then it comes into the List."

**EMP-224** — `[SRC-B01 ¶40]`
"Now we put **Edit**, we put **Delete**, we put a **Status** — whatever you put there, it specifies
it in that List itself."

**EMP-225** — `[SRC-B01 ¶41]`
"For example, that **Type** section, and I don't know, **Currency** and **TRN Number** and so on —
those are not there; there is no need to bring them into the Customer information."

**EMP-226** — `[SRC-B01 ¶42]`
"Okay, that Currency and the gear and those things belong to the Accounting part of it, which we'll
explain later."

**EMP-227** — `[SRC-B01 ¶43]`
"So adding a Customer here is only:"

**EMP-228** — `[SRC-B01 ¶44]`
"**Name**"

**EMP-229** — `[SRC-B01 ¶45]`
"Now **Contact Number, Email, Address**"

**EMP-230** — `[SRC-B01 ¶46]`
"And that Code."

**EMP-231** — `[SRC-B01 ¶47]`
"The Code — well, the system gives it itself."

**EMP-232** — `[SRC-B01 ¶48]`
"Its format must be like this:"

**EMP-233** — `[SRC-B01 ¶49]`
"**CUST 3.1**"

**EMP-234** — `[SRC-B01 ¶50]`
"For example, the next Customer:"

**EMP-235** — `[SRC-B01 ¶51]`
"**3.2, 3.3, 3.4**"

**EMP-236** — `[SRC-B01 ¶52]`
"Okay, then when we want to go and see these Customer Lists — so the Customers are in such a state
that now, for example, its Customer, its Status, now it has an Edit, it has a Delete, whatever it
has."

**EMP-237** — `[SRC-B01 ¶53]`
"That **Type** section, and I don't know, **Currency** and **TRN Number** and **Short Name** and
those things — there is no need for them at all."

**EMP-238** — `[SRC-B01 ¶54]`
"That's the end of the Customer section."

> **TN:** Note the three different Customer code formats given within this one clip
> (`CUST 3-3-1`, `CUST 3SF-2`, `CUST 3.1`). The employer is clearly improvising the example. The
> *substantive* requirement is: a system-generated sequential code with a `CUST` prefix. The
> formatting is recorded as an unresolved decision, not a contradiction in business meaning.

---
### Source `SRC-B02` — `audio_2026-09-14_04-59-40.txt` (04:59:40) — Ports and abbreviations

---

**EMP-239** — `[SRC-B02 ¶1]`
"Okay, after Customer we get to, for example, registering Ports — the ports."

**EMP-240** — `[SRC-B02 ¶2]`
"Okay, in the Port section, we write the Port's name. Okay, because later in the Bill of Lading,
when it writes **Port of Loading** or **Port of Discharge** — meaning now the loading port or the
discharge port — you must write the Port's name."

**EMP-241** — `[SRC-B02 ¶3]`
"Then its Format is like this: comma with a space, Space, for example the city name, again a comma
with a space, the country name."

**EMP-242** — `[SRC-B02 ¶4]`
"For example, now we want to register Bandar Abbas port — for example we want to register Rajaee
port. What is the Port's name? For example, Rajaee."

**EMP-243** — `[SRC-B02 ¶5]`
"Okay, where is its address? It becomes like this — that, for example:"

**EMP-244** — `[SRC-B02 ¶6]`
"**Bandar Abbas, Persian Gulf, Iran**"

**EMP-245** — `[SRC-B02 ¶7]`
"For example, like this."

**EMP-246** — `[SRC-B02 ¶8]`
"Now, for example, for Bushehr we want to register:"

**EMP-247** — `[SRC-B02 ¶9]`
"**Bushehr, Persian Gulf, Iran**"

**EMP-248** — `[SRC-B02 ¶10]`
"Or some such state."

**EMP-249** — `[SRC-B02 ¶11]`
"For example, for Hamriyah Port Dubai we register:"

**EMP-250** — `[SRC-B02 ¶12]`
"**Hamriyah Port, Dubai, UAE**"

**EMP-251** — `[SRC-B02 ¶13]`
"Like this."

**EMP-252** — `[SRC-B02 ¶14]`
"Now we want to register, for example, the one for Sohar port."

**EMP-253** — `[SRC-B02 ¶15]`
"Okay, for example it becomes:"

**EMP-254** — `[SRC-B02 ¶16]`
"**Port of Sohar, Oman**"

**EMP-255** — `[SRC-B02 ¶17]`
"Then what does it become for it? For example Oman — its country name becomes Oman."

**EMP-256** — `[SRC-B02 ¶18]`
"Okay, now for the codes, we must consider an Abbreviation for it. For example, an abbreviated
state."

**EMP-257** — `[SRC-B02 ¶19]`
"Okay, because the Load List — the Load List takes up a lot of space — so because of that, here we
consider an Abbreviation for that Port name."

**EMP-258** — `[SRC-B02 ¶20]`
"So that when we want to look at the Load List and so on, the origin Port and the destination Port
are written as an Abbreviation — meaning abbreviated — not that the full Port name is written."

**EMP-259** — `[SRC-B02 ¶21]`
"Because it takes up a lot of space and it empties out a lot of the space — because of that."

**EMP-260** — `[SRC-B02 ¶22]`
"Okay, so what do we do for Port? We write a Port name — now its city and its country — and that
Abbreviation, or now to put it the same way, that Code — which we use from this Code in the Load
List, in the Load List display, when we want to enter the Data for entering a new Cargo, we Select
that Port and port and Destination."

**EMP-261** — `[SRC-B02 ¶23]`
"For example, it says:"

**EMP-262** — `[SRC-B02 ¶24]`
"**Hamriyah Port, Dubai, UAE**"

**EMP-263** — `[SRC-B02 ¶25]`
"For example, we Select this."

**EMP-264** — `[SRC-B02 ¶26]`
"Then when we want to come and look in that List, it says, for example, **Port of Loading** — now
here, instead of it saying Hamriyah Port, Dubai, for example we defined an Abbreviation for it:"

**EMP-265** — `[SRC-B02 ¶27]`
"**HAM**"

**EMP-266** — `[SRC-B02 ¶28]`
"For example, Hamriyah — there it says **HAM**, not that it has written Hamriyah Port, Dubai in
full."

**EMP-267** — `[SRC-B02 ¶29]`
"Okay?"

**EMP-268** — `[SRC-B02 ¶30]`
"Now this Port name — now this can all be starred, okay — meaning the Port name should be starred,
its city should be starred, its Country too should be starred — and that Code of it, that we
ourselves want to set an Abbreviation for, that should also be starred."

**EMP-269** — `[SRC-B02 ¶31]`
"Then we click **Create Port** — the Port is registered."

**EMP-270** — `[SRC-B02 ¶32]`
"That's its Port section too."

---

### Source `SRC-B03` — `audio_2026-09-14_05-00-18.txt` (05:00:18) — Yards

---

**EMP-271** — `[SRC-B03 ¶1]`
"Okay, now for entering **Yard**s."

**EMP-272** — `[SRC-B03 ¶2]`
"When are Yards useful to us?"

**EMP-273** — `[SRC-B03 ¶3]`
"When we want to take delivery of a Cargo — to see which Port we took delivery in and which Yard we
discharged it into."

**EMP-274** — `[SRC-B03 ¶4]`
"In that section of Data that we want to enter, for **Operations** and I don't know **Yard
Inventory** and those things — this discharge **Location** of that goods is important."

**EMP-275** — `[SRC-B03 ¶5]`
"Now I'll say we define it here."

**EMP-276** — `[SRC-B03 ¶6]`
"When we want to define the Yards — that we only specify which Port it belongs to and what the
Yard's name is."

**EMP-277** — `[SRC-B03 ¶7]`
"For example:"

**EMP-278** — `[SRC-B03 ¶8]`
"**Port Hamriyah — Yard F15**"

**EMP-279** — `[SRC-B03 ¶9]`
"Done — that alone is enough."

---

### Source `SRC-B04` — `audio_2026-09-14_05-00-51.txt` (05:00:51) — Yard selection cascades from Port

---

**EMP-280** — `[SRC-B04 ¶1]`
"Okay, when we want to Select it — for example, when we take delivery of a Cargo, suppose there it
says **Port of Loading**."

**EMP-281** — `[SRC-B04 ¶2]`
"We want to do a Data Entry, we want to register a Cargo."

**EMP-282** — `[SRC-B04 ¶3]`
"Okay, the Cargo we want to register — one of its Options is the loading Port — what its loading
port is."

**EMP-283** — `[SRC-B04 ¶4]`
"For example, we select **Hamriyah**."

**EMP-284** — `[SRC-B04 ¶5]`
"The moment we selected Hamriyah, the Yards that we previously registered under the name Hamriyah
— is, meaning… of course, they come up."

**EMP-285** — `[SRC-B04 ¶6]`
"Now, for example, **B15**, **B16**, **B17** — whatever it is — we register it there."

**EMP-286** — `[SRC-B04 ¶7]`
"Meaning the Yards that belong to Hamriyah come up automatically."

**EMP-287** — `[SRC-B04 ¶8]`
"Or, for example, the Yards that we saved for **Jebel Ali** — automatically come up."

**EMP-288** — `[SRC-B04 ¶9]`
"The Yards that, for example, we registered for **Rajai / Bandar Abbas** — automatically come up."

**EMP-289** — `[SRC-B04 ¶10]`
"There we Select it."

> **TN:** The Yard codes in this clip (`B15/B16/B17`) differ from that in `EMP-278` (`F15`). Both
> are illustrative examples, not conflicting rules.

---

### Source `SRC-B05` — `audio_2026-09-14_05-01-56.txt` (05:01:56) — Vessels, Tug & Barge, Voyage numbering

---

**EMP-290** — `[SRC-B05 ¶1]`
"Okay, after Yard we get to **Vessels** — meaning the ships."

**EMP-291** — `[SRC-B05 ¶2]`
"Okay, for the vessels we can consider the vessel's name — **Vessel Name**."

**EMP-292** — `[SRC-B05 ¶3]`
"And now if they have anything else, then… now the vessels are divided into a few types."

**EMP-293** — `[SRC-B05 ¶4]`
"Now either they are **Tug & Barge** — which becomes **Tug** and **Barge** — or they are **Landing
Craft** — or now they are **Vessel**."

**EMP-294** — `[SRC-B05 ¶5]`
"These we can now write both as **Tug Name** and **Barge Name**, or we can write only Vessel Name."

**EMP-295** — `[SRC-B05 ¶6]`
"And also that we consider an Option — an IMO Number — for it too."

**EMP-296** — `[SRC-B05 ¶7]`
"IMO Number too… [passage unclear]. It doesn't matter at all — just the vessel's name and its
specifications."

**EMP-297** — `[SRC-B05 ¶8]`
"Now I'm saying we have two models of vessels — it must either be **Tug & Barge**, which writes:"

**EMP-298** — `[SRC-B05 ¶9]`
"**Tug Name / Barge Name**"

**EMP-299** — `[SRC-B05 ¶10]`
"Or, for example:"

**EMP-300** — `[SRC-B05 ¶11]`
"**Vessel Name / Landing Craft Name**"

**EMP-301** — `[SRC-B05 ¶12]`
"Something like that."

**EMP-302** — `[SRC-B05 ¶13]`
"Okay, **Load List**, Loading List, Print."

**EMP-303** — `[SRC-B05 ¶14]`
"Suppose we want to say that, look, for example 20 machines — their document work is ready."

**EMP-304** — `[SRC-B05 ¶15]`
"Now we want to bring them into their Loading List."

**EMP-305** — `[SRC-B05 ¶16]`
"We prepared the Loading List."

**EMP-306** — `[SRC-B05 ¶17]`
"Now we want to link it to a vessel."

**EMP-307** — `[SRC-B05 ¶18]`
"For example, we say that, look, these 20 machines are for the vessel **Mahdi Yazd**."

**EMP-308** — `[SRC-B05 ¶19]`
"We take a Print of this and give it to the Operators."

**EMP-309** — `[SRC-B05 ¶20]`
"The Operators — now according to the Loading List we gave them — that, look, such-and-such machine
entered on this date, this many Packages accompany it, it is in this Yard."

**EMP-310** — `[SRC-B05 ¶21]`
"We want to say, for example, now it is the Load List of the vessel **Mahdi Yazd**."

**EMP-311** — `[SRC-B05 ¶22]`
"We listed 20 machines for it to be loaded onto Mahdi Yazd."

**EMP-312** — `[SRC-B05 ¶23]`
"And where else is this vessel's name useful?"

**EMP-313** — `[SRC-B05 ¶24]`
"In the Bill of Lading."

**EMP-314** — `[SRC-B05 ¶25]`
"In issuing the Bill of Lading — issuing the Bill of Lading and the Manifest — it should give them
automatically."

**EMP-315** — `[SRC-B05 ¶26]`
"For example, suppose Mahdi Yazd in the year 2026 — this is now its first trip going to
Khorramshahr."

**EMP-316** — `[SRC-B05 ¶27]`
"So when we are issuing the Khorramshahr Bill of Lading, **Vessel Mahdi Yazd**, for example,
becomes:"

**EMP-317** — `[SRC-B05 ¶28]`
"**Voyage 1/26**"

**EMP-318** — `[SRC-B05 ¶29]`
"If it is its second time in 2026 that it is going to Khorramshahr, for example it becomes:"

**EMP-319** — `[SRC-B05 ¶30]`
"**Voyage 2/26**"

**EMP-320** — `[SRC-B05 ¶31]`
"Meaning the system itself must give this automatically."

**EMP-321** — `[SRC-B05 ¶32]`
"If it is its third time, for example it becomes:"

**EMP-322** — `[SRC-B05 ¶33]`
"**Voyage 3/26**"

**EMP-323** — `[SRC-B05 ¶34]`
"Okay, this must be defined **separately for each Destination**."

**EMP-324** — `[SRC-B05 ¶35]`
"That the system itself must…"

**EMP-325** — `[SRC-B05 ¶36]`
"For example, Mahdi Yazd's next trip may go to Bandar Abbas."

**EMP-326** — `[SRC-B05 ¶37]`
"It goes to Bandar Abbas for the first time."

**EMP-327** — `[SRC-B05 ¶38]`
"So in the Bandar Abbas programme, for example, the vessel name becomes Mahdi Yazd, its Voyage
becomes **Voyage 1/26**."

**EMP-328** — `[SRC-B05 ¶39]`
"What does that mean?"

**EMP-329** — `[SRC-B05 ¶40]`
"So when you wanted to issue the Khorramshahr Bill of Lading, you selected, for example, the name
Mahdi Yazd — its Voyage itself must automatically come:"

**EMP-330** — `[SRC-B05 ¶41]`
"**Voyage 5/26**"

**EMP-331** — `[SRC-B05 ¶42]`
"Meaning, look, it is the fifth time in 2026 that it is going towards Khorramshahr."

**EMP-332** — `[SRC-B05 ¶43]`
"The Manifest too — now those Details at the top of it that we want to enter — one of its options
is the vessel name, of course."

**EMP-333** — `[SRC-B05 ¶44]`
"The vessel name and Voyage — these Manifest Details must definitely be stated."

**EMP-334** — `[SRC-B05 ¶45]`
"Okay, now what Options do we need here to add the vessel names?"

**EMP-335** — `[SRC-B05 ¶46]`
"Same as what I said:"

**EMP-336** — `[SRC-B05 ¶47]`
"Just the vessel name."

**EMP-337** — `[SRC-B05 ¶48]`
"Now if it is **Tug & Barge**, it should write:"

**EMP-338** — `[SRC-B05 ¶49]`
"**Tug Name / Barge Name**"

**EMP-339** — `[SRC-B05 ¶50]`
"And if it is a Landing Craft or a vessel, then now it is specified:"

**EMP-340** — `[SRC-B05 ¶51]`
"**Vessel Name**"

**EMP-341** — `[SRC-B05 ¶52]`
"It has one name."

**EMP-342** — `[SRC-B05 ¶53]`
"Put an **IMO Number** for it too."

**EMP-343** — `[SRC-B05 ¶54]`
"IMO Number is also part of its thing — it should be among its Options, not among the… starred."

**EMP-344** — `[SRC-B05 ¶55]`
"Meaning if we have it, we enter it; if we don't have it, it shouldn't give an Error — it should
register."

---

### Source `SRC-B06` — `audio_2026-09-14_05-02-13.txt` (05:02:13) — Shippers

---

**EMP-345** — `[SRC-B06 ¶1]`
"The next option is **Shippers**."

**EMP-346** — `[SRC-B06 ¶2]`
"Shippers — well, that's obvious. The first data registered in the Bill of Lading is the
**Shipper**."

**EMP-347** — `[SRC-B06 ¶3]`
"The Shipper's information must also be like this:"

**EMP-348** — `[SRC-B06 ¶4]`
"**Name**"

**EMP-349** — `[SRC-B06 ¶5]`
"For example National ID — or, for example, some countries don't have a National ID, they have a
**TRN Number** — now, or they have anything else."

**EMP-350** — `[SRC-B06 ¶6]`
"**National ID / TRN Number**"

**EMP-351** — `[SRC-B06 ¶7]`
"**Address**"

**EMP-352** — `[SRC-B06 ¶8]`
"**Contact Number**"

**EMP-353** — `[SRC-B06 ¶9]`
"**Email**"

**EMP-354** — `[SRC-B06 ¶10]`
"These should be among its Options."

**EMP-355** — `[SRC-B06 ¶11]`
"If there is something, they write it; if not, for example, it shouldn't give an Error."

**EMP-356** — `[SRC-B06 ¶12]`
"Only that company name — natural or legal — that one should be starred."

**EMP-357** — `[SRC-B06 ¶13]`
"The rest of the items should be among the Options — meaning, for example, optional."

---

### Source `SRC-B07` — `audio_2026-09-14_05-02-40.txt` (05:02:40) — When Shipper is used

---

**EMP-358** — `[SRC-B07 ¶1]`
"When is this Shipper useful?"

**EMP-359** — `[SRC-B07 ¶2]`
"When we want to issue a Bill of Lading — the first data we must enter is its Shipper."

**EMP-360** — `[SRC-B07 ¶3]`
"Shipper — the Shipper's specifications."

**EMP-361** — `[SRC-B07 ¶4]`
"In the Manifest too, one of the options is Shipper — which we select there."

---

### Source `SRC-B08` — `audio_2026-09-14_05-02-53.txt` (05:02:53) — Consignees

---

**EMP-362** — `[SRC-B08 ¶1]`
"**Consignee** is exactly the same thing as **Shipper** — the same information."

**EMP-363** — `[SRC-B08 ¶2]`
"Okay, **Consignee** — now it's either a natural person or a legal entity."

**EMP-364** — `[SRC-B08 ¶3]`
"So for Consignee we must write a **Name**."

**EMP-365** — `[SRC-B08 ¶4]`
"Then **National ID** or **TRN Number**. Now, for example, this can be written in one row, or you
can separate them with a Slash."

**EMP-366** — `[SRC-B08 ¶5]`
"If we have the **National ID**, we enter its National ID; if we have its **TRN Number**, we enter
its TRN Number."

**EMP-367** — `[SRC-B08 ¶6]`
"**National ID / TRN Number**"

**EMP-368** — `[SRC-B08 ¶7]`
"In other words:"

**EMP-369** — `[SRC-B08 ¶8]`
"**Address**"

**EMP-370** — `[SRC-B08 ¶9]`
"**Contact Number**"

**EMP-371** — `[SRC-B08 ¶10]`
"**Email**"

**EMP-372** — `[SRC-B08 ¶11]`
"Done."

---

### Source `SRC-B09` — `audio_2026-09-14_05-03-16.txt` (05:03:16) — Agents; end of Master Data

---

**EMP-373** — `[SRC-B09 ¶1]`
"Okay, the last stage — the other Option that we add in this Master Data — is **Agents**."

**EMP-374** — `[SRC-B09 ¶2]`
"The Agent's Details too, again in the same way — for example as:"

**EMP-375** — `[SRC-B09 ¶3]`
"**Name**"

**EMP-376** — `[SRC-B09 ¶4]`
"**Address**"

**EMP-377** — `[SRC-B09 ¶5]`
"**Contact Number**"

**EMP-378** — `[SRC-B09 ¶6]`
"**Email**"

**EMP-379** — `[SRC-B09 ¶7]`
"This Agent Data must be stated in the Bill of Lading."

**EMP-380** — `[SRC-B09 ¶8]`
"Now, for example, the Bandar Abbas Agent — in the Bandar Abbas Bills of Lading; the Agent, for
example, of Bushehr — in the Bushehr Bills of Lading."

**EMP-381** — `[SRC-B09 ¶9]`
"The Agent for each destination is different — which, of course, is stated in the Bills of Lading
related to that same destination."

**EMP-382** — `[SRC-B09 ¶10]`
"Okay, we've reached the Master Data stage."

**EMP-383** — `[SRC-B09 ¶11]`
"This is a set of Data that we must save as default, because we must use these in various places."

---

### Source `SRC-B10` — `audio_2026-09-14_05-03-32.txt` (05:03:32) — Customer vs Shipper/Consignee; ETOZ; Job Number; Ledger

---

**EMP-384** — `[SRC-B10 ¶1]`
"Okay, look — each of these must be defined separately."

**EMP-385** — `[SRC-B10 ¶2]`
"Because a Customer may, for example, not be our Shipper, not be our Consignee."

**EMP-386** — `[SRC-B10 ¶3]`
"Customer is a separate natural or legal person who is in contact with us privately."

**EMP-387** — `[SRC-B10 ¶4]`
"It's possible that, for example, our customer is in contact with us by telephone."

**EMP-388** — `[SRC-B10 ¶5]`
"Now they may have gone and, for example, from China or the UAE or now any other country, bought a
machine, bought something."

**EMP-389** — `[SRC-B10 ¶6]`
"Our Shipper, for example, becomes that selling company."

**EMP-390** — `[SRC-B10 ¶7]`
"You see? Whose information we must bring into the Bill of Lading."

**EMP-391** — `[SRC-B10 ¶8]`
"Our Consignee too becomes — now whoever that company at the destination wants to put on the
document — now whatever they want to write."

**EMP-392** — `[SRC-B10 ¶9]`
"Okay, in the Customer section we have nothing to do with this Shipper and Consignee and blah and
those things."

**EMP-393** — `[SRC-B10 ¶10]`
"Customer is directly the person we are in contact with and for whom we issue the statement."

**EMP-394** — `[SRC-B10 ¶11]`
"Now, for example, let's say we have a customer — suppose we have a customer — they give us a
machine in Australia."

**EMP-395** — `[SRC-B10 ¶12]`
"Okay, they tell us: look, deliver this to us in Khorramshahr."

**EMP-396** — `[SRC-B10 ¶13]`
"Who is our Customer?"

**EMP-397** — `[SRC-B10 ¶14]`
"For example, it's Arash Alidadi. Done, that's it."

**EMP-398** — `[SRC-B10 ¶15]`
"So this machine is registered in our system under the name of Arash Alidadi."

**EMP-399** — `[SRC-B10 ¶16]`
"We only know Arash Alidadi."

**EMP-400** — `[SRC-B10 ¶17]`
"Now that Australian company — who is the Shipper?"

**EMP-401** — `[SRC-B10 ¶18]`
"Then again, who is the Consignee?"

**EMP-402** — `[SRC-B10 ¶19]`
"It separates."

**EMP-403** — `[SRC-B10 ¶20]`
"We pick it up from there and bring it to Jebel Ali, for example, UAE."

**EMP-404** — `[SRC-B10 ¶21]`
"We clear it from Jebel Ali."

**EMP-405** — `[SRC-B10 ¶22]`
"We bring it to Hamriyah Port Dubai."

**EMP-406** — `[SRC-B10 ¶23]`
"We load it from Hamriyah Port Dubai."

**EMP-407** — `[SRC-B10 ¶24]`
"We send this to Khorramshahr."

**EMP-408** — `[SRC-B10 ¶25]`
"This is ETOZ."

**EMP-409** — `[SRC-B10 ¶26]`
"From the moment we hit Start until, for example, we deliver it — a set of expenses are incurred
frequently and repeatedly."

**EMP-410** — `[SRC-B10 ¶27]`
"Suppose, look, repair costs — or, for example, vessel cost, clearance cost, low-bed cost, moving
cost — whatever it is."

**EMP-411** — `[SRC-B10 ¶28]`
"From the moment this Start is registered and this thing is recorded — like a **Job Number** state,
like a **Job Number** state, like a note-taking state, like a Note state — that, look, we take
notes: from day one, what has been spent on this."

**EMP-412** — `[SRC-B10 ¶29]`
"Job Number, Job Number, Invoice."

**EMP-413** — `[SRC-B10 ¶30]`
"Now we want to say, for example, Mr Arash as our Customer — when we want to issue an Invoice for
him — we use this Job Number like a Note, of course."

**EMP-414** — `[SRC-B10 ¶31]`
"Come here — for example, a thousand dirhams was spent on Repairing; a thousand dirhams on Jebel
Ali clearance; a thousand dirhams on the low-bed until it came to Hamriyah; then again here, for
example, 500 dirhams was spent on customs documents; and again, for example, 10,000 dirhams was
spent until it reached Khorramshahr."

**EMP-415** — `[SRC-B10 ¶32]`
"Okay, when we issue this Invoice — in whose name is the Invoice issued?"

**EMP-416** — `[SRC-B10 ¶33]`
"Meaning this Invoice is issued in our system for Arash Alidadi, who is our Customer."

**EMP-417** — `[SRC-B10 ¶34]`
"Okay, now it's possible that the Details inside it — for example, Arash says, look, write this
Bill of Lading in the name of, for example, such-and-such company."

**EMP-418** — `[SRC-B10 ¶35]`
"Okay, that doesn't matter any more."

**EMP-419** — `[SRC-B10 ¶36]`
"For the Bill of Lading, whatever they want, we write it for them."

**EMP-420** — `[SRC-B10 ¶37]`
"Whatever name they want it to be."

**EMP-421** — `[SRC-B10 ¶38]`
"Once we've issued the statement, this goes and sits in Arash Alidadi's profile."

**EMP-422** — `[SRC-B10 ¶39]`
"For example, we issued an Invoice for him — it goes as Sales into his Ledger section and sits
there; it sits, for example, as Debit in his account."

**EMP-423** — `[SRC-B10 ¶40]`
"For example, in total, look, from this ETOZ it became forty thousand dirhams."

**EMP-424** — `[SRC-B10 ¶41]`
"Okay, this should come and sit in Arash Alidadi's system."

**EMP-425** — `[SRC-B10 ¶42]`
"Now the rest of the customers follow the same pattern."

**EMP-426** — `[SRC-B10 ¶43]`
"Each of them should have a Profile — so that when I, for example, enter Arash Alidadi, I go into
Arash's Profile, and see, look, how many Invoices I have issued for him, how much money he has
given us, how much he is in debt, how much he is owed."

**EMP-427** — `[SRC-B10 ¶44]`
"His account's Credit and Debit — how much time has passed since the last statement we issued for
him."

**EMP-428** — `[SRC-B10 ¶45]`
"Whether he has paid his statement — it's Paid, it's Unpaid, or it's a Partial Payment."

**EMP-429** — `[SRC-B10 ¶46]`
"Something like that."

**EMP-430** — `[SRC-B10 ¶47]`
"That's why I'm saying — look, this Customer is completely separate from the Shipper and the
Consignee and the rest of the information."

**EMP-431** — `[SRC-B10 ¶48]`
"Customer is an Internal thing — meaning it is internal, and it is only for us."

---
### Source `SRC-B11` — `audio_2026-09-14_05-05-14.txt` (05:05:14) — Operations: Cargo registration, Inspection, Load List, B/L, Manifest, output

---

**EMP-432** — `[SRC-B11 ¶1]`
"Okay, now the stage after this Master Data that we entered — we go to my first main section, which
is the same **Operations**."

**EMP-433** — `[SRC-B11 ¶2]`
"Operations means operations."

**EMP-434** — `[SRC-B11 ¶3]`
"Okay, its first option says **Cargo**."

**EMP-435** — `[SRC-B11 ¶4]`
"Okay, when is this? When we want to Register a goods item."

**EMP-436** — `[SRC-B11 ¶5]`
"Firstly, we took delivery somewhere — one of the ports around the world — for example a machine,
Cargo, a container, something we took delivery of for moving."

**EMP-437** — `[SRC-B11 ¶6]`
"Okay, in this section, when we enter it, we must enter a set of data so this Cargo gets
registered."

**EMP-438** — `[SRC-B11 ¶7]`
"Okay, when we want to register the first Cargo — meaning when we click **New Cargo** — these
Options, the fields, should come up so we can fill them."

**EMP-439** — `[SRC-B11 ¶8]`
"The first important thing is the **Customer**."

**EMP-440** — `[SRC-B11 ¶9]`
"Let's see whose this goods, this Cargo, this commodity is — meaning which of our customers it
belongs to."

**EMP-441** — `[SRC-B11 ¶10]`
"For example, we want to say this goods belongs to Arash Alidadi."

**EMP-442** — `[SRC-B11 ¶11]`
"Okay, this Arash Alidadi — we entered him previously in that Master Data."

**EMP-443** — `[SRC-B11 ¶12]`
"Now that we want to register a Cargo, the first thing that should come up must be Customer."

**EMP-444** — `[SRC-B11 ¶13]`
"Whose is this Cargo? For example, it belongs to Arash Alidadi."

**EMP-445** — `[SRC-B11 ¶14]`
"Okay, what is it? We must add a set of Options here so this data gets registered, so this Cargo
gets registered."

**EMP-446** — `[SRC-B11 ¶15]`
"Okay, the first thing we must consider in the section for Registering a Cargo — the first thing
must be that this Customer is specified."

**EMP-447** — `[SRC-B11 ¶16]`
"Let's see our customer — meaning this machine, Cargo or Container, whatever we took delivery of
somewhere — whose is it; meaning it goes to whose account."

**EMP-448** — `[SRC-B11 ¶17]`
"This Customer here — that place where we had the data in Master Data, where we were entering the
Customers — here it must come up so we can Select it."

**EMP-449** — `[SRC-B11 ¶18]`
"Now either we write its name or, for example, we write its code and Search — it comes up — we
Select it."

**EMP-450** — `[SRC-B11 ¶19]`
"The next Option is **Shipper Name**."

**EMP-451** — `[SRC-B11 ¶20]`
"We must write the Shipper's name."

**EMP-452** — `[SRC-B11 ¶21]`
"And, look, from what… [inaudible] we took delivery of this."

**EMP-453** — `[SRC-B11 ¶22]`
"**Port of Loading** — where is its loading port?"

**EMP-454** — `[SRC-B11 ¶23]`
"**Port of Destination** — meaning that port which is the goods' destination."

**EMP-455** — `[SRC-B11 ¶24]`
"Let's consider a **Description** for it — the description of the goods."

**EMP-456** — `[SRC-B11 ¶25]`
"**Chassis Number**"

**EMP-457** — `[SRC-B11 ¶26]`
"**Serial Number**"

**EMP-458** — `[SRC-B11 ¶27]`
"**Number of Units**"

**EMP-459** — `[SRC-B11 ¶28]`
"**Number of Packages**"

**EMP-460** — `[SRC-B11 ¶29]`
"How many machines there are, how many Packages."

**EMP-461** — `[SRC-B11 ¶30]`
"For example, it's possible we take one machine and three or four Nagle accompany it."

**EMP-462** — `[SRC-B11 ¶31]`
"**Weight**"

**EMP-463** — `[SRC-B11 ¶32]`
"Then that **Weight Unit** must also be specified — which is mainly Kilogram."

**EMP-464** — `[SRC-B11 ¶33]`
"And **Arrival Date** — the date we received it."

**EMP-465** — `[SRC-B11 ¶34]`
"**Yard**."

**EMP-466** — `[SRC-B11 ¶35]`
"Okay, here, for example, when we are selecting Port of Loading and, for example, Hamriyah — those
Yards that we previously entered in Master Data for Hamriyah — those Yards come up automatically,
of course."

**EMP-467** — `[SRC-B11 ¶36]`
"Meaning when we select the Port, automatically their Yard names come up and here we Select."

**EMP-468** — `[SRC-B11 ¶37]`
"Okay, the next Option is **Document Status**."

**EMP-469** — `[SRC-B11 ¶38]`
"Look, with what documents did this come and enter the Port?"

**EMP-470** — `[SRC-B11 ¶39]`
"For example, it had **EXID**, it had **BCC**, it was a **Local Transfer**."

**EMP-471** — `[SRC-B11 ¶40]`
"Now this, the guys enter manually — what type of Document it is."

**EMP-472** — `[SRC-B11 ¶41]`
"The next stage is its **Inspection** — its inspection."

**EMP-473** — `[SRC-B11 ¶42]`
"For example, generally the Dubai customs — when, look, you take delivery of a goods item, of
something, in the customs and you want to carry out loading — you must prepare its Documents, its
customs papers."

**EMP-474** — `[SRC-B11 ¶43]`
"Then, for example, you **Book** an inspection slot."

**EMP-475** — `[SRC-B11 ¶44]`
"Technically they say **Book Inspection**."

**EMP-476** — `[SRC-B11 ¶45]`
"You pay its amount and you also Book its time."

**EMP-477** — `[SRC-B11 ¶46]`
"And when its inspection time arrives, they carry out the inspection."

**EMP-478** — `[SRC-B11 ¶47]`
"And Pending too — the text itself."

**EMP-479** — `[SRC-B11 ¶48]`
"That Pending text itself — for example, you can consider it red — so that in that Load Status,
in that general section, for example, for example, in Yard Inventory it is specified that, look,
its Inspection has not been done."

**EMP-480** — `[SRC-B11 ¶49]`
"And its last option — of course — is **Loading Date / Loading Time** — its loading time, which we
specify: its Arrival Date was this, when was its Loading Time."

**EMP-481** — `[SRC-B11 ¶50]`
"That we need it when we want to pay its **Storage**, its warehousing — the **Number of Days** —
when we want to look at its Number of Days, to know how many days this has been in the Port and we
want to go and calculate its warehousing — we need to know this."

**EMP-482** — `[SRC-B11 ¶51]`
"Now we must consider a Comment here."

**EMP-483** — `[SRC-B11 ¶52]`
"Absolutely, absolutely, absolutely."

**EMP-484** — `[SRC-B11 ¶53]`
"Why?"

**EMP-485** — `[SRC-B11 ¶54]`
"Because, for example, sometimes a set of expenses are incurred for one machine, one customer —
and when it is brought into the Comment, this prevents it from being forgotten."

**EMP-486** — `[SRC-B11 ¶55]`
"Then these Comments — for example, where are they useful? For when we want to issue the customer's
statement in the Accounting section."

**EMP-487** — `[SRC-B11 ¶56]`
"That accountant sees these Comments."

**EMP-488** — `[SRC-B11 ¶57]`
"For example, they see that, look, this machine that came — we paid its Transport cost, we paid its
customs cost."

**EMP-489** — `[SRC-B11 ¶58]`
"If it needed any repairs inside the Port — for example, we did it, we paid for it."

**EMP-490** — `[SRC-B11 ¶59]`
"This, the operations guys write in the Comment section — meaning that employee to whose account
they are responsible for these things writes it in that Comment."

**EMP-491** — `[SRC-B11 ¶60]`
"And then that accountant, automatically, when they want to issue their statements, can read these
Comments."

**EMP-492** — `[SRC-B11 ¶61]`
"And there is no longer any need for asking questions and, for example, scattering here and there
and making inquiries and, you know, those things."

**EMP-493** — `[SRC-B11 ¶62]`
"These Comments."

**EMP-494** — `[SRC-B11 ¶63]`
"Okay, then after we've entered this data, the Cargo is Registered."

**EMP-495** — `[SRC-B11 ¶64]`
"For example, it comes into this List of the Cargos themselves."

**EMP-496** — `[SRC-B11 ¶65]`
"Okay, now that this Cargo List is written and it's specified that, look, this customer of ours —
now we have a List."

**EMP-497** — `[SRC-B11 ¶66]`
"For example, who are the Customers? Arash Alidadi, Kianoush Jowkar."

**EMP-498** — `[SRC-B11 ¶67]`
"Well, then it's specified — look, this machine is such-and-such, its Chassis Number is
such-and-such."

**EMP-499** — `[SRC-B11 ¶68]`
"Suppose, for example, Hamriyah to Khorramshahr."

**EMP-500** — `[SRC-B11 ¶69]`
"Okay, these must have a set of Filters inside them."

**EMP-501** — `[SRC-B11 ¶70]`
"Why? Because when, for example, I as management want to decide which destination to assign this
vessel, this craft to — meaning, for example, where to load and assign it to which destination —
this must specify for me that, look, we have 30 machines for Khorramshahr."

**EMP-502** — `[SRC-B11 ¶71]`
"For example, for destination Bushehr — suppose, for example, we have 10 machines. For destination
Bandar Abbas, for example, we have 10 machines."

**EMP-503** — `[SRC-B11 ¶72]`
"Okay, so it's natural that I immediately assign the vessel to Khorramshahr."

**EMP-504** — `[SRC-B11 ¶73]`
"Okay, when we want to do the Khorramshahr loading — suppose, look, the vessel has come and berthed
at one of the Hamriyah berths."

**EMP-505** — `[SRC-B11 ¶74]`
"Okay, here the employees gather the documents, they do the Inspection work."

**EMP-506** — `[SRC-B11 ¶75]`
"Okay, when they've done the Inspection work — in that Inspection section, for example, the state
is Done."

**EMP-507** — `[SRC-B11 ¶76]`
"Now you have to place a Select option, something there — that this employee there selects that its
Inspection has been done."

**EMP-508** — `[SRC-B11 ¶77]`
"Okay, the machines and Cargos whose Inspection has been done are the necessary condition for
entering into that Loading List's account."

**EMP-509** — `[SRC-B11 ¶78]`
"Now what is the Loading List?"

**EMP-510** — `[SRC-B11 ¶79]`
"A vessel — the vessel names that, for example, we previously entered in those Master Data — they
are useful to us here."

**EMP-511** — `[SRC-B11 ¶80]`
"We prepare a Loading List, we take a Print and hand it to the loading Operators, so they start
loading."

**EMP-512** — `[SRC-B11 ¶81]`
"Okay, now for example the Loading List option — the Loading List can help us with this: that,
look, if a machine has not been Inspected, automatically don't bring it for it — don't allow us to
select it for the Loading List."

**EMP-513** — `[SRC-B11 ¶82]`
"For example, give an Error."

**EMP-514** — `[SRC-B11 ¶83]`
"What should its Error be?"

**EMP-515** — `[SRC-B11 ¶84]`
"That, look, for example, we haven't done its Inspection."

**EMP-516** — `[SRC-B11 ¶85]`
"If they have done its Inspection and it has gone from the Pending state to the Done state and it
is registered — that is the precondition for us to be able to select it for the Loading List."

**EMP-517** — `[SRC-B11 ¶86]`
"Okay, suppose, for example, out of the total of our Yard Inventories that are fifty, for example
twenty of them are for Khorramshahr."

**EMP-518** — `[SRC-B11 ¶87]`
"Okay, out of those twenty that are for Khorramshahr, suppose twenty of them have had their
Inspection done and are ready to enter the Loading List."

**EMP-519** — `[SRC-B11 ¶88]`
"Okay, we prepare the Loading List."

**EMP-520** — `[SRC-B11 ¶89]`
"What must the Loading List include?"

**EMP-521** — `[SRC-B11 ¶90]`
"It includes a set of information that we entered previously, of course."

**EMP-522** — `[SRC-B11 ¶91]`
"Okay, for example:"

**EMP-523** — `[SRC-B11 ¶92]`
"Loading port, destination port, Description, Chassis Number, Serial Number, number of machines,
number of Packages, Weight, arrival date, Yard and those things."

**EMP-524** — `[SRC-B11 ¶93]`
"And its Inspection is Done."

**EMP-525** — `[SRC-B11 ¶94]`
"So that we take a Print of these and give it to the Operator — and the Operators know this machine
that is, for example, in such-and-such Yard in Hamriyah — its Inspection has also been done and it
is ready for loading."

**EMP-526** — `[SRC-B11 ¶95]`
"Okay, this List — for example those twenty — we took a Print and handed it over."

**EMP-527** — `[SRC-B11 ¶96]`
"Well, these have a set of other fine details too."

**EMP-528** — `[SRC-B11 ¶97]`
"Suppose, suppose that on the first night the vessel comes and we want to start loading — out of
the total of these 20 machines, now we want to prepare a Loading List and give it to the Operators
so they start loading."

**EMP-529** — `[SRC-B11 ¶98]`
"Then suppose that on the first night, for example, out of these 20, we Inspected 7 of them and 7
are ready for loading."

**EMP-530** — `[SRC-B11 ¶99]`
"Okay, this Loading List that we create — we Create it — 7 machines come into our Load List."

**EMP-531** — `[SRC-B11 ¶100]`
"We take a Print, we give it to the Operators to load."

**EMP-532** — `[SRC-B11 ¶101]`
"Okay, tomorrow we prepare the remaining 13 — for example tomorrow — again we say we Edit the same
Loading List, we also add those other 13 to it."

**EMP-533** — `[SRC-B11 ¶102]`
"We Print it in one go, we give it to the Operators so they know, for example, those 7 from
yesterday have been loaded, 13 others have also become ready for loading."

**EMP-534** — `[SRC-B11 ¶103]`
"Okay, when the loading is finished and the Operators announce to us that, for example, out of this
List of twenty you handed us, we managed to load 19 of them."

**EMP-535** — `[SRC-B11 ¶104]`
"For example, one of them for whatever reason we could not load — either there was no space, or it
was broken, or the Crane had a problem, or whatever."

**EMP-536** — `[SRC-B11 ¶105]`
"One of them remained."

**EMP-537** — `[SRC-B11 ¶106]`
"This one must have the ability to be removed from the Loading List and go back into the Yard
Inventory and that Cargo section — that same one — to remain available for, for example, the next
Trip, the next vessel, the next loading."

**EMP-538** — `[SRC-B11 ¶107]`
"Okay, once this Load List is completed and it's specified and Finalized and the Load List is
closed — or, for example, this vessel Mahdi 11 out of this total of, for example, 20 machines
available, has loaded 19 of them — okay, now these 19 go to the stage of issuing the Bill of
Lading and Manifest."

**EMP-539** — `[SRC-B11 ¶108]`
"Okay, these 19 that we have — well, each of them belongs to a Customer."

**EMP-540** — `[SRC-B11 ¶109]`
"Okay, now each Bill of Lading we want to issue:"

**EMP-541** — `[SRC-B11 ¶110]`
"Shipper, Consignee, Bill of Lading number."

**EMP-542** — `[SRC-B11 ¶111]`
"For example, the Bill of Lading number must be specified for each destination — for example,
according to the form we gave it, it should Generate it, of course."

**EMP-543** — `[SRC-B11 ¶112]`
"For example, for Khorramshahr we wrote — suppose:"

**EMP-544** — `[SRC-B11 ¶113]`
"**KHS/26-2/2026**"

**EMP-545** — `[SRC-B11 ¶114]`
"Or, for example, if we want to issue a Bill of Lading for Rajaee:"

**EMP-546** — `[SRC-B11 ¶115]`
"**RJS/26-10**"

**EMP-547** — `[SRC-B11 ¶116]`
"The dash… for example, this 10 is the Bill of Lading that we issued in the year 2026 for Rajaee."

**EMP-548** — `[SRC-B11 ¶117]`
"Okay, once we've also brought all the Details of the Bill of Lading — look, we entered the
Shippers previously in the Master Data."

**EMP-549** — `[SRC-B11 ¶118]`
"Here we Select."

**EMP-550** — `[SRC-B11 ¶119]`
"Consignee likewise — we entered it previously, we issue it, we select it."

**EMP-551** — `[SRC-B11 ¶120]`
"Notify Party likewise."

**EMP-552** — `[SRC-B11 ¶121]`
"The vessel name — the Voyage, of course, the system itself must automatically detect which trip
number of this vessel it is that we are… Khorramshahr…"

**EMP-553** — `[SRC-B11 ¶122]`
"Loading Port — we entered it previously — here we Select."

**EMP-554** — `[SRC-B11 ¶123]`
"Destination Port likewise."

**EMP-555** — `[SRC-B11 ¶124]`
"Okay, we get to that Bill of Lading format which, for example, has a **Quantity** section, has
quantity, has **Marks & Numbers**, has Description, has net weight, has gross weight, has **CBM**."

**EMP-556** — `[SRC-B11 ¶125]`
"Then at the bottom of it, for example, it has Total."

**EMP-557** — `[SRC-B11 ¶126]`
"Shipper, the goods, whatever the customer has in mind, should be stated in the Shipper."

**EMP-558** — `[SRC-B11 ¶127]`
"Then it has **Place of B/L Issue**."

**EMP-559** — `[SRC-B11 ¶128]`
"That **Freight Charges** — now the **Collect** or **Prepaid** section — it must have."

**EMP-560** — `[SRC-B11 ¶129]`
"Date — for example, the Bill of Lading issue date."

**EMP-561** — `[SRC-B11 ¶130]`
"That Stamp section of it — or, for example, a set of explanations that the conventions and
international laws of the Bill of Lading — according to that same form we give it, the Bill of
Lading should be issued."

**EMP-562** — `[SRC-B11 ¶131]`
"Okay, the Bill of Lading… the first thing when the Bill of Lading is issued — it must be in
**Draft** state."

**EMP-563** — `[SRC-B11 ¶132]`
"That, for example, its Watermark section says **DRAFT** and we send it to the customer to check."

**EMP-564** — `[SRC-B11 ¶133]`
"If, for example, it needs corrections — adding or removing a set of information — they announce it
to us."

**EMP-565** — `[SRC-B11 ¶134]`
"And then, when it's Final, finished, Approved — the Bill of Lading is issued and comes out of the
Draft state."

**EMP-566** — `[SRC-B11 ¶135]`
"Okay, once it has come out of the Draft state — well, now afterwards what do we want to do?"

**EMP-567** — `[SRC-B11 ¶136]`
"We want to issue the Manifest, of course."

**EMP-568** — `[SRC-B11 ¶137]`
"We want to issue the Manifest and hand it to, for example, the vessel."

**EMP-569** — `[SRC-B11 ¶138]`
"Okay, the Manifest too — according to that same format of ours that, for example, we enter into
the system."

**EMP-570** — `[SRC-B11 ¶139]`
"Vessel name, its Voyage, for example its Manifest Number according to that same format we want,
date, for example loading, loading port, exit port, and a set of other Data."

**EMP-571** — `[SRC-B11 ¶140]`
"Also, for example, we have put our own shipping company's name and specifications in the middle
there."

**EMP-572** — `[SRC-B11 ¶141]`
"If you want, we Upload that same Format that we have into the system."

**EMP-573** — `[SRC-B11 ¶142]`
"Okay, its Titles too — of course, which include, for example, the row, the description of the
goods — then, for example, Consignee, Shipper, weight, quantity — which in the end the number of
Manifest pages — for example two pages, three pages, whatever it is."

**EMP-574** — `[SRC-B11 ¶143]`
"The last page also gives us a Total Weight, Total Quantity — that, look, Total this many machines
and this many Packages with this much Weight have been loaded, for example."

**EMP-575** — `[SRC-B11 ¶144]`
"Okay, when we want… whether the PDF of the Bill of Lading — this must give us an output, of
course, for the Bills of Lading."

**EMP-576** — `[SRC-B11 ¶145]`
"Now either it gives us an Excel output and a PDF output."

**EMP-577** — `[SRC-B11 ¶146]`
"Whichever of them is needed now."

**EMP-578** — `[SRC-B11 ¶147]`
"If we want PDF, it gives PDF; if we also want Excel, it gives Excel."

**EMP-579** — `[SRC-B11 ¶148]`
"Or, for example, it directly takes a PDF."

**EMP-580** — `[SRC-B11 ¶149]`
"When we want to take a PDF, those Stamps and Marks and signatures must automatically be in the
system."

**EMP-581** — `[SRC-B11 ¶150]`
"Meaning there, itself — when we want to take the PDF of the Bill of Lading — it has applied those
Stamps itself; meaning they are ready."

**EMP-582** — `[SRC-B11 ¶151]`
"But when we want to take a Print — meaning we want to apply a live Stamp or a live seal — then it
must automatically remove those."

**EMP-583** — `[SRC-B11 ¶152]`
"So that, for example, that live Stamp is applied."

**EMP-584** — `[SRC-B11 ¶153]`
"Okay, we send the Bill of Lading to the customer."

**EMP-585** — `[SRC-B11 ¶154]`
"Likewise the Manifest — which we Print, apply a live stamp, and hand to the captain."

**EMP-586** — `[SRC-B11 ¶155]`
"We also send a PDF copy of it to the destination Agent."

---

### Source `SRC-B12` — `audio_2026-09-14_05-05-37.txt` (05:05:37) — Manifest structure and totals

---

**EMP-587** — `[SRC-B12 ¶1]`
"What is the Manifest information like?"

**EMP-588** — `[SRC-B12 ¶2]`
"The Manifest information — at its header there is a set of Data: the vessel name — now either
**Tug & Barge** or that it is a **Landing Craft** — one name and its **Voyage**, the loading port,
the discharge port and the Manifest number."

**EMP-589** — `[SRC-B12 ¶3]`
"The Manifest number — which each time, uniquely, each time the system must automatically, according
to the format we give it, give a new number itself."

**EMP-590** — `[SRC-B12 ¶4]`
"Okay, our Manifest Titles."

**EMP-591** — `[SRC-B12 ¶5]`
"After these top Details — the row — is the Bill of Lading number."

**EMP-592** — `[SRC-B12 ¶6]`
"Okay, according to those Bills of Lading that have been issued — for example, for this vessel, for
this Khorramshahr — this must, in order, for example number 1, 2, 3, 4 — like that, according to
those Bill of Lading numbers, it should write."

**EMP-593** — `[SRC-B12 ¶7]`
"Then we get to the **description of the goods**, their Shipper, their Consignee."

**EMP-594** — `[SRC-B12 ¶8]`
"Okay, these Bills of Lading that were issued previously — they have a description of the goods, of
course."

**EMP-595** — `[SRC-B12 ¶9]`
"For example, one such-and-such machine — **Excavator PC400** — Excavator with this Chassis
Number."

**EMP-596** — `[SRC-B12 ¶10]`
"Then its Shipper, its Consignee, its quantity, its weight."

**EMP-597** — `[SRC-B12 ¶11]`
"Its quantity is the total, of course."

**EMP-598** — `[SRC-B12 ¶12]`
"Meaning, for example, its machine must be specified, its Nagle must also be specified —
separately."

**EMP-599** — `[SRC-B12 ¶13]`
"That, look, for example, this is one machine, plus two Nagle."

**EMP-600** — `[SRC-B12 ¶14]`
"Then at the end it also gives us a Total — that, for example, this many machines and this many
Nagle and the weight, in total this much, have been loaded onto this vessel."

---
### Source `SRC-B13` — `audio_2026-09-14_05-06-35.txt` (05:06:35) — Accounting: Jobs, Invoices, VAT, Ledger, Documents, Release/Delivery, Agent portal, Reports

---

**EMP-601** — `[SRC-B13 ¶1]`
"Okay, we get to the **Accounting** section."

**EMP-602** — `[SRC-B13 ¶2]`
"Okay, the Accounting section here really… for example, we have many Options."

**EMP-603** — `[SRC-B13 ¶3]`
"First of all — for every Invoice — meaning before we want to issue the Invoice — we must consider
a **Job** to the account — for example, writing a Note for every machine or now whatever work we
take delivery of."

**EMP-604** — `[SRC-B13 ¶4]`
"It assigns a **Job Number** to it."

**EMP-605** — `[SRC-B13 ¶5]`
"Okay, we specify that Job Number's Customer — and now **ETDZ** — every expense we incurred for the
Cargo, come, put it into this Job Number."

> **TN:** The employer says "ETDZ" here and "ETOZ" in `EMP-054` / `EMP-408`. Same concept,
> inconsistent transliteration in the transcripts.

**EMP-606** — `[SRC-B13 ¶6]`
"Okay, the next stage is these Invoices."

**EMP-607** — `[SRC-B13 ¶7]`
"Okay, we can issue these Invoices in two ways."

**EMP-608** — `[SRC-B13 ¶8]`
"One is that those Bills of Lading that have been issued and that we have sent to the customer —
their Invoice must automatically come into **Draft** — it becomes like a Draft state."

**EMP-609** — `[SRC-B13 ¶9]`
"So that then I come and check it against the related Job Numbers — Match all of them."

**EMP-610** — `[SRC-B13 ¶10]`
"And now, for example, in the format we have:"

**EMP-611** — `[SRC-B13 ¶11]`
"**Description of goods, Rate, quantity, VAT and the total amount which includes VAT.**"

**EMP-612** — `[SRC-B13 ¶12]`
"Then in its Total section, we write the total amount separately, the VAT amount separately."

**EMP-613** — `[SRC-B13 ¶13]`
"For example, like:"

**EMP-614** — `[SRC-B13 ¶14]`
"**Subtotal, VAT and Total Amount**"

**EMP-615** — `[SRC-B13 ¶15]`
"This too we must consider."

**EMP-616** — `[SRC-B13 ¶16]`
"Now this… how do I say it?"

**EMP-617** — `[SRC-B13 ¶17]`
"There are a set of invoices that have VAT, and a set of invoices that don't have VAT."

**EMP-618** — `[SRC-B13 ¶18]`
"The ones that have VAT — later, for example, at that time when we want to send the tax list — the
system should automatically show us that, look, in this quarter — for example February, March and
April — these twenty invoices had VAT, their VAT amount is this much, the total VAT amount is, for
example, this much."

**EMP-619** — `[SRC-B13 ¶19]`
"This much we collected."

**EMP-620** — `[SRC-B13 ¶20]`
"Or, for example, such-and-such invoices included VAT — we paid their VAT."

**EMP-621** — `[SRC-B13 ¶21]`
"So that when we want to send this VAT report, we know how much VAT we paid, how much VAT we
received."

**EMP-622** — `[SRC-B13 ¶22]`
"That this is needed for the quarterly reports."

**EMP-623** — `[SRC-B13 ¶23]`
"Okay, these Invoices — one is that those Bills of Lading that we issued — here after being
**Issued** — meaning after being issued:"

**EMP-624** — `[SRC-B13 ¶24]`
"**Invoice Draft**"

**EMP-625** — `[SRC-B13 ¶25]`
"Draft Invoice — 4, 5 Lines — whatever Rate — based on the Job Numbers we previously assigned — we
can issue these Invoices."

**EMP-626** — `[SRC-B13 ¶26]`
"There is another model of this Invoice — which is the normal Invoice."

**EMP-627** — `[SRC-B13 ¶27]`
"Now, for example, suppose we want to issue an Invoice for a customer just like that, outside the
topic of the Bill of Lading and Job Number and those things."

**EMP-628** — `[SRC-B13 ¶28]`
"Okay, this too I must consider."

**EMP-629** — `[SRC-B13 ¶29]`
"Now the Invoice that is issued — each Invoice belongs to a Customer, of course."

**EMP-630** — `[SRC-B13 ¶30]`
"This automatically goes and sits in the Customer's Profile and Ledger account — as **Debit**."

**EMP-631** — `[SRC-B13 ¶31]`
"It sits as Debit."

**EMP-632** — `[SRC-B13 ¶32]`
"So that in total — when now a payment of something wants to take place — it goes into the Ledger
account and sits as **Credit**."

**EMP-633** — `[SRC-B13 ¶33]`
"After these Invoices…"

**EMP-634** — `[SRC-B13 ¶34]`
"Now these Invoices must have a set of Details, of course."

**EMP-635** — `[SRC-B13 ¶35]`
"The number of this Invoice."

**EMP-636** — `[SRC-B13 ¶36]`
"For example, the number of this Invoice."

**EMP-637** — `[SRC-B13 ¶37]`
"Then let me say this… which customer it belongs to."

**EMP-638** — `[SRC-B13 ¶38]`
"The Bill of Lading specifications — its description."

**EMP-639** — `[SRC-B13 ¶39]`
"Or, for example, if it was previously specified for that Bill of Lading — it was issued for this
Bill of Lading — which Manifest it belongs to."

**EMP-640** — `[SRC-B13 ¶40]`
"Its issue date."

**EMP-641** — `[SRC-B13 ¶41]`
"Its payment deadline date."

**EMP-642** — `[SRC-B13 ¶42]`
"Now, if after this Invoice, for example, it has been paid — the amount that has been paid from it,
or it is a Partial Payment, or it hasn't been paid — these should be specified."

**EMP-643** — `[SRC-B13 ¶43]`
"Then **Proforma Invoice**."

**EMP-644** — `[SRC-B13 ¶44]`
"This Invoice — which now, based on that same Format of ours — we Upload its Excel, for example —
and we enter the Data based on that Format we want."

**EMP-645** — `[SRC-B13 ¶45]`
"**Quotation** likewise."

**EMP-646** — `[SRC-B13 ¶46]`
"**Delivery Order, Release Order, Vouchers, Salary** and that **Ledger** section."

**EMP-647** — `[SRC-B13 ¶47]`
"The Ledger section should not necessarily all be for those Customers."

**EMP-648** — `[SRC-B13 ¶48]`
"Why?"

**EMP-649** — `[SRC-B13 ¶49]`
"Because, for example, when we want to give these annual Tax reports — or suppose we want to record
the office expenses — this Ledger — for example, the office expenses must also be in that same
Ledger, of course."

**EMP-650** — `[SRC-B13 ¶50]`
"So we understand how much VAT we spent — we record its daily entries."

**EMP-651** — `[SRC-B13 ¶51]`
"The **Salary** section too — of course, we define the employees."

**EMP-652** — `[SRC-B13 ¶52]`
"Like a Salary state."

**EMP-653** — `[SRC-B13 ¶53]`
"A **Salary Slip** must be issued for each of their months."

**EMP-654** — `[SRC-B13 ¶54]`
"The Voucher section — of course, we have two types of Voucher."

**EMP-655** — `[SRC-B13 ¶55]`
"One is the **Payment Voucher**, one is the **Receipt Voucher**."

**EMP-656** — `[SRC-B13 ¶56]`
"It should be specified which Customer it is."

**EMP-657** — `[SRC-B13 ¶57]`
"Meaning whether we want to make a Payment, or we want to give a Receipt — meaning we have received
money."

**EMP-658** — `[SRC-B13 ¶58]`
"First of all, this Customer must be specified — which Customer this belongs to."

**EMP-659** — `[SRC-B13 ¶59]`
"And then, once we've specified that this money we took — for example, was for this specific
Invoice, was for a specific Bill of Lading number — if we specified these, then, of course, it
automatically goes and sits in their account."

**EMP-660** — `[SRC-B13 ¶60]`
"And if we haven't written anything — for example, it shouldn't give an Error — it goes and sits in
their Ledger system as Credit."

**EMP-661** — `[SRC-B13 ¶61]`
"Which then gives the Balance accordingly."

**EMP-662** — `[SRC-B13 ¶62]`
"That, look, for this Customer — for example, we now create a Ledger Statement for them."

**EMP-663** — `[SRC-B13 ¶63]`
"Which we then give a range to — for example, such-and-such month to such-and-such month,
such-and-such date to such-and-such date."

**EMP-664** — `[SRC-B13 ¶64]`
"It gives us the Statement — that, look, this many statements have been issued for them, how much
they have paid, for example how much their Balance is."

**EMP-665** — `[SRC-B13 ¶65]`
"Okay, the **Release Order** and **Delivery Order** section."

**EMP-666** — `[SRC-B13 ¶66]`
"Delivery Order relates to the goods that we brought — for example, we discharged them in our own
port and now we want to issue a Delivery Order and give it to the customer, of course."

**EMP-667** — `[SRC-B13 ¶67]`
"Together with the other documents we hand it to the customer — so they go and deliver it in the
name of the Consignee — so they go and get the machine, now come and clear their Cargo and take
it."

**EMP-668** — `[SRC-B13 ¶68]`
"This Delivery Order likewise — of course."

**EMP-669** — `[SRC-B13 ¶69]`
"For example, its Customer should be specified."

**EMP-670** — `[SRC-B13 ¶70]`
"Each of these has a number, has a date."

**EMP-671** — `[SRC-B13 ¶71]`
"And now the Delivery Order that is specific to that Port — that, for example, we state inside it
that the Port is such-and-such."

**EMP-672** — `[SRC-B13 ¶72]`
"And that account — a standard Delivery Order state — is issued and Printed, is Stamped, and
together with the other documents is handed to the customer."

**EMP-673** — `[SRC-B13 ¶73]`
"Okay, the **Release Order** section."

**EMP-674** — `[SRC-B13 ¶74]`
"The Bills of Lading that are issued — the Manifest — and then the craft moves, reaches the
destination, is discharged."

**EMP-675** — `[SRC-B13 ¶75]`
"There a warehouse receipt is issued and the documents stay with the Agent until such time as, for
example, we announce this Release to that Agent — that, look, such-and-such Bill of Lading with
these specifications has been **Released** — and you can hand the documents to the Consignee too."

**EMP-676** — `[SRC-B13 ¶76]`
"Now here we must consider a mechanism — that we ourselves, to the account, give the Agents an
access."

**EMP-677** — `[SRC-B13 ¶77]`
"They see their own port."

**EMP-678** — `[SRC-B13 ¶78]`
"Likewise, separately, they see their own Bills of Lading and Manifests — for example, their own
port's."

**EMP-679** — `[SRC-B13 ¶79]`
"Meaning look — Khorramshahr only sees what belongs to Khorramshahr, Bushehr only sees what belongs
to Bushehr, Bandar Abbas only sees what belongs to Bandar Abbas."

**EMP-680** — `[SRC-B13 ¶80]`
"There they see, of course, that, look, they see the Bills of Lading related to themselves."

**EMP-681** — `[SRC-B13 ¶81]`
"In the Release Order section too — of course, it is specified."

**EMP-682** — `[SRC-B13 ¶82]`
"For example, there is a Bill of Lading number — now, for example, Consignee, description of the
goods, and that section, for example, now the tick that needs to be specified as a Mark."

**EMP-683** — `[SRC-B13 ¶83]`
"Or, for example, its Status writes **Released**."

**EMP-684** — `[SRC-B13 ¶84]`
"These things."

**EMP-685** — `[SRC-B13 ¶85]`
"Okay, its payment section should also be specified for the accountant."

**EMP-686** — `[SRC-B13 ¶86]`
"This must also have a Payment section."

**EMP-687** — `[SRC-B13 ¶87]`
"It should be specified that, look, this document we released — the customer has paid in full, it's
Paid — the Invoice related to this Release Order has been paid."

**EMP-688** — `[SRC-B13 ¶88]`
"Or, for example, they took it on credit — it's Unpaid."

**EMP-689** — `[SRC-B13 ¶89]`
"Or that it's a **Partial Payment** — they paid a part of it, and they must pay a part of it
later."

**EMP-690** — `[SRC-B13 ¶90]`
"This should be specified."

**EMP-691** — `[SRC-B13 ¶91]`
"So that later we can, for example, quickly Follow-up."

**EMP-692** — `[SRC-B13 ¶92]`
"That if this Invoice has been Released and they took it on credit — for example, now within one or
two weeks — it gives us a warning there, so we can talk to the customer there so they make their
payment."

**EMP-693** — `[SRC-B13 ¶93]`
"Okay, now we get to the **Reports** stage."

**EMP-694** — `[SRC-B13 ¶94]`
"Reports."

**EMP-695** — `[SRC-B13 ¶95]`
"We must specify a mechanism — that for every vessel — meaning every Manifest that is closed towards
a destination — now Khorramshahr, Bushehr, Bandar Abbas, wherever — towards whatever destination
this Manifest is closed — we consider the vessel's expenses."

**EMP-696** — `[SRC-B13 ¶96]`
"For example, vessel charter, **Port Use** costs, **Handling**, **Lashing**, and now its
miscellaneous costs — we consider them."

**EMP-697** — `[SRC-B13 ¶97]`
"Okay, what does its income become?"

**EMP-698** — `[SRC-B13 ¶98]`
"The total sum of the Invoice amounts — the statements issued for its Bills of Lading — becomes its
income."

**EMP-699** — `[SRC-B13 ¶99]`
"So that when you subtract these from each other, the profit and loss of one vessel, of one
Manifest is obtained."

**EMP-700** — `[SRC-B13 ¶100]`
"This Report is very important — that we know, look, for each Manifest that has been closed, how
much we spent, how much, for example, income we had."

**EMP-701** — `[SRC-B13 ¶101]`
"Now its profit and loss is specified."

**EMP-702** — `[SRC-B13 ¶102]`
"So that when we want to, for example, do the annual Tax — without trouble and using a few Filters
we can bring out that profit and loss statement and those things in general."

---

### Source `SRC-B14` — `audio_2026-09-14_05-06-46.txt` (05:06:46) — Payment Voucher ID card and signature

---

**EMP-703** — `[SRC-B14 ¶1]`
"For example, in the **Voucher** section — when we want to pay money — the **Payment** section must
have two blank places, two Options built into it."

**EMP-704** — `[SRC-B14 ¶2]`
"That, for example, that **ID Card** of the recipient — as, for example, a document and receipt —
should be built in there."

**EMP-705** — `[SRC-B14 ¶3]`
"Which now either we take a photo, or we Upload it, or, for example, it Take Photos from the back
and front of their ID Card."

**EMP-706** — `[SRC-B14 ¶4]`
"When we want to give them the money and issue a receipt for them — we Upload their ID Card or its
photo, or we take a photo of it — it should be uploaded there."

**EMP-707** — `[SRC-B14 ¶5]`
"And then we take a signature from the recipient."

---

### Source `SRC-B15` — `audio_2026-09-14_05-07-11.txt` (05:07:11) — Salary Slip ID card and signature

---

**EMP-708** — `[SRC-B15 ¶1]`
"The **Salary Slip** section is the same way."

**EMP-709** — `[SRC-B15 ¶2]`
"If, for example, one or two days before the end of each month, when we prepare the Salary Slip —
the place for the scan of that employee's **ID Card** — front and back — must be there."

**EMP-710** — `[SRC-B15 ¶3]`
"Which now either it is as an Upload — meaning they Upload the ready photo from within the system —
or they take a photo directly through the Camera, from front and back — and it is in that Salary
Slip of theirs."

**EMP-711** — `[SRC-B15 ¶4]`
"So that when the Print is taken, the output is taken — those ID Cards are specified — and that
employee signs below it."

**EMP-712** — `[SRC-B15 ¶5]`
"Meaning they have actually received the money."

---

### Source `SRC-B16` — `audio_2026-09-14_05-07-29.txt` (05:07:29) — "Company Archive" title

---

**EMP-713** — `[SRC-B16 ¶1]`
"Title: 'Company Archive'"

> **TN:** This clip is a single 38-byte line. It is a content heading the employer dictated for the
> UI. It implies an archive / company-archive area, but no further detail is given anywhere in the
> transcript set. Recorded as an unresolved topic (see `open-questions.md`, ARCH-01).

---

### Source `SRC-B17` — `audio_2026-09-14_05-07-41.txt` (05:07:41) — General Journal, daily entries, office expenses

---

**EMP-714** — `[SRC-B17 ¶1]`
"One of the other items is the daily entries."

**EMP-715** — `[SRC-B17 ¶2]`
"For example, when those Customer Profiles, the Customer Ledgers — it must have the ability that,
even without issuing this Invoice, we can, for example, add to it there."

**EMP-716** — `[SRC-B17 ¶3]`
"For example, a **General Journal** — money that, for example, we paid to a person or received from
a person, outside the scope of the main work — and we want, now, for example, it to be as a loan —
we want to bring it into their Ledger."

**EMP-717** — `[SRC-B17 ¶4]`
"Such an Option should be put in the Ledger — that we can add a General Journal to it."

**EMP-718** — `[SRC-B17 ¶5]`
"Now, if we have made a payment to a person — we bring it into their account, into that Ledger
section of theirs — as **Debit**."

**EMP-719** — `[SRC-B17 ¶6]`
"And if a person has paid something to us — we bring it into their account as **Credit**."

**EMP-720** — `[SRC-B17 ¶7]`
"Those daily expenses and office expenses and the company's running costs — we must definitely put a
mechanism in place for them, so these expenses are recorded, and at the end of the year they are
deducted from the income as company expenses."

---

### Source `SRC-B18` — `audio_2026-09-14_05-07-52.txt` (05:07:52) — Output templates and formats

---

**EMP-721** — `[SRC-B18 ¶1]`
"At every stage where we need an output — now whether a PDF output, or an Excel output, or a Print —
we have specific formats and specific shapes."

**EMP-722** — `[SRC-B18 ¶2]`
"For example, we have our own company's special formats — which, for example, we Upload — so it
understands what model of output we want in the **Loading List** section, what Print we want."

**EMP-723** — `[SRC-B18 ¶3]`
"Or, for example, the **Invoice** section, the **Delivery Order** section, the **Release Order**
section, the **Salary Slip** section, **Voucher**, **Payment**, **Receipt** — each of these has a
specific format."

**EMP-724** — `[SRC-B18 ¶4]`
"Or, for example, the **Ledger** section — which Options we want — when we want to take a Print —
what the appearance of that Print should be."

**EMP-725** — `[SRC-B18 ¶5]`
"We Upload these."

---

## Appendix A — Coverage checklist

| Source key | File | Paragraphs covered | Statement IDs |
|---|---|---|---|
| `SRC-A1` | `part1_0-15.txt` | ¶1–¶75 | EMP-001 – EMP-075 |
| `SRC-A2` | `part2_15-end.txt` | ¶1–¶109 | EMP-076 – EMP-184 |
| `SRC-B01` | `audio_2026-09-14_04-57-33.txt` | ¶1–¶54 | EMP-185 – EMP-238 |
| `SRC-B02` | `audio_2026-09-14_04-59-40.txt` | ¶1–¶32 | EMP-239 – EMP-270 |
| `SRC-B03` | `audio_2026-09-14_05-00-18.txt` | ¶1–¶9 | EMP-271 – EMP-279 |
| `SRC-B04` | `audio_2026-09-14_05-00-51.txt` | ¶1–¶10 | EMP-280 – EMP-289 |
| `SRC-B05` | `audio_2026-09-14_05-01-56.txt` | ¶1–¶55 | EMP-290 – EMP-344 |
| `SRC-B06` | `audio_2026-09-14_05-02-13.txt` | ¶1–¶13 | EMP-345 – EMP-357 |
| `SRC-B07` | `audio_2026-09-14_05-02-40.txt` | ¶1–¶4 | EMP-358 – EMP-361 |
| `SRC-B08` | `audio_2026-09-14_05-02-53.txt` | ¶1–¶11 | EMP-362 – EMP-372 |
| `SRC-B09` | `audio_2026-09-14_05-03-16.txt` | ¶1–¶11 | EMP-373 – EMP-383 |
| `SRC-B10` | `audio_2026-09-14_05-03-32.txt` | ¶1–¶48 | EMP-384 – EMP-431 |
| `SRC-B11` | `audio_2026-09-14_05-05-14.txt` | ¶1–¶155 | EMP-432 – EMP-586 |
| `SRC-B12` | `audio_2026-09-14_05-05-37.txt` | ¶1–¶14 | EMP-587 – EMP-600 |
| `SRC-B13` | `audio_2026-09-14_05-06-35.txt` | ¶1–¶102 | EMP-601 – EMP-702 |
| `SRC-B14` | `audio_2026-09-14_05-06-46.txt` | ¶1–¶5 | EMP-703 – EMP-707 |
| `SRC-B15` | `audio_2026-09-14_05-07-11.txt` | ¶1–¶5 | EMP-708 – EMP-712 |
| `SRC-B16` | `audio_2026-09-14_05-07-29.txt` | ¶1 | EMP-713 |
| `SRC-B17` | `audio_2026-09-14_05-07-41.txt` | ¶1–¶7 | EMP-714 – EMP-720 |
| `SRC-B18` | `audio_2026-09-14_05-07-52.txt` | ¶1–¶5 | EMP-721 – EMP-725 |

**Total: 20 files, 725 numbered statements.**

## Appendix B — Topic index (quick lookup by statement IDs)

| Topic | Primary statements |
|---|---|
| Company identity, ports of operation, fleet ownership | EMP-001 – EMP-005 |
| Customer as the central entity; historical manual codes | EMP-006 – EMP-009, EMP-197 – EMP-200, EMP-384 – EMP-431 |
| Yard / warehouse inventory | EMP-010 – EMP-024, EMP-162 – EMP-166, EMP-271 – EMP-289 |
| Load List / Loading List | EMP-014 – EMP-022, EMP-047 – EMP-049, EMP-302 – EMP-311, EMP-508 – EMP-537 |
| Inspection gating | EMP-014, EMP-077 – EMP-078, EMP-472 – EMP-479, EMP-504 – EMP-516 |
| Manifest | EMP-024 – EMP-033, EMP-168 – EMP-172, EMP-567 – EMP-574, EMP-587 – EMP-600 |
| Bill of Lading | EMP-034 – EMP-040, EMP-540 – EMP-566 |
| Partner / forwarder B/Ls in one Manifest | EMP-068 – EMP-074 |
| Job Number / ETOZ costing | EMP-054 – EMP-067, EMP-176 – EMP-178, EMP-411 – EMP-414, EMP-603 – EMP-605 |
| Cargo registration fields | EMP-075 – EMP-076, EMP-432 – EMP-481 |
| Cargo Comments | EMP-079 – EMP-088, EMP-482 – EMP-493 |
| Destination filters for vessel allocation | EMP-042 – EMP-046, EMP-094 – EMP-097, EMP-499 – EMP-503 |
| Invoice structure, Tax Invoice, VAT | EMP-098 – EMP-125, EMP-606 – EMP-642 |
| Ledger, Debit/Credit, Balance, Statement | EMP-130 – EMP-137, EMP-421 – EMP-429, EMP-662 – EMP-664 |
| General Journal, office/daily expenses | EMP-649 – EMP-650, EMP-714 – EMP-720 |
| Release Order, agent notification, credit releases, alerts | EMP-138 – EMP-160, EMP-673 – EMP-692 |
| Delivery Order | EMP-162 – EMP-163, EMP-665 – EMP-672 |
| Agent portal and destination scoping | EMP-153 – EMP-159, EMP-676 – EMP-681 |
| Vouchers, ID card capture, signature | EMP-654 – EMP-661, EMP-703 – EMP-707 |
| Salary and Salary Slip | EMP-651 – EMP-653, EMP-708 – EMP-712 |
| Proforma / Quotation | EMP-643 – EMP-645 |
| Reports: voyage/manifest P&L, VAT report | EMP-126 – EMP-129, EMP-617 – EMP-622, EMP-693 – EMP-702 |
| Output templates, PDF/Excel/Print, stamp rules | EMP-037 – EMP-040, EMP-169 – EMP-172, EMP-575 – EMP-586, EMP-721 – EMP-725 |
| Sidebar / navigation structure | EMP-185 – EMP-194 |
| Master data definitions (Ports, Yards, Vessels, Shippers, Consignees, Agents) | EMP-239 – EMP-383 |
| Company Archive (title only) | EMP-713 |

## Appendix C — Known gaps in this record

1. **No audio was available.** Only the Persian transcripts were available. Where the transcript
   itself marks a passage as unintelligible, this record marks it `[inaudible]`; it cannot be
   recovered from the materials in this repository.
2. **`/home/duna/dunaData/transcripts/` does not exist in this repository.** Several existing
   project documents (notably `docs/current-plan/00-project-authority.md`) name that path as the
   "highest authority" transcript source. It is absent from this checkout; the only transcript
   copies available are the 20 files under `docs/duna-analysis/requirements/`. If the employer has a
   fuller transcript set, statements from it are **not** represented here.
3. **Group A ↔ Group B ordering is inferred, not evidenced** (see §0.2).
4. **`SRC-B16`** is a bare title with no explanatory content.
5. Some clips are separated by gaps of 1–2 minutes (e.g. `SRC-B09` 05:03:32 → `SRC-B11` 05:05:14,
   a 1m42s gap). It is not known whether additional voice material existed in those gaps and was
   not transcribed.
6. **The employer repeatedly promises formats that are not in this repository:**
   "I'll send you the format of these Invoices" (EMP-107), "we have our own company's special
   formats — which we Upload" (EMP-722). Only 7 PDF documents were supplied
   (see [`../02-business-documents/document-catalog.md`](../02-business-documents/document-catalog.md)),
   and none of them is a blank/uploadable template.
