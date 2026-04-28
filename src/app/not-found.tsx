import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-sm font-semibold text-indigo-600 tracking-wide uppercase">
          404
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 text-base text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Go home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
