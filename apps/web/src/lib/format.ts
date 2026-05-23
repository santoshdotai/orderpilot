export function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeMinutes(value: string | null | undefined) {
  if (!value) return "No schedule";

  const diff = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);

  if (minutes === 0) return "Due now";
  if (minutes > 0) return `In ${minutes} min`;

  return `${Math.abs(minutes)} min overdue`;
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
