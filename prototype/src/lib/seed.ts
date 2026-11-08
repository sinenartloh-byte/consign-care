import type { Case, CaseStatus, Data, DocItem, Product } from "./types";
import {
  addDays,
  DEMO_TODAY,
  demoNow,
  hospitalLoc,
  poNumberFor,
  priceFor,
  receiveStock,
  totals,
  WAREHOUSE,
} from "./ops";

export const DATA_VERSION = 12;

/* ---------------------------------------------------------------- mock patients (fictional) */

const TITLES = [
  ["นาย", "M"],
  ["นาง", "F"],
  ["นางสาว", "F"],
] as const;
const FIRST: Record<"M" | "F", string[]> = {
  M: ["สมชาย", "ประเสริฐ", "วิชัย", "ธนากร", "อนุชา", "สุรศักดิ์", "กิตติพงษ์", "ณัฐวุฒิ", "ชัยวัฒน์", "พงศกร", "ธีรพงษ์", "ศุภชัย"],
  F: ["สุดารัตน์", "มาลี", "วรรณา", "จันทร์เพ็ญ", "ปิยะนุช", "อรุณี", "กัญญารัตน์", "ศิริพร", "ณัฐธิดา", "พรทิพย์", "รัตนา", "สุภาวดี"],
};
const LAST = ["ใจดี", "สุขสวัสดิ์", "ทองคำ", "ศรีสมบูรณ์", "บุญมา", "แสงทอง", "วงศ์ไทย", "รุ่งเรือง", "พึ่งบุญ", "มีสุข", "เจริญผล", "ปัญญาดี", "สายสุวรรณ", "อินทร์แก้ว"];

/** Fictional patient details for a seeded case, the same every time for the same case number. */
function mockPatient(n: number): Pick<Case, "patientHn" | "patientAn" | "patientName"> {
  const [title, sex] = TITLES[n % 3];
  const first = FIRST[sex][(n * 7) % FIRST[sex].length];
  const last = LAST[(n * 5) % LAST.length];
  return {
    patientHn: `HN-${((n * 37) % 900000) + 100000}`,
    patientAn: `69-${String(10000 + ((n * 13) % 9000)).padStart(5, "0")}`,
    patientName: `${title}${first} ${last}`,
  };
}

/* ---------------------------------------------------------------- master data */

const users: Data["users"] = [
  { id: "u-sinenart", name: "Sinenart", nameTh: "สิเนนาถ", email: "sinenart@consigncare.co.th", role: "SALES_REP", phone: "081-234-5678", hospitalIds: ["h-bkk", "h-bmr", "h-smv", "h-pyt", "h-pys"] },
  { id: "u-anan", name: "Anan", nameTh: "อนันต์", email: "anan@consigncare.co.th", role: "SALES_REP", phone: "081-555-0101", hospitalIds: ["h-bkk", "h-bmr"] },
  { id: "u-natt", name: "Nattapong", nameTh: "ณัฐพงษ์", email: "nattapong@consigncare.co.th", role: "SALES_REP", phone: "081-555-0102", hospitalIds: ["h-smv", "h-pyt"] },
  { id: "u-kanya", name: "Kanya", nameTh: "กัญญา", email: "kanya@consigncare.co.th", role: "SALES_ADMIN", phone: "02-111-2201", hospitalIds: [] },
  { id: "u-somchai", name: "Wichai S.", nameTh: "วิชัย ส.", email: "wichai.s@consigncare.co.th", role: "MANAGER", phone: "081-999-1000", hospitalIds: [] },
  { id: "u-pim", name: "Pim", nameTh: "พิมพ์", email: "pim@consigncare.co.th", role: "WAREHOUSE", phone: "02-111-2205", hospitalIds: [] },
  { id: "u-ratana", name: "Ratana", nameTh: "รัตนา", email: "ratana@consigncare.co.th", role: "ACCOUNTING", phone: "02-111-2207", hospitalIds: [] },
  { id: "u-admin", name: "Admin", nameTh: "ผู้ดูแลระบบ", email: "admin@consigncare.co.th", role: "ADMIN", phone: "02-111-2200", hospitalIds: [] },
];

const hospitals: Data["hospitals"] = [
  { id: "h-bkk", code: "BKK", name: "Bangkok Hospital", nameTh: "โรงพยาบาลกรุงเทพ", address: "2 Soi Soonvijai 7, New Petchburi Rd., Huai Khwang, Bangkok 10310", taxId: "0107536000315", contactEmail: "purchasing@bangkokhospital.example", lineGroupId: "LINE-BKH-PUR", palette: ["#1d4ed8", "#60a5fa"] },
  { id: "h-bmr", code: "BMR", name: "Bumrungrad Hospital", nameTh: "โรงพยาบาลบำรุงราษฎร์", address: "33 Sukhumvit 3, Wattana, Bangkok 10110", taxId: "0107537000025", contactEmail: "procurement@bumrungrad.example", lineGroupId: "LINE-BRH-PUR", palette: ["#0f766e", "#5eead4"] },
  { id: "h-smv", code: "SMV", name: "Samitivej Hospital", nameTh: "โรงพยาบาลสมิติเวช", address: "133 Sukhumvit 49, Khlong Tan Nuea, Wattana, Bangkok 10110", taxId: "0107536000196", contactEmail: "purchase@samitivej.example", lineGroupId: "LINE-SVH-PUR", palette: ["#7c3aed", "#c4b5fd"] },
  { id: "h-pyt", code: "PYT", name: "Phyathai 2 Hospital", nameTh: "โรงพยาบาลพญาไท 2", address: "943 Phahonyothin Rd., Phaya Thai, Bangkok 10400", taxId: "0107537000432", contactEmail: "purchasing@phyathai2.example", lineGroupId: "LINE-PT2-PUR", palette: ["#c2410c", "#fdba74"] },
  { id: "h-pys", code: "PYS", name: "Phyathai Sriracha Hospital", nameTh: "โรงพยาบาลพญาไท ศรีราชา", address: "90 Sukhumvit Rd., Si Racha, Chon Buri 20110", taxId: "0205540000123", contactEmail: "purchasing@phyathai-sriracha.example", lineGroupId: "LINE-PYS-PUR", palette: ["#be123c", "#fda4af"] },
];

const departments: Data["departments"] = [
  { id: "d-ortho", name: "Sales – Orthopedics", nameTh: "ฝ่ายขาย ออร์โธปิดิกส์" },
  { id: "d-cardio", name: "Sales – Cardiology", nameTh: "ฝ่ายขาย หัวใจและหลอดเลือด" },
  { id: "d-neuro", name: "Sales – Neurovascular", nameTh: "ฝ่ายขาย ระบบประสาท" },
  { id: "d-wh", name: "Warehouse", nameTh: "คลังสินค้า" },
  { id: "d-cs", name: "Customer Service", nameTh: "บริการลูกค้า" },
];

const doctors: Data["doctors"] = [
  { id: "doc-somchai", name: "Dr. Somchai", nameTh: "นพ.สมชาย", specialty: "Orthopedics", hospitalIds: ["h-bkk", "h-bmr", "h-smv", "h-pyt"] },
  { id: "doc-anan", name: "Dr. Anan", nameTh: "นพ.อนันต์", specialty: "Sports Medicine", hospitalIds: ["h-bkk", "h-bmr", "h-smv", "h-pyt"] },
  { id: "doc-krit", name: "Dr. Krit", nameTh: "นพ.กฤษ", specialty: "Cardiology", hospitalIds: ["h-bkk", "h-bmr", "h-smv", "h-pyt"] },
  // Doctor code 2048 as printed on the hospital's patient sticker; the name is filled in from the hospital's doctor list.
  { id: "doc-2048", name: "Doctor #2048", nameTh: "แพทย์รหัส 2048", specialty: "Cardiac Electrophysiology", hospitalIds: ["h-pys"], code: "2048" },
];

const procedures: Data["procedures"] = [
  { id: "knee", name: "Knee Arthroscopy", nameTh: "ผ่าตัดส่องกล้องข้อเข่า" },
  { id: "shoulder", name: "Shoulder Arthroscopy", nameTh: "ผ่าตัดส่องกล้องข้อไหล่" },
  { id: "acl", name: "ACL Reconstruction", nameTh: "ผ่าตัดสร้างเอ็นไขว้หน้า (ACL)" },
  { id: "pci", name: "PCI", nameTh: "ขยายหลอดเลือดหัวใจ (PCI)" },
  { id: "ep", name: "EP Study / Ablation", nameTh: "ตรวจและจี้ไฟฟ้าหัวใจ (EP)" },
];

const suppliers: Data["suppliers"] = [
  { id: "sup-medtech", name: "MedTech Global (Thailand) Co., Ltd.", email: "orders@medtechglobal.example", phone: "02-555-1100", taxId: "0105558001234" },
  { id: "sup-arthro", name: "Arthro Supplies Co., Ltd.", email: "sales@arthrosupplies.example", phone: "02-555-2200", taxId: "0105560004321" },
  { id: "sup-cardio", name: "CardioLine Asia Co., Ltd.", email: "th.orders@cardioline.example", phone: "02-555-3300", taxId: "0105561007788" },
  { id: "sup-ep", name: "EP Medical Supply Co., Ltd.", email: "orders@epmedical.example", phone: "02-555-5500", taxId: "0105562001122" },
  { id: "sup-abc", name: "ABC Pharma", email: "order@abcpharma.example", phone: "02-555-4400", taxId: "0105549009900" },
];

const products: Product[] = [
  { id: "p-se", ref: "SE-001", name: "Surpass Evolve", category: "Neurovascular", unit: "piece", gtin: "08845210000017", listPrice: 185000, reorderPoint: 4, supplierId: "sup-medtech" },
  { id: "p-sa", ref: "SA-003", name: "Suture Anchor 3.0", category: "Arthroscopy", unit: "piece", gtin: "08845210000031", listPrice: 18500, reorderPoint: 20, supplierId: "sup-medtech" },
  { id: "p-cn", ref: "CN-005", name: "Cannula 5mm", category: "Arthroscopy", unit: "piece", gtin: "08845210000055", listPrice: 2400, reorderPoint: 15, supplierId: "sup-medtech" },
  { id: "p-st", ref: "ST-010", name: "Suction Tube", category: "Arthroscopy", unit: "piece", gtin: "08845210000109", listPrice: 650, reorderPoint: 30, supplierId: "sup-arthro" },
  { id: "p-as", ref: "AS-020", name: "Arthroscopic Shaver Blade", category: "Arthroscopy", unit: "piece", gtin: "08845210000208", listPrice: 7800, reorderPoint: 12, supplierId: "sup-arthro" },
  { id: "p-ct", ref: "CT-101", name: "Catheter XYZ", category: "Cardiology", unit: "piece", gtin: "08845210001014", listPrice: 12500, reorderPoint: 10, supplierId: "sup-cardio" },
  { id: "p-bl", ref: "BL-202", name: "Balloon ABC", category: "Cardiology", unit: "piece", gtin: "08845210002028", listPrice: 21000, reorderPoint: 10, supplierId: "sup-cardio" },
  // Electrophysiology items read from the Phayathai Sriracha usage sheet (sticker = REF LOT SERIAL).
  // Names and prices are placeholders until the real catalogue is loaded.
  { id: "p-ep-map", ref: "MAP-KIT-3-01", name: "Mapping Sensor Kit", category: "Electrophysiology", unit: "set", gtin: "MAP-KIT-3-01", listPrice: 48000, reorderPoint: 4, supplierId: "sup-ep" },
  { id: "p-ep-dx1", ref: "410105", name: "EP Diagnostic Catheter 410105", category: "Electrophysiology", unit: "piece", gtin: "410105", listPrice: 36000, reorderPoint: 4, supplierId: "sup-ep" },
  { id: "p-ep-dx2", ref: "410212", name: "EP Diagnostic Catheter 410212", category: "Electrophysiology", unit: "piece", gtin: "410212", listPrice: 38500, reorderPoint: 4, supplierId: "sup-ep" },
  { id: "p-ep-sheath", ref: "410320", name: "Steerable Sheath 410320", category: "Electrophysiology", unit: "piece", gtin: "410320", listPrice: 29500, reorderPoint: 4, supplierId: "sup-ep" },
  { id: "p-ep-abl", ref: "ABL-20511", name: "Ablation Catheter ABL-20511", category: "Electrophysiology", unit: "piece", gtin: "ABL-20511", listPrice: 89000, reorderPoint: 4, supplierId: "sup-ep" },
  { id: "p-ep-intro", ref: "410438", name: "Introducer Set 410438", category: "Electrophysiology", unit: "piece", gtin: "410438", listPrice: 6800, reorderPoint: 6, supplierId: "sup-ep" },
  { id: "p-pc", ref: "1245678980123", name: "Paracetamol 500 mg", category: "Pharmaceutical", unit: "pcs", gtin: "1245678980123", listPrice: 1.5, reorderPoint: 1000, supplierId: "sup-abc" },
];

const discountByHospital: Record<string, number> = { "h-bkk": 0.92, "h-bmr": 0.9, "h-smv": 0.94, "h-pyt": 0.95, "h-pys": 0.93 };

const priceLists: Data["priceLists"] = hospitals.flatMap((h) =>
  products
    .filter((p) => p.id !== "p-pc")
    .map((p) => ({
      id: `pl-${h.id}-${p.id}`,
      hospitalId: h.id,
      productId: p.id,
      contractPrice: Math.round(p.listPrice * discountByHospital[h.id]),
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    })),
);

const locations: Data["locations"] = [
  { id: WAREHOUSE, type: "WAREHOUSE", name: "Main Warehouse", nameTh: "คลังสินค้าหลัก" },
  ...hospitals.map((h) => ({
    id: hospitalLoc(h.id),
    type: "HOSPITAL" as const,
    name: `Consignment – ${h.name}`,
    nameTh: `คลังฝากขาย ${h.nameTh}`,
    hospitalId: h.id,
  })),
];

/** product -> [lotNo, expiry, warehouseQty, perHospitalQty] */
const LOTS: Record<string, [string, string, number, number][]> = {
  "p-se": [["240105", "2027-12-31", 0, 4], ["240311", "2028-03-31", 6, 0]],
  "p-sa": [["SA2406", "2028-06-30", 14, 10]],
  "p-cn": [["CN2410", "2026-12-20", 0, 6], ["CN2503", "2028-03-15", 40, 6]],
  "p-st": [["ST2409", "2026-11-30", 0, 5], ["ST2504", "2028-04-30", 22, 6]],
  "p-as": [["AS2407", "2028-07-31", 25, 6]],
  "p-ct": [["CT2405", "2027-05-31", 18, 6]],
  "p-bl": [["BL2304", "2026-09-30", 0, 1], ["BL2311", "2027-01-05", 0, 3], ["BL2506", "2028-06-30", 4, 3]],
  "p-ep-map": [["21005803", "2028-01-31", 4, 4]],
  "p-ep-dx1": [["21004417", "2027-11-30", 4, 4]],
  "p-ep-dx2": [["21005582", "2027-12-31", 4, 4]],
  "p-ep-sheath": [["21006139", "2028-02-29", 4, 4]],
  "p-ep-abl": [["21005906", "2028-01-31", 2, 4]],
  "p-ep-intro": [["21003118", "2026-10-05", 0, 2], ["21007264", "2028-05-31", 10, 6]],
  "p-pc": [["LOT2264A", "2027-06-30", 550, 0]],
};

const EP_ONLY: Record<string, string> = Object.fromEntries(
  ["p-ep-map", "p-ep-dx1", "p-ep-dx2", "p-ep-sheath", "p-ep-abl", "p-ep-intro"].map((id) => [id, "h-pys"]),
);

/* ---------------------------------------------------------------- cases */

type Spec = [no: string, hospitalId: string, repId: string, date: string, status: CaseStatus, items: [string, number][], doctor?: string, procedure?: string];

const S = "u-sinenart";
const A = "u-anan";
const N = "u-natt";

const CASES: Spec[] = [
  // Bangkok Hospital – open 12, waiting PO 4, waiting billing 3, 18 cases & 26 used items this month
  ["C25001", "h-bkk", S, "2026-10-15", "WAITING_PO", [["p-se", 1], ["p-sa", 2], ["p-cn", 1], ["p-st", 1], ["p-as", 1]], "doc-somchai", "knee"],
  ["C24998", "h-bkk", S, "2026-10-14", "WAITING_PO", [["p-bl", 1], ["p-cn", 1]], "doc-krit", "pci"],
  ["C24994", "h-bkk", S, "2026-10-13", "QUOTED", [["p-sa", 1]], "doc-anan", "shoulder"],
  ["C24990", "h-bkk", S, "2026-10-11", "WAITING_PO", [["p-ct", 1]], "doc-krit", "pci"],
  ["C24996", "h-bkk", S, "2026-10-14", "PO_RECEIVED", [["p-as", 2]], "doc-somchai", "knee"],
  ["C24987", "h-bkk", S, "2026-10-09", "REQUISITIONED", [["p-ct", 2]], "doc-krit", "pci"],
  ["C24970", "h-bkk", S, "2026-10-10", "PO_RECEIVED", [["p-cn", 1]], "doc-somchai", "knee"],
  ["C24999", "h-bkk", A, "2026-10-16", "QUOTED", [["p-se", 1]], "doc-somchai", "acl"],
  ["C24997", "h-bkk", A, "2026-10-15", "QUOTED", [["p-st", 1]], "doc-anan", "knee"],
  ["C24983", "h-bkk", A, "2026-10-08", "BILLED", [["p-sa", 1]], "doc-anan", "shoulder"],
  ["C24978", "h-bkk", A, "2026-10-06", "BILLED", [["p-bl", 1]], "doc-krit", "pci"],
  ["C24975", "h-bkk", S, "2026-10-05", "BILLED", [["p-as", 1]], "doc-somchai", "knee"],
  ["C24968", "h-bkk", A, "2026-10-03", "CLOSED", [["p-cn", 1]], "doc-anan", "knee"],
  ["C24965", "h-bkk", A, "2026-10-02", "CLOSED", [["p-st", 1]], "doc-somchai", "acl"],
  ["C24962", "h-bkk", S, "2026-10-02", "CLOSED", [["p-sa", 1]], "doc-anan", "shoulder"],
  ["C24960", "h-bkk", A, "2026-10-01", "CLOSED", [["p-ct", 1]], "doc-krit", "pci"],
  ["C24958", "h-bkk", A, "2026-10-01", "CLOSED", [["p-bl", 1]], "doc-krit", "pci"],
  ["C24956", "h-bkk", A, "2026-10-01", "CLOSED", [["p-cn", 1]], "doc-somchai", "knee"],
  ["C24930", "h-bkk", S, "2026-09-20", "CLOSED", [["p-sa", 2]], "doc-anan", "shoulder"],
  ["C24921", "h-bkk", S, "2026-09-28", "CLOSED", [["p-se", 1]], "doc-somchai", "acl"],
  // Bumrungrad – open 8, waiting PO 2, waiting billing 2, 15 used
  ["C24995", "h-bmr", S, "2026-10-14", "WAITING_PO", [["p-ct", 2], ["p-st", 1], ["p-cn", 1]], "doc-krit", "pci"],
  ["C24985", "h-bmr", A, "2026-10-14", "QUOTED", [["p-ct", 1], ["p-se", 1]], "doc-anan", "pci"],
  ["C24992", "h-bmr", S, "2026-10-12", "PO_RECEIVED", [["p-bl", 1], ["p-as", 1], ["p-sa", 1]], "doc-somchai", "knee"],
  ["C24981", "h-bmr", S, "2026-09-29", "REQUISITIONED", [["p-sa", 1]], "doc-anan", "shoulder"],
  ["C24993", "h-bmr", A, "2026-10-13", "QUOTED", [["p-as", 1]], "doc-somchai", "knee"],
  ["C24986", "h-bmr", A, "2026-10-09", "QUOTED", [["p-st", 1]], "doc-anan", "acl"],
  ["C24979", "h-bmr", A, "2026-10-07", "BILLED", [["p-sa", 1]], "doc-anan", "shoulder"],
  ["C24976", "h-bmr", A, "2026-10-04", "BILLED", [["p-bl", 1]], "doc-krit", "pci"],
  ["C24963", "h-bmr", A, "2026-10-02", "CLOSED", [["p-ct", 1]], "doc-krit", "pci"],
  ["C24957", "h-bmr", A, "2026-10-01", "CLOSED", [["p-cn", 1]], "doc-somchai", "knee"],
  // Samitivej – open 6, waiting PO 1, waiting billing 1, 9 used
  ["C24980", "h-smv", N, "2026-10-12", "WAITING_PO", [["p-sa", 1], ["p-se", 1]], "doc-anan", "shoulder"],
  ["C24989", "h-smv", S, "2026-10-10", "REQUISITIONED", [["p-as", 1], ["p-cn", 1]], "doc-somchai", "knee"],
  ["C24991", "h-smv", N, "2026-10-12", "QUOTED", [["p-cn", 1]], "doc-somchai", "knee"],
  ["C24984", "h-smv", N, "2026-10-08", "QUOTED", [["p-ct", 1]], "doc-krit", "pci"],
  ["C24977", "h-smv", N, "2026-10-06", "BILLED", [["p-bl", 1]], "doc-krit", "pci"],
  ["C24972", "h-smv", N, "2026-10-03", "BILLED", [["p-sa", 1]], "doc-anan", "acl"],
  ["C24961", "h-smv", N, "2026-10-01", "CLOSED", [["p-as", 1]], "doc-somchai", "knee"],
  // Phyathai 2 – open 4, waiting billing 2, 6 used
  ["C24935", "h-pyt", S, "2026-09-24", "PO_RECEIVED", [["p-se", 1]], "doc-anan", "acl"],
  ["C24940", "h-pyt", S, "2026-09-26", "REQUISITIONED", [["p-ct", 1]], "doc-krit", "pci"],
  ["C24988", "h-pyt", N, "2026-10-09", "QUOTED", [["p-as", 1], ["p-cn", 2]], "doc-somchai", "knee"],
  ["C24973", "h-pyt", N, "2026-10-04", "BILLED", [["p-bl", 1]], "doc-krit", "pci"],
  ["C24959", "h-pyt", N, "2026-10-01", "CLOSED", [["p-st", 2]], "doc-anan", "acl"],
];

/** OCR "AI extraction" results used by the simulated OCR service, per procedure */
export const OCR_TEMPLATES: Record<string, [string, number][]> = {
  knee: [["p-se", 1], ["p-sa", 2], ["p-cn", 1], ["p-st", 1], ["p-as", 1]],
  shoulder: [["p-sa", 3], ["p-cn", 1], ["p-st", 1], ["p-as", 1]],
  acl: [["p-se", 1], ["p-sa", 2], ["p-cn", 1], ["p-st", 1], ["p-as", 1]],
  pci: [["p-ct", 1], ["p-bl", 2], ["p-st", 1]],
  ep: [["p-ep-map", 1], ["p-ep-dx1", 1], ["p-ep-dx2", 1], ["p-ep-sheath", 1], ["p-ep-abl", 1], ["p-ep-intro", 1]],
};

const ORDER: CaseStatus[] = ["DRAFT", "USAGE_RECORDED", "QUOTED", "WAITING_PO", "PO_RECEIVED", "REQUISITIONED", "BILLED", "CLOSED"];
const OFFSET: Partial<Record<CaseStatus, [number, number]>> = {
  DRAFT: [0, 9],
  USAGE_RECORDED: [0, 14],
  QUOTED: [1, 10],
  WAITING_PO: [1, 15],
  PO_RECEIVED: [3, 11],
  REQUISITIONED: [4, 10],
  BILLED: [5, 14],
  CLOSED: [9, 16],
};

function iso(date: string, hour: number, min = 0) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour, min).toISOString();
}

export function buildSeed(): Data {
  const now = demoNow();
  const nowMs = now.getTime();
  const d: Data = {
    version: DATA_VERSION,
    users: structuredClone(users),
    hospitals: structuredClone(hospitals),
    departments: structuredClone(departments),
    doctors: structuredClone(doctors),
    suppliers: structuredClone(suppliers),
    products: structuredClone(products),
    priceLists: structuredClone(priceLists),
    locations: structuredClone(locations),
    lots: [],
    stock: [],
    movements: [],
    cases: [],
    usage: [],
    accruals: [],
    quotations: [],
    customerPos: [],
    incomingPos: [],
    requisitions: [],
    purchaseRequests: [],
    invoices: [],
    activity: [],
    notifications: [],
    approvals: [],
    procedures: structuredClone(procedures),
  };

  let seq = 0;
  const sid = (p: string) => `${p}-s${++seq}`;
  const clamp = (isoStr: string) => {
    const t = Date.parse(isoStr);
    return t > nowMs - 3600_000 ? new Date(nowMs - 3600_000 * (2 + (seq % 20))).toISOString() : isoStr;
  };

  /* opening stock */
  const opening = iso("2026-09-01", 8);
  for (const [productId, lots] of Object.entries(LOTS)) {
    for (const [lotNo, exp, wh, perHosp] of lots) {
      if (wh > 0) receiveStock(d, "u-pim", productId, wh, lotNo, exp, WAREHOUSE, "OPEN", "OPENING-2026", opening, "ADJUST");
      for (const h of hospitals) {
        // EP consignment sits only at the hospital whose usage sheet we have
        if (productId in EP_ONLY && h.id !== EP_ONLY[productId]) continue;
        if (perHosp > 0)
          receiveStock(d, "u-pim", productId, perHosp, lotNo, exp, hospitalLoc(h.id), "OPEN", "OPENING-2026", opening, "ADJUST");
      }
      if (wh === 0 && perHosp === 0) receiveStock(d, "u-pim", productId, 0, lotNo, exp, WAREHOUSE, "OPEN", "OPENING-2026", opening, "ADJUST");
    }
  }
  // Paracetamol transactions shown in the concept image
  receiveStock(d, "u-pim", "p-pc", 500, "LOT2264A", "2027-06-30", WAREHOUSE, "GR", "GR-001", iso("2026-10-10", 10));
  {
    const lot = d.lots.find((l) => l.lotNo === "LOT2264A")!;
    d.stock.find((s) => s.locationId === WAREHOUSE && s.lotId === lot.id)!.qty -= 100;
    d.movements.unshift({ id: sid("mv"), type: "OUT", lotId: lot.id, productId: "p-pc", qty: 100, fromLocationId: WAREHOUSE, refDocType: "ISSUE", refDocNo: "OS-023", at: iso("2026-10-12", 14), by: "u-pim" });
  }
  receiveStock(d, "u-pim", "p-pc", 300, "LOT2264A", "2027-06-30", WAREHOUSE, "IN", "PO-045", iso("2026-10-15", 11));

  /* cases (process oldest first so FEFO consumption is chronological) */
  const specs = [...CASES].sort((a, b) => a[3].localeCompare(b[3]));
  let qtSeq = 0;
  let rqSeq = 1;
  let invSeq = 1;
  // one running number from QT-00001, in the order the quotations were made
  const qtNoFor = () => `QT-${String(++qtSeq).padStart(5, "0")}`;

  for (const [no, hospitalId, repId, date, status, items, doctorId, procedure] of specs) {
    const reached = ORDER.slice(0, ORDER.indexOf(status) + 1);
    const history: Case["history"] = {};
    for (const st of reached) {
      const [dd, hh] = OFFSET[st]!;
      history[st] = clamp(iso(addDays(date, dd), hh, (seq * 7) % 60));
    }
    // the quotation is made when usage is recorded (no approval step)
    if (history.QUOTED) history.QUOTED = history.USAGE_RECORDED;
    if (no === "C25001") {
      history.USAGE_RECORDED = iso("2026-10-15", 16, 20);
      history.QUOTED = history.USAGE_RECORDED;
      history.WAITING_PO = iso("2026-10-16", 11, 30);
    }
    const c: Case = {
      id: `case-${no}`,
      no,
      hospitalId,
      repId,
      doctorId,
      ...mockPatient(parseInt(no.slice(1), 10)),
      procedure,
      caseDate: date,
      status,
      photos: [{ id: sid("ph"), url: "sample-1" }],
      createdAt: history.DRAFT!,
      history,
    };
    d.cases.push(c);

    // usage – consume hospital consignment stock FEFO
    for (const [productId, qty] of items) {
      let remaining = qty;
      const lots = d.stock
        .filter((s) => s.locationId === hospitalLoc(hospitalId) && s.qty > 0)
        .map((s) => ({ s, lot: d.lots.find((l) => l.id === s.lotId)! }))
        .filter((x) => x.lot.productId === productId && x.lot.expiryDate >= date)
        .sort((a, b) => a.lot.expiryDate.localeCompare(b.lot.expiryDate));
      let firstLot = lots[0]?.lot.id;
      for (const { s, lot } of lots) {
        if (remaining <= 0) break;
        const take = Math.min(s.qty, remaining);
        s.qty -= take;
        remaining -= take;
        firstLot = firstLot ?? lot.id;
        d.movements.unshift({ id: sid("mv"), type: "OUT", lotId: lot.id, productId, qty: take, fromLocationId: hospitalLoc(hospitalId), refDocType: "CASE", refDocNo: no, at: history.USAGE_RECORDED!, by: repId });
      }
      d.usage.push({ id: sid("use"), caseId: c.id, productId, lotId: firstLot, qty, unitPrice: priceFor(d, hospitalId, productId), source: no === "C25001" ? "OCR" : (seq % 3 === 0 ? "SCAN" : "OCR") });
    }

    // quotation
    if (ORDER.indexOf(status) >= ORDER.indexOf("QUOTED")) {
      const docItems: DocItem[] = items.map(([productId, qty]) => ({
        productId,
        unit: d.products.find((p) => p.id === productId)!.unit,
        qty,
        unitPrice: priceFor(d, hospitalId, productId),
      }));
      const discountPct = no === "C24994" ? 12 : 0;
      const t = totals(docItems, discountPct);
      const qDate = history.QUOTED!.slice(0, 10);
      const qno = qtNoFor();
      const qStatus =
        status === "QUOTED" ? "APPROVED" : status === "WAITING_PO" ? "SENT" : "ACCEPTED";
      const q = {
        id: `qt-${no}`,
        no: qno,
        caseId: c.id,
        hospitalId,
        date: qDate,
        validUntil: addDays(qDate, 30),
        items: docItems,
        discountPct,
        subtotal: t.subtotal,
        discount: t.discount,
        vat: t.vat,
        total: t.total,
        status: qStatus as "SENT",
        createdBy: "u-kanya",
        sentVia: qStatus === "APPROVED" ? undefined : (["EMAIL", "LINE"] as ("EMAIL" | "LINE")[]),
      };
      d.quotations.push(q);

      // customer PO
      if (ORDER.indexOf(status) >= ORDER.indexOf("PO_RECEIVED")) {
        d.customerPos.push({
          id: `po-${no}`,
          poNo: poNumberFor(hospitalId, qno),
          hospitalId,
          quotationId: q.id,
          caseId: c.id,
          date: history.PO_RECEIVED!.slice(0, 10),
          amount: t.total,
          recordedBy: seq % 2 ? "u-kanya" : repId,
          method: seq % 2 ? "SCAN" : "TYPED",
        });
      } else if (status === "WAITING_PO" && ["C25001", "C24998", "C24995"].includes(no)) {
        // hospital has already e-mailed the PO; waiting to be matched in the system
        d.incomingPos.push({
          poNo: poNumberFor(hospitalId, qno),
          hospitalId,
          quotationNo: qno,
          amount: t.total,
          date: DEMO_TODAY,
          channel: no === "C24995" ? "LINE" : "EMAIL",
        });
      }

      // requisition (replenish consignment)
      if (ORDER.indexOf(status) >= ORDER.indexOf("REQUISITIONED") && history.REQUISITIONED) {
        const rno = `RQ-2026-${String(rqSeq++).padStart(3, "0")}`;
        const at = history.REQUISITIONED;
        for (const [productId, qty] of items) {
          let remaining = qty;
          const lots = d.stock
            .filter((s) => s.locationId === WAREHOUSE && s.qty > 0)
            .map((s) => ({ s, lot: d.lots.find((l) => l.id === s.lotId)! }))
            .filter((x) => x.lot.productId === productId)
            .sort((a, b) => a.lot.expiryDate.localeCompare(b.lot.expiryDate));
          for (const { s, lot } of lots) {
            if (remaining <= 0) break;
            const take = Math.min(s.qty, remaining);
            s.qty -= take;
            remaining -= take;
            const dest = d.stock.find((x) => x.locationId === hospitalLoc(hospitalId) && x.lotId === lot.id);
            if (dest) dest.qty += take;
            else d.stock.push({ locationId: hospitalLoc(hospitalId), lotId: lot.id, qty: take });
            d.movements.unshift({ id: sid("mv"), type: "TRANSFER", lotId: lot.id, productId, qty: take, fromLocationId: WAREHOUSE, toLocationId: hospitalLoc(hospitalId), refDocType: "REQUISITION", refDocNo: rno, at, by: "u-pim" });
          }
        }
        d.requisitions.push({
          id: `rq-${no}`,
          no: rno,
          departmentId: ["p-ct", "p-bl"].includes(items[0][0]) ? "d-cardio" : "d-ortho",
          purpose: `Replenish consignment after case ${no}`,
          requesterId: repId,
          status: "ISSUED",
          caseId: c.id,
          hospitalId,
          items: items.map(([productId, qty]) => ({ productId, qty, reason: `Used in case ${no}` })),
          createdAt: iso(addDays(date, 3), 15),
          approvedBy: "u-somchai",
          issuedAt: at,
        });
      }

      // invoice
      if (ORDER.indexOf(status) >= ORDER.indexOf("BILLED")) {
        const issueDate = history.BILLED!.slice(0, 10);
        d.invoices.push({
          id: `inv-${no}`,
          no: `INV-2026-${String(invSeq++).padStart(4, "0")}`,
          caseId: c.id,
          customerPoId: `po-${no}`,
          hospitalId,
          amount: t.total,
          issueDate,
          dueDate: addDays(issueDate, no === "C24978" ? 7 : 30),
          status: status === "CLOSED" ? "PAID" : no === "C24978" ? "OVERDUE" : "ISSUED",
          paidAt: history.CLOSED,
        });
      }
    }
  }
  d.cases.sort((a, b) => b.no.localeCompare(a.no));
  d.quotations.sort((a, b) => b.no.localeCompare(a.no));
  d.invoices.sort((a, b) => b.no.localeCompare(a.no));
  d.requisitions.sort((a, b) => b.no.localeCompare(a.no));

  /* pending requisition awaiting approval (not tied to a case) */
  d.requisitions.unshift({
    id: "rq-pending-1",
    no: `RQ-2026-${String(rqSeq++).padStart(3, "0")}`,
    departmentId: "d-ortho",
    purpose: "เติมสต็อกฝากขาย รพ.สมิติเวช ก่อนเคสผ่าตัดสัปดาห์หน้า / Top up Samitivej consignment before next week's surgery list",
    requesterId: "u-natt",
    status: "SUBMITTED",
    hospitalId: "h-smv",
    items: [
      { productId: "p-as", qty: 3, reason: "Par level 6" },
      { productId: "p-cn", qty: 4, reason: "Lot CN2410 expiring" },
    ],
    createdAt: iso("2026-10-16", 17, 10),
  });

  /* purchase requests */
  d.purchaseRequests.push(
    {
      id: "pr-15",
      no: "PR-2026-015",
      supplierId: "sup-cardio",
      requesterId: "u-pim",
      status: "SUBMITTED",
      items: [
        { productId: "p-bl", qty: 16, unitPrice: 12600 },
        { productId: "p-ct", qty: 10, unitPrice: 7500 },
      ],
      note: "Balloon ABC below reorder point",
      neededBy: "2026-10-30",
      createdAt: iso("2026-10-16", 9, 40),
    },
    {
      id: "pr-14",
      no: "PR-2026-014",
      supplierId: "sup-medtech",
      requesterId: "u-pim",
      status: "ORDERED",
      items: [{ productId: "p-se", qty: 4, unitPrice: 111000 }],
      neededBy: "2026-10-25",
      createdAt: iso("2026-10-12", 13, 0),
      supplierPoNo: "SPO-2026-009",
      approvedBy: "u-somchai",
    },
    {
      id: "pr-13",
      no: "PR-2026-013",
      supplierId: "sup-abc",
      requesterId: "u-pim",
      status: "RECEIVED",
      items: [{ productId: "p-pc", qty: 500, unitPrice: 0.9 }],
      neededBy: "2026-10-10",
      createdAt: iso("2026-10-03", 10, 0),
      supplierPoNo: "SPO-2026-008",
      grNo: "GR-001",
      approvedBy: "u-somchai",
    },
  );

  /* activity feed (most recent first) */
  const ago = (h: number) => new Date(nowMs - h * 3600_000).toISOString();
  const caseId = (no: string) => `case-${no}`;
  d.activity.push(
    { id: sid("act"), actorId: "u-kanya", action: "poUploaded", entity: "PO", entityId: "po-C24992", ref: poNumberFor("h-bmr", d.quotations.find((q) => q.caseId === caseId("C24992"))!.no), hospitalId: "h-bmr", at: ago(2) },
    { id: sid("act"), actorId: "u-kanya", action: "quotationCreated", entity: "QUOTATION", entityId: "qt-C25001", ref: d.quotations.find((q) => q.id === "qt-C25001")!.no, hospitalId: "h-bkk", at: ago(5) },
    { id: sid("act"), actorId: "u-anan", action: "usageRecorded", entity: "CASE", entityId: caseId("C24999"), ref: "C24999", hospitalId: "h-bkk", at: ago(24) },
    { id: sid("act"), actorId: "u-anan", action: "usageRecorded", entity: "CASE", entityId: caseId("C24997"), ref: "C24997", hospitalId: "h-bkk", at: ago(30) },
    { id: sid("act"), actorId: "u-sinenart", action: "usageRecorded", entity: "CASE", entityId: caseId("C25001"), ref: "C25001", hospitalId: "h-bkk", at: ago(40) },
    { id: sid("act"), actorId: "u-pim", action: "requisitionIssued", entity: "REQUISITION", entityId: "rq-C24989", ref: d.requisitions.find((r) => r.caseId === caseId("C24989"))!.no, hospitalId: "h-smv", at: ago(52) },
    { id: sid("act"), actorId: "u-ratana", action: "invoiceIssued", entity: "INVOICE", entityId: "inv-C24975", ref: d.invoices.find((r) => r.caseId === caseId("C24975"))!.no, hospitalId: "h-bkk", at: ago(60) },
    { id: sid("act"), actorId: "u-ratana", action: "invoicePaid", entity: "INVOICE", entityId: "inv-C24968", ref: d.invoices.find((r) => r.caseId === caseId("C24968"))!.no, hospitalId: "h-bkk", at: ago(72) },
    { id: sid("act"), actorId: "u-pim", action: "goodsReceived", entity: "PR", entityId: "pr-13", ref: "GR-001", at: ago(170) },
  );

  d.notifications.push(
    { id: sid("ntf"), userId: "u-sinenart", action: "poUploaded", ref: "C24992", hospitalId: "h-bmr", href: `/m/cases/${caseId("C24992")}`, at: ago(2), read: false },
    { id: sid("ntf"), userId: "u-sinenart", action: "quotationCreated", ref: "C25001", hospitalId: "h-bkk", href: `/m/cases/${caseId("C25001")}`, at: ago(5), read: false },
    { id: sid("ntf"), userId: "*", action: "lotExpiring", ref: "CN2410", hospitalId: "h-bkk", href: `/m/scan`, at: ago(20), read: false },
    { id: sid("ntf"), userId: "*", action: "approvalRequested", ref: "PR-2026-015", href: `/admin/approvals`, at: ago(26), read: true },
  );

  return d;
}
