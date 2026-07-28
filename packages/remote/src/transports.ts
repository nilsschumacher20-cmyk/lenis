import { parseEnvelope } from './protocol'
import type {
  RemoteEnvelope,
  RemoteTransport,
  RemoteTransportHandler,
} from './types'

/**
 * Origins allowed to talk to a peer. `'*'` is an explicit opt-out of the check
 * and should only be used when the page can't know its counterpart's origin.
 */
export type AllowedOrigins = string[] | '*'

export function isOriginAllowed(origin: string, allowed: AllowedOrigins) {
  if (allowed === '*') return true
  return allowed.includes(origin)
}

export type PostMessageTransportOptions = {
  /**
   * The window to send envelopes to. Pass a getter when the window doesn't
   * exist yet, e.g. an iframe that hasn't loaded.
   */
  target: Window | (() => Window | null | undefined)
  /**
   * The origin envelopes are sent to, matching `postMessage`'s second argument.
   * Use `'*'` only when the target's origin is genuinely unknown — it makes the
   * envelope readable by whatever document happens to be there.
   */
  targetOrigin: string
  /**
   * Origins envelopes are accepted from. Incoming messages from any other
   * origin are dropped before they are parsed.
   */
  allowedOrigins: AllowedOrigins
  /**
   * Only accept messages whose `event.source` is this window. Narrows a page
   * listening to several frames down to the one it cares about.
   */
  source?: Window | (() => Window | null | undefined)
  /**
   * The window listening for messages
   * @default window
   */
  listenTarget?: Window
}

function resolveWindow(
  target: Window | (() => Window | null | undefined) | undefined
) {
  return typeof target === 'function' ? target() : target
}

/**
 * Carry the protocol over `postMessage`, for a page controlling an iframe, a
 * popup, or its own parent — same origin or not.
 *
 * @example
 * // inside the iframe
 * const transport = postMessageTransport({
 *   target: window.parent,
 *   targetOrigin: 'https://example.com',
 *   allowedOrigins: ['https://example.com'],
 * })
 */
export function postMessageTransport({
  target,
  targetOrigin,
  allowedOrigins,
  source,
  listenTarget = window,
}: PostMessageTransportOptions): RemoteTransport {
  const handlers = new Set<RemoteTransportHandler>()

  const onMessage = (event: MessageEvent) => {
    if (!isOriginAllowed(event.origin, allowedOrigins)) return

    const expectedSource = resolveWindow(source)
    if (expectedSource && event.source !== expectedSource) return

    const envelope = parseEnvelope(event.data)
    if (!envelope) return

    for (const handler of handlers) {
      handler(envelope, { origin: event.origin })
    }
  }

  listenTarget.addEventListener('message', onMessage)

  return {
    send(envelope: RemoteEnvelope) {
      // the target may not exist yet, or anymore — dropping is the right move,
      // peers re-announce themselves when they connect
      resolveWindow(target)?.postMessage(envelope, targetOrigin)
    },
    subscribe(handler: RemoteTransportHandler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    destroy() {
      handlers.clear()
      listenTarget.removeEventListener('message', onMessage)
    },
  }
}

/**
 * Talk to a Lenis instance running inside an iframe
 *
 * @example
 * const remote = new RemoteControl({
 *   transport: iframeTransport(iframe, {
 *     targetOrigin: 'https://example.com',
 *     allowedOrigins: ['https://example.com'],
 *   }),
 * })
 */
export function iframeTransport(
  iframe: HTMLIFrameElement,
  options: Omit<PostMessageTransportOptions, 'target' | 'source'>
): RemoteTransport {
  const contentWindow = () => iframe.contentWindow
  return postMessageTransport({
    ...options,
    target: contentWindow,
    source: contentWindow,
  })
}

/**
 * Talk to the document embedding this one, from inside an iframe
 *
 * @example
 * const host = new RemoteControlHost(lenis, {
 *   transport: parentTransport({
 *     targetOrigin: 'https://example.com',
 *     allowedOrigins: ['https://example.com'],
 *   }),
 * })
 */
export function parentTransport(
  options: Omit<PostMessageTransportOptions, 'target' | 'source'>
): RemoteTransport {
  return postMessageTransport({
    ...options,
    target: () => window.parent,
    source: () => window.parent,
  })
}

/**
 * Carry the protocol over a `BroadcastChannel`, for tabs and windows of the
 * same origin. Every peer on the channel receives every envelope, so several
 * controllers and several hosts can share one.
 *
 * @example
 * const host = new RemoteControlHost(lenis, {
 *   transport: broadcastChannelTransport(),
 * })
 */
export function broadcastChannelTransport(
  name = 'lenis-remote'
): RemoteTransport {
  const channel = new BroadcastChannel(name)
  const handlers = new Set<RemoteTransportHandler>()

  const onMessage = (event: MessageEvent) => {
    const envelope = parseEnvelope(event.data)
    if (!envelope) return

    for (const handler of handlers) {
      // a BroadcastChannel is same-origin by construction
      handler(envelope, { origin: window.location.origin })
    }
  }

  channel.addEventListener('message', onMessage)

  return {
    send(envelope: RemoteEnvelope) {
      channel.postMessage(envelope)
    },
    subscribe(handler: RemoteTransportHandler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    destroy() {
      handlers.clear()
      channel.removeEventListener('message', onMessage)
      channel.close()
    },
  }
}
