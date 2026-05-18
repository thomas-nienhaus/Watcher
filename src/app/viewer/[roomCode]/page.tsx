'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { isValidRoomCode } from '@/lib/roomCode'
import ViewerView from '@/components/viewer/ViewerView'

// In Next.js 15, params is a Promise in Client Components — must use use() to unwrap
export default function ViewerPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params)

  if (!isValidRoomCode(roomCode)) {
    notFound()
  }

  return <ViewerView roomCode={roomCode} />
}
