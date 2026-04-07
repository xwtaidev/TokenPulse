import type React from "react";
import Image from "next/image";
import {
  CalendarBlank,
  CalendarCheck,
  CalendarDots,
  ChartDonut,
  CirclesFour,
  Database,
  GithubLogo,
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
import { SyncDataButton } from "@/components/sync-data-button";
import { TokenTrendCard } from "@/components/dashboard/token-trend-card";
import { ThemeModeSelect } from "@/components/theme-mode-select";
import { TokenUnitToggle } from "@/components/token-unit-toggle";
import {
  aggregateByModel,
  loadDashboardData,
} from "@/lib/dashboard-data";
import { formatTokenByUnit, formatUsd, type TokenDisplayUnit } from "@/lib/formatters";

type HomeProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const rawUnit = resolvedSearchParams.unit;
  const unitParam = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
  const tokenUnit: TokenDisplayUnit = unitParam === "yi" ? "yi" : "m";

  const data = await loadDashboardData();
  const modelTotals = aggregateByModel(data.daily);

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
    shapeClass: string;
  }[] = [
    {
      title: "Token使用总量",
      tokenValue: totalTokensAllTime,
      usdValue: totalCostAllTime,
      period: "历史累计",
      icon: Database,
      iconBgClass: "bg-[#F2EFFB] dark:bg-[#2D2850]",
      iconClass: "text-[#7F6CEB] dark:text-[#B7AAFF]",
      shapeClass:
        "absolute -right-[52%] -bottom-[54%] h-[116%] w-[116%] rounded-[58%_42%_52%_48%/54%_46%_58%_42%] bg-[#F2EEFF] opacity-80 dark:bg-[#3B2F6A] dark:opacity-68",
    },
    {
      title: "近一个月Token使用总量",
      tokenValue: totalTokensLast30Days,
      usdValue: totalCostLast30Days,
      period: "最近30天",
      icon: CalendarBlank,
      iconBgClass: "bg-[#EEF6FF] dark:bg-[#23385A]",
      iconClass: "text-[#4476D9] dark:text-[#83AEFF]",
      shapeClass:
        "absolute -right-[46%] -top-[56%] h-[112%] w-[108%] rounded-[44%_56%_40%_60%/60%_42%_58%_40%] bg-[#EEF5FF] opacity-80 dark:bg-[#2B436C] dark:opacity-64",
    },
    {
      title: "仅7天Token使用总量",
      tokenValue: totalTokensLast7Days,
      usdValue: totalCostLast7Days,
      period: "最近7天",
      icon: CalendarDots,
      iconBgClass: "bg-[#EEFDF5] dark:bg-[#21423C]",
      iconClass: "text-[#2E9155] dark:text-[#7BC8A1]",
      shapeClass:
        "absolute -right-[56%] -bottom-[56%] h-[120%] w-[112%] rounded-[62%_38%_46%_54%/52%_48%_60%_40%] bg-[#ECFAF2] opacity-80 dark:bg-[#2A5A4E] dark:opacity-62",
    },
    {
      title: "当天Token使用总量",
      tokenValue: totalTokensToday,
      usdValue: totalCostToday,
      period: latestRecord?.date ?? "当日",
      icon: CalendarCheck,
      iconBgClass: "bg-[#FFF5EE] dark:bg-[#4A3528]",
      iconClass: "text-[#CC7A3D] dark:text-[#F1B787]",
      shapeClass:
        "absolute -right-[52%] -top-[52%] h-[116%] w-[112%] rounded-[50%_50%_36%_64%/62%_45%_55%_38%] bg-[#FFF5ED] opacity-80 dark:bg-[#6A4630] dark:opacity-60",
    },
  ];

  const budgetItems = modelTotals.map((item) => ({
    name: item.model,
    value: item.total_cost_usd,
  }));

  const topTokenDays = [...data.daily]
    .sort((a, b) => b.total_tokens - a.total_tokens)
    .slice(0, 8)
    .map((day) => ({
      date: day.date,
      totalTokens: day.total_tokens,
      inputTokens: day.input_tokens,
      outputTokens: day.output_tokens,
      costUsd: day.total_cost_usd,
    }));

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#ECECF1] p-4 dark:bg-[#0E0F16]">
      <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-[240px_1fr]">
        <aside className="flex h-full flex-col rounded-[22px] border border-[#DAD9E2] bg-[#E7E6EE] p-4 dark:border-[#2C2F43] dark:bg-[#171927]">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-[10px]">
              <Image
                src="/tokenpulse-app-icon.png"
                alt="TokenPulse Icon"
                width={36}
                height={36}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <p className="text-[30px] font-semibold tracking-tight text-[#262338] dark:text-[#ECEBFF]">TokenPulse</p>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3 rounded-2xl bg-[#7F6CEB] px-3 py-2.5 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-[#6B56F5]">
              <CirclesFour size={16} weight="fill" />
              Dashboard
            </div>
          </div>

          <div className="mt-auto pt-4">
            <TokenUnitToggle initialUnit={tokenUnit} />
          </div>
        </aside>

        <main className="h-full space-y-3 overflow-y-auto overflow-x-hidden rounded-[22px] border border-[#DAD9E2] bg-[#F6F6F9] p-4 dark:border-[#2C2F43] dark:bg-[#141624]">
            <header className="flex flex-wrap items-start justify-between gap-3 px-1 py-1">
              <div>
                <h1 className="text-[30px] leading-none font-semibold tracking-tight text-[#1F1D2E] dark:text-[#F2F1FF]">
                  Dashboard Overview
                </h1>
                <p className="mt-1 text-sm text-[#7F7A90] dark:text-[#A9A6C1]">Welcome back, XuWeiteng</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <ThemeModeSelect />
                <SyncDataButton />
                <a
                  href="https://github.com/xwtaidev/TokenPulse"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open TokenPulse repository on GitHub"
                  className="flex items-center justify-start gap-2 rounded-full border border-[#DAD9E2] bg-white px-3.5 py-1.5 pr-4 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB]">
                    <GithubLogo size={18} weight="fill" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#2E2B3F] dark:text-[#EFEFFF]">XuWeiteng</p>
                    <p className="text-[11px] text-[#9C98AA] dark:text-[#A39FBE]">xwtaidev@gmail.com</p>
                  </div>
                </a>
              </div>
            </header>

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              {topMetricCards.map((card) => {
                const CardIcon = card.icon;
                const valueText = formatTokenByUnit(card.tokenValue, tokenUnit);
                return (
                  <article
                    key={card.title}
                    className="relative grid min-h-[192px] grid-rows-[54px_auto_auto] overflow-hidden rounded-[22px] border border-[#DCDCE5] bg-white p-4 shadow-[0_8px_18px_-14px_rgba(45,37,92,0.26)] dark:border-[#323750] dark:bg-[#1B1E2F] dark:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.9)]"
                  >
                    <div aria-hidden className={card.shapeClass} />
                    <div className="relative z-10 flex min-h-[54px] items-center justify-between gap-3">
                      <p className="max-w-[78%] text-[22px] leading-tight font-medium text-[#272438] dark:text-[#EDEBFF]">
                        {card.title}
                      </p>
                      <div
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#DDDCE5] dark:border-[#454964] ${card.iconBgClass}`}
                      >
                        <CardIcon size={17} weight="duotone" className={card.iconClass} />
                      </div>
                    </div>
                    <div className="relative z-10 grid grid-cols-[1fr_auto] items-end gap-3">
                      <p className="text-[40px] leading-none font-semibold tracking-tight text-[#201E31] dark:text-[#FBFAFF]">
                        {valueText}
                      </p>
                      <p className="justify-self-end text-right text-[24px] leading-none font-semibold tracking-tight text-[#464158] dark:text-[#DAD6F3]">
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
                        <span className="text-[#9A97A9] dark:text-[#AAA7C2]">Token Volume</span>
                      </div>
                      <span className="justify-self-end text-right text-[10px] font-medium tracking-wide text-[#8E89A1] uppercase dark:text-[#B4B1CC]">
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
                  amountUsd: item.total_cost_usd,
                }))}
                tokenUnit={tokenUnit}
              />
            </section>

            <section className="grid grid-cols-1 gap-3 xl:items-stretch xl:grid-cols-[1.75fr_1fr]">
              <article className="flex h-full flex-col rounded-[22px] border border-[#DCDCE5] bg-white p-4 dark:border-[#323750] dark:bg-[#1B1E2F]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[30px] font-semibold text-[#242135] dark:text-[#F2F1FF]">Top Token Days</p>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-[#DCDCE5] px-3 py-1 text-xs text-[#5F5C72] dark:border-[#444A66] dark:text-[#C0BDDA]">
                      Top 8 by total tokens
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-auto rounded-xl border border-[#E6E5EE] dark:border-[#3C425E]">
                  <Table>
                    <TableHeader className="bg-[#F2EFFB] dark:bg-[#242841]">
                      <TableRow className="border-[#E3E1ED] dark:border-[#414664]">
                        <TableHead className="text-center">DATE</TableHead>
                        <TableHead className="text-center">
                          TOTAL TOKENS ({tokenUnit === "m" ? "M" : "亿"})
                        </TableHead>
                        <TableHead className="text-center">
                          INPUT TOKENS ({tokenUnit === "m" ? "M" : "亿"})
                        </TableHead>
                        <TableHead className="text-center">
                          OUTPUT TOKENS ({tokenUnit === "m" ? "M" : "亿"})
                        </TableHead>
                        <TableHead className="text-center">COST (USD)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topTokenDays.map((row, idx) => (
                        <TableRow key={`${row.date}-${idx}`} className="border-[#EFEEF4] dark:border-[#393E5A]">
                          <TableCell className="text-center">{row.date}</TableCell>
                          <TableCell className="text-center font-medium text-[#2A273A] dark:text-[#ECEBFF]">
                            {formatTokenByUnit(row.totalTokens, tokenUnit)}
                          </TableCell>
                          <TableCell className="text-center">{formatTokenByUnit(row.inputTokens, tokenUnit)}</TableCell>
                          <TableCell className="text-center">{formatTokenByUnit(row.outputTokens, tokenUnit)}</TableCell>
                          <TableCell className="text-center">{formatUsd(row.costUsd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </article>

              <article className="flex h-full flex-col overflow-hidden rounded-[22px] border border-[#DCDCE5] bg-white p-4 dark:border-[#323750] dark:bg-[#1B1E2F]">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[30px] font-semibold text-[#242135] dark:text-[#F2F1FF]">Model Cost Share</p>
                  <button className="grid h-9 w-9 place-items-center rounded-full border border-[#DDDCE5] text-[#7A778D] dark:border-[#444A66] dark:text-[#C4C0DF]">
                    <ChartDonut size={16} weight="duotone" />
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
