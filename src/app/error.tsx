'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-4 text-center bg-slate-50 dark:bg-slate-950">
      <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">!</p>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Something went wrong
      </h1>
      <p className="mt-2 text-slate-500 dark:text-slate-400">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        Try again
      </button>
    </div>
  )
}
