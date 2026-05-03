const rtf = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" });

export function formatNumber(value: unknown, digits = 1): string {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return Number(value).toFixed(digits).replace(".", ",");
}

export function formatPercent(value: unknown): string {
  if (!Number.isFinite(Number(value))) {
    return "0%";
  }

  return `${Math.round(Number(value))}%`;
}

export function formatDelta(value: unknown): string {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }

  return `${Number(value) > 0 ? "+" : ""}${formatNumber(value)}`;
}

export function formatDate(
  value: unknown,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value as string | number | Date);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("ru-RU", options).format(date);
}

export function formatRelative(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value as string | number | Date);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, "second");
  }

  const diffMin = Math.round(diffSec / 60);

  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }

  const diffHour = Math.round(diffMin / 60);

  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  }

  return rtf.format(Math.round(diffHour / 24), "day");
}
