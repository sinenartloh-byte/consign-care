"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { toast } from "@/components/toast";
import { Button, EmptyState, Input, Modal, PageLoader, Tabs, cx } from "@/components/ui";
import { useFmt } from "@/lib/format";
import * as ops from "@/lib/ops";
import { accountExpiry, name, NEAR_EXP_DAYS } from "@/lib/selectors";
import { useData, useOp } from "@/lib/store";

type T = "near" | "expired";
type Row = ReturnType<typeof accountExpiry>[number];

export default function ExpiryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ExpiryList />
    </Suspense>
  );
}

/**
 * Consignment stock at the rep's hospitals that is expired (to write off) or expires within 90 days.
 * A near-exp lot can be actioned: a requisition for a replacement, or an accrual that moves the units into PO wait.
 */
function ExpiryList() {
  const { t, lang, date } = useFmt();
  const sp = useSearchParams();
  const router = useRouter();
  const d = useData();
  const me = useMe();
  const run = useOp();
  const [tab, setTab] = useState<T>(sp.get("t") === "expired" ? "expired" : "near");
  const [picked, setPicked] = useState<Row | null>(null);
  const [qty, setQty] = useState(1);

  const all = accountExpiry(d, me.hospitalIds);
  const near = all.filter((x) => x.daysLeft >= 0 && x.daysLeft <= NEAR_EXP_DAYS);
  const expired = all.filter((x) => x.daysLeft < 0);
  const rows = tab === "near" ? near : expired;
  const qtySum = (xs: typeof all) => xs.reduce((s, x) => s + x.qty, 0);
  const pickedQty = picked ? Math.min(Math.max(1, Math.floor(qty) || 1), picked.qty) : 0;

  const open = (x: Row) => {
    setPicked(x);
    setQty(x.qty);
  };
  const close = () => setPicked(null);

  const doRequisition = () => {
    if (!picked || pickedQty <= 0) return;
    const rq = run(ops.requestNearExpReplacement, {
      hospitalId: picked.hospitalId,
      productId: picked.product.id,
      lotId: picked.lot.id,
      qty: pickedQty,
    });
    close();
    if (rq) toast.success(t("m.exp.reqDone", { no: rq.no }));
    router.push("/m/documents?t=requisition");
  };

  const doAccrual = () => {
    if (!picked || pickedQty <= 0) return;
    const acc = run(ops.accrueNearExp, {
      hospitalId: picked.hospitalId,
      productId: picked.product.id,
      lotId: picked.lot.id,
      qty: pickedQty,
    });
    close();
    if (acc) toast.success(t("m.exp.accDone", { no: acc.no }));
    router.push("/m/documents?t=accrual");
  };

  return (
    <MScreen title={t("m.exp.title")} back="/m/home">
      <div className="space-y-3 p-4">
        <Tabs
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "near", label: t("m.exp.near"), count: qtySum(near) },
            { id: "expired", label: t("m.exp.writeOff"), count: qtySum(expired) },
          ]}
        />
        <p className="text-xs text-slate-500">{t("m.exp.summary", { n: rows.length, q: qtySum(rows) })}</p>
        {tab === "near" && rows.length > 0 && <p className="text-xs font-medium text-rose-600">{t("m.exp.tapHint")}</p>}
        {rows.length === 0 ? (
          <EmptyState title={t("m.exp.empty")} />
        ) : (
          <div className="space-y-2">
            {rows.map((x) => {
              const card = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{x.product.name}</p>
                    <p className="truncate text-xs text-slate-500">{name(d.hospitals.find((h) => h.id === x.hospitalId), lang)}</p>
                    <p className="text-xs text-slate-500">
                      LOT <b className="text-slate-700">{x.lot.lotNo}</b> · EXP {date(x.lot.expiryDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-800">{x.qty}</p>
                    <p className={cx("text-[11px] font-medium", x.daysLeft < 0 ? "text-slate-500" : x.daysLeft <= 30 ? "text-rose-600" : "text-orange-600")}>
                      {x.daysLeft < 0 ? t("m.exp.expiredAgo", { n: -x.daysLeft }) : t("m.exp.daysLeft", { n: x.daysLeft })}
                    </p>
                  </div>
                </>
              );
              return tab === "near" ? (
                <button
                  key={`${x.hospitalId}-${x.lot.id}`}
                  onClick={() => open(x)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl bg-white p-3 text-left shadow-card ring-1 ring-rose-100 transition hover:bg-rose-50/40 active:scale-[0.99]"
                >
                  {card}
                </button>
              ) : (
                <Link
                  key={`${x.hospitalId}-${x.lot.id}`}
                  href={`/m/products/${x.product.id}?lot=${x.lot.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-card"
                >
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!picked} onClose={close} title={t("m.exp.pickTitle")}>
        {picked && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">{picked.product.name}</p>
              <p className="text-xs text-slate-500">{name(d.hospitals.find((h) => h.id === picked.hospitalId), lang)}</p>
              <p className="text-xs text-slate-500">
                LOT <b className="text-slate-700">{picked.lot.lotNo}</b> · EXP {date(picked.lot.expiryDate)} ·{" "}
                {t("m.exp.daysLeft", { n: picked.daysLeft })}
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-600">
              {t("m.exp.qtySelected", { n: picked.qty })}
              <Input type="number" min={1} max={picked.qty} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 h-11" />
            </label>
            <div className="grid gap-2">
              <button onClick={doRequisition} className="rounded-2xl bg-blue-50 p-4 text-left ring-1 ring-blue-200 hover:bg-blue-100 active:scale-[0.99]">
                <p className="text-sm font-bold text-blue-700">{t("m.exp.doReq")}</p>
                <p className="text-xs text-blue-700/80">{t("m.exp.doReqHint")}</p>
              </button>
              <button onClick={doAccrual} className="rounded-2xl bg-emerald-50 p-4 text-left ring-1 ring-emerald-200 hover:bg-emerald-100 active:scale-[0.99]">
                <p className="text-sm font-bold text-emerald-700">{t("m.exp.doAcc")}</p>
                <p className="text-xs text-emerald-700/80">{t("m.exp.doAccHint")}</p>
              </button>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={close}>
                {t("g.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </MScreen>
  );
}
