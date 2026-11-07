"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { EmptyState, Input, PageLoader, cx } from "@/components/ui";
import { useFmt } from "@/lib/format";
import { DEMO_TODAY, addDays } from "@/lib/ops";
import { inMonth, name, usageRows } from "@/lib/selectors";
import { useData } from "@/lib/store";

type DateF = "all" | "7d" | "month";

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
      return `${r.product.name} ${r.product.ref} ${h?.name} ${h?.nameTh} ${doc?.name} ${doc?.nameTh} ${r.c.no}`.toLowerCase().includes(q.toLowerCase());
    });

  const totalQty = rows.reduce((s, r) => s + r.u.qty, 0);
  const anyFilter = df !== "all" || hf !== "all" || pf !== "all" || q;

  return (
    <MScreen title={t("m.usage.title")} back="/m/home">
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("m.usage.search")} className="h-11 pl-9" />
        </div>
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
        ) : (
          <ol className="relative ml-2 border-l-2 border-slate-200 pl-5">
            {rows.map(({ u, c, product }) => {
              const done = ["BILLED", "CLOSED"].includes(c.status);
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
                          {t("g.case")} <b className="text-slate-700">{c.no}</b>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        {t("g.qty")} <b className="text-slate-800">{u.qty}</b>
                      </span>
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
