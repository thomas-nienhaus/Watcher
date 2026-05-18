import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center h-full gap-10 p-6 pt-safe pb-safe">
      {/* Header */}
      <div className="text-center">
        <div className="text-6xl mb-3">👶</div>
        <h1 className="text-4xl font-bold text-white tracking-tight">BabyWatch</h1>
        <p className="text-gray-400 mt-2 text-lg">Browser-based baby monitor</p>
      </div>

      {/* Role selection */}
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/camera"
          className="flex flex-col items-center justify-center gap-2
                     bg-primary text-white rounded-2xl p-6 min-h-[100px]
                     text-xl font-semibold active:scale-95 transition-transform
                     shadow-lg shadow-emerald-900/40"
        >
          <span className="text-4xl">📹</span>
          <span>Set Up Camera</span>
          <span className="text-sm font-normal text-emerald-100">
            Place this device in the baby room
          </span>
        </Link>

        <Link
          href="/viewer/join"
          className="flex flex-col items-center justify-center gap-2
                     bg-surface border border-gray-700 text-white rounded-2xl p-6 min-h-[100px]
                     text-xl font-semibold active:scale-95 transition-transform"
        >
          <span className="text-4xl">👁️</span>
          <span>Watch Feed</span>
          <span className="text-sm font-normal text-gray-400">
            View the baby monitor on this device
          </span>
        </Link>
      </div>

      <p className="text-gray-600 text-xs text-center max-w-xs">
        Video streams peer-to-peer via WebRTC — no video is stored or recorded.
      </p>
    </main>
  )
}
