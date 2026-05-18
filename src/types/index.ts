// ─── Socket.IO Event Payloads ───────────────────────────────────────────────

export interface JoinRoomPayload {
  roomCode: string
}

export interface ViewerJoinPayload {
  roomCode: string
}

export interface OfferPayload {
  offer: RTCSessionDescriptionInit
  targetSocketId: string
}

export interface AnswerPayload {
  answer: RTCSessionDescriptionInit
  cameraSocketId: string
}

export interface IceCandidatePayload {
  candidate: RTCIceCandidateInit
  targetSocketId: string
}

export interface AudioActivityPayload {
  level: number     // 0–100
  isActive: boolean // sustained activity above threshold
}

export interface BatteryUpdatePayload {
  level: number     // 0–1 (raw from Battery API)
  charging: boolean
}

export interface ViewerJoinedPayload {
  viewerSocketId: string
  viewerCount: number
}

export interface RoomJoinedPayload {
  cameraSocketId?: string
  roomCode?: string
}

export interface RoomErrorPayload {
  message: string
}

// ─── WebRTC Hook Return Types ────────────────────────────────────────────────

export interface CameraWebRTCState {
  viewerCount: number
  connectionStates: Map<string, RTCPeerConnectionState>
}

export interface ViewerWebRTCState {
  remoteStream: MediaStream | null
  connectionState: RTCPeerConnectionState | 'idle'
  error: string | null
}

// ─── Media Stream ────────────────────────────────────────────────────────────

export type CameraFacing = 'user' | 'environment'

export interface MediaStreamState {
  stream: MediaStream | null
  error: string | null
  isRequesting: boolean
  facing: CameraFacing
}

// ─── Audio Detection ─────────────────────────────────────────────────────────

export interface AudioDetectionState {
  level: number       // 0–100 RMS
  isActive: boolean   // sustained above threshold
}

// ─── Wake Lock ───────────────────────────────────────────────────────────────

export interface WakeLockState {
  isLocked: boolean
  isSupported: boolean
}

// ─── Battery Status API (not in standard TS DOM lib) ────────────────────────

export interface BatteryManager extends EventTarget {
  readonly charging: boolean
  readonly chargingTime: number
  readonly dischargingTime: number
  readonly level: number
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null
  onchargingtimechange: ((this: BatteryManager, ev: Event) => void) | null
  ondischargingtimechange: ((this: BatteryManager, ev: Event) => void) | null
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null
}

declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>
  }
}

// ─── Page State Machines ─────────────────────────────────────────────────────

export type CameraPageState =
  | 'idle'
  | 'requesting-permission'
  | 'streaming'
  | 'error'

export type ViewerPageState =
  | 'connecting'
  | 'waiting-for-camera'
  | 'streaming'
  | 'disconnected'
  | 'error'
