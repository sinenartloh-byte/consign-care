import type { Extraction } from "./extract";
export type Lang = "th" | "en";

export type Role =
  | "SALES_REP"
  | "SALES_ADMIN"
  | "MANAGER"
  | "WAREHOUSE"
  | "PURCHASING"
  | "ACCOUNTING"
  | "ADMIN";

export interface User {
  id: string;
  name: string;
  nameTh: string;
  email: string;
  role: Role;
  phone: string;
  hospitalIds: string[];
}

export interface Hospital {
  id: string;
  code: string;
  name: string;
  nameTh: string;
  address: string;
  taxId: string;
  contactEmail: string;
  lineGroupId: string;
  /** two hex colours used for the generated illustration */
  palette: [string, string];
}

export interface Department {
  id: string;
  name: string;
  nameTh: string;
}

export interface Doctor {
  id: string;
  name: string;
  nameTh: string;
  specialty: string;
  hospitalIds: string[];
  /** the hospital's doctor code, as printed on patient stickers */
  code?: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  taxId: string;
}

export interface Product {
  id: string;
  ref: string;
  name: string;
  category: string;
  unit: string;
  gtin: string;
  listPrice: number;
  reorderPoint: number;
  supplierId: string;
}

export interface PriceList {
  id: string;
  hospitalId: string;
  productId: string;
  contractPrice: number;
  validFrom: string;
  validTo: string;
}

export interface Location {
  id: string;
  type: "WAREHOUSE" | "HOSPITAL";
  name: string;
  nameTh: string;
  hospitalId?: string;
}

export interface Lot {
  id: string;
  productId: string;
  lotNo: string;
  expiryDate: string; // yyyy-mm-dd
}

export interface StockBalance {
  locationId: string;
  lotId: string;
  qty: number;
}

export type MovementType = "IN" | "OUT" | "TRANSFER" | "ADJUST";

export interface StockMovement {
  id: string;
  type: MovementType;
  lotId: string;
  productId: string;
  qty: number;
  fromLocationId?: string;
  toLocationId?: string;
  refDocType: string;
  refDocNo: string;
  at: string; // ISO
  by: string; // userId
}

export type CaseStatus =
  | "DRAFT"
  | "USAGE_RECORDED"
  | "QUOTED"
  | "WAITING_PO"
  | "PO_RECEIVED"
  | "REQUISITIONED"
  | "BILLED"
  | "CLOSED"
  | "CANCELLED";

export const CASE_FLOW: CaseStatus[] = [
  "DRAFT",
  "USAGE_RECORDED",
  "QUOTED",
  "WAITING_PO",
  "PO_RECEIVED",
  "REQUISITIONED",
  "BILLED",
  "CLOSED",
];

export type UsageSource = "OCR" | "SCAN" | "MANUAL";

export interface UsageItem {
  id: string;
  caseId: string;
  productId: string;
  lotId?: string;
  qty: number;
  unitPrice: number;
  source: UsageSource;
  /** unit serial printed on the sticker (REF LOT SERIAL) */
  serialNo?: string;
}

export interface CasePhoto {
  id: string;
  /** data url or a sample key ("sample-1") */
  url: string;
}

export interface Case {
  id: string;
  no: string;
  hospitalId: string;
  repId: string;
  doctorId?: string;
  patientHn?: string;
  /** patient name-surname, entered by the rep (the photo readers never return names) */
  patientName?: string;
  /** admission number from the patient sticker */
  patientAn?: string;
  procedure?: string;
  caseDate: string; // yyyy-mm-dd
  status: CaseStatus;
  photos: CasePhoto[];
  createdAt: string;
  /** ISO timestamps when each status was reached */
  history: Partial<Record<CaseStatus, string>>;
  note?: string;
}

/**
 * Quotations are approved automatically when created (APPROVED), then sent. An admin can still force-reject one that
 * the hospital has not accepted yet (REJECTED); its case can then get a new quotation.
 */
export type QuotationStatus = "APPROVED" | "SENT" | "ACCEPTED" | "EXPIRED" | "REJECTED";

export interface DocItem {
  productId: string;
  unit: string;
  qty: number;
  unitPrice: number;
}

export interface Quotation {
  id: string;
  no: string;
  caseId?: string;
  hospitalId: string;
  date: string;
  validUntil: string;
  items: DocItem[];
  discountPct: number;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  status: QuotationStatus;
  createdBy: string;
  sentVia?: ("EMAIL" | "LINE")[];
  note?: string;
  /** set when an admin force-rejects the quotation */
  rejected?: { by: string; at: string; reason: string };
}

export interface CustomerPO {
  id: string;
  poNo: string;
  hospitalId: string;
  quotationId: string;
  caseId?: string;
  date: string;
  amount: number;
  recordedBy: string;
  method: "SCAN" | "TYPED";
}

/** PO documents received from hospitals (email / LINE) but not yet matched */
export interface IncomingPO {
  poNo: string;
  hospitalId: string;
  quotationNo: string;
  amount: number;
  date: string;
  channel: "EMAIL" | "LINE";
}

/**
 * Accrual (Sales EP): near-expiry consignment stock the rep takes out of the hospital's inventory. It leaves On shelf /
 * Usage at once and waits in PO wait until the hospital's PO arrives.
 */
export interface Accrual {
  id: string;
  no: string;
  hospitalId: string;
  productId: string;
  lotId: string;
  qty: number;
  unitPrice: number;
  status: "PO_WAIT";
  reason: string;
  createdBy: string;
  createdAt: string;
}

export type RequisitionStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ISSUED";

export interface RequisitionItem {
  productId: string;
  qty: number;
  reason: string;
}

export interface Requisition {
  id: string;
  no: string;
  departmentId: string;
  purpose: string;
  requesterId: string;
  status: RequisitionStatus;
  caseId?: string;
  hospitalId?: string; // destination consignment
  items: RequisitionItem[];
  createdAt: string;
  approvedBy?: string;
  issuedAt?: string;
}

export type PRStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ORDERED" | "RECEIVED";

export interface PRItem {
  productId: string;
  qty: number;
  unitPrice: number;
}

export interface PurchaseRequest {
  id: string;
  no: string;
  supplierId: string;
  requesterId: string;
  status: PRStatus;
  items: PRItem[];
  note?: string;
  neededBy: string;
  createdAt: string;
  supplierPoNo?: string;
  grNo?: string;
  approvedBy?: string;
}

export type InvoiceStatus = "ISSUED" | "PAID" | "OVERDUE" | "VOID";

export interface Invoice {
  id: string;
  no: string;
  caseId: string;
  customerPoId?: string;
  hospitalId: string;
  amount: number; // incl. VAT
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAt?: string;
}

export interface ActivityLog {
  id: string;
  actorId: string;
  /** i18n key under "act." */
  action: string;
  entity: string;
  entityId: string;
  ref: string; // human readable doc no
  hospitalId?: string;
  at: string;
}

export interface Notification {
  id: string;
  userId: string | "*";
  action: string;
  ref: string;
  hospitalId?: string;
  href: string;
  at: string;
  read: boolean;
}

export interface Approval {
  id: string;
  entity: "REQUISITION" | "PR";
  entityId: string;
  approverId: string;
  decision: "APPROVED" | "REJECTED";
  note?: string;
  at: string;
}

export interface OcrDraft {
  /** which way the case is being created (the choice on /m/cases/new) */
  mode?: "scan" | "manual";
  hospitalId: string;
  caseDate: string;
  doctorId?: string;
  patientHn?: string;
  patientName?: string;
  patientAn?: string;
  procedure?: string;
  photos: CasePhoto[];
  /** stickers scanned live with the camera before review */
  scanned?: string[];
  /** equipment picked from the hospital's consignment stock list */
  picked?: PickedItem[];
  /** made-up usage for a demo without a camera (lib/mock.ts), read on the patient pages like a photo */
  mock?: Extraction;
  /** what each photo was read as when it was added, by photo id (review reuses it instead of reading again) */
  extracted?: Record<string, Extraction>;
}

export interface PickedItem {
  productId: string;
  lotId: string;
  qty: number;
}

export interface Data {
  version: number;
  users: User[];
  hospitals: Hospital[];
  departments: Department[];
  doctors: Doctor[];
  suppliers: Supplier[];
  products: Product[];
  priceLists: PriceList[];
  locations: Location[];
  lots: Lot[];
  stock: StockBalance[];
  movements: StockMovement[];
  cases: Case[];
  usage: UsageItem[];
  accruals: Accrual[];
  quotations: Quotation[];
  customerPos: CustomerPO[];
  incomingPos: IncomingPO[];
  requisitions: Requisition[];
  purchaseRequests: PurchaseRequest[];
  invoices: Invoice[];
  activity: ActivityLog[];
  notifications: Notification[];
  approvals: Approval[];
  procedures: { id: string; name: string; nameTh: string }[];
}
