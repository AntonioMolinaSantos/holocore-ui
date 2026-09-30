import "./style.css";
import pkg from "holocore-ui/package.json";
import { PRESETS, webglAvailable, type PresetName } from "holocore-ui/lite";
import { DEFAULT_STATE, configSnippet, installLines, normalizeAccent, toOptions, type LabState, type Mode } from "./controls";
import { createOrb } from "./orb";
import { mountFpsMeter, wantsFps } from "./fps";
import { bindHoldToTalk, type VoiceState } from "./voice";
import { SAMPLE_PRESENT, SAMPLE_SRC, createSamplePlayer } from "./sample";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`lab: #${id} is missing from index.html`);
  return el as T;
}

const orbEl = byId<HTMLDivElement>("orb");
const caption = byId<HTMLParagraphElement>("caption");
const preset = byId<HTMLSelectElement>("preset");
const accent = byId<HTMLInputElement>("accent");
const rings = byId<HTMLInputElement>("rings");
const ringsOut = byId<HTMLOutputElement>("rings-out");
const config = byId<HTMLElement>("config");
const copy = byId<HTMLButtonElement>("copy");
const copyStatus = byId<HTMLElement>("copy-status");
const sample = byId<HTMLButtonElement>("sample");
const sampleStatus = byId<HTMLElement>("sample-status");
const radios = (name: string) => [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];

const state: LabState = { ...DEFAULT_STATE, mode: webglAvailable() ? "webgl" : "lite" };
const orb = createOrb(orbEl, toOptions(state));
if (wantsFps(location.search)) mountFpsMeter(orbEl); // ?fps: the real frame rate, on a real device

function reflect(): void {
  orbEl.dataset.mode = state.mode;
  orbEl.dataset.preset = state.preset;
  orbEl.dataset.accent = state.accent ?? "";
  orbEl.dataset.rings = String(state.rings);
  orbEl.dataset.activity = state.activity;
  preset.value = state.preset;
  accent.value = (state.accent ?? PRESETS[state.preset].accent).toLowerCase();
  rings.value = String(state.rings);
  ringsOut.value = String(state.rings);
  for (const r of radios("mode")) r.checked = r.value === state.mode;
  for (const r of radios("activity")) r.checked = r.value === state.activity;
  config.textContent = configSnippet(state);
}

async function apply(change: Partial<LabState>): Promise<void> {
  Object.assign(state, change);
  if (change.mode) {
    await orb.setMode(change.mode);
    state.mode = orb.engine(); // WebGL refused: the lite orb is what draws
  }
  orb.update(toOptions(state));
  reflect();
}

for (const r of radios("mode")) r.addEventListener("change", () => void apply({ mode: r.value as Mode }));
for (const r of radios("activity")) r.addEventListener("change", () => void apply({ activity: r.value as LabState["activity"] }));
preset.addEventListener("change", () => void apply({ preset: preset.value as PresetName, accent: null }));
accent.addEventListener("input", () => void apply({ accent: normalizeAccent(accent.value) }));
rings.addEventListener("input", () => void apply({ rings: Number(rings.value) }));

copy.addEventListener("click", () => {
  if (!navigator.clipboard?.writeText) {
    copyStatus.textContent = "Copy failed: select the code below";
    return;
  }
  navigator.clipboard.writeText(configSnippet(state)).then(
    () => { copyStatus.textContent = "Copied"; },
    () => { copyStatus.textContent = "Copy failed: select the code below"; },
  );
});

let peak = 0;
/** Every level reaches the orb. The highest so far is kept on the element, which the browser tests read. */
function feedLevel(level: number): void {
  orb.update({ level });
  if (level > peak) {
    peak = level;
    orbEl.dataset.levelPeak = level.toFixed(3);
  }
}

if (SAMPLE_PRESENT) {
  const player = createSamplePlayer(SAMPLE_SRC, feedLevel, (text) => {
    caption.textContent = text ?? "";
    caption.hidden = text === null;
  });
  sample.addEventListener("click", () => {
    sampleStatus.textContent = "";
    player.play().catch((e: unknown) => {
      caption.hidden = true;
      sampleStatus.textContent = "Sample could not play";
      console.error("[holocore lab] the sample could not play:", e);
    });
  });
} else {
  sample.disabled = true;
  sample.textContent = "Sample coming soon";
}

const install = installLines(pkg.version);
byId("install-npm").textContent = install.npm;
byId("install-cdn").textContent = install.cdn;
byId("install-example").textContent = install.example;

const talk = byId<HTMLButtonElement>("talk");
const talkLabel: Record<VoiceState, string> = {
  idle: "Hold to talk",
  asking: "Waiting for the microphone",
  live: "Listening",
  denied: "Microphone blocked: allow it in the browser to talk",
  error: "Something stopped the microphone: try again",
};
// Without both, a hold could only fail: the button stays disabled instead of inviting retries.
if (navigator.mediaDevices?.getUserMedia && typeof AudioContext === "function") {
  talk.disabled = false;
  bindHoldToTalk(talk, {
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    createAudioContext: () => new AudioContext(),
    onLevel: feedLevel,
    onState: (s, label) => {
      talk.dataset.state = s;
      talk.textContent = label ?? talkLabel[s];
    },
  });
} else {
  talk.textContent = "Microphone unavailable on this page";
}

reflect();
void apply({ mode: state.mode });
