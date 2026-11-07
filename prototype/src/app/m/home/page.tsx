"use client";

import { Bell, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LangToggle } from "@/components/LangToggle";
import { ActivityRow, useMe } from "@/components/mobile/bits";
import { MScreen } from "@/components/mobile/MScreen";
import { Avatar } from "@/components/PersonaSwitcher";
import { Button, EmptyState, StatTile } from "@/components/ui";
import { useT } from "@/i18n";
import { accountStats, name } from "@/lib/selectors";
import { useFmt } from "@/lib/format";
import { useData } from "@/lib/store";

export default function HomePage() {
  const { t, lang } = useT();
  const router = useRouter();
  const d = useData();
  const me = useMe();
  const stats = accountStats(d, me.hospitalIds);
  const { money } = useFmt();
  const unread = d.notifications.filter((n) => (n.userId === me.id || n.userId === "*") && !n.read).length;
  const activity = d.activity.filter((a) => !a.hospitalId || me.hospitalIds.includes(a.hospitalId)).slice(0, 6);

  return (
    <MScreen
      header={
        <div className="px-4 pb-2 pt-3">
          <div className="flex items-center gap-3">
            <Link href="/m/settings">
              <Avatar user={me} size={44} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{t("m.home.hello", { name: name(me, lang) })}</p>
              <p className="text-xs text-white/70">{t(`role.${me.role}`)}</p>
            </div>
            <LangToggle dark />
            <Link href="/m/notifications" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold">{unread}</span>}
            </Link>
          </div>
        </div>
      }
    >
      <div className="h-10 bg-navy-700 @3xl/app:hidden" />
      <div className="-mt-10 space-y-5 pb-6 @3xl/app:mt-0 @3xl/app:pt-5">
        <div className="relative mx-4 rounded-3xl bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              {t("m.home.myAccounts")} ({me.hospitalIds.length})
            </h2>
            <Link href="/m/accounts" className="text-xs font-semibold text-brand-600">
              {t("g.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 @3xl/app:grid-cols-5">
            <StatTile tone="purple" value={stats.usageMonth} label={t("m.home.usage")} onClick={() => router.push("/m/usage?d=month")} />
            <StatTile tone="blue" value={stats.quotation} label={t("m.home.quotation")} onClick={() => router.push("/m/cases?f=po&s=accounts")} />
            <StatTile tone="green" value={<span className="text-lg">{money(stats.accrual, 0)}</span>} label={t("m.home.accrual")} onClick={() => router.push("/m/cases?f=accrual&s=accounts")} />
            <StatTile tone="slate" value={stats.writeOff} label={t("m.home.writeOff")} onClick={() => router.push("/m/expiry?t=expired")} />
            <StatTile tone="rose" value={stats.nearExp} label={t("m.home.nearExp")} className="col-span-2 @3xl/app:col-span-1" onClick={() => router.push("/m/expiry?t=near")} />
          </div>
          <Link href="/m/cases/new" className="mt-3 block">
            <Button size="lg" className="w-full">
              <Plus className="h-5 w-5" /> {t("m.home.newCase")}
            </Button>
          </Link>
        </div>

        <div className="mx-4 rounded-3xl bg-white px-4 pb-2 pt-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">{t("m.home.recentActivity")}</h2>
            <Link href="/m/notifications" className="text-xs font-semibold text-brand-600">
              {t("g.viewAll")}
            </Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState title={t("g.noData")} />
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((a) => (
                <ActivityRow key={a.id} a={a} d={d} />
              ))}
            </div>
          )}
        </div>

        <Link href="/m/settings" className="mx-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Settings className="h-3.5 w-3.5" /> {t("g.settings")}
        </Link>
      </div>
    </MScreen>
  );
}
