"use client";

import type { Data, OcrDraft } from "./types";
import { DATA_VERSION } from "./seed";

/**
 * The prototype's database is the browser's localStorage: one key per table, plus a meta record.
 *
 *   consigncare:db:_meta      { version, updatedAt, tables: { cases: { rows, updatedAt }, … } }
 *   consigncare:db:cases      Case[]
 *   consigncare:db:usage      UsageItem[]
 *   …
 *   consigncare:draft         the New Case form in progress (survives a refresh)
 *
 * A save writes only the tables that changed, then the meta record last — other tabs listen for the
 * meta key, so they reload once per commit and never see half a write.
 */

export type Table = Exclude<keyof Data, "version">;
export interface TableMeta {
  rows: number;
  updatedAt: string;
}
export interface Meta {
  version: number;
  updatedAt: string;
  tables: Partial<Record<Table, TableMeta>>;
}

export const NS = "consigncare:db:";
export const META_KEY = `${NS}_meta`;
const DRAFT_KEY = "consigncare:draft";
const LEGACY_KEY = "consigncare:data";

export const TABLES = [
  "users",
  "hospitals",
  "departments",
  "doctors",
  "suppliers",
  "products",
  "priceLists",
  "procedures",
  "locations",
  "lots",
  "stock",
  "movements",
  "cases",
  "usage",
  "accruals",
  "quotations",
  "customerPos",
  "incomingPos",
  "requisitions",
  "purchaseRequests",
  "invoices",
  "approvals",
  "notifications",
  "activity",
] as const satisfies readonly Table[];
// every Data collection must be a table: a new one fails to compile until it is listed above
const exhaustive: Exclude<Table, (typeof TABLES)[number]> extends never ? true : never = true;
void exhaustive;

/** Last JSON written per table, so a save can skip tables nothing touched. */
const written = new Map<Table, string>();

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function put(key: string, v: string): boolean {
  try {
    window.localStorage.setItem(key, v);
    return true;
  } catch {
    return false; // quota or storage disabled: the demo keeps working in memory
  }
}
function del(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readMeta(): Meta | null {
  try {
    return JSON.parse(get(META_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** Load every table, or null when the database is missing, from another data version, or damaged. */
export function load(): Data | null {
  const meta = readMeta();
  if (!meta) return migrateLegacy();
  if (meta.version !== DATA_VERSION) {
    // a new data version also drops the New Case draft: its photos and products belong to the old data
    del(DRAFT_KEY);
    return null;
  }
  const d = { version: DATA_VERSION } as Data;
  for (const t of TABLES) {
    const raw = get(NS + t);
    if (raw == null) return null;
    try {
      (d as unknown as Record<string, unknown>)[t] = JSON.parse(raw);
      written.set(t, raw);
    } catch {
      return null;
    }
  }
  return d;
}

/** Write the tables that changed (all of them with `force`). Returns the names written. */
export function save(d: Data, force = false): Table[] {
  const now = new Date().toISOString();
  const meta: Meta = readMeta() ?? { version: DATA_VERSION, updatedAt: now, tables: {} };
  if (meta.version !== DATA_VERSION) {
    meta.version = DATA_VERSION;
    meta.tables = {};
    force = true;
  }
  const changed: Table[] = [];
  for (const t of TABLES) {
    const json = JSON.stringify(d[t]);
    if (!force && written.get(t) === json) continue;
    if (put(NS + t, json)) {
      written.set(t, json);
      meta.tables[t] = { rows: (d[t] as unknown[]).length, updatedAt: now };
      changed.push(t);
    }
  }
  if (changed.length) {
    meta.updatedAt = now;
    put(META_KEY, JSON.stringify(meta));
  }
  return changed;
}

/** Remove every database key (the next load reseeds). */
export function clear() {
  for (const t of TABLES) del(NS + t);
  del(META_KEY);
  del(DRAFT_KEY);
  written.clear();
}

/** Rows and bytes per table, as stored right now. */
export function stats() {
  const meta = readMeta();
  return TABLES.map((t) => {
    const raw = get(NS + t) ?? "";
    return { table: t, key: NS + t, rows: meta?.tables[t]?.rows ?? 0, bytes: raw.length * 2, updatedAt: meta?.tables[t]?.updatedAt };
  });
}

/** Everything this origin keeps in localStorage, in bytes (UTF-16, as browsers count the quota). */
export function usedBytes() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch {
    /* ignore */
  }
  return n;
}

/** A backup file of the whole database. */
export function dump(d: Data) {
  return JSON.stringify({ app: "consigncare", version: DATA_VERSION, exportedAt: new Date().toISOString(), tables: Object.fromEntries(TABLES.map((t) => [t, d[t]])) }, null, 2);
}

/** Read a backup file; throws when it is not one of ours or is from another data version. */
export function parseDump(text: string): Data {
  const j = JSON.parse(text);
  if (j?.app !== "consigncare" || !j.tables) throw new Error("not a ConsignCare backup");
  if (j.version !== DATA_VERSION) throw new Error(`backup is data version ${j.version}, this build uses ${DATA_VERSION}`);
  const d = { version: DATA_VERSION } as Data;
  for (const t of TABLES) {
    if (!Array.isArray(j.tables[t])) throw new Error(`table "${t}" is missing`);
    (d as unknown as Record<string, unknown>)[t] = j.tables[t];
  }
  return d;
}

/** Databases saved before the per-table layout kept everything under one key. */
function migrateLegacy(): Data | null {
  const raw = get(LEGACY_KEY);
  if (!raw) return null;
  del(LEGACY_KEY);
  try {
    const d = JSON.parse(raw) as Data;
    if (d.version !== DATA_VERSION) return null;
    save(d, true);
    return d;
  } catch {
    return null;
  }
}

export const draft = {
  load(): OcrDraft | undefined {
    try {
      return JSON.parse(get(DRAFT_KEY) ?? "null") ?? undefined;
    } catch {
      return undefined;
    }
  },
  save(d?: OcrDraft) {
    if (d) put(DRAFT_KEY, JSON.stringify(d));
    else del(DRAFT_KEY);
  },
};
