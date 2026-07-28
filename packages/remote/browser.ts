// This file serves as an entry point for the package
import { RemoteControl } from './src/controller'
import { RemoteControlHost } from './src/host'
import {
  broadcastChannelTransport,
  iframeTransport,
  parentTransport,
  postMessageTransport,
} from './src/transports'

const LenisRemote = {
  RemoteControl,
  RemoteControlHost,
  broadcastChannelTransport,
  postMessageTransport,
  iframeTransport,
  parentTransport,
}

// @ts-expect-error
globalThis.LenisRemote = LenisRemote
