import type {
  EasingFunction,
  GestureOrientation,
  Scrolling,
  UserData,
} from 'lenis'

/**
 * Serializable subset of Lenis `ScrollToOptions`.
 *
 * `easing` is a key into the host's `easings` registry rather than a function,
 * as functions can't cross a message boundary.
 */
export type RemoteScrollToOptions = {
  /**
   * The offset to apply to the target value
   * @default 0
   */
  offset?: number
  /**
   * Skip the animation and jump to the target value immediately
   * @default false
   */
  immediate?: boolean
  /**
   * Lock the scroll to the target value
   * @default false
   */
  lock?: boolean
  /**
   * The duration of the scroll animation (in s)
   */
  duration?: number
  /**
   * Linear interpolation (lerp) intensity (between 0 and 1)
   */
  lerp?: number
  /**
   * Key of an easing function registered on the host through its `easings` option
   */
  easing?: string
  /**
   * Scroll even if stopped
   * @default false
   */
  force?: boolean
  /**
   * Scroll initiated from outside of the lenis instance
   * @default true
   */
  programmatic?: boolean
  /**
   * User data that will be forwarded through the scroll event, must be structured-cloneable
   */
  userData?: UserData
}

/**
 * Serializable subset of `LenisOptions` that is safe to change at runtime.
 *
 * Options that are read once at construction time (`wrapper`, `orientation`,
 * `autoRaf`, …) are intentionally excluded.
 */
export type RemoteOptions = {
  lerp?: number
  duration?: number
  /**
   * Key of an easing function registered on the host through its `easings` option
   */
  easing?: string
  smoothWheel?: boolean
  syncTouch?: boolean
  syncTouchLerp?: number
  touchInertiaExponent?: number
  wheelMultiplier?: number
  touchMultiplier?: number
  infinite?: boolean
  overscroll?: boolean
  gestureOrientation?: GestureOrientation
  allowNestedScroll?: boolean
}

/**
 * A snapshot of a remote Lenis instance
 */
export type RemoteState = {
  scroll: number
  targetScroll: number
  limit: number
  progress: number
  velocity: number
  direction: 1 | -1 | 0
  isScrolling: Scrolling
  isStopped: boolean
  isLocked: boolean
  isHorizontal: boolean
  /**
   * The time in ms since the remote lenis instance was created
   */
  time: number
}

export type RemoteCommand =
  | {
      id: string
      type: 'scrollTo'
      target: number | string
      options?: RemoteScrollToOptions
    }
  | {
      id: string
      type: 'scrollBy'
      delta: number
      options?: RemoteScrollToOptions
    }
  | { id: string; type: 'start' }
  | { id: string; type: 'stop' }
  | { id: string; type: 'resize' }
  | { id: string; type: 'setOptions'; options: RemoteOptions }
  | { id: string; type: 'getState' }

export type RemoteCommandType = RemoteCommand['type']

// `Omit` collapses a union to its common keys, this keeps each member intact
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never

/**
 * A command before the controller stamps it with an id
 */
export type RemoteCommandInput = DistributiveOmit<RemoteCommand, 'id'>

/**
 * Messages sent by a controller to the hosts on its channel
 */
export type RemoteControllerMessage =
  | { type: 'command'; command: RemoteCommand }
  | { type: 'discover' }

/**
 * Messages sent by a host to the controllers on its channel
 */
export type RemoteHostMessage =
  | { type: 'hello'; state: RemoteState }
  | { type: 'bye' }
  | { type: 'state'; state: RemoteState }
  | { type: 'ack'; id: string; state: RemoteState }
  | { type: 'error'; id: string; message: string }

export type RemoteMessage = RemoteControllerMessage | RemoteHostMessage

/**
 * The wire format. Everything a transport carries is an envelope.
 */
export type RemoteEnvelope = {
  protocol: 'lenis-remote'
  version: number
  /**
   * Peers only talk to peers sharing the same channel
   */
  channel: string
  /**
   * Id of the peer that sent the envelope
   */
  from: string
  /**
   * Id of the intended recipient, when the envelope is not a broadcast
   */
  to?: string
  payload: RemoteMessage
}

/**
 * What a transport knows about the sender of an envelope, when it knows it
 */
export type RemoteTransportContext = {
  /**
   * Origin the envelope came from, when the transport can determine it
   */
  origin?: string
}

export type RemoteTransportHandler = (
  envelope: RemoteEnvelope,
  context: RemoteTransportContext
) => void

/**
 * The link between a host and its controllers. Implement this to run the
 * protocol over anything: a WebSocket, a `MessagePort`, a WebRTC data channel…
 */
export type RemoteTransport = {
  send: (envelope: RemoteEnvelope) => void
  subscribe: (handler: RemoteTransportHandler) => () => void
  destroy?: () => void
}

export type RemoteControlHostOptions = {
  /**
   * The link to the controllers
   */
  transport: RemoteTransport
  /**
   * Peers only talk to peers sharing the same channel
   * @default 'default'
   */
  channel?: string
  /**
   * Stable id for this host, useful to address it specifically from a controller.
   * Defaults to a random id.
   */
  id?: string
  /**
   * Minimum delay (in ms) between two state broadcasts. `0` broadcasts on every
   * scroll event, which is a message per frame while scrolling.
   * @default 100
   */
  stateInterval?: number
  /**
   * Easing functions a controller can refer to by name
   */
  easings?: Record<string, EasingFunction>
  /**
   * Commands this host accepts. Defaults to all of them.
   */
  allowedCommands?: RemoteCommandType[]
  /**
   * Last word on whether a command runs. Called after `allowedCommands`.
   */
  authorize?: (
    command: RemoteCommand,
    context: RemoteTransportContext
  ) => boolean
}

export type RemoteControlOptions = {
  /**
   * The link to the hosts
   */
  transport: RemoteTransport
  /**
   * Peers only talk to peers sharing the same channel
   * @default 'default'
   */
  channel?: string
  /**
   * Stable id for this controller. Defaults to a random id.
   */
  id?: string
  /**
   * Only talk to the host with this id. Defaults to broadcasting to every host
   * on the channel.
   */
  host?: string
  /**
   * Delay (in ms) after which a pending command rejects. `0` disables it.
   * @default 10000
   */
  timeout?: number
}
