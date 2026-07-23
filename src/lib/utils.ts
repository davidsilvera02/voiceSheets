import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a short, URL-friendly slug fragment. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Format a Date (or ISO string) as a relative "time ago" label. */
export function timeAgo(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let count = seconds;
  let unit = "second";
  let acc = 1;
  for (const [step, name] of intervals) {
    if (Math.abs(count) < step * acc) {
      unit = name;
      break;
    }
    acc *= step;
    unit = name;
  }
  const value2 = Math.round(count / acc);
  if (value2 <= 0 && unit === "second") return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return rtf.format(-value2, unit as Intl.RelativeTimeFormatUnit);
}

/** Truncate a string to a maximum length with an ellipsis. */
export function truncate(input: string, max = 80): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

/** Sleep for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
