export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Keryvion StudyHub</span>
          <p className="mt-1 text-xs text-slate-500">GATE 2027 Preparation Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
