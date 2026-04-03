"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncResponse = {
  ok: boolean;
  message?: string;
  backups?: string[];
};

export function SyncDataButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [statusText, setStatusText] = useState("");

  const onSync = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setStatus("idle");
    setStatusText("");

    try {
      const response = await fetch("/api/sync-data", {
        method: "POST",
      });
      const payload = (await response.json()) as SyncResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "同步失败");
      }

      const backupCount = payload.backups?.length ?? 0;
      setStatus("ok");
      setStatusText(`已同步（备份 ${backupCount} 个文件）`);
      router.refresh();
    } catch (error) {
      setStatus("error");
      setStatusText(error instanceof Error ? error.message : "同步失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onSync}
        disabled={loading}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-[#DAD9E2] bg-white px-3.5 text-sm font-medium text-[#4C4860] transition-colors hover:bg-[#F7F6FB] disabled:cursor-not-allowed disabled:opacity-70 dark:border-[#343851] dark:bg-[#1C1F31] dark:text-[#EAE8FF] dark:hover:bg-[#242841]"
      >
        <ArrowsClockwise
          size={16}
          weight="bold"
          className={loading ? "animate-spin text-[#7F6CEB]" : "text-[#7F6CEB] dark:text-[#B8AEF6]"}
        />
        {loading ? "同步中..." : "同步数据"}
      </button>
      {status !== "idle" ? (
        <span
          className={`pointer-events-none absolute top-[calc(100%+4px)] z-20 max-w-[240px] text-center text-[11px] whitespace-nowrap ${
            status === "ok" ? "text-[#4B8764] dark:text-[#91D0AF]" : "text-[#B04A60] dark:text-[#E69EB2]"
          }`}
        >
          {statusText}
        </span>
      ) : null}
    </div>
  );
}
