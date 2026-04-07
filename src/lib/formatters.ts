export function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export type TokenDisplayUnit = "m" | "yi";

export function formatTokenByUnit(
  value: number,
  unit: TokenDisplayUnit,
  maxFractionDigits = 2,
): string {
  const divisor = unit === "yi" ? 100_000_000 : 1_000_000;
  const suffix = unit === "yi" ? "亿" : "M";
  const scaled = value / divisor;

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(scaled);

  return `${formatted}${suffix}`;
}
