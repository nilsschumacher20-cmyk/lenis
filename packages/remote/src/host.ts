import type Lenis from 'lenis'
import type { EasingFunction } from 'lenis'
import { createEnvelope, DEFAULT_CHANNEL, isAddressedTo, uid } from './protocol'
import type {
  RemoteCommand,
  RemoteControlHostOptions,
  RemoteControllerMessage,
  RemoteEnvelope,
  RemoteHostMessage,
  RemoteOptions,
  RemoteScrollToOptions,
  RemoteState,
  RemoteTransportContext,
} from './types'

/**
 * Options a controller may change at runtime. Applying only these keys, rather
 * than whatever the payload happens to carry, keeps a remote peer from writing
 * to `__proto__` or to construction-time options.
 */
const REMOTE_OPTION_KEYS = [
  'lerp',
  'duration',
  'smoothWheel',
  'syncTouch',
  'syncTouchLerp',
  'touchInertiaExponent',
  'wheelMultiplier',
  'touchMultiplier',
  'infinite',
  'overscroll',
  'gestureOrientation',
  'allowNestedScroll',
] as const satisfies readonly Exclude<keyof RemoteOptions, 'easing'>[]

/**
 * Exposes a Lenis instance to controllers sitting in another window, frame or
 * tab. The host owns the instance: it receives commands, runs them, and
 * broadcasts scroll state back.
 *
 * @example
 * const lenis = new Lenis({ autoRaf: true })
 *
 * const host = new RemoteControlHost(lenis, {
 *   transport: broadcastChannelTransport(),
 *   easings: {
 *     expo: (t) => 1 - 2 ** (-10 * t),
 *   },
 * })
 */
export class RemoteControlHost {
  readonly id: string
  readonly channel: string
  readonly options: Required<
    Pick<RemoteControlHostOptions, 'transport' | 'stateInterval' | 'easings'>
  > &
    Pick<RemoteControlHostOptions, 'allowedCommands' | 'authorize'>

  private unsubscribe: () => void
  private lastStateTime = 0
  private stateTimeout: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(
    private lenis: Lenis,
    {
      transport,
      channel = DEFAULT_CHANNEL,
      id = uid('host'),
      stateInterval = 100,
      easings = {},
      allowedCommands,
      authorize,
    }: RemoteControlHostOptions
  ) {
    this.id = id
    this.channel = channel
    this.options = {
      transport,
      stateInterval,
      easings,
      allowedCommands,
      authorize,
    }

    this.unsubscribe = transport.subscribe(this.onEnvelope)
    this.lenis.on('scroll', this.onScroll)

    // let controllers already listening know we're here
    this.send({ type: 'hello', state: this.state })
  }

  /**
   * Stop serving commands and tell the controllers this host is gone. Does not
   * destroy the underlying Lenis instance.
   */
  destroy() {
    if (this.destroyed) return
    this.destroyed = true

    this.send({ type: 'bye' })

    this.lenis.off('scroll', this.onScroll)
    this.unsubscribe()

    if (this.stateTimeout !== null) {
      clearTimeout(this.stateTimeout)
      this.stateTimeout = null
    }
  }

  /**
   * A snapshot of the Lenis instance, as sent to the controllers
   */
  get state(): RemoteState {
    const lenis = this.lenis

    return {
      scroll: lenis.scroll,
      targetScroll: lenis.targetScroll,
      limit: lenis.limit,
      progress: lenis.progress,
      velocity: lenis.velocity,
      direction: lenis.direction,
      isScrolling: lenis.isScrolling,
      isStopped: lenis.isStopped,
      isLocked: lenis.isLocked,
      isHorizontal: lenis.isHorizontal,
      time: lenis.time,
    }
  }

  /**
   * Broadcast the current state right away, bypassing `stateInterval`
   */
  broadcastState() {
    if (this.stateTimeout !== null) {
      clearTimeout(this.stateTimeout)
      this.stateTimeout = null
    }

    this.lastStateTime = Date.now()
    this.send({ type: 'state', state: this.state })
  }

  private send(payload: RemoteHostMessage, to?: string) {
    this.options.transport.send(
      createEnvelope(this.channel, this.id, payload, to)
    )
  }

  private onScroll = () => {
    const interval = this.options.stateInterval

    if (interval <= 0) {
      this.broadcastState()
      return
    }

    const elapsed = Date.now() - this.lastStateTime

    if (elapsed >= interval) {
      this.broadcastState()
    } else if (this.stateTimeout === null) {
      // trailing edge, so the last position of a scroll is never missed
      this.stateTimeout = setTimeout(() => {
        this.stateTimeout = null
        this.broadcastState()
      }, interval - elapsed)
    }
  }

  private onEnvelope = (
    envelope: RemoteEnvelope,
    context: RemoteTransportContext
  ) => {
    if (this.destroyed) return
    if (!isAddressedTo(envelope, this.channel, this.id)) return

    const payload = envelope.payload as RemoteControllerMessage

    if (payload.type === 'discover') {
      this.send({ type: 'hello', state: this.state }, envelope.from)
      return
    }

    if (payload.type !== 'command') return

    const command = payload.command
    if (typeof command?.id !== 'string' || typeof command.type !== 'string')
      return

    if (!this.isAllowed(command, context)) {
      this.send(
        { type: 'error', id: command.id, message: 'Command not allowed' },
        envelope.from
      )
      return
    }

    try {
      this.run(command, envelope.from)
    } catch (error) {
      this.send(
        {
          type: 'error',
          id: command.id,
          message: error instanceof Error ? error.message : String(error),
        },
        envelope.from
      )
    }
  }

  private isAllowed(command: RemoteCommand, context: RemoteTransportContext) {
    const { allowedCommands, authorize } = this.options

    if (allowedCommands && !allowedCommands.includes(command.type)) return false
    if (authorize && !authorize(command, context)) return false

    return true
  }

  private run(command: RemoteCommand, from: string) {
    switch (command.type) {
      case 'scrollTo': {
        if (
          typeof command.target !== 'number' &&
          typeof command.target !== 'string'
        ) {
          throw new TypeError('scrollTo target must be a number or a string')
        }
        this.scrollTo(command.id, from, command.target, command.options)
        return
      }
      case 'scrollBy': {
        if (typeof command.delta !== 'number') {
          throw new TypeError('scrollBy delta must be a number')
        }
        this.scrollTo(
          command.id,
          from,
          this.lenis.targetScroll + command.delta,
          command.options
        )
        return
      }
      case 'start': {
        this.lenis.start()
        break
      }
      case 'stop': {
        this.lenis.stop()
        break
      }
      case 'resize': {
        this.lenis.resize()
        break
      }
      case 'setOptions': {
        this.applyOptions(command.options ?? {})
        break
      }
      case 'getState': {
        break
      }
      default: {
        throw new TypeError(
          `Unknown command "${(command as RemoteCommand).type}"`
        )
      }
    }

    this.send({ type: 'ack', id: command.id, state: this.state }, from)
  }

  private scrollTo(
    id: string,
    from: string,
    target: number | string,
    options: RemoteScrollToOptions = {}
  ) {
    // resolved before the call so an unknown easing rejects the command
    const easing = this.resolveEasing(options.easing)

    let accepted = false

    this.lenis.scrollTo(target, {
      offset: options.offset,
      immediate: options.immediate,
      lock: options.lock,
      duration: options.duration,
      lerp: options.lerp,
      easing,
      force: options.force,
      programmatic: options.programmatic,
      userData: options.userData,
      onStart: () => {
        accepted = true
      },
      onComplete: () => {
        accepted = true
        this.send({ type: 'ack', id, state: this.state }, from)
      },
    })

    // Lenis bails out without calling either callback when it is stopped or
    // locked, or when the target can't be resolved — nothing will ever ack it
    if (!accepted) {
      let reason = `could not resolve target ${JSON.stringify(target)}`
      if (this.lenis.isStopped) reason = 'lenis is stopped'
      else if (this.lenis.isLocked) reason = 'lenis is locked'

      this.send(
        { type: 'error', id, message: `Scroll rejected: ${reason}` },
        from
      )
    }
  }

  private applyOptions(options: RemoteOptions) {
    for (const key of REMOTE_OPTION_KEYS) {
      const value = options[key]
      if (value === undefined) continue
      // biome-ignore lint/suspicious/noExplicitAny: key is narrowed by REMOTE_OPTION_KEYS, the value type isn't
      ;(this.lenis.options as any)[key] = value
    }

    if (options.easing !== undefined) {
      this.lenis.options.easing = this.resolveEasing(options.easing)
    }
  }

  private resolveEasing(name?: string): EasingFunction | undefined {
    if (name === undefined) return undefined

    const easing = this.options.easings[name]
    if (!easing) {
      throw new Error(
        `Unknown easing "${name}", register it through the host's \`easings\` option`
      )
    }

    return easing
  }
}
