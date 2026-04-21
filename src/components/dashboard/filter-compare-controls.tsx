"use client";

import { CalendarBlank, CaretDown, Check, Fire, Funnel } from "@phosphor-icons/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type FilterCompareControlsProps = {
  models: string[];
  selectedModel: string;
  selectedRange: "7" | "30" | "90" | "180" | "all";
  selectedMinTokens: "0" | "1000000" | "10000000";
};

type MenuKey = "range" | "model" | "minTokens" | null;

type Option = {
  value: string;
  label: string;
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

function FilterDropdown({
  icon,
  value,
  options,
  open,
  onToggle,
  onSelect,
}: {
  icon: React.ReactNode;
  value: string;
  options: Option[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const currentLabel = options.find((item) => item.value === value)?.label ?? options[0]?.label ?? "";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className="inline-flex h-11 items-center rounded-full border border-[#DAD9E2] bg-white pl-1.5 pr-3 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB] dark:bg-[#2B2F4A] dark:text-[#B8AEF6]">
          {icon}
        </span>
        <span className="max-w-[190px] truncate pl-2 text-sm font-medium text-[#4C4860] dark:text-[#EAE8FF]">
          {currentLabel}
        </span>
        <CaretDown
          size={14}
          weight="bold"
          className={`ml-2 text-[#7A778D] transition-transform dark:text-[#BBB7D5] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-40 min-w-[180px] rounded-2xl border border-[#DAD9E2] bg-white p-1.5 shadow-[0_16px_36px_-18px_rgba(34,28,73,0.35)] dark:border-[#3A3F5D] dark:bg-[#1E2133] dark:shadow-[0_22px_40px_-20px_rgba(0,0,0,0.9)]"
        >
          <div className="max-h-72 overflow-auto">
            {options.map((item) => {
              const active = value === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => onSelect(item.value)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-[#EEEAFD] text-[#342E56] dark:bg-[#313756] dark:text-[#F0EEFF]"
                      : "text-[#4C4860] hover:bg-[#F6F4FC] dark:text-[#D1CEE7] dark:hover:bg-[#2A2E48]"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {active ? <Check size={14} weight="bold" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);

  const modelOptions = useMemo<Option[]>(
    () => [{ value: "all", label: "全部模型" }, ...models.map((model) => ({ value: model, label: model }))],
    [models],
  );

  const rangeOptions: Option[] = [
    { value: "7", label: "最近 7 天" },
    { value: "30", label: "最近 30 天" },
    { value: "90", label: "最近 90 天" },
    { value: "180", label: "最近 180 天" },
    { value: "all", label: "全部历史" },
  ];

  const minTokenOptions: Option[] = [
    { value: "0", label: "不限" },
    { value: "1000000", label: "≥ 1M" },
    { value: "10000000", label: "≥ 10M" },
  ];

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const onChange = (key: string, value: string, defaultValue: string) => {
    const query = updateQueryParam(searchParams, key, value, defaultValue);
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpenMenu(null);
  };

  return (
    <div ref={wrapRef} className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        icon={<CalendarBlank size={16} weight="duotone" />}
        value={selectedRange}
        options={rangeOptions}
        open={openMenu === "range"}
        onToggle={() => setOpenMenu((prev) => (prev === "range" ? null : "range"))}
        onSelect={(value) => onChange("range", value, "90")}
      />

      <FilterDropdown
        icon={<Funnel size={16} weight="duotone" />}
        value={selectedModel}
        options={modelOptions}
        open={openMenu === "model"}
        onToggle={() => setOpenMenu((prev) => (prev === "model" ? null : "model"))}
        onSelect={(value) => onChange("model", value, "all")}
      />

      <FilterDropdown
        icon={<Fire size={16} weight="duotone" />}
        value={selectedMinTokens}
        options={minTokenOptions}
        open={openMenu === "minTokens"}
        onToggle={() => setOpenMenu((prev) => (prev === "minTokens" ? null : "minTokens"))}
        onSelect={(value) => onChange("minTokens", value, "0")}
      />
    </div>
  );
}
