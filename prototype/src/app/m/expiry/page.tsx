"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { EmptyState, PageLoader, Tabs, cx } from "@/components/ui";
import { useFmt } from "@/lib/format";
import { accountExpiry, name, NEAR_EXP_DAYS } from "@/lib/selectors";
import { useData } from "@/lib/store";

type T = "near" | "expired";

export default function ExpiryPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ExpiryList />
    </Suspense>
  );
}

/** Consignment stock at the rep's hospitals that is expired (to write off) or expires within 90 days. */
function ExpiryList() {
  const { t, lang, date } = useFmt();
  const sp = useSearchParams();
  const d = useData();
  const me = useMe();
  const [tab, setTab] = useState<T>(sp.get("t") === "expired" ? "expired" : "near");

  const all = accountExpiry(d, me.hospitalIds);
  const near = all.filter((x) => x.daysLeft >= 0 && x.daysLeft <= NEAR_EXP_DAYS);
  const expired = all.filter((x) => x.daysLeft < 0);
  const rows = tab === "near" ? near : expired;
  const qty = (xs: typeof all) => xs.reduce((s, x) => s + x.qty, 0);

  return (
    <MScreen title={t("m.exp.title")} back="/m/home">
      <div className="space-y-3 p-4">
        <Tabs
          variant="pill"
          className="w-full [&>button]:flex-1"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "near", label: t("m.exp.near"), count: qty(near) },
            { id: "expired", label: t("m.exp.writeOff"), count: qty(expired) },
          ]}
        />
        <p className="text-xs text-slate-500">{t("m.exp.summary", { n: rows.length, q: qty(rows) })}</p>
        {rows.length === 0 ? (
          <EmptyState title={t("m.exp.empty")} />
        ) : (
          <div className="space-y-2">
            {rows.map((x) => (
              <Link
                key={`${x.hospitalId}-${x.lot.id}`}
                href={`/m/products/${x.product.id}?lot=${x.lot.id}`}
                className="flex items-start justify-between gap-3 rounded-xl bg-white p-3 shadow-card"
              >
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </MScreen>
  );
}
