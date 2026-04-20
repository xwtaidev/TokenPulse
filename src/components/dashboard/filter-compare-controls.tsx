"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterCompareControlsProps = {
  models: string[];
  selectedModel: string;
  selectedRange: "7" | "30" | "90" | "180" | "all";
  selectedMinTokens: "0" | "1000000" | "10000000";
};

function updateQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
): string {
  const next = new URLSearchParams(searchParams.toString());
  if (value === defaultValue) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next.toString();
}

export function FilterCompareControls({
  models,
  selectedModel,
  selectedRange,
  selectedMinTokens,
}: FilterCompareControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (key: string, value: string, defaultValue: string) => {
    const query = updateQueryParam(searchParams, key, value, defaultValue);
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="grid grid-cols-1 gap-2 rounded-[18px] border border-[#DCDCE5] bg-white p-3 dark:border-[#323750] dark:bg-[#1B1E2F] xl:grid-cols-[1fr_1fr_1fr]">
      <label className="grid gap-1 text-xs text-[#6A667D] dark:text-[#BCB9D5]">
        时间范围
        <select
          value={selectedRange}
          onChange={(event) => onChange("range", event.target.value, "90")}
          className="h-10 rounded-xl border border-[#DAD9E2] bg-white px-3 text-sm text-[#2F2B42] dark:border-[#3A3F5D] dark:bg-[#22263C] dark:text-[#EEEFFF]"
        >
          <option value="7">最近 7 天</option>
          <option value="30">最近 30 天</option>
          <option value="90">最近 90 天</option>
          <option value="180">最近 180 天</option>
          <option value="all">全部历史</option>
        </select>
      </label>

      <label className="grid gap-1 text-xs text-[#6A667D] dark:text-[#BCB9D5]">
        模型维度
        <select
          value={selectedModel}
          onChange={(event) => onChange("model", event.target.value, "all")}
          className="h-10 rounded-xl border border-[#DAD9E2] bg-white px-3 text-sm text-[#2F2B42] dark:border-[#3A3F5D] dark:bg-[#22263C] dark:text-[#EEEFFF]"
        >
          <option value="all">全部模型</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs text-[#6A667D] dark:text-[#BCB9D5]">
        活跃阈值（日总 Tokens）
        <select
          value={selectedMinTokens}
          onChange={(event) => onChange("minTokens", event.target.value, "0")}
          className="h-10 rounded-xl border border-[#DAD9E2] bg-white px-3 text-sm text-[#2F2B42] dark:border-[#3A3F5D] dark:bg-[#22263C] dark:text-[#EEEFFF]"
        >
          <option value="0">不限</option>
          <option value="1000000">≥ 1M</option>
          <option value="10000000">≥ 10M</option>
        </select>
      </label>
    </div>
  );
}
