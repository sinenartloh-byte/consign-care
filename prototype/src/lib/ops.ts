/**
 * Pure business operations on the in-memory data model.
 * Every function mutates the draft `d` it receives (the store clones before calling).
 */
import type {
  Accrual,
  Case,
  CaseStatus,
  CustomerPO,
  Data,
  DocItem,
  IncomingPO,
  Invoice,
  OcrDraft,
  PRItem,
  PurchaseRequest,
  Quotation,
  Requisition,
  RequisitionItem,
  UsageSource,
} from "./types";

/* ------------------------------------------------------------------ clock */

/** The demo is frozen on 17 Oct 2026 (time of day is real). */
export const DEMO_TODAY = "2026-10-17";
export const DEMO_MONTH = "2026-10";

export function demoNow(): Date {
  const r = new Date();
  return new Date(2026, 9, 17, r.getHours(), r.getMinutes(), r.getSeconds());
}
export const nowIso = () => demoNow().toISOString();

export function addDays(date: string, days: number): string {
  const [y, m, dd] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ------------------------------------------------------------------ numbering */

function maxSeq(nos: string[], re: RegExp): number {
  let max = 0;
  for (const n of nos) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

export function nextCaseNo(d: Data) {
  return `C${maxSeq(d.cases.map((c) => c.no), /^C(\d+)$/) + 1}`;
}
/** Quotations run one sequence from QT-00001, never reset by year. */
export function nextQuotationNo(d: Data) {
  const n = maxSeq(d.quotations.map((q) => q.no), /^QT-(\d+)$/) + 1;
  return `QT-${String(n).padStart(5, "0")}`;
}
export function nextRequisitionNo(d: Data) {
  const n = maxSeq(d.requisitions.map((q) => q.no), /^RQ-2026-(\d+)$/) + 1;
  return `RQ-2026-${String(n).padStart(3, "0")}`;
}
export function nextPRNo(d: Data) {
  const n = maxSeq(d.purchaseRequests.map((q) => q.no), /^PR-2026-(\d+)$/) + 1;
  return `PR-2026-${String(n).padStart(3, "0")}`;
}
export function nextInvoiceNo(d: Data) {
  const n = maxSeq(d.invoices.map((q) => q.no), /^INV-2026-(\d+)$/) + 1;
  return `INV-2026-${String(n).padStart(4, "0")}`;
}
export function nextSupplierPoNo(d: Data) {
  const n = maxSeq(
    d.purchaseRequests.map((q) => q.supplierPoNo ?? ""),
    /^SPO-2026-(\d+)$/,
  ) + 1;
  return `SPO-2026-${String(n).padStart(3, "0")}`;
}
export function nextGrNo(d: Data) {
  const n = maxSeq(d.movements.map((m) => m.refDocNo), /^GR-(\d+)$/) + 1;
  return `GR-${String(n).padStart(3, "0")}`;
}

/* ------------------------------------------------------------------ helpers */

export const hospitalLoc = (hospitalId: string) => `loc-${hospitalId}`;
export const WAREHOUSE = "loc-wh";

export function priceFor(d: Data, hospitalId: string, productId: string): number {
  const pl = d.priceLists.find((p) => p.hospitalId === hospitalId && p.productId === productId);
  if (pl) return pl.contractPrice;
  return d.products.find((p) => p.id === productId)?.listPrice ?? 0;
}

export function log(
  d: Data,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  ref: string,
  hospitalId?: string,
  at: string = nowIso(),
) {
  d.activity.unshift({ id: uid("act"), actorId, action, entity, entityId, ref, hospitalId, at });
}

export function notify(
  d: Data,
  userId: string,
  action: string,
  ref: string,
  href: string,
  hospitalId?: string,
  at: string = nowIso(),
) {
  d.notifications.unshift({ id: uid("ntf"), userId, action, ref, href, hospitalId, at, read: false });
}

function balance(d: Data, locationId: string, lotId: string) {
  let b = d.stock.find((s) => s.locationId === locationId && s.lotId === lotId);
  if (!b) {
    b = { locationId, lotId, qty: 0 };
    d.stock.push(b);
  }
  return b;
}

/** Lots of a product at a location with qty > 0, first-expiry-first-out */
export function fefo(d: Data, locationId: string, productId: string) {
  return d.stock
    .filter((s) => s.locationId === locationId && s.qty > 0)
    .map((s) => ({ s, lot: d.lots.find((l) => l.id === s.lotId)! }))
    .filter((x) => x.lot && x.lot.productId === productId)
    .sort((a, b) => a.lot.expiryDate.localeCompare(b.lot.expiryDate));
}

/** Take qty out of a location, FEFO. Returns lot ids used. */
function takeStock(
  d: Data,
  actor: string,
  locationId: string,
  productId: string,
  qty: number,
  type: "OUT" | "TRANSFER",
  toLocationId: string | undefined,
  refDocType: string,
  refDocNo: string,
  at: string,
  preferLotId?: string,
): string[] {
  const used: string[] = [];
  let remaining = qty;
  // never pick an expired lot on its own (it waits for write-off); a lot the user scanned is still taken as given
  const lots = fefo(d, locationId, productId).filter((x) => x.lot.id === preferLotId || x.lot.expiryDate >= at.slice(0, 10));
  if (preferLotId) {
    const i = lots.findIndex((x) => x.lot.id === preferLotId);
    if (i > 0) lots.unshift(...lots.splice(i, 1));
  }
  for (const { s, lot } of lots) {
    if (remaining <= 0) break;
    const take = Math.min(s.qty, remaining);
    s.qty -= take;
    remaining -= take;
    used.push(lot.id);
    if (toLocationId) balance(d, toLocationId, lot.id).qty += take;
    d.movements.unshift({
      id: uid("mv"),
      type,
      lotId: lot.id,
      productId,
      qty: take,
      fromLocationId: locationId,
      toLocationId,
      refDocType,
      refDocNo,
      at,
      by: actor,
    });
  }
  if (remaining > 0) {
    // Not enough consignment stock: record against newest lot (shows negative balance – flagged in UI)
    const lot =
      d.lots.filter((l) => l.productId === productId).sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0];
    if (lot) {
      balance(d, locationId, lot.id).qty -= remaining;
      if (toLocationId) balance(d, toLocationId, lot.id).qty += remaining;
      used.push(lot.id);
      d.movements.unshift({
        id: uid("mv"),
        type,
        lotId: lot.id,
        productId,
        qty: remaining,
        fromLocationId: locationId,
        toLocationId,
        refDocType,
        refDocNo,
        at,
        by: actor,
      });
    }
  }
  return used;
}

export function receiveStock(
  d: Data,
  actor: string,
  productId: string,
  qty: number,
  lotNo: string,
  expiryDate: string,
  locationId: string,
  refDocType: string,
  refDocNo: string,
  at: string,
  type: "IN" | "ADJUST" = "IN",
) {
  let lot = d.lots.find((l) => l.productId === productId && l.lotNo === lotNo);
  if (!lot) {
    lot = { id: uid("lot"), productId, lotNo, expiryDate };
    d.lots.push(lot);
  }
  balance(d, locationId, lot.id).qty += qty;
  d.movements.unshift({
    id: uid("mv"),
    type,
    lotId: lot.id,
    productId,
    qty,
    toLocationId: locationId,
    refDocType,
    refDocNo,
    at,
    by: actor,
  });
  return lot.id;
}

export function setCaseStatus(c: Case, status: CaseStatus, at: string = nowIso()) {
  c.status = status;
  c.history[status] = at;
}

function caseOf(d: Data, id?: string) {
  return id ? d.cases.find((c) => c.id === id) : undefined;
}

/* ------------------------------------------------------------------ cases */

export interface NewUsageLine {
  productId: string;
  qty: number;
  lotId?: string;
  source: UsageSource;
  serialNo?: string;
}

export function createCase(
  d: Data,
  actor: string,
  input: OcrDraft & { items: NewUsageLine[]; repId?: string; poNo?: string },
): Case {
  const at = nowIso();
  const c: Case = {
    id: uid("case"),
    no: nextCaseNo(d),
    hospitalId: input.hospitalId,
    repId: input.repId ?? actor,
    doctorId: input.doctorId || undefined,
    patientHn: input.patientHn || undefined,
    patientName: input.patientName || undefined,
    patientAn: input.patientAn || undefined,
    procedure: input.procedure || undefined,
    caseDate: input.caseDate,
    status: "DRAFT",
    photos: input.photos,
    createdAt: at,
    history: { DRAFT: at },
  };
  d.cases.unshift(c);
  log(d, actor, "caseCreated", "CASE", c.id, c.no, c.hospitalId, at);
  if (input.items.length) {
    recordUsage(d, actor, c, input.items, at);
    quoteCase(d, actor, c, at);
  }
  if (input.poNo) c.note = `PO: ${input.poNo}`;
  return c;
}

/**
 * Quotations need no approval, so one is made the moment usage is recorded: every item used, at the hospital's
 * contract price, no discount. It is approved on creation and the case moves to QUOTED, ready to send.
 */
export function quoteCase(d: Data, actor: string, c: Case, at = nowIso()) {
  if (d.quotations.some((q) => q.caseId === c.id && q.status !== "REJECTED")) return;
  const qty = new Map<string, number>();
  for (const u of d.usage) if (u.caseId === c.id) qty.set(u.productId, (qty.get(u.productId) ?? 0) + u.qty);
  if (!qty.size) return;
  const items: DocItem[] = [...qty].map(([productId, n]) => ({
    productId,
    unit: d.products.find((p) => p.id === productId)?.unit ?? "piece",
    qty: n,
    unitPrice: priceFor(d, c.hospitalId, productId),
  }));
  return createQuotation(d, actor, { caseId: c.id, hospitalId: c.hospitalId, date: at.slice(0, 10), items, discountPct: 0 });
}

export function recordUsage(d: Data, actor: string, c: Case, items: NewUsageLine[], at = nowIso()) {
  for (const it of items) {
    if (it.qty <= 0) continue;
    const lots = takeStock(
      d,
      actor,
      hospitalLoc(c.hospitalId),
      it.productId,
      it.qty,
      "OUT",
      undefined,
      "CASE",
      c.no,
      at,
      it.lotId,
    );
    d.usage.push({
      id: uid("use"),
      caseId: c.id,
      productId: it.productId,
      lotId: it.lotId ?? lots[0],
      qty: it.qty,
      unitPrice: priceFor(d, c.hospitalId, it.productId),
      source: it.source,
      serialNo: it.serialNo,
    });
  }
  setCaseStatus(c, "USAGE_RECORDED", at);
  log(d, actor, "usageRecorded", "CASE", c.id, c.no, c.hospitalId, at);
  notify(d, "*", "usageRecorded", c.no, `/admin/cases/${c.id}`, c.hospitalId, at);
}

export function updateCase(
  d: Data,
  actor: string,
  caseId: string,
  patch: Partial<Pick<Case, "doctorId" | "patientHn" | "patientName" | "procedure" | "caseDate" | "note">>,
) {
  const c = caseOf(d, caseId);
  if (!c) return;
  Object.assign(c, patch);
  log(d, actor, "caseUpdated", "CASE", c.id, c.no, c.hospitalId);
}

export function cancelCase(d: Data, actor: string, caseId: string) {
  const c = caseOf(d, caseId);
  if (!c || ["BILLED", "CLOSED"].includes(c.status)) return;
  setCaseStatus(c, "CANCELLED");
  log(d, actor, "caseCancelled", "CASE", c.id, c.no, c.hospitalId);
}

/* ------------------------------------------------------------------ quotation */

export const VAT_RATE = 0.07;

export function totals(items: DocItem[], discountPct: number) {
  const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const discount = Math.round(subtotal * discountPct) / 100;
  const net = subtotal - discount;
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  return { subtotal, discount, net, vat, total: Math.round((net + vat) * 100) / 100 };
}

export function createQuotation(
  d: Data,
  actor: string,
  input: {
    caseId?: string;
    hospitalId: string;
    date: string;
    validUntil?: string;
    items: DocItem[];
    discountPct: number;
    note?: string;
  },
): Quotation {
  const t = totals(input.items, input.discountPct);
  const q: Quotation = {
    id: uid("qt"),
    no: nextQuotationNo(d),
    caseId: input.caseId,
    hospitalId: input.hospitalId,
    date: input.date,
    validUntil: input.validUntil ?? addDays(input.date, 30),
    items: input.items,
    discountPct: input.discountPct,
    subtotal: t.subtotal,
    discount: t.discount,
    vat: t.vat,
    total: t.total,
    status: "APPROVED", // no approval step: every quotation is approved when it is created
    createdBy: actor,
    note: input.note,
  };
  d.quotations.unshift(q);
  log(d, actor, "quotationCreated", "QUOTATION", q.id, q.no, q.hospitalId);
  const c = caseOf(d, input.caseId);
  if (c && ["DRAFT", "USAGE_RECORDED"].includes(c.status)) {
    setCaseStatus(c, "QUOTED");
    notify(d, c.repId, "quotationCreated", c.no, `/m/cases/${c.id}`, c.hospitalId);
  }
  return q;
}

/** Only a Sales Manager decides; any other persona's decision is recorded under the manager. */
export function approverFor(d: Data, actor: string): string {
  const me = d.users.find((u) => u.id === actor);
  if (me?.role === "MANAGER") return actor;
  return d.users.find((u) => u.role === "MANAGER")?.id ?? actor;
}

/** Only an admin can reject a quotation, and only before the hospital accepts it with a PO. */
export function canForceReject(d: Data, actor: string, q: Quotation) {
  return d.users.find((u) => u.id === actor)?.role === "ADMIN" && ["APPROVED", "SENT"].includes(q.status);
}

/**
 * An admin overrides the automatic approval. The hospital's pending PO reply for it is dropped, and the case goes back
 * to QUOTED with no live quotation, so a new one can be issued.
 */
export function forceRejectQuotation(d: Data, actor: string, id: string, reason: string) {
  const q = d.quotations.find((x) => x.id === id);
  if (!q || !canForceReject(d, actor, q)) return;
  const at = nowIso();
  q.status = "REJECTED";
  q.rejected = { by: actor, at, reason };
  d.incomingPos = d.incomingPos.filter((p) => p.quotationNo !== q.no);
  log(d, actor, "quotationRejected", "QUOTATION", q.id, q.no, q.hospitalId, at);
  const c = caseOf(d, q.caseId);
  if (c) {
    if (c.status === "WAITING_PO") setCaseStatus(c, "QUOTED", at);
    notify(d, c.repId, "quotationRejected", q.no, `/m/cases/${c.id}`, c.hospitalId, at);
  }
}

const PO_PREFIX: Record<string, string> = {
  "h-bkk": "BKH",
  "h-bmr": "BRH",
  "h-smv": "SVH",
  "h-pyt": "PT2",
  "h-pys": "PYS",
};

export function poNumberFor(hospitalId: string, quotationNo: string) {
  const seq = Number(quotationNo.split("-").pop() ?? 0);
  return `${PO_PREFIX[hospitalId] ?? "HOS"}-PO-26-${String(1000 + seq * 7).padStart(4, "0")}`;
}

export function sendQuotation(d: Data, actor: string, id: string, channel: "EMAIL" | "LINE"): boolean {
  const q = d.quotations.find((x) => x.id === id);
  if (!q || !["APPROVED", "SENT"].includes(q.status)) return false;
  q.status = "SENT";
  q.sentVia = Array.from(new Set([...(q.sentVia ?? []), channel]));
  log(d, actor, channel === "EMAIL" ? "quotationEmailed" : "quotationLined", "QUOTATION", q.id, q.no, q.hospitalId);
  const c = caseOf(d, q.caseId);
  if (c && ["QUOTED", "USAGE_RECORDED"].includes(c.status)) {
    setCaseStatus(c, "WAITING_PO");
  }
  // Simulation: the hospital purchasing dept answers with a PO document
  const poNo = poNumberFor(q.hospitalId, q.no);
  if (!d.incomingPos.some((p) => p.quotationNo === q.no) && !d.customerPos.some((p) => p.quotationId === q.id)) {
    d.incomingPos.unshift({
      poNo,
      hospitalId: q.hospitalId,
      quotationNo: q.no,
      amount: q.total,
      date: DEMO_TODAY,
      channel,
    });
    notify(d, "*", "poArrived", poNo, `/admin/pos?po=${encodeURIComponent(poNo)}`, q.hospitalId);
  }
  return true;
}

export function findIncomingPo(d: Data, poNo: string): IncomingPO | undefined {
  const k = poNo.trim().toUpperCase();
  return d.incomingPos.find((p) => p.poNo.toUpperCase() === k);
}

export function recordPo(
  d: Data,
  actor: string,
  input: { poNo: string; quotationId: string; amount: number; date: string; method: "SCAN" | "TYPED" },
): CustomerPO | undefined {
  const q = d.quotations.find((x) => x.id === input.quotationId);
  if (!q) return;
  const po: CustomerPO = {
    id: uid("po"),
    poNo: input.poNo.trim().toUpperCase(),
    hospitalId: q.hospitalId,
    quotationId: q.id,
    caseId: q.caseId,
    date: input.date,
    amount: input.amount,
    recordedBy: actor,
    method: input.method,
  };
  d.customerPos.unshift(po);
  d.incomingPos = d.incomingPos.filter((p) => p.poNo.toUpperCase() !== po.poNo);
  q.status = "ACCEPTED";
  const c = caseOf(d, q.caseId);
  if (c && ["QUOTED", "WAITING_PO", "USAGE_RECORDED"].includes(c.status)) {
    setCaseStatus(c, "PO_RECEIVED");
    notify(d, c.repId, "poRecorded", c.no, `/m/cases/${c.id}`, c.hospitalId);
  }
  log(d, actor, "poRecorded", "PO", po.id, po.poNo, po.hospitalId);
  return po;
}

/* ------------------------------------------------------------------ requisition */

export function createRequisition(
  d: Data,
  actor: string,
  input: {
    departmentId: string;
    purpose: string;
    caseId?: string;
    hospitalId?: string;
    items: RequisitionItem[];
  },
): Requisition {
  const c = caseOf(d, input.caseId);
  const r: Requisition = {
    id: uid("rq"),
    no: nextRequisitionNo(d),
    departmentId: input.departmentId,
    purpose: input.purpose,
    requesterId: actor,
    status: "SUBMITTED",
    caseId: input.caseId,
    hospitalId: input.hospitalId ?? c?.hospitalId,
    items: input.items,
    createdAt: nowIso(),
  };
  d.requisitions.unshift(r);
  log(d, actor, "requisitionSubmitted", "REQUISITION", r.id, r.no, r.hospitalId);
  notify(d, "u-somchai", "approvalRequested", r.no, `/admin/approvals`, r.hospitalId);
  return r;
}

export function decideRequisition(d: Data, by: string, id: string, approve: boolean, note?: string) {
  const r = d.requisitions.find((x) => x.id === id);
  if (!r || r.status !== "SUBMITTED") return;
  const actor = approverFor(d, by);
  r.status = approve ? "APPROVED" : "REJECTED";
  r.approvedBy = actor;
  d.approvals.unshift({
    id: uid("apv"),
    entity: "REQUISITION",
    entityId: r.id,
    approverId: actor,
    decision: approve ? "APPROVED" : "REJECTED",
    note,
    at: nowIso(),
  });
  log(d, actor, approve ? "requisitionApproved" : "requisitionRejected", "REQUISITION", r.id, r.no, r.hospitalId);
}

export function issueRequisition(d: Data, actor: string, id: string) {
  const r = d.requisitions.find((x) => x.id === id);
  if (!r || r.status !== "APPROVED") return;
  const at = nowIso();
  for (const it of r.items) {
    if (r.hospitalId) {
      takeStock(d, actor, WAREHOUSE, it.productId, it.qty, "TRANSFER", hospitalLoc(r.hospitalId), "REQUISITION", r.no, at);
    } else {
      takeStock(d, actor, WAREHOUSE, it.productId, it.qty, "OUT", undefined, "REQUISITION", r.no, at);
    }
  }
  r.status = "ISSUED";
  r.issuedAt = at;
  log(d, actor, "requisitionIssued", "REQUISITION", r.id, r.no, r.hospitalId, at);
  const c = caseOf(d, r.caseId);
  if (c && c.status === "PO_RECEIVED") {
    setCaseStatus(c, "REQUISITIONED", at);
    notify(d, c.repId, "requisitionIssued", c.no, `/m/cases/${c.id}`, c.hospitalId, at);
  }
}

/* ------------------------------------------------------------------ near expiry (Sales EP) */

export function nextAccrualNo(d: Data) {
  const n = maxSeq(d.accruals.map((a) => a.no), /^ACR-2026-(\d+)$/) + 1;
  return `ACR-2026-${String(n).padStart(3, "0")}`;
}

/**
 * Near-exp, option 1: ask for a replacement. A requisition to the warehouse for the same product, the near-exp lot
 * stays at the hospital until the new stock arrives.
 */
export function requestNearExpReplacement(
  d: Data,
  actor: string,
  input: { hospitalId: string; productId: string; lotId: string; qty: number },
): Requisition | undefined {
  const lot = d.lots.find((l) => l.id === input.lotId);
  if (!lot || input.qty <= 0) return undefined;
  const department = d.departments.find((x) => x.id !== "d-wh")?.id ?? "";
  return createRequisition(d, actor, {
    departmentId: department,
    purpose: `Near exp: LOT ${lot.lotNo} (EXP ${lot.expiryDate})`,
    hospitalId: input.hospitalId,
    items: [{ productId: input.productId, qty: input.qty, reason: "Near exp" }],
  });
}

/**
 * Near-exp, option 2: accrue. The units leave the hospital's inventory (On shelf) at once and wait in PO wait for the
 * hospital's PO. They are not billed until the PO arrives.
 */
export function accrueNearExp(
  d: Data,
  actor: string,
  input: { hospitalId: string; productId: string; lotId: string; qty: number },
  at = nowIso(),
): Accrual | undefined {
  const lot = d.lots.find((l) => l.id === input.lotId);
  if (!lot || input.qty <= 0) return undefined;
  const no = nextAccrualNo(d);
  takeStock(d, actor, hospitalLoc(input.hospitalId), input.productId, input.qty, "OUT", undefined, "ACCRUAL", no, at, input.lotId);
  const acc: Accrual = {
    id: uid("acr"),
    no,
    hospitalId: input.hospitalId,
    productId: input.productId,
    lotId: input.lotId,
    qty: input.qty,
    unitPrice: priceFor(d, input.hospitalId, input.productId),
    status: "PO_WAIT",
    reason: `Near exp: LOT ${lot.lotNo} (EXP ${lot.expiryDate})`,
    createdBy: actor,
    createdAt: at,
  };
  d.accruals.unshift(acc);
  log(d, actor, "accrualCreated", "ACCRUAL", acc.id, acc.no, input.hospitalId, at);
  return acc;
}

/* ------------------------------------------------------------------ purchase request */

export function warehouseQty(d: Data, productId: string) {
  return d.stock
    .filter((s) => s.locationId === WAREHOUSE)
    .filter((s) => d.lots.find((l) => l.id === s.lotId)?.productId === productId)
    .reduce((a, s) => a + s.qty, 0);
}

/** Items whose warehouse stock is below reorder point, grouped by supplier */
export function suggestPR(d: Data) {
  const out: { supplierId: string; items: (PRItem & { current: number; reorderPoint: number })[] }[] = [];
  for (const p of d.products) {
    const cur = warehouseQty(d, p.id);
    if (cur >= p.reorderPoint) continue;
    const pending = d.purchaseRequests
      .filter((r) => ["SUBMITTED", "APPROVED", "ORDERED"].includes(r.status))
      .some((r) => r.items.some((i) => i.productId === p.id));
    if (pending) continue;
    let g = out.find((x) => x.supplierId === p.supplierId);
    if (!g) {
      g = { supplierId: p.supplierId, items: [] };
      out.push(g);
    }
    g.items.push({
      productId: p.id,
      qty: Math.max(p.reorderPoint * 2 - cur, 1),
      unitPrice: Math.round(p.listPrice * 0.6 * 100) / 100,
      current: cur,
      reorderPoint: p.reorderPoint,
    });
  }
  return out;
}

export function createPR(
  d: Data,
  actor: string,
  input: { supplierId: string; items: PRItem[]; note?: string; neededBy: string; submit?: boolean },
): PurchaseRequest {
  const pr: PurchaseRequest = {
    id: uid("pr"),
    no: nextPRNo(d),
    supplierId: input.supplierId,
    requesterId: actor,
    status: input.submit === false ? "DRAFT" : "SUBMITTED",
    items: input.items,
    note: input.note,
    neededBy: input.neededBy,
    createdAt: nowIso(),
  };
  d.purchaseRequests.unshift(pr);
  log(d, actor, "prSubmitted", "PR", pr.id, pr.no);
  if (pr.status === "SUBMITTED") notify(d, "u-somchai", "approvalRequested", pr.no, `/admin/approvals`);
  return pr;
}

export function submitPR(d: Data, actor: string, id: string) {
  const pr = d.purchaseRequests.find((x) => x.id === id);
  if (!pr || pr.status !== "DRAFT") return;
  pr.status = "SUBMITTED";
  log(d, actor, "prSubmitted", "PR", pr.id, pr.no);
}

export function decidePR(d: Data, by: string, id: string, approve: boolean, note?: string) {
  const pr = d.purchaseRequests.find((x) => x.id === id);
  if (!pr || pr.status !== "SUBMITTED") return;
  const actor = approverFor(d, by);
  pr.status = approve ? "APPROVED" : "REJECTED";
  pr.approvedBy = actor;
  d.approvals.unshift({
    id: uid("apv"),
    entity: "PR",
    entityId: pr.id,
    approverId: actor,
    decision: approve ? "APPROVED" : "REJECTED",
    note,
    at: nowIso(),
  });
  log(d, actor, approve ? "prApproved" : "prRejected", "PR", pr.id, pr.no);
}

export function orderPR(d: Data, actor: string, id: string) {
  const pr = d.purchaseRequests.find((x) => x.id === id);
  if (!pr || pr.status !== "APPROVED") return;
  pr.status = "ORDERED";
  pr.supplierPoNo = nextSupplierPoNo(d);
  log(d, actor, "prOrdered", "PR", pr.id, pr.supplierPoNo);
}

export function receivePR(d: Data, actor: string, id: string) {
  const pr = d.purchaseRequests.find((x) => x.id === id);
  if (!pr || pr.status !== "ORDERED") return;
  const at = nowIso();
  const grNo = nextGrNo(d);
  pr.items.forEach((it, i) => {
    const prod = d.products.find((p) => p.id === it.productId);
    const lotNo = `${(prod?.ref ?? "LOT").replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase()}2610${String.fromCharCode(65 + i)}`;
    receiveStock(d, actor, it.productId, it.qty, lotNo, addDays(DEMO_TODAY, 730), WAREHOUSE, "GR", grNo, at);
  });
  pr.status = "RECEIVED";
  pr.grNo = grNo;
  log(d, actor, "goodsReceived", "PR", pr.id, grNo);
}

/* ------------------------------------------------------------------ billing */

export function issueInvoice(d: Data, actor: string, caseId: string): Invoice | undefined {
  const c = caseOf(d, caseId);
  if (!c || !["PO_RECEIVED", "REQUISITIONED"].includes(c.status)) return;
  const po = d.customerPos.find((p) => p.caseId === c.id);
  const q = d.quotations.find((x) => x.caseId === c.id && x.status !== "REJECTED");
  const amount =
    po?.amount ??
    q?.total ??
    totals(
      d.usage.filter((u) => u.caseId === c.id).map((u) => ({ productId: u.productId, unit: "", qty: u.qty, unitPrice: u.unitPrice })),
      0,
    ).total;
  const inv: Invoice = {
    id: uid("inv"),
    no: nextInvoiceNo(d),
    caseId: c.id,
    customerPoId: po?.id,
    hospitalId: c.hospitalId,
    amount,
    issueDate: DEMO_TODAY,
    dueDate: addDays(DEMO_TODAY, 30),
    status: "ISSUED",
  };
  d.invoices.unshift(inv);
  setCaseStatus(c, "BILLED");
  log(d, actor, "invoiceIssued", "INVOICE", inv.id, inv.no, c.hospitalId);
  notify(d, c.repId, "invoiceIssued", c.no, `/m/cases/${c.id}`, c.hospitalId);
  return inv;
}

export function markPaid(d: Data, actor: string, invoiceId: string) {
  const inv = d.invoices.find((x) => x.id === invoiceId);
  if (!inv || !["ISSUED", "OVERDUE"].includes(inv.status)) return;
  inv.status = "PAID";
  inv.paidAt = nowIso();
  log(d, actor, "invoicePaid", "INVOICE", inv.id, inv.no, inv.hospitalId);
  const c = caseOf(d, inv.caseId);
  if (c) {
    setCaseStatus(c, "CLOSED");
    log(d, actor, "caseClosed", "CASE", c.id, c.no, c.hospitalId);
    notify(d, c.repId, "caseClosed", c.no, `/m/cases/${c.id}`, c.hospitalId);
  }
}

export function voidInvoice(d: Data, actor: string, invoiceId: string) {
  const inv = d.invoices.find((x) => x.id === invoiceId);
  if (!inv || inv.status === "PAID") return;
  inv.status = "VOID";
  const c = caseOf(d, inv.caseId);
  if (c && c.status === "BILLED") {
    const prev: CaseStatus = c.history.REQUISITIONED ? "REQUISITIONED" : "PO_RECEIVED";
    c.status = prev;
    delete c.history.BILLED;
  }
  log(d, actor, "invoiceVoided", "INVOICE", inv.id, inv.no, inv.hospitalId);
}

/* ------------------------------------------------------------------ master data */

export type MasterCollection = "hospitals" | "doctors" | "products" | "suppliers" | "priceLists" | "users";

export function upsertMaster<T extends { id: string }>(d: Data, actor: string, col: MasterCollection, item: T) {
  const arr = d[col] as unknown as T[];
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.push(item);
  log(d, actor, i >= 0 ? "masterUpdated" : "masterCreated", col.toUpperCase(), item.id, col);
  if (col === "hospitals" && !d.locations.some((l) => l.hospitalId === item.id)) {
    const h = item as unknown as { id: string; name: string; nameTh: string };
    d.locations.push({
      id: hospitalLoc(h.id),
      type: "HOSPITAL",
      name: `Consignment – ${h.name}`,
      nameTh: `คลังฝากขาย ${h.nameTh}`,
      hospitalId: h.id,
    });
  }
}

export function deleteMaster(d: Data, actor: string, col: MasterCollection, id: string) {
  const arr = d[col] as unknown as { id: string }[];
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
  log(d, actor, "masterDeleted", col.toUpperCase(), id, col);
}

/* ------------------------------------------------------------------ notifications */

export function markAllRead(d: Data, userId: string) {
  d.notifications.forEach((n) => {
    if (n.userId === userId || n.userId === "*") n.read = true;
  });
}
