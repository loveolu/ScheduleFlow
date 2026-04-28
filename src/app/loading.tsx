/**
 * Root-segment loading UI. Next.js uses this as Suspense fallback while a
 * route's data is fetching during navigation. Keeps the layout chrome on
 * screen and shows a centered spinner; specific routes can ship their own
 * `loading.tsx` with skeleton screens to override this.
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading"
        className="flex items-center gap-3 text-slate-400"
      >
        <span
          aria-hidden="true"
          className="inline-block w-5 h-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin"
        />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  );
}
