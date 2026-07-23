/**
 * VoiceSheets brand mark — a five-bar "sound wave" built from rounded capsules
 * (echoing the Binaria symbol) filled with the brand's bright→navy blue
 * gradient. Standalone, scales to the given className size.
 */
const BARS = [
  { cx: 5.2, h: 11 },
  { cx: 10.6, h: 19 },
  { cx: 16, h: 25 },
  { cx: 21.4, h: 19 },
  { cx: 26.8, h: 11 },
];
const W = 3.6;

export function VoiceSheetsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vs-mark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E5BE6" />
          <stop offset="1" stopColor="#16245F" />
        </linearGradient>
      </defs>
      {BARS.map((b) => (
        <rect
          key={b.cx}
          x={b.cx - W / 2}
          y={16 - b.h / 2}
          width={W}
          height={b.h}
          rx={W / 2}
          fill="url(#vs-mark-grad)"
        />
      ))}
    </svg>
  );
}
