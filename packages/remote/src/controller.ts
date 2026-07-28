import { Emitter } from './emitter'
import { createEnvelope, DEFAULT_CHANNEL, isAddressedTo, uid } from './protocol'
import type {
  RemoteCommand,
  RemoteCommandInput,
  RemoteControllerMessage,
  RemoteControlOptions,
  RemoteEnvelope,
  RemoteHostMessage,
  RemoteOptions,
  RemoteScrollToOptions,
  RemoteState,
} from './types'

export type RemoteControlEvents = {
  /**
   * A host joined the channel, or answered a discovery
   */
  connect: (hostId: string, state: RemoteState) => void
  /**
   * A host left the channel
   */
  disconnect: (hostId: string) => void
  /**
   * A host broadcast its scroll state
   */
  state: (state: RemoteState, hostId: string) => void
}

type PendingCommand = {
  resolve: (state: RemoteState) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout> | null
}

/**
 * Drives one or several Lenis instances living in another window, frame or tab.
 *
 * Commands return a promise that settles when a host acknowledges them —
 * `scrollTo` resolves once the scroll animation has completed on the host side.
 * When several hosts share the channel, the first acknowledgement wins.
 *
 * @example
 * const remote = new RemoteControl({
 *   transport: iframeTransport(iframe, {
 *     targetOrigin: 'https://example.com',
 *     allowedOrigins: ['https://example.com'],
 *   }),
 * })
 *
 * remote.on('state', (state) => {
 *   progressBar.style.scale = `${state.progress} 1`
 * })
 *
 * await remote.scrollTo('#footer', { duration: 1.2 })
 */
export class RemoteControl {
  readonly id: string
  readonly channel: string
  /**
   * Last known state of every connected host, keyed by host id
   */
  readonly hosts = new Map<string, RemoteState>()

  private emitter = new Emitter<RemoteControlEvents>()
  private pending = new Map<string, PendingCommand>()
  private unsubscribe: () => void
  private target?: string
  private transport: RemoteControlOptions['transport']
  private timeout: number
  private destroyed = false

  constructor({
    transport,
    channel = DEFAULT_CHANNEL,
    id = uid('controller'),
    host,
    timeout = 10000,
  }: RemoteControlOptions) {
    this.id = id
    this.channel = channel
    this.transport = transport
    this.target = host
    this.timeout = timeout

    this.unsubscribe = transport.subscribe(this.onEnvelope)

    // hosts that were already running answer with a `hello`
    this.discover()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true

    for (const [id, command] of this.pending) {
      if (command.timeout !== null) clearTimeout(command.timeout)
      command.reject(new Error(`Lenis remote: command "${id}" was cancelled`))
    }
    this.pending.clear()

    this.hosts.clear()
    this.emitter.destroy()
    this.unsubscribe()
  }

  /**
   * Add an event listener for the given event and callback
   *
   * @returns Unsubscribe function
   */
  on<K extends keyof RemoteControlEvents>(
    event: K,
    callback: RemoteControlEvents[K]
  ) {
    return this.emitter.on(event, callback)
  }

  /**
   * Remove an event listener for the given event and callback
   */
  off<K extends keyof RemoteControlEvents>(
    event: K,
    callback: RemoteControlEvents[K]
  ) {
    this.emitter.off(event, callback)
  }

  /**
   * Last known state of the addressed host, or of the first connected one
   */
  get state(): RemoteState | undefined {
    if (this.target) return this.hosts.get(this.target)
    return this.hosts.values().next().value
  }

  /**
   * Whether at least one host is connected
   */
  get isConnected() {
    return this.target ? this.hosts.has(this.target) : this.hosts.size > 0
  }

  /**
   * Ask the hosts on the channel to announce themselves. Called once on
   * construction; call it again if a host may have been created since.
   */
  discover() {
    this.send({ type: 'discover' })
  }

  /**
   * Scroll the remote instance to a target value, a selector or a keyword
   * (`'top'`, `'bottom'`, …)
   *
   * @returns A promise resolving with the host state once the scroll completes
   */
  scrollTo(target: number | string, options?: RemoteScrollToOptions) {
    return this.request({ type: 'scrollTo', target, options })
  }

  /**
   * Scroll the remote instance by a delta, relative to its current target
   *
   * @returns A promise resolving with the host state once the scroll completes
   */
  scrollBy(delta: number, options?: RemoteScrollToOptions) {
    return this.request({ type: 'scrollBy', delta, options })
  }

  /**
   * Start the remote instance after it has been stopped
   */
  start() {
    return this.request({ type: 'start' })
  }

  /**
   * Stop the remote instance
   */
  stop() {
    return this.request({ type: 'stop' })
  }

  /**
   * Force the remote instance to recalculate its dimensions
   */
  resize() {
    return this.request({ type: 'resize' })
  }

  /**
   * Change the remote instance's options at runtime
   */
  setOptions(options: RemoteOptions) {
    return this.request({ type: 'setOptions', options })
  }

  /**
   * Read the remote instance's state, without waiting for its next broadcast
   */
  getState() {
    return this.request({ type: 'getState' })
  }

  private send(payload: RemoteControllerMessage) {
    this.transport.send(
      createEnvelope(this.channel, this.id, payload, this.target)
    )
  }

  private request(command: RemoteCommandInput) {
    const id = uid('command')

    const promise = new Promise<RemoteState>((resolve, reject) => {
      if (this.destroyed) {
        reject(new Error('Lenis remote: controller is destroyed'))
        return
      }

      const timeout =
        this.timeout > 0
          ? setTimeout(() => {
              this.pending.delete(id)
              reject(
                new Error(
                  `Lenis remote: "${command.type}" timed out after ${this.timeout}ms`
                )
              )
            }, this.timeout)
          : null

      this.pending.set(id, { resolve, reject, timeout })

      this.send({
        type: 'command',
        command: { ...command, id } as RemoteCommand,
      })
    })

    // commands are usable fire-and-forget, so a rejection nobody awaits must
    // not surface as an unhandled rejection — `promise` itself still throws for
    // callers that do await it
    promise.catch(() => {
      // swallowed here, re-thrown to whoever awaits `promise`
    })

    return promise
  }

  private settle(id: string, state: RemoteState): void
  private settle(id: string, state: undefined, error: Error): void
  private settle(id: string, state?: RemoteState, error?: Error) {
    const command = this.pending.get(id)
    if (!command) return

    this.pending.delete(id)
    if (command.timeout !== null) clearTimeout(command.timeout)

    if (error) {
      command.reject(error)
    } else if (state) {
      command.resolve(state)
    }
  }

  private onEnvelope = (envelope: RemoteEnvelope) => {
    if (this.destroyed) return
    if (!isAddressedTo(envelope, this.channel, this.id)) return
    if (this.target && envelope.from !== this.target) return

    const payload = envelope.payload as RemoteHostMessage
    const hostId = envelope.from

    switch (payload.type) {
      case 'hello': {
        const isNew = !this.hosts.has(hostId)
        this.hosts.set(hostId, payload.state)
        if (isNew) this.emitter.emit('connect', hostId, payload.state)
        break
      }
      case 'bye': {
        if (this.hosts.delete(hostId)) {
          this.emitter.emit('disconnect', hostId)
        }
        break
      }
      case 'state': {
        this.track(hostId, payload.state)
        break
      }
      case 'ack': {
        this.track(hostId, payload.state)
        this.settle(payload.id, payload.state)
        break
      }
      case 'error': {
        this.settle(
          payload.id,
          undefined,
          new Error(`Lenis remote: ${payload.message}`)
        )
        break
      }
    }
  }

  /**
   * Record a host's state, connecting it first if we somehow missed its `hello`
   */
  private track(hostId: string, state: RemoteState) {
    const isNew = !this.hosts.has(hostId)
    this.hosts.set(hostId, state)

    if (isNew) this.emitter.emit('connect', hostId, state)
    this.emitter.emit('state', state, hostId)
  }
}
