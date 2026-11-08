"use client";

import { Download } from "lucide-react";
import { useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { Button, EmptyState, StatTile } from "@/components/ui";
import { exportExcel } from "@/lib/excel";
import { useFmt } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/ops";
import { docStats, name, usageRows } from "@/lib/selectors";
import { useData } from "@/lib/store";

interface Line {
  hospitalId: string;
  hospital: string;
  productId: string;
  ref: string;
  product: string;
  unit: string;
  qty: number;
  unitPrice: number;
  value: number;
}

/** Centralized usage: every usage record across the rep's accounts, by hospital and product, with an Excel export. */
export default function SummaryPage() {
  const { t, lang, money, date } = useFmt();
  const d = useData();
  const me = useMe();
  const stats = docStats(d, me.hospitalIds);

  const lines = new Map<string, Line>();
  for (const r of usageRows(d).filter((x) => me.hospitalIds.includes(x.c.hospitalId))) {
    const key = `${r.c.hospitalId}|${r.product.id}`;
    const line =
      lines.get(key) ??
      ({
        hospitalId: r.c.hospitalId,
        hospital: name(d.hospitals.find((h) => h.id === r.c.hospitalId), lang),
        productId: r.product.id,
        ref: r.product.ref,
        product: r.product.name,
        unit: r.product.unit,
        qty: 0,
        unitPrice: r.u.unitPrice,
        value: 0,
      } satisfies Line);
    line.qty += r.u.qty;
    line.value += r.u.qty * r.u.unitPrice;
    lines.set(key, line);
  }
  const list = [...lines.values()].sort((a, b) => a.hospital.localeCompare(b.hospital) || b.qty - a.qty);
  const totalQty = list.reduce((s, x) => s + x.qty, 0);
  const totalValue = list.reduce((s, x) => s + x.value, 0);

  const exportAll = () => {
    const rows: (string | number)[][] = [
      [t("m.sum.title"), date(DEMO_TODAY)],
      [],
      ["Document", "Count", "Qty", "Value"],
      ["Usage (this month)", stats.usage.count, stats.usage.qty, ""],
      ["Accrual (PO wait)", stats.accrual.count, stats.accrual.qty, Math.round(stats.accrual.value)],
      ["Requisition (open)", stats.requisition.count, "", ""],
      ["Write off (expired units)", "", stats.writeOff.qty, ""],
      ["Near exp (≤90 days)", "", stats.nearExp.qty, ""],
      [],
      [t("m.sum.hospital"), "REF", t("m.sum.product"), "Unit", t("m.sum.qty"), "Unit price", t("m.sum.value")],
      ...list.map((x) => [x.hospital, x.ref, x.product, x.unit, x.qty, x.unitPrice, Math.round(x.value)]),
      [t("m.sum.total"), "", "", "", totalQty, "", Math.round(totalValue)],
    ];
    exportExcel(`centralized-usage-${DEMO_TODAY}.xlsx`, "Centralized usage", rows);
  };

  return (
    <MScreen title={t("m.sum.title")} back="/m/home">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatTile tone="purple" value={stats.usage.qty} label={t("m.home.usageQty")} />
          <StatTile tone="green" value={<span className="text-lg">{money(stats.accrual.value, 0)}</span>} label={`${t("m.home.accrualDoc")} · ${stats.accrual.count}`} />
          <StatTile tone="blue" value={stats.requisition.count} label={t("m.home.requisitionDoc")} />
          <StatTile tone="slate" value={stats.writeOff.qty} label={t("m.home.writeOffDoc")} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {list.length} · {t("m.sum.qty")} {totalQty} · {money(totalValue, 0)}
          </p>
          <Button size="sm" onClick={exportAll} disabled={list.length === 0}>
            <Download className="h-4 w-4" /> {t("m.sum.export")}
          </Button>
        </div>

        {list.length === 0 ? (
          <EmptyState title={t("m.sum.empty")} />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {list.map((x) => (
              <div key={`${x.hospitalId}-${x.productId}`} className="flex items-start justify-between gap-3 border-b border-slate-100 p-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{x.product}</p>
                  <p className="truncate text-xs text-slate-500">
                    {x.hospital} · {x.ref}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-slate-800">
                    {x.qty} {x.unit}
                  </p>
                  <p className="text-xs text-slate-500">{money(x.value, 0)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MScreen>
  );
}
