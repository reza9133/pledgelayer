export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brass-600 to-brass-400 transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
