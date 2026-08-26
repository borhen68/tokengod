import type { ReactNode } from "react";

export function OceanStage({ children }: { children: ReactNode }) {
  return (
    <section className="hero-stage">{children}</section>
  );
}
