"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatInteger, formatUsd } from "@/lib/formatters";

type MoneyFlowPoint = {
  date: string;
  label: string;
  tokens: number;
};

type BudgetItem = {
  name: string;
  value: number;
};

type MoneyFlowProps = {
  points: MoneyFlowPoint[];
};

type BudgetProps = {
  items: BudgetItem[];
};

const COLORS = ["#7F6CEB", "#A89BEE", "#D9D2F5", "#8B7AE7", "#B7ACEF"];

type PieTooltipPayloadItem = {
  name?: string;
  value?: number | string;
};

type PieTooltipProps = {
  active?: boolean;
  payload?: PieTooltipPayloadItem[];
};

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }
  const item = payload[0];
  return (
    <div className="max-w-[180px] rounded-xl border border-[var(--trend-tooltip-border)] bg-[var(--trend-tooltip-bg)] px-3 py-2 shadow-[0_10px_24px_rgba(46,33,89,0.18)]">
      <p className="truncate text-sm font-medium text-[var(--trend-output)]">{item.name ?? "Model"}</p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--trend-tooltip-text)]">
        {formatUsd(Number(item.value ?? 0))}
      </p>
    </div>
  );
}

export function MoneyFlowChart({ points }: MoneyFlowProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="h-[360px] w-full">
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barCategoryGap={10} barSize={10}>
            <CartesianGrid stroke="var(--trend-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
              interval={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--trend-tick)", fontSize: 11 }}
              tickFormatter={(value: number) =>
                value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`
              }
            />
            <Tooltip
              cursor={{ fill: "var(--trend-hover-band)" }}
              formatter={(value: unknown) => {
                const num = Number(value ?? 0);
                return [`${formatInteger(num)} tokens`, "Token usage"];
              }}
              labelFormatter={(label, payload) => {
                const point = payload?.[0]?.payload as MoneyFlowPoint | undefined;
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
            <Bar dataKey="tokens" name="Token usage" fill="var(--trend-output)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full animate-pulse rounded-2xl bg-[#F0EDFA] dark:bg-[#272B45]" />
      )}
    </div>
  );
}

export function BudgetPanel({ items }: BudgetProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const top = items[0];
  const list = useMemo(() => items.slice(0, 6), [items]);
  const listWithPct = useMemo(
    () =>
      list.map((item) => ({
        ...item,
        pct: total > 0 ? (item.value / total) * 100 : 0,
      })),
    [list, total],
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 xl:grid-rows-[1fr_auto]">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_170px]">
        <div className="space-y-2">
          {listWithPct.map((item, idx) => (
            <div key={item.name} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="truncate text-[#635F74] dark:text-[#C2BFDA]">{item.name}</span>
              </div>
              <span className="font-medium text-[#4A465C] dark:text-[#E8E5FF]">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <div className="h-[170px] overflow-hidden">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={3}
                >
                  {items.map((item, idx) => (
                    <Cell key={item.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={{ fill: "var(--trend-hover-band)" }}
                  content={<PieTooltip />}
                  wrapperStyle={{
                    outline: "none",
                    pointerEvents: "none",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full animate-pulse rounded-full bg-[#F0EDFA]" />
          )}
        </div>
      </div>

      <div className="border-t border-[#ECEAF4] pt-3 dark:border-[#3A3F5D]">
        <p className="text-xs text-[#9A96AB] dark:text-[#AAA7C3]">Total model cost</p>
        <p className="text-3xl font-semibold tracking-tight text-[#222031] dark:text-[#F3F1FF]">
          {formatUsd(total)}
        </p>
        {top ? (
          <p className="text-xs text-[#6F6A84] dark:text-[#C0BDDA]">
            Top model: <span className="font-medium">{top.name}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
