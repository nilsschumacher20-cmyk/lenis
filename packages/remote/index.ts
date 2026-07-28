// This file serves as an entry point for the package

export type { RemoteControlEvents } from './src/controller'
export { RemoteControl as default, RemoteControl } from './src/controller'
export { RemoteControlHost } from './src/host'
export {
  DEFAULT_CHANNEL,
  REMOTE_PROTOCOL,
  REMOTE_PROTOCOL_VERSION,
} from './src/protocol'
export * from './src/transports'
export * from './src/types'
