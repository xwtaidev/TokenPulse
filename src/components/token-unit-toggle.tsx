"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TokenDisplayUnit } from "@/lib/formatters";

type TokenUnitToggleProps = {
  initialUnit: TokenDisplayUnit;
};

export function TokenUnitToggle({ initialUnit }: TokenUnitToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryUnit = searchParams.get("unit");
  const activeUnit: TokenDisplayUnit = queryUnit === "yi" || queryUnit === "m" ? queryUnit : initialUnit;

  const onSwitch = (nextUnit: TokenDisplayUnit) => {
    if (nextUnit === activeUnit) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextUnit === "m") {
      nextParams.delete("unit");
    } else {
      nextParams.set("unit", "yi");
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  return (
    <div className="rounded-md border border-[#DAD9E2] bg-white/70 p-2 dark:border-[#353954] dark:bg-[#202438]">
      <p className="mb-2 px-1 text-[11px] font-medium tracking-wide text-[#7D7990] uppercase dark:text-[#B6B2CE]">
        Token Unit
      </p>
      <div className="inline-flex w-full rounded-md border border-[#DCDCE5] bg-white p-1 dark:border-[#444A66] dark:bg-[#232741]">
        <button
          type="button"
          onClick={() => onSwitch("m")}
          className={`flex-1 rounded-sm px-3 py-1.5 text-xs transition ${
            activeUnit === "m"
              ? "bg-[#7F6CEB] text-white"
              : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
          }`}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => onSwitch("yi")}
          className={`flex-1 rounded-sm px-3 py-1.5 text-xs transition ${
            activeUnit === "yi"
              ? "bg-[#7F6CEB] text-white"
              : "text-[#5F5C72] hover:bg-[#F2EFFB] active:scale-[0.98] dark:text-[#C6C3DD] dark:hover:bg-[#323859]"
          }`}
        >
          亿
        </button>
      </div>
    </div>
  );
}
