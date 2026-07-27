/**
 * VoiceSheets brand mark — a five-bar "sound wave" built from rounded capsules
 * (echoing the Binaria symbol). Two solid brand blues alternate so the colours
 * contrast one another instead of blending through a gradient: the centre and
 * outer bars use the bright primary blue, the two intermediate bars the deep
 * navy. Standalone, scales to the given className size.
 */
const BRIGHT = "#2557E6";
const NAVY = "#15246E";

const BARS = [
  { cx: 5.2, h: 11, fill: NAVY },
  { cx: 10.6, h: 19, fill: BRIGHT },
  { cx: 16, h: 25, fill: NAVY },
  { cx: 21.4, h: 19, fill: BRIGHT },
  { cx: 26.8, h: 11, fill: NAVY },
];
const W = 3.6;

export function VoiceSheetsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      {BARS.map((b) => (
        <rect
          key={b.cx}
          x={b.cx - W / 2}
          y={16 - b.h / 2}
          width={W}
          height={b.h}
          rx={W / 2}
          fill={b.fill}
        />
      ))}
    </svg>
  );
}
