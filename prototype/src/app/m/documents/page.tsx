"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { EmptyState, PageLoader, Tabs, cx } from "@/components/ui";
import { useFmt } from "@/lib/format";
import { name } from "@/lib/selectors";
import { useData } from "@/lib/store";

type Doc = "accrual" | "requisition";

export default function DocumentsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Documents />
    </Suspense>
  );
}

/** Accruals (PO wait) and requisitions of the rep's hospitals. */
function Documents() {
  const { t, lang, date, money } = useFmt();
  const sp = useSearchParams();
  const d = useData();
  const me = useMe();
  const [tab, setTab] = useState<Doc>(sp.get("t") === "requisition" ? "requisition" : "accrual");

  const hospitalName = (id: string) => name(d.hospitals.find((h) => h.id === id), lang);
  const productOf = (id: string) => d.products.find((p) => p.id === id);
  const lotOf = (id: string) => d.lots.find((l) => l.id === id);

  const accruals = d.accruals.filter((a) => me.hospitalIds.includes(a.hospitalId) && a.status === "PO_WAIT");
  const requisitions = d.requisitions.filter((r) => r.hospitalId && me.hospitalIds.includes(r.hospitalId));
  const accrualValue = accruals.reduce((s, a) => s + a.qty * a.unitPrice, 0);
  const requisitionQty = requisitions.reduce((s, r) => s + r.items.reduce((a, i) => a + i.qty, 0), 0);

  return (
    <MScreen title={t("m.req.title")} back="/m/home">
      <div className="space-y-3 p-4">
        <Tabs
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "accrual", label: t("m.home.accrualDoc"), count: accruals.length },
            { id: "requisition", label: t("m.home.requisitionDoc"), count: requisitions.length },
          ]}
        />

        {tab === "accrual" ? (
          <>
            <p className="text-xs text-slate-500">
              {accruals.length} · {money(accrualValue, 0)}
            </p>
            {accruals.length === 0 ? (
              <EmptyState title={t("g.noData")} />
            ) : (
              <div className="space-y-2">
                {accruals.map((a) => {
                  const p = productOf(a.productId);
                  const lot = lotOf(a.lotId);
                  return (
                    <div key={a.id} className="rounded-xl bg-white p-3 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400">
                            {a.no} · {date(a.createdAt.slice(0, 10))}
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-800">{p?.name}</p>
                          <p className="truncate text-xs text-slate-500">{hospitalName(a.hospitalId)}</p>
                          <p className="text-xs text-slate-500">
                            LOT <b className="text-slate-700">{lot?.lotNo ?? "-"}</b>
                            {lot && ` · EXP ${date(lot.expiryDate)}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-800">{a.qty}</p>
                          <p className="text-xs text-slate-500">{money(a.qty * a.unitPrice, 0)}</p>
                          <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                            PO wait
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">{t("m.req.summary", { n: requisitions.length, q: requisitionQty })}</p>
            {requisitions.length === 0 ? (
              <EmptyState title={t("m.req.empty")} />
            ) : (
              <div className="space-y-2">
                {requisitions.map((r) => (
                  <div key={r.id} className="rounded-xl bg-white p-3 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400">
                          {r.no} · {date(r.createdAt.slice(0, 10))}
                        </p>
                        <p className="truncate text-sm font-semibold text-slate-800">{hospitalName(r.hospitalId ?? "")}</p>
                        <p className="truncate text-xs text-slate-500">{r.purpose}</p>
                        <ul className="mt-1 space-y-0.5">
                          {r.items.map((i) => (
                            <li key={i.productId} className="truncate text-xs text-slate-600">
                              {productOf(i.productId)?.name} × <b>{i.qty}</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span
                        className={cx(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          r.status === "ISSUED" && "bg-emerald-50 text-emerald-700 ring-emerald-200",
                          (r.status === "SUBMITTED" || r.status === "APPROVED" || r.status === "DRAFT") && "bg-blue-50 text-blue-700 ring-blue-200",
                          r.status === "REJECTED" && "bg-rose-50 text-rose-700 ring-rose-200",
                        )}
                      >
                        {t(`m.req.st.${r.status}`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </MScreen>
  );
}
