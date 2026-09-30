// Hold to talk. The page promises: "The sound is analysed on this page only:
// nothing is recorded, stored or sent." This module keeps that true on every
// path. The microphone is open only while a hold lasts; every track stops on
// every way a hold can end; a grant that arrives after its hold ended is
// stopped unused; and nothing here records or sends anything, anywhere.
import { levelFromRms, rms } from "./levels";

export const HOLD_CAP_MS = 30_000;

export type VoiceState = "idle" | "asking" | "live" | "denied" | "error";

export type VoiceDeps = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createAudioContext(): AudioContext;
  onLevel(level: number): void;
  onState(state: VoiceState, label?: string): void;
};

type Hold = { id: number; stream?: MediaStream; ctx?: AudioContext; raf: number; cap: ReturnType<typeof setTimeout> };

const DENIED_LABEL: Record<string, string> = {
  NotAllowedError: "Microphone blocked: allow it in the browser to talk",
  NotFoundError: "No microphone found",
  NotReadableError: "The microphone is busy",
};
const DENIED_FALLBACK = "The microphone could not start";
const ERROR_LABEL = "Something stopped the microphone: try again";

function deniedLabel(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  return (Object.hasOwn(DENIED_LABEL, name) && DENIED_LABEL[name]) || DENIED_FALLBACK;
}

/** A space pressed in these is theirs, not a hold: typing, choosing, another button. */
function ownsSpace(target: EventTarget | null, button: HTMLElement): boolean {
  if (!(target instanceof HTMLElement) || target === button || target === document.body) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(target.tagName);
}

function stopTracks(stream: MediaStream): void {
  for (const t of stream.getTracks()) t.stop();
}

export function bindHoldToTalk(button: HTMLButtonElement, deps: VoiceDeps): () => void {
  let holds = 0; // each hold has a number; a stream for an older number is stopped, never connected
  let hold: Hold | null = null;
  let spaceDown = false;
  const buf = new Float32Array(1024);

  function start(): void {
    if (hold) return;
    const id = ++holds;
    hold = { id, raf: 0, cap: setTimeout(() => stop(), HOLD_CAP_MS) };
    button.setAttribute("aria-pressed", "true");
    deps.onState("asking");
    deps.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }).then(
      (stream) => {
        const current = hold;
        if (!current || current.id !== id) { stopTracks(stream); return; } // a late grant, or a quick tap
        current.stream = stream;
        try {
          // Made only now that the stream exists: iOS Safari otherwise gives silence.
          const ctx = deps.createAudioContext();
          current.ctx = ctx;
          ctx.resume().catch(() => {});
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          ctx.createMediaStreamSource(stream).connect(analyser); // never to ctx.destination: no echo, no output
          const tick = () => {
            if (hold !== current) return;
            analyser.getFloatTimeDomainData(buf);
            deps.onLevel(levelFromRms(rms(buf)));
            current.raf = requestAnimationFrame(tick);
          };
          current.raf = requestAnimationFrame(tick);
          deps.onState("live");
        } catch {
          // No AudioContext, or a browser refuses one of the steps above: the hold cannot
          // continue, but the stream this browser just granted must still be closed.
          if (hold === current) stop("error", ERROR_LABEL);
          else stopTracks(stream);
        }
      },
      (err: unknown) => {
        if (hold && hold.id === id) stop("denied", deniedLabel(err));
      },
    );
  }

  /** Ends the current hold, if any. Reports `final` (default "idle") once: never a mid-teardown flicker. */
  function stop(final: VoiceState = "idle", label?: string): void {
    const h = hold;
    if (!h) return;
    hold = null;
    clearTimeout(h.cap);
    cancelAnimationFrame(h.raf);
    if (h.stream) stopTracks(h.stream);
    h.ctx?.close().catch(() => {});
    button.setAttribute("aria-pressed", "false");
    deps.onLevel(0);
    deps.onState(final, label);
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault(); // no text selection, no focus scroll
    try { button.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no active pointer */ }
    start();
  };
  const onPointerEnd = () => stop();
  const onContextMenu = (e: Event) => e.preventDefault(); // no long-press menu on touch
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || ownsSpace(e.target, button)) return;
    e.preventDefault(); // never scrolls, never clicks
    if (e.repeat || spaceDown) return;
    spaceDown = true;
    start();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== "Space") return;
    if (!ownsSpace(e.target, button)) e.preventDefault(); // a focused button clicks on keyup otherwise
    spaceDown = false;
    stop(); // released anywhere ends the hold
  };
  const onLeave = () => { spaceDown = false; stop(); };

  const pointerEnds = ["pointerup", "pointercancel", "lostpointercapture", "pointerleave"] as const;
  button.addEventListener("pointerdown", onPointerDown);
  for (const t of pointerEnds) button.addEventListener(t, onPointerEnd);
  button.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onLeave);
  document.addEventListener("visibilitychange", onLeave);

  return () => {
    stop();
    button.removeEventListener("pointerdown", onPointerDown);
    for (const t of pointerEnds) button.removeEventListener(t, onPointerEnd);
    button.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onLeave);
    document.removeEventListener("visibilitychange", onLeave);
  };
}
