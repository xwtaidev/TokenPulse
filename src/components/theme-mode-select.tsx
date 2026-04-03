"use client";

import { CaretDown, Check, Palette } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "tokenpulse-theme-mode";
const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const enableDark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", enableDark);
  root.setAttribute("data-theme-mode", mode);
}

export function ThemeModeSelect() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setMode(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
      if (current === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  const onChange = (value: ThemeMode) => {
    setMode(value);
    localStorage.setItem(STORAGE_KEY, value);
    applyTheme(value);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Theme mode"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 items-center rounded-full border border-[#DAD9E2] bg-white pl-1.5 pr-3 transition-colors hover:bg-[#F7F6FB] dark:border-[#343851] dark:bg-[#1C1F31] dark:hover:bg-[#242841]"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F2EFFB] text-[#7F6CEB] dark:bg-[#2B2F4A] dark:text-[#B8AEF6]">
          <Palette size={16} weight="duotone" />
        </span>
        <span className="pl-2 text-sm font-medium text-[#4C4860] dark:text-[#EAE8FF]">
          {OPTIONS.find((item) => item.value === mode)?.label ?? "System"}
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
          className="absolute top-[calc(100%+8px)] right-0 z-40 min-w-[150px] rounded-2xl border border-[#DAD9E2] bg-white p-1.5 shadow-[0_16px_36px_-18px_rgba(34,28,73,0.35)] dark:border-[#3A3F5D] dark:bg-[#1E2133] dark:shadow-[0_22px_40px_-20px_rgba(0,0,0,0.9)]"
        >
          {OPTIONS.map((item) => {
            const active = mode === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => onChange(item.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[#EEEAFD] text-[#342E56] dark:bg-[#313756] dark:text-[#F0EEFF]"
                    : "text-[#4C4860] hover:bg-[#F6F4FC] dark:text-[#D1CEE7] dark:hover:bg-[#2A2E48]"
                }`}
              >
                <span>{item.label}</span>
                {active ? <Check size={14} weight="bold" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
