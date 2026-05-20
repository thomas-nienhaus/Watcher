'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createPeerConnection, addStreamTracks, prefetchIceServers } from '@/lib/webrtc'
import { SOCKET_EVENTS } from '@/lib/constants'
import type { CameraWebRTCState, ViewerWebRTCState } from '@/types'

// ─── Camera side ─────────────────────────────────────────────────────────────
// Creates one RTCPeerConnection per viewer (mesh topology).
// Handles offer creation, ICE exchange, and cleanup on disconnect.

export function useCameraWebRTC(
  socket: Socket | null,
  localStream: MediaStream | null
): CameraWebRTCState {
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
  const pendingViewerIds = useRef<Set<string>>(new Set())
  const [viewerCount, setViewerCount] = useState(0)

  // Prefetch ICE config on mount so TURN credentials are ready before first call
  useEffect(() => { prefetchIceServers() }, [])
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(
    new Map()
  )

  // Store stream in a ref so createOffer doesn't need localStream as a dependency.
  // Without this, any stream change (e.g. camera flip) recreates createOffer,
  // which triggers the useEffect cleanup and closes all existing peer connections.
  const localStreamRef = useRef(localStream)
  localStreamRef.current = localStream

  const createOffer = useCallback(
    async (viewerSocketId: string) => {
      if (!socket || !localStreamRef.current) return

      const pc = createPeerConnection()
      peerConnections.current.set(viewerSocketId, pc)

      addStreamTracks(pc, localStreamRef.current)

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, {
            candidate: candidate.toJSON(),
            targetSocketId: viewerSocketId,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        setConnectionStates((prev) => {
          const next = new Map(prev)
          next.set(viewerSocketId, pc.connectionState)
          return next
        })

        if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          pc.close()
          peerConnections.current.delete(viewerSocketId)
          setConnectionStates((prev) => {
            const next = new Map(prev)
            next.delete(viewerSocketId)
            return next
          })
        }
      }

      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit(SOCKET_EVENTS.OFFER, {
          offer: pc.localDescription,
          targetSocketId: viewerSocketId,
        })
      } catch (err) {
        console.error('[WebRTC] createOffer failed:', err)
        pc.close()
        peerConnections.current.delete(viewerSocketId)
      }
    },
    [socket] // localStream intentionally excluded — read via ref to avoid reconnecting viewers on flip
  )

  // When the stream becomes available, retry offers for any viewers who joined before Start Camera.
  useEffect(() => {
    if (!localStream) return
    pendingViewerIds.current.forEach((id) => createOffer(id))
    pendingViewerIds.current.clear()
  }, [localStream, createOffer])

  // When stream changes (camera flip), replace tracks in all existing peer connections.
  // replaceTrack() swaps the track without renegotiation.
  useEffect(() => {
    if (!localStream || peerConnections.current.size === 0) return

    const videoTrack = localStream.getVideoTracks()[0]
    const audioTrack = localStream.getAudioTracks()[0]

    peerConnections.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video' && videoTrack) {
          sender.replaceTrack(videoTrack).catch((err) => console.warn('[WebRTC] replaceTrack video:', err))
        }
        if (sender.track?.kind === 'audio' && audioTrack) {
          sender.replaceTrack(audioTrack).catch((err) => console.warn('[WebRTC] replaceTrack audio:', err))
        }
      })
    })
  }, [localStream])

  useEffect(() => {
    if (!socket) return

    const onViewerJoined = ({
      viewerSocketId,
      viewerCount: count,
    }: {
      viewerSocketId: string
      viewerCount: number
    }) => {
      setViewerCount(count)
      if (!localStreamRef.current) {
        // Stream not started yet — queue viewer and retry when stream becomes available
        pendingViewerIds.current.add(viewerSocketId)
        return
      }
      createOffer(viewerSocketId)
    }

    const onViewerLeft = ({
      viewerSocketId,
      viewerCount: count,
    }: {
      viewerSocketId: string
      viewerCount: number
    }) => {
      setViewerCount(count)
      const pc = peerConnections.current.get(viewerSocketId)
      pc?.close()
      peerConnections.current.delete(viewerSocketId)
      setConnectionStates((prev) => {
        const next = new Map(prev)
        next.delete(viewerSocketId)
        return next
      })
    }

    const onAnswerReceived = async ({
      answer,
      viewerSocketId,
    }: {
      answer: RTCSessionDescriptionInit
      viewerSocketId: string
    }) => {
      const pc = peerConnections.current.get(viewerSocketId)
      if (!pc) return
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }

    const onIceCandidateReceived = async ({
      candidate,
      fromSocketId,
    }: {
      candidate: RTCIceCandidateInit
      fromSocketId: string
    }) => {
      const pc = peerConnections.current.get(fromSocketId)
      if (!pc) return
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Benign race: ICE candidates arriving after connection closed
      }
    }

    socket.on(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined)
    socket.on(SOCKET_EVENTS.VIEWER_LEFT, onViewerLeft)
    socket.on(SOCKET_EVENTS.ANSWER_RECEIVED, onAnswerReceived)
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE_RECEIVED, onIceCandidateReceived)

    return () => {
      socket.off(SOCKET_EVENTS.VIEWER_JOINED, onViewerJoined)
      socket.off(SOCKET_EVENTS.VIEWER_LEFT, onViewerLeft)
      socket.off(SOCKET_EVENTS.ANSWER_RECEIVED, onAnswerReceived)
      socket.off(SOCKET_EVENTS.ICE_CANDIDATE_RECEIVED, onIceCandidateReceived)
      peerConnections.current.forEach((pc) => pc.close())
      peerConnections.current.clear()
    }
  }, [socket, createOffer])

  return { viewerCount, connectionStates }
}

// ─── Viewer side ─────────────────────────────────────────────────────────────
// Manages a single RTCPeerConnection to the camera.
// Returns a videoRef that should be attached to the <video> element.

export function useViewerWebRTC(
  socket: Socket | null,
  cameraSocketId: string | null
): ViewerWebRTCState & { videoRef: React.RefObject<HTMLVideoElement | null>; getStats: () => Promise<RTCStatsReport | null> } {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'idle'>('idle')
  const [error, setError] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const getStats = useCallback(async (): Promise<RTCStatsReport | null> => {
    if (!pcRef.current) return null
    return pcRef.current.getStats()
  }, [])
  // iOS Safari: event.streams is empty — tracks arrive individually.
  // Collect them into one MediaStream so the video element gets a complete source.
  const incomingStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!socket || !cameraSocketId) return

    const onOfferReceived = async ({
      offer,
      cameraSocketId: camId,
    }: {
      offer: RTCSessionDescriptionInit
      cameraSocketId: string
    }) => {
      try {
        pcRef.current?.close()
        incomingStreamRef.current = new MediaStream()

        const pc = createPeerConnection()
        pcRef.current = pc

        pc.ontrack = (event) => {
          // Desktop: event.streams[0] has all tracks. iOS Safari: empty streams, tracks arrive one at a time.
          // Always collect into incomingStreamRef, then create a NEW MediaStream so React always sees a
          // reference change and the srcObject useEffect re-runs — critical for iOS to detect the video track.
          if (event.streams[0]) {
            event.streams[0].getTracks().forEach(track => {
              if (!incomingStreamRef.current!.getTrackById(track.id)) {
                incomingStreamRef.current!.addTrack(track)
              }
            })
          } else {
            incomingStreamRef.current!.addTrack(event.track)
          }
          const combined = new MediaStream(incomingStreamRef.current!.getTracks())
          incomingStreamRef.current = combined
          setRemoteStream(combined)
          // Only assign srcObject once video is present — assigning an audio-only stream first
          // prevents iOS Safari from rendering video when the track arrives later.
          // load() resets the element so the new source is always picked up.
          if (videoRef.current && combined.getVideoTracks().length > 0) {
            videoRef.current.srcObject = combined
            videoRef.current.load()
            videoRef.current.play().catch(() => {})
          }
        }

        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            socket.emit(SOCKET_EVENTS.ICE_CANDIDATE, {
              candidate: candidate.toJSON(),
              targetSocketId: camId,
            })
          }
        }

        pc.onconnectionstatechange = () => {
          setConnectionState(pc.connectionState)
          if (pc.connectionState === 'failed') {
            setError('Connection failed. Check your network and try again.')
          }
        }

        // iOS Safari doesn't always fire onconnectionstatechange — use ICE state as backup
        pc.oniceconnectionstatechange = () => {
          if (['connected', 'completed'].includes(pc.iceConnectionState)) {
            setConnectionState('connected')
          }
          if (pc.iceConnectionState === 'failed') {
            setConnectionState('failed')
            setError('Connection failed. Check your network and try again.')
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        socket.emit(SOCKET_EVENTS.ANSWER, {
          answer: pc.localDescription,
          cameraSocketId: camId,
        })

        setConnectionState('connecting')
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to camera')
      }
    }

    const onIceCandidateReceived = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit
    }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
      } catch {
        // Ignore benign races
      }
    }

    const onCameraDisconnected = () => {
      setRemoteStream(null)
      setError('The camera went offline.')
      if (videoRef.current) videoRef.current.srcObject = null
    }

    socket.on(SOCKET_EVENTS.OFFER_RECEIVED, onOfferReceived)
    socket.on(SOCKET_EVENTS.ICE_CANDIDATE_RECEIVED, onIceCandidateReceived)
    socket.on(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)

    return () => {
      socket.off(SOCKET_EVENTS.OFFER_RECEIVED, onOfferReceived)
      socket.off(SOCKET_EVENTS.ICE_CANDIDATE_RECEIVED, onIceCandidateReceived)
      socket.off(SOCKET_EVENTS.CAMERA_DISCONNECTED, onCameraDisconnected)
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [socket, cameraSocketId])

  return { remoteStream, connectionState, error, videoRef, getStats }
}
