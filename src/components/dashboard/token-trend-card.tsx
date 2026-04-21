"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatInteger, formatTokenByUnit, type TokenDisplayUnit } from "@/lib/formatters";

type DailyTokenPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  tokens: number;
};

type TokenTrendCardProps = {
  points: DailyTokenPoint[];
  tokenUnit: TokenDisplayUnit;
};

type RangeOption = 7 | 30 | 90 | 180;
type ChartOption = "bar" | "line";
type CompareOption = "none" | "mom" | "wow";

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TokenTrendCard({ points, tokenUnit }: TokenTrendCardProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [chartType, setChartType] = useState<ChartOption>("bar");
  const [range, setRange] = useState<RangeOption>(90);
  const [compare, setCompare] = useState<CompareOption>("none");
  const [showMa7, setShowMa7] = useState(false);

  const focusDate = searchParams.get("focusDate") ?? "";

  const rangeOptions: RangeOption[] = [7, 30, 90, 180];

  const chartData = useMemo(() => {
    const latestDate = points.length > 0 ? new Date(`${points[points.length - 1].date}T00:00:00`) : null;
    if (!latestDate) {
      return [];
    }

    const map = new Map(points.map((item) => [item.date, item.tokens]));
    const inputMap = new Map(points.map((item) => [item.date, item.inputTokens]));
    const outputMap = new Map(points.map((item) => [item.date, item.outputTokens]));

    const rows = Array.from({ length: range }, (_, idx) => {
      const day = new Date(latestDate);
      day.setDate(day.getDate() - (range - 1 - idx));
      const date = toIsoDate(day);
      const inputTokens = inputMap.get(date) ?? 0;
      const outputTokens = outputMap.get(date) ?? 0;
      const tokens = map.get(date) ?? inputTokens + outputTokens;
      return {
        date,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day),
        tokens,
        inputTokens,
        outputTokens,
        compareTokens: null as number | null,
        ma7: null as number | null,
      };
    });

    for (let i = 0; i < rows.length; i += 1) {
      if (compare === "mom" && i >= 1) {
        rows[i].compareTokens = rows[i - 1].tokens;
      }
      if (compare === "wow" && i >= 7) {
        rows[i].compareTokens = rows[i - 7].tokens;
      }

      if (showMa7) {
        const start = Math.max(0, i - 6);
        const window = rows.slice(start, i + 1);
        const avg = window.reduce((sum, item) => sum + item.tokens, 0) / window.length;
        rows[i].ma7 = avg;
      }
    }

    return rows;
  }, [compare, points, range, showMa7]);

  const onPointSelect = (date: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (focusDate === date) {
      next.delete("focusDate");
    } else {
      next.set("focusDate", date);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const compareLabel = compare === "mom" ? "Day-over-day" : "Week-over-week";

  return (
    <article className="min-h-[360px] rounded-[22px] border border-[#DCDCE5] bg-white p-4 dark:border-[#323750] dark:bg-[#1B1E2F]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[30px] font-semibold text-[#242135] dark:text-[#F2F1FF]">Token Trend</p>
        <div className="flex flex-wrap items-center gap-2">
          {chartType === "bar" ? (
            <div className="mr-1 flex items-center gap-4 text-xs text-[#68647A] dark:text-[#B7B3D0]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#7F6CEB]" />
                Output (bottom)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#A89BEE]" />
                Input (top)
              </span>
            </div>
          ) : null}

          <div className="inline-flex rounded-full border border-[#DCDCE5] bg-white p-1 dark:border-[#444A66] dark:bg-[#232741]">
            <button
              type="button"
              onClick={() => setShowMa7((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                showMa7
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              MA7
            </button>
            <button
              type="button"
              onClick={() => setCompare("none")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                compare === "none"
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              无对比
            </button>
            <button
              type="button"
              onClick={() => setCompare("mom")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                compare === "mom"
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              环比
            </button>
            <button
              type="button"
              onClick={() => setCompare("wow")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                compare === "wow"
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              同比
            </button>
          </div>

          <div className="inline-flex rounded-full border border-[#DCDCE5] bg-white p-1 dark:border-[#444A66] dark:bg-[#232741]">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                chartType === "bar"
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              Bar
            </button>
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                chartType === "line"
                  ? "bg-[#7F6CEB] text-white"
                  : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
              }`}
            >
              Line
            </button>
          </div>

          <div className="inline-flex rounded-full border border-[#DCDCE5] bg-white p-1 dark:border-[#444A66] dark:bg-[#232741]">
            {rangeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  range === option
                    ? "bg-[#7F6CEB] text-white"
                    : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
                }`}
              >
                {option}D
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-xs text-[#7F7A90] dark:text-[#A9A6C1]">
        <span>点击图上的日期可联动下方表格</span>
        {focusDate ? <span className="rounded-full bg-[#F2EFFB] px-2 py-0.5 text-[#6A58D3]">已聚焦 {focusDate}</span> : null}
      </div>

      <div className="h-[300px] w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart
                data={chartData}
                barCategoryGap={10}
                barSize={10}
                onClick={(state) => {
                  const payload = (state as { activePayload?: Array<{ payload?: { date?: string } }> } | undefined)
                    ?.activePayload?.[0]?.payload;
                  const date = payload?.date;
                  if (date) {
                    onPointSelect(date);
                  }
                }}
              >
                <CartesianGrid stroke="var(--trend-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  interval={Math.max(0, Math.floor(range / 8))}
                  tickFormatter={(value: string) => value.slice(5)}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatTokenByUnit(value, tokenUnit, 1)}
                />
                <Tooltip
                  cursor={{ fill: "var(--trend-hover-band)" }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = Number(value ?? 0);
                    const label = String(name ?? "");
                    return [`${formatTokenByUnit(num, tokenUnit)} tokens (${formatInteger(num)})`, label];
                  }}
                  labelFormatter={(label) => String(label ?? "")}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--trend-tooltip-border)",
                    backgroundColor: "var(--trend-tooltip-bg)",
                    color: "var(--trend-tooltip-text)",
                    boxShadow: "0 10px 24px rgba(46,33,89,0.12)",
                  }}
                />
                {focusDate ? <ReferenceLine x={focusDate} stroke="#D38A44" strokeDasharray="4 4" /> : null}
                <Bar
                  dataKey="outputTokens"
                  name="Output"
                  stackId="tokens"
                  fill="var(--trend-output)"
                  radius={[0, 0, 6, 6]}
                />
                <Bar
                  dataKey="inputTokens"
                  name="Input"
                  stackId="tokens"
                  fill="var(--trend-input)"
                  radius={[6, 6, 0, 0]}
                />
                {compare !== "none" ? (
                  <Line
                    type="monotone"
                    dataKey="compareTokens"
                    name={compareLabel}
                    stroke="#CC7A3D"
                    strokeWidth={1.6}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
                {showMa7 ? (
                  <Line
                    type="monotone"
                    dataKey="ma7"
                    name="MA7"
                    stroke="#2E9155"
                    strokeWidth={1.6}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
              </BarChart>
            ) : (
              <LineChart
                data={chartData}
                onClick={(state) => {
                  const payload = (state as { activePayload?: Array<{ payload?: { date?: string } }> } | undefined)
                    ?.activePayload?.[0]?.payload;
                  const date = payload?.date;
                  if (date) {
                    onPointSelect(date);
                  }
                }}
              >
                <CartesianGrid stroke="var(--trend-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  interval={Math.max(0, Math.floor(range / 8))}
                  tickFormatter={(value: string) => value.slice(5)}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatTokenByUnit(value, tokenUnit, 1)}
                />
                <Tooltip
                  cursor={{ stroke: "var(--trend-hover-line)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = Number(value ?? 0);
                    return [`${formatTokenByUnit(num, tokenUnit)} tokens (${formatInteger(num)})`, String(name ?? "")];
                  }}
                  labelFormatter={(label) => String(label ?? "")}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--trend-tooltip-border)",
                    backgroundColor: "var(--trend-tooltip-bg)",
                    color: "var(--trend-tooltip-text)",
                    boxShadow: "0 10px 24px rgba(46,33,89,0.12)",
                  }}
                />
                {focusDate ? <ReferenceLine x={focusDate} stroke="#D38A44" strokeDasharray="4 4" /> : null}
                <Line
                  type="monotone"
                  dataKey="tokens"
                  name="Token usage"
                  stroke="var(--trend-output)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--trend-output)" }}
                />
                {compare !== "none" ? (
                  <Line
                    type="monotone"
                    dataKey="compareTokens"
                    name={compareLabel}
                    stroke="#CC7A3D"
                    strokeWidth={1.6}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
                {showMa7 ? (
                  <Line
                    type="monotone"
                    dataKey="ma7"
                    name="MA7"
                    stroke="#2E9155"
                    strokeWidth={1.6}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full animate-pulse rounded-2xl bg-[#F0EDFA] dark:bg-[#272B45]" />
        )}
      </div>
    </article>
  );
}
