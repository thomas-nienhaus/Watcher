'use client'

import GlassPanel from '@/components/ui/GlassPanel'

export interface StatsSnapshot {
  uptimeSeconds: number
  bitrateKbps: number | null
  rttMs: number | null
  packetsLost: number | null
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function ConnectionStats({ stats }: { stats: StatsSnapshot }) {
  return (
    <GlassPanel className="px-3 py-2.5 flex flex-col gap-1.5 min-w-[160px]">
      <p className="text-white/30 text-[9px] uppercase tracking-widest font-mono">Debug</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] font-mono">
        <span className="text-white/30">Uptime</span>
        <span className="text-white/60">{formatUptime(stats.uptimeSeconds)}</span>
        <span className="text-white/30">Bitrate</span>
        <span className="text-white/60">
          {stats.bitrateKbps !== null ? `${stats.bitrateKbps} kbps` : '—'}
        </span>
        <span className="text-white/30">RTT</span>
        <span className="text-white/60">
          {stats.rttMs !== null ? `${stats.rttMs} ms` : '—'}
        </span>
        <span className="text-white/30">Pkt lost</span>
        <span className="text-white/60">
          {stats.packetsLost !== null ? String(stats.packetsLost) : '—'}
        </span>
      </div>
    </GlassPanel>
  )
}
