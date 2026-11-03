// Shown while a page loads. Keeps the layout stable so the page does not jump when content arrives.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-surface-muted" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-[var(--radius-card)] border border-border bg-surface" />
        ))}
      </div>
      <div className="h-72 rounded-[var(--radius-card)] border border-border bg-surface" />
    </div>
  );
}
