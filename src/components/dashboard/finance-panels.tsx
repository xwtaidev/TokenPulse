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
            <CartesianGrid stroke="#ECEAF4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9A96AB", fontSize: 11 }}
              interval={4}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9A96AB", fontSize: 11 }}
              tickFormatter={(value: number) =>
                value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`
              }
            />
            <Tooltip
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
                border: "1px solid #E6E3F0",
                boxShadow: "0 10px 24px rgba(46,33,89,0.12)",
              }}
            />
            <Bar dataKey="tokens" name="Token usage" fill="#7F6CEB" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full animate-pulse rounded-2xl bg-[#F0EDFA]" />
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
                <span className="truncate text-[#635F74]">{item.name}</span>
              </div>
              <span className="font-medium text-[#4A465C]">{item.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>

        <div className="h-[170px]">
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
                <Tooltip formatter={(value: unknown) => formatUsd(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full animate-pulse rounded-full bg-[#F0EDFA]" />
          )}
        </div>
      </div>

      <div className="border-t border-[#ECEAF4] pt-3">
        <p className="text-xs text-[#9A96AB]">Total model cost</p>
        <p className="text-3xl font-semibold tracking-tight text-[#222031]">
          {formatUsd(total)}
        </p>
        {top ? (
          <p className="text-xs text-[#6F6A84]">
            Top model: <span className="font-medium">{top.name}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
