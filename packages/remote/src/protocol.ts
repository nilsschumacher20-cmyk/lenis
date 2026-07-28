import type { RemoteEnvelope, RemoteMessage } from './types'

export const REMOTE_PROTOCOL = 'lenis-remote'
export const REMOTE_PROTOCOL_VERSION = 1
export const DEFAULT_CHANNEL = 'default'

let index = 0

/**
 * Generate an id unique to this document
 */
export function uid(prefix: string) {
  index += 1
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 10)}`
}

export function createEnvelope(
  channel: string,
  from: string,
  payload: RemoteMessage,
  to?: string
): RemoteEnvelope {
  return {
    protocol: REMOTE_PROTOCOL,
    version: REMOTE_PROTOCOL_VERSION,
    channel,
    from,
    ...(to === undefined ? {} : { to }),
    payload,
  }
}

/**
 * Narrow unknown message data to an envelope. Anything that isn't one — another
 * library's `postMessage`, a browser extension, a malformed payload — returns
 * `null` and is meant to be ignored.
 */
export function parseEnvelope(data: unknown): RemoteEnvelope | null {
  if (typeof data !== 'object' || data === null) return null

  const envelope = data as Partial<RemoteEnvelope>

  if (envelope.protocol !== REMOTE_PROTOCOL) return null
  if (envelope.version !== REMOTE_PROTOCOL_VERSION) return null
  if (typeof envelope.channel !== 'string') return null
  if (typeof envelope.from !== 'string') return null
  if (envelope.to !== undefined && typeof envelope.to !== 'string') return null
  if (typeof envelope.payload !== 'object' || envelope.payload === null)
    return null
  if (typeof (envelope.payload as RemoteMessage).type !== 'string') return null

  return envelope as RemoteEnvelope
}

/**
 * Whether an envelope is meant for the peer reading it
 */
export function isAddressedTo(
  envelope: RemoteEnvelope,
  channel: string,
  id: string
) {
  if (envelope.channel !== channel) return false
  if (envelope.from === id) return false // don't listen to ourselves
  if (envelope.to !== undefined && envelope.to !== id) return false
  return true
}
