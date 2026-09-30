// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { build, type Rollup } from "vite";
import { afterEach, describe, expect, test, vi } from "vitest";
import { bindHoldToTalk, HOLD_CAP_MS, type VoiceDeps, type VoiceState } from "../../src/voice";

const labRoot = path.resolve(process.cwd(), "apps/lab");
const voiceSrc = readFileSync(path.join(labRoot, "src/voice.ts"), "utf-8");

type FakeTrack = { readyState: "live" | "ended"; stop: ReturnType<typeof vi.fn> };

function fakeTrack(): FakeTrack {
  const track: FakeTrack = { readyState: "live", stop: vi.fn() };
  track.stop.mockImplementation(() => { track.readyState = "ended"; });
  return track;
}

function fakeStream(): { getTracks: () => FakeTrack[] } & MediaStream {
  const tracks = [fakeTrack()];
  return { getTracks: () => tracks } as unknown as { getTracks: () => FakeTrack[] } & MediaStream;
}

function fakeAnalyser() {
  return { fftSize: 0, getFloatTimeDomainData: vi.fn() } as unknown as AnalyserNode;
}

function fakeCtx() {
  const analyser = fakeAnalyser();
  const source = { connect: vi.fn() };
  return {
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createAnalyser: vi.fn(() => analyser),
    createMediaStreamSource: vi.fn(() => source),
  } as unknown as AudioContext;
}

function fakeDeps(overrides: Partial<VoiceDeps> = {}) {
  const states: [VoiceState, string | undefined][] = [];
  const levels: number[] = [];
  const deps: VoiceDeps = {
    getUserMedia: vi.fn(() => new Promise<MediaStream>(() => {})),
    createAudioContext: vi.fn(() => fakeCtx()),
    onLevel: (l) => levels.push(l),
    onState: (s, label) => states.push([s, label]),
    ...overrides,
  };
  return { deps, states, levels };
}

let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { rafId += 1; rafCallbacks.set(rafId, cb); return rafId; });
vi.stubGlobal("cancelAnimationFrame", (id: number) => { rafCallbacks.delete(id); });

afterEach(() => {
  vi.useRealTimers();
  rafCallbacks.clear();
});

function fakeButton(): HTMLButtonElement {
  return document.createElement("button");
}

describe("bindHoldToTalk: numbering a hold that outlives itself", () => {
  test("stop, then a new hold: the old grant is stopped and never wired up, the new one still pending", async () => {
    let resolveA: ((s: MediaStream) => void) | undefined;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => { resolveA = r; }));
    const { deps, states } = fakeDeps({ getUserMedia });
    const button = fakeButton();
    bindHoldToTalk(button, deps);

    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
    button.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 })); // stop before A resolves

    let resolveB: ((s: MediaStream) => void) | undefined;
    getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((r) => { resolveB = r; }));
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 })); // start B

    const streamA = fakeStream();
    resolveA?.(streamA);
    await Promise.resolve();
    await Promise.resolve();

    expect(streamA.getTracks()[0].stop).toHaveBeenCalledTimes(1);
    expect(deps.createAudioContext).not.toHaveBeenCalled(); // A never wired up

    expect(resolveB).toBeTypeOf("function"); // B is still pending, untouched by A's resolution
    expect(button.getAttribute("aria-pressed")).toBe("true"); // B is still held
    expect(states.at(-1)?.[0]).toBe("asking");
  });
});

describe("bindHoldToTalk: a denied hold", () => {
  test("a rejection only ends its own hold: a later hold is unaffected", async () => {
    let rejectA: ((e: unknown) => void) | undefined;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((_r, j) => { rejectA = j; }));
    const { deps, states } = fakeDeps({ getUserMedia });
    const button = fakeButton();
    bindHoldToTalk(button, deps);

    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
    button.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 })); // stop before A rejects

    let resolveB: ((s: MediaStream) => void) | undefined;
    getUserMedia.mockImplementationOnce(() => new Promise<MediaStream>((r) => { resolveB = r; }));
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 })); // start B

    rejectA?.(Object.assign(new Error("NotAllowedError"), { name: "NotAllowedError" }));
    await Promise.resolve();
    await Promise.resolve();

    expect(states.some(([s]) => s === "denied")).toBe(false); // A's rejection is stale, ignored
    expect(resolveB).toBeTypeOf("function"); // B is unaffected
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(states.at(-1)?.[0]).toBe("asking");
  });

  test("NotAllowedError, NotFoundError and NotReadableError each get their own label; unknown names fall back", async () => {
    const cases: [string, string][] = [
      ["NotAllowedError", "Microphone blocked: allow it in the browser to talk"],
      ["NotFoundError", "No microphone found"],
      ["NotReadableError", "The microphone is busy"],
      ["SomeOtherError", "The microphone could not start"],
      ["constructor", "The microphone could not start"], // an inherited property is not a label
      ["", "The microphone could not start"],
    ];
    for (const [name, label] of cases) {
      const getUserMedia = vi.fn(() => Promise.reject(Object.assign(new Error(name), { name })));
      const { deps, states } = fakeDeps({ getUserMedia });
      const button = fakeButton();
      bindHoldToTalk(button, deps);
      button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
      await Promise.resolve();
      await Promise.resolve();
      expect(states.at(-1)).toEqual(["denied", label]);
      expect(states.some(([s]) => s === "idle")).toBe(false); // no idle flicker before denied
    }
  });
});

describe("bindHoldToTalk: a failure after the grant", () => {
  test("a throw while wiring the audio stops the track, reports error and releases the button", async () => {
    const stream = fakeStream();
    const { deps, states } = fakeDeps({
      getUserMedia: vi.fn(() => Promise.resolve(stream)),
      createAudioContext: vi.fn(() => { throw new Error("no AudioContext here"); }),
    });
    const button = fakeButton();
    bindHoldToTalk(button, deps);
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(stream.getTracks()[0].readyState).toBe("ended");
    expect(states.at(-1)?.[0]).toBe("error");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("bindHoldToTalk: the hold cap", () => {
  test("ends by itself after HOLD_CAP_MS", async () => {
    vi.useFakeTimers();
    const stream = fakeStream();
    const { deps } = fakeDeps({ getUserMedia: vi.fn(() => Promise.resolve(stream)) });
    const button = fakeButton();
    bindHoldToTalk(button, deps);
    button.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 1 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stream.getTracks()[0].readyState).toBe("live");
    await vi.advanceTimersByTimeAsync(HOLD_CAP_MS);
    expect(stream.getTracks()[0].readyState).toBe("ended");
  });
});

describe("nothing here sends or records", () => {
  test("voice.ts never records, sends or stores: no recorder, socket, beacon, peer connection, request, image beacon or storage API", () => {
    const banned = /MediaRecorder|WebSocket|sendBeacon|RTCPeerConnection|createMediaStreamDestination|XMLHttpRequest|EventSource|WebTransport|new Image|localStorage|sessionStorage|indexedDB|caches\.|\bfetch\b/;
    expect(voiceSrc).not.toMatch(banned);
  });

  test("the built lab bundle never records, sends or stores (fetch is allowed: the sample clip uses it)", async () => {
    // "e2e" mode: the only build mode that does not require the sample clip (a local-only
    // recording, gitignored) to be present, per sample-plugin.ts's own buildStart check.
    const result = await build({ root: labRoot, mode: "e2e", configFile: path.join(labRoot, "vite.config.ts"), build: { write: false }, logLevel: "silent" });
    const output = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    const chunks = (output as Rollup.OutputChunk[]).filter((c): c is Rollup.OutputChunk => c.type === "chunk");
    expect(chunks.length).toBeGreaterThan(0);
    const banned = /MediaRecorder|WebSocket|sendBeacon|RTCPeerConnection|createMediaStreamDestination|XMLHttpRequest|EventSource|WebTransport|localStorage|sessionStorage|indexedDB/;
    for (const chunk of chunks) expect(chunk.code, `banned pattern found in ${chunk.fileName}`).not.toMatch(banned);
  }, 60_000);
});
