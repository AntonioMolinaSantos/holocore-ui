/**
 * Installed before the page loads: records every stream the page is given,
 * counts every AudioContext it makes, can gate a grant so the test decides
 * exactly when it resolves, counts every returned (resolved) grant, counts
 * WebSocket and RTCPeerConnection construction (nothing here should make
 * either), and turns MediaRecorder into a counter that throws.
 */
export function micProbe(): void {
  const w = window as unknown as {
    __mic: {
      streams: MediaStream[];
      contexts: number;
      recorders: number;
      sockets: number;
      peers: number;
      returned: number;
      gated: boolean;
      open: () => void;
    };
  };
  let release: (() => void) | null = null;
  w.__mic = {
    streams: [],
    contexts: 0,
    recorders: 0,
    sockets: 0,
    peers: 0,
    returned: 0,
    gated: false,
    open: () => release?.(),
  };
  const md = navigator.mediaDevices;
  const real = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    const stream = await real(constraints);
    w.__mic.streams.push(stream);
    if (w.__mic.gated) await new Promise<void>((r) => { release = r; });
    w.__mic.returned += 1;
    return stream;
  };
  const RealContext = window.AudioContext;
  window.AudioContext = class extends RealContext {
    constructor(options?: AudioContextOptions) {
      super(options);
      w.__mic.contexts += 1;
    }
  };
  (window as unknown as { MediaRecorder: unknown }).MediaRecorder = class {
    constructor() {
      w.__mic.recorders += 1;
      throw new Error("MediaRecorder is not allowed on this page");
    }
  };
  const RealSocket = window.WebSocket;
  (window as unknown as { WebSocket: unknown }).WebSocket = class extends RealSocket {
    constructor(...args: ConstructorParameters<typeof RealSocket>) {
      w.__mic.sockets += 1;
      super(...args);
    }
  };
  const maybePeer = (window as unknown as { RTCPeerConnection?: typeof RTCPeerConnection }).RTCPeerConnection;
  if (maybePeer) {
    const RealPeer: typeof RTCPeerConnection = maybePeer;
    class CountedPeer extends RealPeer {
      constructor(...args: ConstructorParameters<typeof RealPeer>) {
        w.__mic.peers += 1;
        super(...args);
      }
    }
    (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = CountedPeer;
  }
}
