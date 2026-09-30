import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Holocore } from "../../../src/react";

// Every engine the wrapper's root reports, in order, for the test to read.
const seen: string[] = [];
(window as unknown as { seen: string[] }).seen = seen;
new MutationObserver((records) => {
  for (const r of records) {
    const el = r.target as HTMLElement;
    if (el.classList.contains("probe-root") && el.dataset.holocoreEngine) seen.push(el.dataset.holocoreEngine);
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-holocore-engine"] });

// ?lite-only renders the wrapper with no WebGL loader, as a lite-only app would.
const liteOnly = new URLSearchParams(location.search).has("lite-only");

function App() {
  const [level, setLevel] = useState(0);
  (window as unknown as { setLevel: (n: number) => void }).setLevel = setLevel;
  return (
    <div style={{ width: 480, height: 480 }}>
      {liteOnly
        ? <Holocore className="probe-root" theme="holo" level={level} />
        : <Holocore className="probe-root" theme="holo" level={level} webgl={() => import("../../../src/webgl")} />}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
