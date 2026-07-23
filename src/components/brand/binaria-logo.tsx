import { cn } from "@/lib/utils";

/**
 * Binaria Analytics logo — the two-tone blue chevron mark plus the wordmark.
 * Recreated as crisp, theme-aware SVG/text so it renders well in light and dark.
 * Size it by setting a font-size on `className` (e.g. text-sm); the mark scales
 * with the text.
 */
export function BinariaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 leading-none", className)}>
      <svg viewBox="0 0 100 100" fill="none" className="h-[1.25em] w-[1.25em] shrink-0">
        <line x1="35" y1="22" x2="72" y2="50" stroke="#2563EB" strokeWidth="20" strokeLinecap="round" />
        <line x1="72" y1="50" x2="35" y2="78" stroke="#1B2A6B" strokeWidth="20" strokeLinecap="round" />
      </svg>
      <span className="font-display font-bold tracking-tight">
        <span className="text-foreground">Binaria</span>{" "}
        <span className="font-semibold text-muted-foreground">Analytics</span>
      </span>
    </span>
  );
}
