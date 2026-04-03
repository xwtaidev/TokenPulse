import { spawn } from "node:child_process";
import { access, copyFile, mkdir } from "node:fs/promises";
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
};

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

function runCommand(cwd: string, cmd: string, args: string[]): Promise<CmdResult> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, env: process.env });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      resolve({
        command: [cmd, ...args].join(" "),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
      });
    });
    proc.on("error", (error) => {
      resolve({
        command: [cmd, ...args].join(" "),
        stdout: stdout.trim(),
        stderr: `${stderr}\n${String(error)}`.trim(),
        exitCode: -1,
      });
    });
  });
}

export async function POST() {
  const projectRoot = process.cwd();
  const suffix = nowStamp();

  const dashboardDataPath = path.join(projectRoot, "data", "dashboard-data.json");
  const excelPath = path.join(projectRoot, "codex-token-usage-by-model.xlsx");
  const backupDir = path.join(projectRoot, "data", "backups");
  const codexHome = path.join(os.homedir(), ".codex");

  const backups = await Promise.all([
    backupIfExists(dashboardDataPath, backupDir, suffix),
    backupIfExists(excelPath, backupDir, suffix),
  ]);

  const commands: Array<{ cmd: string; args: string[] }> = [
    {
      cmd: "python3",
      args: [
        path.join(projectRoot, "scripts", "sync_dashboard_data.py"),
        "--codex-home",
        codexHome,
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
  ];

  const results: CmdResult[] = [];
  for (const item of commands) {
    const result = await runCommand(projectRoot, item.cmd, item.args);
    results.push(result);
    if (result.exitCode !== 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "同步脚本执行失败",
          backups: backups.filter(Boolean),
          failed: result,
          results,
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
  });
}

