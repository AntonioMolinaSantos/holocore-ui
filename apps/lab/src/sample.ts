import { levelFromRms, rms } from "./levels";

/** The line Antonio recorded, shown while it plays. Keep it word for word what the recording says. */
export const SAMPLE_CAPTION = "This is Holocore. It listens, it thinks, and it speaks.";
export const SAMPLE_SRC: string = __SAMPLE_SRC__;
export const SAMPLE_PRESENT: boolean = __SAMPLE_PRESENT__;

export type SamplePlayer = { play(): Promise<void>; stop(): void };

/** Plays the clip through an analyser, so the orb moves with the voice, and shows the caption while it plays. */
export function createSamplePlayer(src: string, onLevel: (level: number) => void, onCaption: (text: string | null) => void): SamplePlayer {
  const audio = new Audio(src);
  audio.preload = "none";
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  const buf = new Float32Array(1024);
  const tick = () => {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(buf);
    onLevel(levelFromRms(rms(buf)));
    raf = requestAnimationFrame(tick);
  };
  const end = () => {
    cancelAnimationFrame(raf);
    onLevel(0);
    onCaption(null);
  };
  audio.addEventListener("ended", end);
  audio.addEventListener("pause", end);
  return {
    async play() {
      if (!ctx) {
        // Made on the first click, a user gesture, and once: an element feeds one source node only.
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(ctx.destination);
      }
      await ctx.resume();
      audio.currentTime = 0;
      onCaption(SAMPLE_CAPTION);
      await audio.play();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    },
    stop() {
      audio.pause();
    },
  };
}
