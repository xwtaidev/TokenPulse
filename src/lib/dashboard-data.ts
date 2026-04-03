import fs from "node:fs/promises";
import path from "node:path";

export type ModelPricing = {
  input_usd_per_1m_tokens: number;
  output_usd_per_1m_tokens: number;
  cached_input_usd_per_1m_tokens: number;
  source_url?: string;
};

export type DailyModelRecord = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
};

export type DailyRecord = {
  date: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  models: DailyModelRecord[];
};

export type DashboardData = {
  generated_at: string;
  timezone: string;
  pricing_unit: string;
  models: string[];
  pricing: Record<string, ModelPricing>;
  summary: {
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
  };
  daily: DailyRecord[];
};

export type ModelAggregate = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
};

const DATA_FILE = path.join(process.cwd(), "data", "dashboard-data.json");

export async function loadDashboardData(): Promise<DashboardData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as DashboardData;
}

export function getLastDays(daily: DailyRecord[], days: number): DailyRecord[] {
  if (daily.length <= days) {
    return daily;
  }
  return daily.slice(-days);
}

export function aggregateByModel(records: DailyRecord[]): ModelAggregate[] {
  const map = new Map<string, ModelAggregate>();

  for (const day of records) {
    for (const row of day.models) {
      const current = map.get(row.model) ?? {
        model: row.model,
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        input_cost_usd: 0,
        output_cost_usd: 0,
        total_cost_usd: 0,
      };

      current.input_tokens += row.input_tokens;
      current.output_tokens += row.output_tokens;
      current.total_tokens += row.total_tokens;
      current.input_cost_usd += row.input_cost_usd;
      current.output_cost_usd += row.output_cost_usd;
      current.total_cost_usd += row.total_cost_usd;
      map.set(row.model, current);
    }
  }

  return [...map.values()].sort((a, b) => b.total_cost_usd - a.total_cost_usd);
}

export type DetailRow = {
  date: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
};

export function toDetailRows(records: DailyRecord[]): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const day of [...records].reverse()) {
    for (const model of day.models) {
      rows.push({
        date: day.date,
        model: model.model,
        input_tokens: model.input_tokens,
        output_tokens: model.output_tokens,
        total_tokens: model.total_tokens,
        input_cost_usd: model.input_cost_usd,
        output_cost_usd: model.output_cost_usd,
        total_cost_usd: model.total_cost_usd,
      });
    }
  }
  return rows;
}
