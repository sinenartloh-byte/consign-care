import type { Case, CaseStatus, Data, Lang, Lot, Product } from "./types";
import { DEMO_MONTH, DEMO_TODAY, daysBetween, hospitalLoc, totals, WAREHOUSE } from "./ops";

export const OPEN_EXCLUDED: CaseStatus[] = ["CLOSED", "CANCELLED"];
export const WAITING_PO: CaseStatus[] = ["QUOTED", "WAITING_PO"];
export const WAITING_BILLING: CaseStatus[] = ["PO_RECEIVED", "REQUISITIONED"];

export const isOpen = (c: Case) => !OPEN_EXCLUDED.includes(c.status);
export const inMonth = (date: string) => date.startsWith(DEMO_MONTH);

export function name(o: { name: string; nameTh?: string } | undefined, lang: Lang) {
  if (!o) return "-";
  return lang === "th" && o.nameTh ? o.nameTh : o.name;
}

export function caseUsage(d: Data, caseId: string) {
  return d.usage.filter((u) => u.caseId === caseId);
}

export function caseValue(d: Data, caseId: string) {
  const items = caseUsage(d, caseId).map((u) => ({ productId: u.productId, unit: "", qty: u.qty, unitPrice: u.unitPrice }));
  return totals(items, 0).total;
}

export function caseQuotation(d: Data, caseId: string) {
  return d.quotations.find((q) => q.caseId === caseId && q.status !== "REJECTED");
}
export function casePo(d: Data, caseId: string) {
  return d.customerPos.find((p) => p.caseId === caseId);
}
export function caseRequisition(d: Data, caseId: string) {
  return d.requisitions.find((r) => r.caseId === caseId && r.status !== "REJECTED");
}
export function caseInvoice(d: Data, caseId: string) {
  return d.invoices.find((i) => i.caseId === caseId && i.status !== "VOID");
}

export function caseStats(d: Data, cases: Case[]) {
  const usageMonth = cases
    .filter((c) => inMonth(c.caseDate) && c.status !== "CANCELLED")
    .reduce((s, c) => s + caseUsage(d, c.id).reduce((a, u) => a + u.qty, 0), 0);
  return {
    open: cases.filter(isOpen).length,
    casesMonth: cases.filter((c) => inMonth(c.caseDate) && c.status !== "CANCELLED").length,
    waitingPo: cases.filter((c) => WAITING_PO.includes(c.status)).length,
    waitingBilling: cases.filter((c) => WAITING_BILLING.includes(c.status)).length,
    usageMonth,
  };
}

export function hospitalStats(d: Data, hospitalId: string) {
  return caseStats(d, d.cases.filter((c) => c.hospitalId === hospitalId));
}

/** Used in a case but not billed yet: the revenue to accrue. */
export const ACCRUAL: CaseStatus[] = ["USAGE_RECORDED", "QUOTED", "WAITING_PO", "PO_RECEIVED", "REQUISITIONED"];
export const NEAR_EXP_DAYS = 90;

/** Consignment stock at the given hospitals, one row per lot and hospital, with days to expiry (negative = expired). */
export function accountExpiry(d: Data, hospitalIds: string[]) {
  return hospitalIds
    .flatMap((hid) =>
      d.stock
        .filter((s) => s.locationId === hospitalLoc(hid) && s.qty > 0)
        .map((s) => {
          const lot = d.lots.find((l) => l.id === s.lotId)!;
          return { hospitalId: hid, qty: s.qty, lot, product: d.products.find((p) => p.id === lot?.productId)!, daysLeft: daysBetween(DEMO_TODAY, lot.expiryDate) };
        }),
    )
    .filter((x) => x.lot && x.product)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Rep home tiles: everything across the hospitals the rep is responsible for, not only the rep's own cases. */
export function accountStats(d: Data, hospitalIds: string[]) {
  const cases = d.cases.filter((c) => hospitalIds.includes(c.hospitalId));
  const usageMonth = cases
    .filter((c) => inMonth(c.caseDate) && c.status !== "CANCELLED")
    .reduce((s, c) => s + caseUsage(d, c.id).reduce((a, u) => a + u.qty, 0), 0);
  const exp = accountExpiry(d, hospitalIds);
  return {
    usageMonth,
    quotation: cases.filter((c) => WAITING_PO.includes(c.status)).length,
    accrual: cases.filter((c) => ACCRUAL.includes(c.status)).reduce((s, c) => s + caseValue(d, c.id), 0),
    writeOff: exp.filter((x) => x.daysLeft < 0).reduce((s, x) => s + x.qty, 0),
    nearExp: exp.filter((x) => x.daysLeft >= 0 && x.daysLeft <= NEAR_EXP_DAYS).reduce((s, x) => s + x.qty, 0),
  };
}

export function repStats(d: Data, userId: string) {
  return caseStats(d, d.cases.filter((c) => c.repId === userId));
}

export function productQty(d: Data, productId: string, locationId?: string) {
  return d.stock
    .filter((s) => (!locationId || s.locationId === locationId))
    .filter((s) => d.lots.find((l) => l.id === s.lotId)?.productId === productId)
    .reduce((a, s) => a + s.qty, 0);
}

export function warehouseStock(d: Data, productId: string) {
  return productQty(d, productId, WAREHOUSE);
}
export function consignmentStock(d: Data, hospitalId: string, productId: string) {
  return productQty(d, productId, hospitalLoc(hospitalId));
}

/** Lots with qty > 0 somewhere that expire within `days` of the demo date */
export function expiringLots(d: Data, days = 90) {
  return d.stock
    .filter((s) => s.qty > 0)
    .map((s) => {
      const lot = d.lots.find((l) => l.id === s.lotId)!;
      return { ...s, lot, product: d.products.find((p) => p.id === lot?.productId)!, daysLeft: lot ? daysBetween(DEMO_TODAY, lot.expiryDate) : 9999 };
    })
    .filter((x) => x.lot && x.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function revenueWaitingBilling(d: Data) {
  return d.cases
    .filter((c) => WAITING_BILLING.includes(c.status))
    .reduce((s, c) => s + (casePo(d, c.id)?.amount ?? caseValue(d, c.id)), 0);
}

export function pendingApprovals(d: Data) {
  return {
    requisitions: d.requisitions.filter((r) => r.status === "SUBMITTED"),
    prs: d.purchaseRequests.filter((r) => r.status === "SUBMITTED"),
  };
}

/** Usage rows joined with case info, newest first */
export function usageRows(d: Data) {
  return d.usage
    .map((u) => {
      const c = d.cases.find((x) => x.id === u.caseId)!;
      return { u, c, product: d.products.find((p) => p.id === u.productId)!, lot: d.lots.find((l) => l.id === u.lotId) };
    })
    .filter((r) => r.c && r.c.status !== "CANCELLED")
    .sort((a, b) => b.c.caseDate.localeCompare(a.c.caseDate) || b.c.no.localeCompare(a.c.no));
}

/** Decode a scanned barcode: GS1 (01)GTIN(17)YYMMDD(10)LOT, plain GTIN/EAN, product REF or lot no */
/** Hospital consignment sticker: "REF LOT SERIAL", e.g. "410105 21004417 560121" */
export const STICKER_RE = /^([A-Z0-9][A-Z0-9-]{2,})\s+(\d{6,10})\s+(\d{4,8})$/i;

export function parseSticker(raw: string) {
  const m = raw.trim().replace(/\s+/g, " ").match(STICKER_RE);
  return m ? { ref: m[1].toUpperCase(), lotNo: m[2], serialNo: m[3] } : undefined;
}

export function parseBarcode(d: Data, raw: string): { product?: Product; lot?: Lot; exp?: string; serialNo?: string; lotNo?: string } {
  const code = raw.trim();
  const st = parseSticker(code);
  if (st) {
    const product = d.products.find((p) => p.ref.toUpperCase() === st.ref);
    const lot = product ? d.lots.find((l) => l.productId === product.id && l.lotNo === st.lotNo) : undefined;
    return { product, lot, exp: lot?.expiryDate, serialNo: st.serialNo, lotNo: st.lotNo };
  }
  let gtin: string | undefined;
  let lotNo: string | undefined;
  let exp: string | undefined;
  const gs1 = code.replace(/[()]/g, "");
  const m = gs1.match(/^01(\d{14})(?:17(\d{6}))?(?:10(.+))?$/);
  if (m) {
    gtin = m[1];
    if (m[2]) exp = `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4, 6)}`;
    lotNo = m[3];
  }
  const product =
    d.products.find((p) => gtin && p.gtin === gtin) ??
    d.products.find((p) => p.gtin === code || p.ref.toUpperCase() === code.toUpperCase());
  let lot = product ? d.lots.find((l) => l.productId === product.id && l.lotNo === lotNo) : undefined;
  if (!product) {
    lot = d.lots.find((l) => l.lotNo.toUpperCase() === code.toUpperCase());
    if (lot) return { product: d.products.find((p) => p.id === lot!.productId), lot, exp: lot.expiryDate };
  }
  if (product && !lot) {
    lot = d.lots
      .filter((l) => l.productId === product.id)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  }
  return { product, lot, exp: exp ?? lot?.expiryDate };
}

export function gs1For(gtin: string, lotNo: string, expiry: string) {
  const [y, m, dd] = expiry.split("-");
  return `(01)${gtin.padStart(14, "0")}(17)${y.slice(2)}${m}${dd}(10)${lotNo}`;
}
