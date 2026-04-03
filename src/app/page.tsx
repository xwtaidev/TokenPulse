import type React from "react";
import {
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  CirclesFour,
  Database,
  GithubLogo,
  HouseLine,
  Moon,
  Sparkle,
  SunDim,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BudgetPanel } from "@/components/dashboard/finance-panels";
import { TokenTrendCard } from "@/components/dashboard/token-trend-card";
import {
  aggregateByModel,
  loadDashboardData,
  toDetailRows,
} from "@/lib/dashboard-data";
import { formatUsd } from "@/lib/formatters";

export default async function Home() {
  const data = await loadDashboardData();
  const modelTotals = aggregateByModel(data.daily);
  const detailRows = toDetailRows(data.daily).slice(0, 8);

  const latestRecord = data.daily[data.daily.length - 1];
  const latestDate = latestRecord ? new Date(`${latestRecord.date}T00:00:00`) : null;
  const isWithinNDays = (dateStr: string, n: number): boolean => {
    if (!latestDate) {
      return false;
    }
    const point = new Date(`${dateStr}T00:00:00`);
    const diffDays = (latestDate.getTime() - point.getTime()) / 86_400_000;
    return diffDays >= 0 && diffDays < n;
  };

  const totalTokensAllTime = data.summary.total_tokens;
  const totalCostAllTime = data.summary.total_cost_usd;
  const totalTokensLast30Days = data.daily
    .filter((item) => isWithinNDays(item.date, 30))
    .reduce((sum, item) => sum + item.total_tokens, 0);
  const totalCostLast30Days = data.daily
    .filter((item) => isWithinNDays(item.date, 30))
    .reduce((sum, item) => sum + item.total_cost_usd, 0);
  const totalTokensLast7Days = data.daily
    .filter((item) => isWithinNDays(item.date, 7))
    .reduce((sum, item) => sum + item.total_tokens, 0);
  const totalCostLast7Days = data.daily
    .filter((item) => isWithinNDays(item.date, 7))
    .reduce((sum, item) => sum + item.total_cost_usd, 0);
  const totalTokensToday = latestRecord?.total_tokens ?? 0;
  const totalCostToday = latestRecord?.total_cost_usd ?? 0;

  const topMetricCards: {
    title: string;
    tokenValue: number;
    usdValue: number;
    period: string;
    icon: React.ElementType;
    iconBgClass: string;
    iconClass: string;
    unit: "M";
    shapeClass: string;
  }[] = [
    {
      title: "Token使用总量",
      tokenValue: totalTokensAllTime,
      usdValue: totalCostAllTime,
      period: "历史累计",
      icon: Database,
      iconBgClass: "bg-[#F2EFFB]",
      iconClass: "text-[#7F6CEB]",
      unit: "M",
      shapeClass:
        "absolute -right-[52%] -bottom-[54%] h-[116%] w-[116%] rounded-[58%_42%_52%_48%/54%_46%_58%_42%] bg-[#F2EEFF] opacity-80",
    },
    {
      title: "近一个月Token使用总量",
      tokenValue: totalTokensLast30Days,
      usdValue: totalCostLast30Days,
      period: "最近30天",
      icon: CalendarBlank,
      iconBgClass: "bg-[#EEF6FF]",
      iconClass: "text-[#4476D9]",
      unit: "M",
      shapeClass:
        "absolute -right-[46%] -top-[56%] h-[112%] w-[108%] rounded-[44%_56%_40%_60%/60%_42%_58%_40%] bg-[#EEF5FF] opacity-80",
    },
    {
      title: "仅7天Token使用总量",
      tokenValue: totalTokensLast7Days,
      usdValue: totalCostLast7Days,
      period: "最近7天",
      icon: CalendarDots,
      iconBgClass: "bg-[#EEFDF5]",
      iconClass: "text-[#2E9155]",
      unit: "M",
      shapeClass:
        "absolute -right-[56%] -bottom-[56%] h-[120%] w-[112%] rounded-[62%_38%_46%_54%/52%_48%_60%_40%] bg-[#ECFAF2] opacity-80",
    },
    {
      title: "当天Token使用总量",
      tokenValue: totalTokensToday,
      usdValue: totalCostToday,
      period: latestRecord?.date ?? "当日",
      icon: CalendarCheck,
      iconBgClass: "bg-[#FFF5EE]",
      iconClass: "text-[#CC7A3D]",
      unit: "M",
      shapeClass:
        "absolute -right-[52%] -top-[52%] h-[116%] w-[112%] rounded-[50%_50%_36%_64%/62%_45%_55%_38%] bg-[#FFF5ED] opacity-80",
    },
  ];

  const budgetItems = modelTotals.map((item) => ({
    name: item.model,
    value: item.total_cost_usd,
  }));

  const transactions = detailRows.map((row, idx) => ({
    date: row.date,
    amount: row.total_cost_usd,
    payment: idx % 3 === 0 ? "YouTube" : idx % 3 === 1 ? "Reserved" : "Yaposhka",
    method: idx % 2 === 0 ? "VISA **3254" : "Mastercard **2154",
    category:
      idx % 3 === 0
        ? "Subscription"
        : idx % 3 === 1
          ? "Shopping"
          : "Cafe & Restaurants",
  }));

  const formatMillions = (value: number): string => {
    const rounded = Math.round((value / 1_000_000) * 100) / 100;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(rounded);
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ECECF1] p-4">
      <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[240px_1fr]">
        <aside className="flex h-full flex-col rounded-[22px] border border-[#DAD9E2] bg-[#E7E6EE] p-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#151325] text-[#8B77F0]">
              <Sparkle size={18} weight="fill" />
            </div>
            <p className="text-[30px] font-semibold tracking-tight text-[#262338]">FinSet</p>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3 rounded-2xl bg-[#7F6CEB] px-3 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <CirclesFour size={16} weight="fill" />
              Dashboard
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between rounded-2xl border border-[#D3D2DD] bg-[#ECEBF4] p-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#7F6CEB] text-white">
              <SunDim size={16} />
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full text-[#5D5A70]">
              <Moon size={16} />
            </div>
          </div>
        </aside>

        <main className="h-full space-y-3 overflow-y-auto rounded-[22px] border border-[#DAD9E2] bg-[#F6F6F9] p-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[40px] leading-none font-semibold tracking-tight text-[#1F1D2E]">
                  Welcome back, XuWeiteng!
                </h1>
                <p className="mt-1 text-sm text-[#9490A4]">
                  It is the best time to manage your finances
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center justify-start gap-2 rounded-full border border-[#DAD9E2] bg-white px-3.5 py-1.5 pr-4">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB]">
                      <GithubLogo size={18} weight="fill" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#2E2B3F]">XuWeiteng</p>
                      <p className="text-[11px] text-[#9C98AA]">xwtaidev@gmail.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              {topMetricCards.map((card) => {
                const CardIcon = card.icon;
                const valueText = `${formatMillions(card.tokenValue)}${card.unit}`;
                return (
                  <article
                    key={card.title}
                    className="relative grid min-h-[192px] grid-rows-[54px_auto_auto] overflow-hidden rounded-[22px] border border-[#DCDCE5] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(45,37,92,0.26)]"
                  >
                    <div aria-hidden className={card.shapeClass} />
                    <div className="relative z-10 flex min-h-[54px] items-center justify-between gap-3">
                      <p className="max-w-[78%] text-[22px] leading-tight font-medium text-[#272438]">
                        {card.title}
                      </p>
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#DDDCE5] ${card.iconBgClass}`}
                      >
                        <CardIcon size={17} weight="duotone" className={card.iconClass} />
                      </div>
                    </div>
                    <div className="relative z-10 grid grid-cols-[1fr_auto] items-end gap-3">
                      <p className="text-[40px] leading-none font-semibold tracking-tight text-[#201E31]">
                        {valueText}
                      </p>
                      <p className="justify-self-end text-right text-[24px] leading-none font-semibold tracking-tight text-[#464158]">
                        {formatUsd(card.usdValue)}
                      </p>
                    </div>
                    <div className="relative z-10 mt-2 grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`rounded-full px-2.5 py-1 ${card.iconBgClass} ${card.iconClass}`}
                        >
                          {card.period}
                        </Badge>
                        <span className="text-[#9A97A9]">Token Volume</span>
                      </div>
                      <span className="justify-self-end text-right text-[10px] font-medium tracking-wide text-[#8E89A1] uppercase">
                        USD Cost
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="grid grid-cols-1 gap-3">
              <TokenTrendCard
                points={data.daily.map((item) => ({
                  date: item.date,
                  inputTokens: item.input_tokens,
                  outputTokens: item.output_tokens,
                  tokens: item.total_tokens,
                }))}
              />
            </section>

            <section className="grid grid-cols-1 gap-3 xl:items-start xl:grid-cols-[1.75fr_1fr]">
              <article className="h-fit rounded-[22px] border border-[#DCDCE5] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[30px] font-semibold text-[#242135]">Recent transactions</p>
                  <div className="flex gap-2">
                    <button className="rounded-full border border-[#DCDCE5] px-3 py-1 text-xs text-[#5F5C72]">
                      All accounts
                    </button>
                    <button className="rounded-full border border-[#DCDCE5] px-3 py-1 text-xs text-[#5F5C72]">
                      See all
                    </button>
                  </div>
                </div>
                <div className="overflow-auto rounded-2xl border border-[#E6E5EE]">
                  <Table>
                    <TableHeader className="bg-[#F2EFFB]">
                      <TableRow className="border-[#E3E1ED]">
                        <TableHead>DATE</TableHead>
                        <TableHead>AMOUNT</TableHead>
                        <TableHead>PAYMENT NAME</TableHead>
                        <TableHead>METHOD</TableHead>
                        <TableHead>CATEGORY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((row, idx) => (
                        <TableRow key={`${row.date}-${idx}`} className="border-[#EFEEF4]">
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="font-medium text-[#2A273A]">
                            - {formatUsd(row.amount)}
                          </TableCell>
                          <TableCell>{row.payment}</TableCell>
                          <TableCell>{row.method}</TableCell>
                          <TableCell>{row.category}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </article>

              <article className="h-fit rounded-[22px] border border-[#DCDCE5] bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[30px] font-semibold text-[#242135]">Budget</p>
                  <button className="grid h-9 w-9 place-items-center rounded-full border border-[#DDDCE5] text-[#7A778D]">
                    <HouseLine size={15} className="-rotate-45" />
                  </button>
                </div>
                <BudgetPanel items={budgetItems} />
              </article>
            </section>
        </main>
      </div>
    </div>
  );
}
