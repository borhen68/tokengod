export function formatMoney(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: value >= 100_000 ? 0 : 1,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatEfficiency(value: number) {
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: digits,
  })}`;
}

export function formatOrdinal(value: number) {
  const remainder = Math.abs(value) % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "#";
  } catch {
    return "#";
  }
}

export function waterPressure(spend: number, maxSpend: number) {
  if (maxSpend <= 0) return 8;
  const normalized = Math.sqrt(Math.max(0, spend) / maxSpend);
  return Math.max(8, Math.min(94, Math.round(normalized * 94)));
}

export function pressureLabel(percent: number) {
  if (percent > 82) return "Very high spend";
  if (percent > 62) return "High spend";
  if (percent > 38) return "Moderate spend";
  return "Lower spend";
}
