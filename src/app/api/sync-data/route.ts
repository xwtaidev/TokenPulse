import { spawn } from "node:child_process";
import { access, copyFile, mkdir, open, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CmdResult = {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
};

type LockMeta = {
  pid: number;
  createdAt: string;
  hostname: string;
};

const LOCK_STALE_MS = 30 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

function nowStamp(): string {
  const value = new Date();
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const mi = String(value.getMinutes()).padStart(2, "0");
  const ss = String(value.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

async function backupIfExists(sourcePath: string, backupDir: string, suffix: string): Promise<string | null> {
  try {
    await access(sourcePath);
  } catch {
    return null;
  }
  await mkdir(backupDir, { recursive: true });
  const ext = path.extname(sourcePath);
  const fileName = path.basename(sourcePath, ext);
  const backupPath = path.join(backupDir, `${fileName}-${suffix}${ext}`);
  await copyFile(sourcePath, backupPath);
  return backupPath;
}

async function acquireSyncLock(lockPath: string): Promise<LockMeta | null> {
  const lockMeta: LockMeta = {
    pid: process.pid,
    createdAt: new Date().toISOString(),
    hostname: os.hostname(),
  };

  const tryCreate = async (): Promise<boolean> => {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify(lockMeta));
      await handle.close();
      return true;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "EEXIST") {
        throw error;
      }
      return false;
    }
  };

  if (await tryCreate()) {
    return lockMeta;
  }

  try {
    const info = await stat(lockPath);
    const age = Date.now() - info.mtimeMs;
    if (age > LOCK_STALE_MS) {
      await rm(lockPath, { force: true });
      if (await tryCreate()) {
        return lockMeta;
      }
    }
  } catch {
    // no-op
  }

  return null;
}

async function releaseSyncLock(lockPath: string): Promise<void> {
  await rm(lockPath, { force: true });
}

async function readLockInfo(lockPath: string): Promise<LockMeta | null> {
  try {
    const raw = await readFile(lockPath, "utf-8");
    return JSON.parse(raw) as LockMeta;
  } catch {
    return null;
  }
}

function runCommand(cwd: string, cmd: string, args: string[], timeoutMs: number): Promise<CmdResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const proc = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 2000);
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        command: [cmd, ...args].join(" "),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
    proc.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({
        command: [cmd, ...args].join(" "),
        stdout: stdout.trim(),
        stderr: `${stderr}\n${String(error)}`.trim(),
        exitCode: -1,
        durationMs: Date.now() - startedAt,
        timedOut,
      });
    });
  });
}

export async function POST() {
  const requestStartedAt = Date.now();
  const projectRoot = process.cwd();
  const suffix = nowStamp();

  const dashboardDataPath = path.join(projectRoot, "data", "dashboard-data.json");
  const excelPath = path.join(projectRoot, "codex-token-usage-by-model.xlsx");
  const claudeExcelPath = path.join(projectRoot, "claude-token-usage-by-model.xlsx");
  const backupDir = path.join(projectRoot, "data", "backups");
  const codexHome = path.join(os.homedir(), ".codex");
  const openclawHome = path.join(os.homedir(), ".openclaw");
  const claudeHome = path.join(os.homedir(), ".claude");
  const lockPath = path.join(projectRoot, "data", ".sync-data.lock.json");

  const lock = await acquireSyncLock(lockPath);
  if (!lock) {
    const holder = await readLockInfo(lockPath);
    return NextResponse.json(
      {
        ok: false,
        message: "已有同步任务正在执行，请稍后重试",
        lock: holder,
      },
      { status: 409 },
    );
  }

  try {
    const backups = await Promise.all([
      backupIfExists(dashboardDataPath, backupDir, suffix),
      backupIfExists(excelPath, backupDir, suffix),
      backupIfExists(claudeExcelPath, backupDir, suffix),
    ]);

    const commands: Array<{ cmd: string; args: string[] }> = [
      {
        cmd: "python3",
        args: [
          path.join(projectRoot, "scripts", "sync_dashboard_data.py"),
          "--codex-home",
          codexHome,
          "--openclaw-home",
          openclawHome,
          "--claude-home",
          claudeHome,
          "--model-cost-json",
          path.join(projectRoot, "model_cost.json"),
          "--output",
          dashboardDataPath,
        ],
      },
      {
        cmd: "python3",
        args: [
          path.join(projectRoot, "sync_codex_token_usage_excel.py"),
          "--codex-home",
          codexHome,
          "--output",
          excelPath,
        ],
      },
      {
        cmd: "python3",
        args: [
          path.join(projectRoot, "sync_codex_token_usage_excel.py"),
          "--codex-home",
          claudeHome,
          "--output",
          claudeExcelPath,
        ],
      },
    ];

    const results: CmdResult[] = [];
    for (const item of commands) {
      const result = await runCommand(projectRoot, item.cmd, item.args, COMMAND_TIMEOUT_MS);
      results.push(result);
      if (result.exitCode !== 0) {
        return NextResponse.json(
          {
            ok: false,
            message: result.timedOut ? "同步脚本执行超时" : "同步脚本执行失败",
            backups: backups.filter(Boolean),
            failed: result,
            results,
            elapsedMs: Date.now() - requestStartedAt,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: "同步完成",
      backups: backups.filter(Boolean),
      results,
      elapsedMs: Date.now() - requestStartedAt,
      lock,
    });
  } finally {
    await releaseSyncLock(lockPath);
  }
}
