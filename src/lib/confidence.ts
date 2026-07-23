export type ConfidenceLevel = "high" | "medium" | "low";

/** Map a 0..1 confidence score to a level for the UI indicators. */
export function confidenceLevel(score: number | null | undefined): ConfidenceLevel | null {
  if (score == null) return null;
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; dot: string; text: string; border: string; ring: string }
> = {
  high: {
    label: "High confidence",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-l-emerald-500",
    ring: "ring-emerald-500/40",
  },
  medium: {
    label: "Medium confidence — please review",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-l-amber-500",
    ring: "ring-amber-500/40",
  },
  low: {
    label: "Low confidence — likely needs correction",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
    border: "border-l-red-500",
    ring: "ring-red-500/40",
  },
};
