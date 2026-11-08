"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { EmptyState, Input, PageLoader, Tabs, cx } from "@/components/ui";
import { useFmt } from "@/lib/format";
import { DEMO_TODAY, addDays } from "@/lib/ops";
import { inMonth, name, usageRows } from "@/lib/selectors";
import { useData } from "@/lib/store";

type DateF = "all" | "7d" | "month";
type View = "hn" | "item";

function Chip({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  const active = value !== "all";
  return (
    <label className={cx("relative inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1", active ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200")}>
      {active ? options.find((o) => o.v === value)?.l : label}
      <span className="ml-1 text-[9px]">▼</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        <option value="all">{label}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function UsagePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UsageCenter />
    </Suspense>
  );
}

function UsageCenter() {
  const sp = useSearchParams();
  const { t, lang, date } = useFmt();
  const d = useData();
  const me = useMe();
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("hn");
  const [df, setDf] = useState<DateF>(sp.get("d") === "month" ? "month" : "all");
  const [hf, setHf] = useState("all");
  const [pf, setPf] = useState("all");

  const rows = usageRows(d)
    .filter((r) => me.hospitalIds.includes(r.c.hospitalId))
    .filter((r) => (df === "all" ? true : df === "month" ? inMonth(r.c.caseDate) : r.c.caseDate >= addDays(DEMO_TODAY, -7)))
    .filter((r) => hf === "all" || r.c.hospitalId === hf)
    .filter((r) => pf === "all" || r.product.id === pf)
    .filter((r) => {
      if (!q) return true;
      const h = d.hospitals.find((x) => x.id === r.c.hospitalId);
      const doc = d.doctors.find((x) => x.id === r.c.doctorId);
      return `${r.product.name} ${r.product.ref} ${h?.name} ${h?.nameTh} ${doc?.name} ${doc?.nameTh} ${r.c.no} ${r.c.patientHn ?? ""}`.toLowerCase().includes(q.toLowerCase());
    });

  const totalQty = rows.reduce((s, r) => s + r.u.qty, 0);
  const anyFilter = df !== "all" || hf !== "all" || pf !== "all" || q;

  // By HN: one block per patient (case), with the pieces used on that patient
  const byHn = new Map<string, { key: string; hn?: string; caseNo: string; date: string; hospital: string; items: typeof rows }>();
  for (const r of rows) {
    const block =
      byHn.get(r.c.id) ??
      { key: r.c.id, hn: r.c.patientHn, caseNo: r.c.no, date: r.c.caseDate, hospital: name(d.hospitals.find((h) => h.id === r.c.hospitalId), lang), items: [] as typeof rows };
    block.items.push(r);
    byHn.set(r.c.id, block);
  }
  const hnBlocks = [...byHn.values()];

  const isDone = (status: string) => ["BILLED", "CLOSED"].includes(status);

  return (
    <MScreen title={t("m.usage.title")} back="/m/home">
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("m.usage.search")} className="h-11 pl-9" />
        </div>
        <Tabs
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={view}
          onChange={setView}
          tabs={[
            { id: "hn", label: t("m.usage.byHn"), count: hnBlocks.length },
            { id: "item", label: t("m.usage.byItem"), count: rows.length },
          ]}
        />
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
          <Chip
            label={t("g.date")}
            value={df}
            onChange={(v) => setDf(v as DateF)}
            options={[
              { v: "7d", l: t("m.usage.last7") },
              { v: "month", l: t("m.cases.thisMonth") },
            ]}
          />
          <Chip label={t("g.hospital")} value={hf} onChange={setHf} options={d.hospitals.filter((h) => me.hospitalIds.includes(h.id)).map((h) => ({ v: h.id, l: name(h, lang) }))} />
          <Chip label={t("g.product")} value={pf} onChange={setPf} options={d.products.filter((p) => p.category !== "Pharmaceutical").map((p) => ({ v: p.id, l: p.name }))} />
          {anyFilter && (
            <button
              onClick={() => {
                setDf("all");
                setHf("all");
                setPf("all");
                setQ("");
              }}
              className="flex shrink-0 items-center gap-0.5 text-xs text-slate-500"
            >
              <X className="h-3.5 w-3.5" /> {t("m.usage.clear")}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">{t("m.usage.summary", { n: rows.length, q: totalQty })}</p>

        {rows.length === 0 ? (
          <EmptyState title={t("g.noResults")} />
        ) : view === "hn" ? (
          <div className="space-y-3">
            {hnBlocks.map((b) => (
              <div key={b.key} className="rounded-xl bg-white p-3 shadow-card">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">HN {b.hn ?? t("m.usage.noHn")}</p>
                    <p className="truncate text-xs text-slate-500">{b.hospital}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-slate-400">{date(b.date)}</p>
                    <Link href={`/m/cases/${b.key}`} className="text-xs font-semibold text-brand-600">
                      {t("g.case")} {b.caseNo}
                    </Link>
                  </div>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {b.items.map(({ u, c, product }) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{product.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <b className="text-slate-800">×{u.qty}</b>
                        <span className={cx("h-2 w-2 rounded-full", isDone(c.status) ? "bg-emerald-500" : "bg-orange-400")} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ol className="relative ml-2 border-l-2 border-slate-200 pl-5">
            {rows.map(({ u, c, product }) => {
              const done = isDone(c.status);
              return (
                <li key={u.id} className="relative pb-4">
                  <span className={cx("absolute -left-[29px] top-1 h-4 w-4 rounded-full ring-4 ring-slate-50", done ? "bg-emerald-500" : "bg-orange-400")} />
                  <Link href={`/m/cases/${c.id}`} className="block rounded-xl bg-white p-3 shadow-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400">{date(c.caseDate)}</p>
                        <p className="truncate text-sm font-semibold text-slate-800">{product.name}</p>
                        <p className="truncate text-xs text-slate-500">{name(d.hospitals.find((h) => h.id === c.hospitalId), lang)}</p>
                        <p className="text-xs text-slate-500">
                          HN <b className="text-slate-700">{c.patientHn ?? t("m.usage.noHn")}</b> · {t("g.case")} <b className="text-slate-700">{c.no}</b>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">
                          {t("g.qty")} <b className="text-slate-800">{u.qty}</b>
                        </p>
                        <span
                          className={cx(
                            "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                            done ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-orange-50 text-orange-700 ring-orange-200",
                          )}
                        >
                          {t(`cs.${c.status}`)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </MScreen>
  );
}
