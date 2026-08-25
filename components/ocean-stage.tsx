"use client";

import type { PointerEvent, ReactNode } from "react";

export function OceanStage({ children }: { children: ReactNode }) {
  function moveLight(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    event.currentTarget.style.setProperty("--pointer-x", `${x}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${y}px`);
    event.currentTarget.style.setProperty("--tank-tilt-x", `${((y / bounds.height) - 0.5) * -3}deg`);
    event.currentTarget.style.setProperty("--tank-tilt-y", `${((x / bounds.width) - 0.5) * 4}deg`);
  }

  function resetLight(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--tank-tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tank-tilt-y", "0deg");
  }

  return (
    <section className="hero-stage" onPointerMove={moveLight} onPointerLeave={resetLight}>
      <span className="ocean-cursor" aria-hidden="true" />
      {children}
    </section>
  );
}
