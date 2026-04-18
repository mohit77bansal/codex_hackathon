export function formatInr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function stanceColor(stance: string): string {
  switch (stance) {
    case "approve":
      return "emerald";
    case "reject":
      return "rose";
    case "conditional":
      return "amber";
    case "review":
      return "sky";
    case "escalate":
      return "fuchsia";
    default:
      return "slate";
  }
}

export const COLOR_HEX: Record<string, string> = {
  indigo: "#818cf8",
  emerald: "#34d399",
  rose: "#fb7185",
  amber: "#fbbf24",
  sky: "#38bdf8",
  fuchsia: "#e879f9",
  violet: "#a78bfa",
  cyan: "#22d3ee",
  slate: "#cbd5e1",
};

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
