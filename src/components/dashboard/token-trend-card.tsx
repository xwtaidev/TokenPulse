"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatInteger } from "@/lib/formatters";

type DailyTokenPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  tokens: number;
};

type TokenTrendCardProps = {
  points: DailyTokenPoint[];
};

type RangeOption = 7 | 30 | 90 | 180;
type ChartOption = "bar" | "line";

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTokensCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return `${Math.round(value / 1000)}K`;
}

export function TokenTrendCard({ points }: TokenTrendCardProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [chartType, setChartType] = useState<ChartOption>("bar");
  const [range, setRange] = useState<RangeOption>(90);

  const rangeOptions: RangeOption[] = [7, 30, 90, 180];

  const chartData = useMemo(() => {
    const latestDate = points.length > 0 ? new Date(`${points[points.length - 1].date}T00:00:00`) : null;
    if (!latestDate) {
      return [];
    }
    const map = new Map(points.map((item) => [item.date, item.tokens]));
    const inputMap = new Map(points.map((item) => [item.date, item.inputTokens]));
    const outputMap = new Map(points.map((item) => [item.date, item.outputTokens]));
    return Array.from({ length: range }, (_, idx) => {
      const day = new Date(latestDate);
      day.setDate(day.getDate() - (range - 1 - idx));
      const date = toIsoDate(day);
      const inputTokens = inputMap.get(date) ?? 0;
      const outputTokens = outputMap.get(date) ?? 0;
      return {
        date,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day),
        tokens: map.get(date) ?? inputTokens + outputTokens,
        inputTokens,
        outputTokens,
      };
    });
  }, [points, range]);

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

      <div className="h-[300px] w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart data={chartData} barCategoryGap={10} barSize={10}>
                <CartesianGrid stroke="var(--trend-grid)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  interval={Math.max(0, Math.floor(range / 8))}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  tickFormatter={formatTokensCompact}
                />
                <Tooltip
                  cursor={{ fill: "var(--trend-hover-band)" }}
                  formatter={(value: unknown, name: unknown) => {
                    const num = Number(value ?? 0);
                    const label = String(name ?? "");
                    return [`${formatInteger(num)} tokens`, label];
                  }}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as { date?: string } | undefined;
                    return point?.date ?? String(label ?? "");
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--trend-tooltip-border)",
                    backgroundColor: "var(--trend-tooltip-bg)",
                    color: "var(--trend-tooltip-text)",
                    boxShadow: "0 10px 24px rgba(46,33,89,0.12)",
                  }}
                />
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
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid stroke="var(--trend-grid)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  interval={Math.max(0, Math.floor(range / 8))}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
                  tickFormatter={formatTokensCompact}
                />
                <Tooltip
                  cursor={{ stroke: "var(--trend-hover-line)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  formatter={(value: unknown) => [`${formatInteger(Number(value ?? 0))} tokens`, "Token usage"]}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as { date?: string } | undefined;
                    return point?.date ?? String(label ?? "");
                  }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--trend-tooltip-border)",
                    backgroundColor: "var(--trend-tooltip-bg)",
                    color: "var(--trend-tooltip-text)",
                    boxShadow: "0 10px 24px rgba(46,33,89,0.12)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="tokens"
                  name="Token usage"
                  stroke="var(--trend-output)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--trend-output)" }}
                />
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
