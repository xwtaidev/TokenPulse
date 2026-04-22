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
import { FilterCompareControls } from "@/components/dashboard/filter-compare-controls";
import { SyncDataButton } from "@/components/sync-data-button";
import { TokenTrendCard } from "@/components/dashboard/token-trend-card";
import { ThemeModeSelect } from "@/components/theme-mode-select";
import { TokenUnitToggle } from "@/components/token-unit-toggle";
import {
  aggregateByModel,
  loadDashboardData,
  type DailyRecord,
} from "@/lib/dashboard-data";
import { formatTokenByUnit, formatUsd, type TokenDisplayUnit } from "@/lib/formatters";

type HomeProps = {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

type RangeOption = "7" | "30" | "90" | "180" | "all";
type MinTokensOption = "0" | "1000000" | "10000000";

const RANGE_DAYS_MAP: Record<Exclude<RangeOption, "all">, number> = {
  "7": 7,
  "30": 30,
  "90": 90,
  "180": 180,
};

function sumTotals(records: DailyRecord[]) {
  return records.reduce(
    (acc, item) => {
      acc.tokens += item.total_tokens;
      acc.cost += item.total_cost_usd;
      return acc;
    },
    { tokens: 0, cost: 0 },
  );
}

function calcDelta(current: number, previous: number) {
  const absolute = current - previous;
  const pct = previous > 0 ? (absolute / previous) * 100 : null;
  return { absolute, pct };
}

function formatPct(value: number | null): string {
  if (value === null) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function buildModelFilteredRecord(day: DailyRecord, selectedModel: string): DailyRecord {
  if (selectedModel === "all") {
    return day;
  }

  const models = day.models.filter((item) => item.model === selectedModel);
  if (models.length === 0) {
    return {
      ...day,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      total_cost_usd: 0,
      models: [],
    };
  }

  const inputTokens = models.reduce((sum, item) => sum + item.input_tokens, 0);
  const outputTokens = models.reduce((sum, item) => sum + item.output_tokens, 0);
  const totalTokens = models.reduce((sum, item) => sum + item.total_tokens, 0);
  const totalCostUsd = models.reduce((sum, item) => sum + item.total_cost_usd, 0);

  return {
    ...day,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    total_cost_usd: totalCostUsd,
    models,
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const rawUnit = resolvedSearchParams.unit;
  const unitParam = Array.isArray(rawUnit) ? rawUnit[0] : rawUnit;
  const tokenUnit: TokenDisplayUnit = unitParam === "yi" ? "yi" : "m";

  const rawRange = resolvedSearchParams.range;
  const rangeParam = Array.isArray(rawRange) ? rawRange[0] : rawRange;
  const selectedRange: RangeOption =
    rangeParam === "7" ||
    rangeParam === "30" ||
    rangeParam === "90" ||
    rangeParam === "180" ||
    rangeParam === "all"
      ? rangeParam
      : "90";

  const rawMinTokens = resolvedSearchParams.minTokens;
  const minTokensParam = Array.isArray(rawMinTokens) ? rawMinTokens[0] : rawMinTokens;
  const selectedMinTokens: MinTokensOption =
    minTokensParam === "0" || minTokensParam === "1000000" || minTokensParam === "10000000"
      ? minTokensParam
      : "0";

  const rawModel = resolvedSearchParams.model;
  const modelParam = Array.isArray(rawModel) ? rawModel[0] : rawModel;
  const rawFocusDate = resolvedSearchParams.focusDate;
  const focusDateParam = Array.isArray(rawFocusDate) ? rawFocusDate[0] : rawFocusDate;

  const data = await loadDashboardData();
  const selectedModel = modelParam && data.models.includes(modelParam) ? modelParam : "all";

  const modelFilteredDaily = data.daily.map((day) => buildModelFilteredRecord(day, selectedModel));
  const latestNonZeroRecord = [...modelFilteredDaily].reverse().find((item) => item.total_tokens > 0);
  const latestDate = latestNonZeroRecord ? new Date(`${latestNonZeroRecord.date}T00:00:00`) : null;

  const isWithinNDays = (dateStr: string, n: number): boolean => {
    if (!latestDate) {
      return false;
    }
    const point = new Date(`${dateStr}T00:00:00`);
    const diffDays = (latestDate.getTime() - point.getTime()) / 86_400_000;
    return diffDays >= 0 && diffDays < n;
  };

  const rangeDays = selectedRange === "all" ? null : RANGE_DAYS_MAP[selectedRange];
  const minTokensFloor = Number(selectedMinTokens);

  const rangeFilteredDaily =
    rangeDays === null
      ? modelFilteredDaily
      : modelFilteredDaily.filter((item) => isWithinNDays(item.date, rangeDays));

  const filteredDaily = rangeFilteredDaily.filter(
    (item) => item.total_tokens > 0 && item.total_tokens >= minTokensFloor,
  );

  const previousPeriodDaily =
    rangeDays === null || !latestDate
      ? []
      : modelFilteredDaily.filter((item) => {
          if (item.total_tokens <= 0 || item.total_tokens < minTokensFloor) {
            return false;
          }
          const point = new Date(`${item.date}T00:00:00`);
          const diffDays = (latestDate.getTime() - point.getTime()) / 86_400_000;
          return diffDays >= rangeDays && diffDays < rangeDays * 2;
        });

  const currentTotals = sumTotals(filteredDaily);
  const previousTotals = sumTotals(previousPeriodDaily);
  const tokenDelta = calcDelta(currentTotals.tokens, previousTotals.tokens);
  const costDelta = calcDelta(currentTotals.cost, previousTotals.cost);

  const modelTotals = aggregateByModel(filteredDaily);
  const modelEfficiencyRows = modelTotals.map((item) => {
    const pricing = data.pricing[item.model];
    const costPer1m = item.total_tokens > 0 ? (item.total_cost_usd * 1_000_000) / item.total_tokens : 0;
    const outputInputRatio = item.input_tokens > 0 ? item.output_tokens / item.input_tokens : null;
    const cachedInputRatio = item.input_tokens > 0 ? (item.cached_input_tokens / item.input_tokens) * 100 : null;
    const cacheSavingsUsd = item.cache_savings_usd;
    return {
      model: item.model,
      costPer1m,
      outputInputRatio,
      cachedInputRatio,
      cacheSavingsUsd,
      listedInputPrice: pricing?.input_usd_per_1m_tokens ?? 0,
      listedCachedInputPrice: pricing?.cached_input_usd_per_1m_tokens ?? 0,
    };
  });

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
  const totalTokensToday = latestNonZeroRecord?.total_tokens ?? 0;
  const totalCostToday = latestNonZeroRecord?.total_cost_usd ?? 0;

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
      title: "近7天Token使用总量",
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
      period: latestNonZeroRecord?.date ?? "当日",
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

  const topTokenDays = [...filteredDaily]
    .sort((a, b) => b.total_tokens - a.total_tokens)
    .slice(0, 8)
    .map((day) => ({
      date: day.date,
      totalTokens: day.total_tokens,
      inputTokens: day.input_tokens,
      outputTokens: day.output_tokens,
      costUsd: day.total_cost_usd,
    }));
  const focusedTopDay = focusDateParam ? topTokenDays.find((item) => item.date === focusDateParam) : null;
  const topTokenDaysForView =
    focusedTopDay && focusDateParam
      ? [focusedTopDay, ...topTokenDays.filter((item) => item.date !== focusDateParam)]
      : topTokenDays;

  const rangeLabel =
    selectedRange === "all"
      ? "全部历史"
      : `最近 ${RANGE_DAYS_MAP[selectedRange]} 天`;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#ECECF1] p-4 dark:bg-[#0E0F16]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(56,121,255,0.16),transparent_30%),radial-gradient(circle_at_86%_6%,rgba(71,193,157,0.14),transparent_28%)]"
      />
      <div className="relative grid w-full grid-cols-1 gap-4 xl:grid-cols-[252px_1fr]">
        <aside className="flex min-h-[calc(100dvh-2rem)] flex-col rounded-[26px] border border-[#DAD9E2] bg-[#E7E6EE]/88 p-4 shadow-[0_14px_28px_-20px_rgba(20,26,52,0.34),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl dark:border-[#2C2F43] dark:bg-[#171927]/90 dark:shadow-[0_18px_30px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
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
            <p className="text-[28px] font-semibold tracking-tight text-[#262338] dark:text-[#ECEBFF]">TokenPulse</p>
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

        <main className="min-h-[calc(100dvh-2rem)] space-y-4 overflow-x-hidden rounded-[26px] border border-[#DAD9E2]/95 bg-[#F6F6F9]/92 p-4 shadow-[0_20px_40px_-24px_rgba(18,24,46,0.34),inset_0_1px_0_rgba(255,255,255,0.48)] backdrop-blur-xl dark:border-[#2C2F43] dark:bg-[#141624]/92 dark:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <header className="flex flex-wrap items-start justify-between gap-3 px-1 py-2">
            <div>
              <h1 className="text-[34px] leading-none font-semibold tracking-tight text-[#1F1D2E] dark:text-[#F2F1FF]">
                Dashboard Overview
              </h1>
              <p className="mt-1 text-sm text-[#6F6A84] dark:text-[#A9A6C1]">Welcome back, XuWeiteng</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <FilterCompareControls
                models={data.models}
                selectedModel={selectedModel}
                selectedRange={selectedRange}
                selectedMinTokens={selectedMinTokens}
              />
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
                  className="relative grid min-h-[192px] grid-rows-[54px_auto_auto] overflow-hidden rounded-[24px] border border-[#DCDCE5] bg-white p-4 shadow-[0_18px_30px_-22px_rgba(24,38,76,0.52),inset_0_1px_0_rgba(255,255,255,0.6)] transition-transform duration-300 hover:-translate-y-[2px] dark:border-[#323750] dark:bg-[#1B1E2F] dark:shadow-[0_16px_28px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <div aria-hidden className={card.shapeClass} />
                  <div className="relative z-10 flex min-h-[54px] items-center justify-between gap-3">
                      <p className="max-w-[78%] text-[20px] leading-tight font-medium text-[#272438] dark:text-[#EDEBFF]">
                        {card.title}
                      </p>
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#DDDCE5] dark:border-[#454964] ${card.iconBgClass}`}
                    >
                      <CardIcon size={17} weight="duotone" className={card.iconClass} />
                    </div>
                  </div>
                  <div className="relative z-10 grid grid-cols-[1fr_auto] items-end gap-3">
                      <p className="text-[38px] leading-none font-semibold tracking-tight text-[#201E31] dark:text-[#FBFAFF]">
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
              points={filteredDaily.map((item) => ({
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
                <p className="text-[28px] font-semibold text-[#242135] dark:text-[#F2F1FF]">Top Token Days</p>
                <div className="flex gap-2">
                  <span className="rounded-full border border-[#DCDCE5] px-3 py-1 text-xs text-[#5F5C72] dark:border-[#444A66] dark:text-[#C0BDDA]">
                    Top 8 by filtered tokens
                  </span>
                  {focusDateParam ? (
                    <span className="rounded-full border border-[#F1D4B3] bg-[#FFF4E8] px-3 py-1 text-xs text-[#A55E1F] dark:border-[#6A4B2E] dark:bg-[#3A2D23] dark:text-[#F0C89A]">
                      Focus: {focusDateParam}
                    </span>
                  ) : null}
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
                    {topTokenDaysForView.map((row, idx) => (
                      <TableRow
                        key={`${row.date}-${idx}`}
                        className={`border-[#EFEEF4] dark:border-[#393E5A] ${
                          focusDateParam === row.date ? "bg-[#FFF4E8] dark:bg-[#2E261F]" : ""
                        }`}
                      >
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
                <p className="text-[28px] font-semibold text-[#242135] dark:text-[#F2F1FF]">Model Cost Share</p>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-[#DDDCE5] text-[#7A778D] dark:border-[#444A66] dark:text-[#C4C0DF]">
                  <ChartDonut size={16} weight="duotone" />
                </button>
              </div>
              <BudgetPanel items={budgetItems} />
            </article>
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-stretch">
            <article className="rounded-[22px] border border-[#DCDCE5] bg-white p-4 dark:border-[#323750] dark:bg-[#1B1E2F]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[24px] font-semibold text-[#242135] dark:text-[#F2F1FF]">筛选结果对比</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="rounded-full bg-[#EEF6FF] text-[#3E6CC7] dark:bg-[#243758] dark:text-[#A8C4FF]">
                    范围：{rangeLabel}
                  </Badge>
                  <Badge className="rounded-full bg-[#EEFDF5] text-[#2F8952] dark:bg-[#21423C] dark:text-[#8DD5AE]">
                    模型：{selectedModel === "all" ? "全部" : selectedModel}
                  </Badge>
                  <Badge className="rounded-full bg-[#FFF5EE] text-[#AD6A33] dark:bg-[#4A3528] dark:text-[#F1B787]">
                    阈值：{selectedMinTokens === "0" ? "不限" : `≥ ${formatTokenByUnit(Number(selectedMinTokens), "m", 0)}`}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="rounded-xl border border-[#E7E5EF] p-3 dark:border-[#3A3F5D]">
                  <p className="text-xs text-[#8A869D] dark:text-[#B8B4D0]">Token 对比</p>
                  <p className="mt-1 text-2xl font-semibold text-[#252238] dark:text-[#F3F1FF]">
                    当前 {formatTokenByUnit(currentTotals.tokens, tokenUnit)}
                  </p>
                  {rangeDays === null ? (
                    <p className="mt-1 text-xs text-[#8A869D] dark:text-[#B8B4D0]">全历史视图不计算上一周期</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#8A869D] dark:text-[#B8B4D0]">
                      上一周期 {formatTokenByUnit(previousTotals.tokens, tokenUnit)} · 变化 {formatTokenByUnit(tokenDelta.absolute, tokenUnit)} ({formatPct(tokenDelta.pct)})
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[#E7E5EF] p-3 dark:border-[#3A3F5D]">
                  <p className="text-xs text-[#8A869D] dark:text-[#B8B4D0]">成本对比</p>
                  <p className="mt-1 text-2xl font-semibold text-[#252238] dark:text-[#F3F1FF]">
                    当前 {formatUsd(currentTotals.cost)}
                  </p>
                  {rangeDays === null ? (
                    <p className="mt-1 text-xs text-[#8A869D] dark:text-[#B8B4D0]">全历史视图不计算上一周期</p>
                  ) : (
                    <p className="mt-1 text-xs text-[#8A869D] dark:text-[#B8B4D0]">
                      上一周期 {formatUsd(previousTotals.cost)} · 变化 {formatUsd(costDelta.absolute)} ({formatPct(costDelta.pct)})
                    </p>
                  )}
                </div>
              </div>
            </article>

            <article className="rounded-[22px] border border-[#DCDCE5] bg-white p-4 dark:border-[#323750] dark:bg-[#1B1E2F]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[24px] font-semibold text-[#242135] dark:text-[#F2F1FF]">模型性价比指标</p>
                <Badge className="rounded-full bg-[#F2EFFB] text-[#5B4AC8] dark:bg-[#2D2850] dark:text-[#C3B8FF]">
                  Efficiency
                </Badge>
              </div>
              <div className="overflow-auto rounded-xl border border-[#E6E5EE] dark:border-[#3C425E]">
                <Table>
                  <TableHeader className="bg-[#F2EFFB] dark:bg-[#242841]">
                    <TableRow className="border-[#E3E1ED] dark:border-[#414664]">
                      <TableHead className="text-left">MODEL</TableHead>
                      <TableHead className="text-center">$/1M TOKENS</TableHead>
                      <TableHead className="text-center">OUTPUT / INPUT</TableHead>
                      <TableHead className="text-center">CACHE HIT RATIO</TableHead>
                      <TableHead className="text-center">CACHE SAVINGS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelEfficiencyRows.length === 0 ? (
                      <TableRow className="border-[#EFEEF4] dark:border-[#393E5A]">
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-[#817D93] dark:text-[#B8B4D0]">
                          当前筛选条件下无模型数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      modelEfficiencyRows.slice(0, 10).map((row) => (
                        <TableRow key={row.model} className="border-[#EFEEF4] dark:border-[#393E5A]">
                          <TableCell className="font-medium text-[#2A273A] dark:text-[#ECEBFF]">{row.model}</TableCell>
                          <TableCell className="text-center">{formatUsd(row.costPer1m)}</TableCell>
                          <TableCell className="text-center">
                            {row.outputInputRatio === null ? "N/A" : `${row.outputInputRatio.toFixed(3)}x`}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.cachedInputRatio === null ? "N/A" : `${row.cachedInputRatio.toFixed(1)}%`}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-[#3A7A56] dark:text-[#8FD8AE]">
                              {formatUsd(row.cacheSavingsUsd)}
                            </span>
                            <span className="ml-1 text-[11px] text-[#8E89A1] dark:text-[#AFAACC]">
                              (list: {formatUsd(row.listedInputPrice)} → {formatUsd(row.listedCachedInputPrice)})
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
