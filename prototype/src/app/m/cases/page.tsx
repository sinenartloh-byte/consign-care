"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CaseRow, useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { EmptyState, Input, PageLoader, Tabs, cx } from "@/components/ui";
import { useT } from "@/i18n";
import { ACCRUAL, inMonth, isOpen, WAITING_BILLING, WAITING_PO } from "@/lib/selectors";
import { useData } from "@/lib/store";
import type { Case } from "@/lib/types";

type F = "all" | "month" | "open" | "po" | "billing" | "accrual" | "closed";
const FILTERS: Record<F, (c: Case) => boolean> = {
  all: () => true,
  month: (c) => inMonth(c.caseDate) && c.status !== "CANCELLED",
  open: isOpen,
  po: (c) => WAITING_PO.includes(c.status),
  billing: (c) => WAITING_BILLING.includes(c.status),
  accrual: (c) => ACCRUAL.includes(c.status),
  closed: (c) => c.status === "CLOSED",
};

export default function CasesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CasesList />
    </Suspense>
  );
}

function CasesList() {
  const { t } = useT();
  const sp = useSearchParams();
  const d = useData();
  const me = useMe();
  const [f, setF] = useState<F>((sp.get("f") as F) in FILTERS ? (sp.get("f") as F) : "all");
  const [scope, setScope] = useState<"mine" | "accounts">(sp.get("s") === "accounts" ? "accounts" : "mine");
  const [q, setQ] = useState("");

  const base = d.cases.filter((c) => (scope === "mine" ? c.repId === me.id : me.hospitalIds.includes(c.hospitalId)));
  const list = base
    .filter(FILTERS[f])
    .filter((c) => {
      if (!q) return true;
      const h = d.hospitals.find((x) => x.id === c.hospitalId);
      return `${c.no} ${h?.name} ${h?.nameTh} ${c.patientHn ?? ""} ${c.patientName ?? ""}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => b.caseDate.localeCompare(a.caseDate) || b.no.localeCompare(a.no));

  const chips: { id: F; label: string }[] = [
    { id: "all", label: t("g.all") },
    { id: "month", label: t("m.cases.thisMonth") },
    { id: "open", label: t("m.cases.open") },
    { id: "po", label: t("m.home.waitingPo") },
    { id: "billing", label: t("m.home.waitingBilling") },
    { id: "accrual", label: t("m.cases.accrual") },
    { id: "closed", label: t("cs.CLOSED") },
  ];

  return (
    <MScreen
      title={t("m.cases.title")}
      right={
        <Link href="/m/cases/new" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="new case">
          <Plus className="h-5 w-5" />
        </Link>
      }
    >
      <div className="space-y-3 p-4">
        <Tabs
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={scope}
          onChange={setScope}
          tabs={[
            { id: "mine", label: t("m.cases.mine") },
            { id: "accounts", label: t("m.cases.allAccounts") },
          ]}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("m.cases.search")} className="h-11 pl-9" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setF(c.id)}
              className={cx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                f === c.id ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-slate-600 ring-slate-200",
              )}
            >
              {c.label} <span className="opacity-60">{base.filter(FILTERS[c.id]).length}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2.5 @3xl/app:grid-cols-2">
          {list.length === 0 && <EmptyState title={t("g.noResults")} className="@3xl/app:col-span-2" />}
          {list.map((c) => (
            <CaseRow key={c.id} c={c} d={d} />
          ))}
        </div>
      </div>
    </MScreen>
  );
}
