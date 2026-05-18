'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { createPeerConnection, addStreamTracks } from '@/lib/webrtc'
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
  const [viewerCount, setViewerCount] = useState(0)
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

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socket.emit(SOCKET_EVENTS.OFFER, {
        offer: pc.localDescription,
        targetSocketId: viewerSocketId,
      })
    },
    [socket] // localStream intentionally excluded — read via ref to avoid reconnecting viewers on flip
  )

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
): ViewerWebRTCState & { videoRef: React.RefObject<HTMLVideoElement | null> } {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'idle'>('idle')
  const [error, setError] = useState<string | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

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

        const pc = createPeerConnection()
        pcRef.current = pc

        pc.ontrack = (event) => {
          const [stream] = event.streams
          setRemoteStream(stream)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
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

  return { remoteStream, connectionState, error, videoRef }
}
