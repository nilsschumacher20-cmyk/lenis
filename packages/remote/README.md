# lenis/remote

## Introduction

lenis/remote drives a [Lenis](https://github.com/darkroomengineering/lenis) instance from outside the document it lives in — a parent page controlling an iframe, an iframe controlling its parent, a devtools panel, or a second tab acting as a presenter remote.

It splits into two halves talking over a **transport**:

- `RemoteControlHost` wraps the Lenis instance. It receives commands, runs them, and broadcasts scroll state.
- `RemoteControl` sends commands and reads state. Its methods return promises that settle when the host acknowledges — `scrollTo` resolves once the scroll animation has actually completed on the other side.

## Installation

```bash
npm i lenis
```

## Usage

### Controlling an iframe

In the embedded document, expose the instance:

```js
import Lenis from 'lenis'
import { RemoteControlHost, parentTransport } from 'lenis/remote'

const lenis = new Lenis({ autoRaf: true })

const host = new RemoteControlHost(lenis, {
  transport: parentTransport({
    targetOrigin: 'https://controller.example',
    allowedOrigins: ['https://controller.example'],
  }),
})
```

In the embedding document, drive it:

```js
import { RemoteControl, iframeTransport } from 'lenis/remote'

const iframe = document.querySelector('iframe')

const remote = new RemoteControl({
  transport: iframeTransport(iframe, {
    targetOrigin: 'https://embedded.example',
    allowedOrigins: ['https://embedded.example'],
  }),
})

remote.on('state', (state) => {
  progressBar.style.scale = `${state.progress} 1`
})

await remote.scrollTo('#footer', { duration: 1.2 })
console.log('the iframe finished scrolling')
```

The host announces itself when it is created, and the controller asks for announcements when it is created — so the two connect whichever loads first. If a host may appear later, call `remote.discover()` again.

### Controlling another tab

`BroadcastChannel` links same-origin tabs and windows with no window references to pass around:

```js
// scrolled page
new RemoteControlHost(lenis, { transport: broadcastChannelTransport() })

// remote page, in another tab
const remote = new RemoteControl({ transport: broadcastChannelTransport() })
remote.scrollBy(window.innerHeight)
```

### Easing across the boundary

Functions can't be serialized, so easings live on the host under a name:

```js
new RemoteControlHost(lenis, {
  transport,
  easings: {
    expo: (t) => 1 - 2 ** (-10 * t),
  },
})

remote.scrollTo(1000, { duration: 1, easing: 'expo' })
```

An unknown name rejects the command rather than silently falling back.

### Several instances on one channel

Every peer sharing a `channel` sees every message, so a page with a main and a nested instance can expose both:

```js
new RemoteControlHost(mainLenis, { transport, id: 'main' })
new RemoteControlHost(panelLenis, { transport, id: 'panel' })

const panel = new RemoteControl({ transport, host: 'panel' })
```

Without a `host`, a controller broadcasts to all of them and `remote.hosts` maps each host id to its last known state.

## Security

Messages arriving over `postMessage` come from whoever can reach the window, so both transports and the host filter them:

- `allowedOrigins` on the transport drops envelopes from any other origin before they are parsed. `'*'` opts out of the check — only use it when the counterpart's origin is genuinely unknown.
- `targetOrigin` is what `postMessage` sends to. `'*'` makes the envelope readable by whatever document happens to be in the target window.
- `allowedCommands` narrows a host to a subset of commands, e.g. `['getState']` for a read-only observer.
- `authorize` gets the last word on every command, with the sender's origin in its second argument.

```js
new RemoteControlHost(lenis, {
  transport,
  allowedCommands: ['scrollTo', 'getState'],
  authorize: (command, { origin }) => origin === 'https://controller.example',
})
```

`setOptions` only ever writes the keys in `RemoteOptions` — a remote peer can't reach construction-time options or the prototype chain.

## Transports

- `postMessageTransport({ target, targetOrigin, allowedOrigins, source?, listenTarget? })` — the general case. `target` accepts a getter for windows that don't exist yet.
- `iframeTransport(iframe, { targetOrigin, allowedOrigins })` — talk to an iframe, only accepting messages back from it.
- `parentTransport({ targetOrigin, allowedOrigins })` — talk to the embedding document, from inside an iframe.
- `broadcastChannelTransport(name?)` — same-origin tabs and windows.

Anything implementing `send` and `subscribe` works, so the protocol also runs over a WebSocket, a `MessagePort` or a WebRTC data channel:

```js
const socketTransport = {
  send: (envelope) => socket.send(JSON.stringify(envelope)),
  subscribe: (handler) => {
    const onMessage = (event) => {
      const envelope = parseEnvelope(JSON.parse(event.data))
      if (envelope) handler(envelope, {})
    }
    socket.addEventListener('message', onMessage)
    return () => socket.removeEventListener('message', onMessage)
  },
}
```

## Host options

- `transport`: `RemoteTransport`. The link to the controllers.
- `channel`: `string` (default: `'default'`). Peers only talk to peers sharing a channel.
- `id`: `string` (default: random). Stable id, so a controller can address this host specifically.
- `stateInterval`: `number` (default: 100). Minimum delay in ms between two state broadcasts. `0` broadcasts on every scroll event, which is a message per frame while scrolling.
- `easings`: `Record<string, EasingFunction>`. Easings a controller can refer to by name.
- `allowedCommands`: `RemoteCommandType[]`. Commands this host accepts, all of them by default.
- `authorize`: `(command, context) => boolean`. Last word on whether a command runs.

## Host methods

- `state`: The current snapshot, as sent to the controllers.
- `broadcastState()`: Broadcast right away, bypassing `stateInterval`.
- `destroy()`: Stop serving commands and tell the controllers this host is gone. Leaves the Lenis instance alone.

## Controller options

- `transport`: `RemoteTransport`. The link to the hosts.
- `channel`: `string` (default: `'default'`).
- `id`: `string` (default: random).
- `host`: `string`. Only talk to the host with this id, instead of broadcasting to every host on the channel.
- `timeout`: `number` (default: 10000). Delay in ms after which a pending command rejects. `0` disables it.

## Controller methods

Every command returns a promise resolving with the host state, or rejecting if the host refuses it or nothing answers before `timeout`. When several hosts share the channel, the first acknowledgement wins. Commands are safe to call fire-and-forget — a rejection nobody awaits won't surface as an unhandled rejection.

- `scrollTo(target: number | string, options?: RemoteScrollToOptions)`: Resolves once the scroll completes on the host.
- `scrollBy(delta: number, options?: RemoteScrollToOptions)`: Same, relative to the host's current target scroll.
- `start()` / `stop()`: Start or stop the remote instance.
- `resize()`: Force the remote instance to recalculate its dimensions.
- `setOptions(options: RemoteOptions)`: Change the remote instance's options at runtime.
- `getState()`: Read the state without waiting for the next broadcast.
- `discover()`: Ask the hosts on the channel to announce themselves.
- `on(event, callback)` / `off(event, callback)`: `connect`, `disconnect` and `state`.
- `state`: Last known state of the addressed host, or of the first connected one.
- `hosts`: `Map<string, RemoteState>` of every connected host.
- `isConnected`: Whether at least one host is connected.
- `destroy()`: Stop listening and reject anything still pending.

`RemoteScrollToOptions` is the serializable subset of Lenis' `ScrollToOptions`: `offset`, `immediate`, `lock`, `duration`, `lerp`, `easing` (a name), `force`, `programmatic` and `userData`. `RemoteOptions` is the subset of `LenisOptions` that can be changed at runtime: `lerp`, `duration`, `easing`, `smoothWheel`, `syncTouch`, `syncTouchLerp`, `touchInertiaExponent`, `wheelMultiplier`, `touchMultiplier`, `infinite`, `overscroll`, `gestureOrientation` and `allowNestedScroll`.
