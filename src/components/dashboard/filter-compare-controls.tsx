"use client";

import { CalendarBlank, Fire, Funnel } from "@phosphor-icons/react";
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
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex h-11 items-center rounded-full border border-[#DAD9E2] bg-white pl-1.5 pr-3 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB] dark:bg-[#2B2F4A] dark:text-[#B8AEF6]">
          <CalendarBlank size={16} weight="duotone" />
        </span>
        <select
          aria-label="时间范围"
          value={selectedRange}
          onChange={(event) => onChange("range", event.target.value, "90")}
          className="h-8 bg-transparent pl-2 pr-1 text-sm font-medium text-[#4C4860] outline-none dark:text-[#EAE8FF]"
        >
          <option value="7">最近 7 天</option>
          <option value="30">最近 30 天</option>
          <option value="90">最近 90 天</option>
          <option value="180">最近 180 天</option>
          <option value="all">全部历史</option>
        </select>
      </label>

      <label className="inline-flex h-11 items-center rounded-full border border-[#DAD9E2] bg-white pl-1.5 pr-3 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB] dark:bg-[#2B2F4A] dark:text-[#B8AEF6]">
          <Funnel size={16} weight="duotone" />
        </span>
        <select
          aria-label="模型维度"
          value={selectedModel}
          onChange={(event) => onChange("model", event.target.value, "all")}
          className="h-8 max-w-[200px] bg-transparent pl-2 pr-1 text-sm font-medium text-[#4C4860] outline-none dark:text-[#EAE8FF]"
        >
          <option value="all">全部模型</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </label>

      <label className="inline-flex h-11 items-center rounded-full border border-[#DAD9E2] bg-white pl-1.5 pr-3 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB] dark:bg-[#2B2F4A] dark:text-[#B8AEF6]">
          <Fire size={16} weight="duotone" />
        </span>
        <select
          aria-label="活跃阈值"
          value={selectedMinTokens}
          onChange={(event) => onChange("minTokens", event.target.value, "0")}
          className="h-8 bg-transparent pl-2 pr-1 text-sm font-medium text-[#4C4860] outline-none dark:text-[#EAE8FF]"
        >
          <option value="0">不限</option>
          <option value="1000000">≥ 1M</option>
          <option value="10000000">≥ 10M</option>
        </select>
      </label>
    </div>
  );
}
