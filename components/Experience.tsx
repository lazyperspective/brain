"use client";

import dynamic from "next/dynamic";
import { Overlay } from "./Overlay";

// WebGL never renders on the server, and pulling three into the RSC payload
// only delays the first paint.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
});

export function Experience() {
  return (
    <main className="stage">
      <Scene />
      <Overlay />
      <div className="grain" aria-hidden />
    </main>
  );
}
