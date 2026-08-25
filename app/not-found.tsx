import { Droplets } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page section-shell">
      <Droplets size={44} />
      <span className="eyebrow">404 · EMPTY TANK</span>
      <h1>This build evaporated.</h1>
      <p>The listing does not exist, or it has been removed from the leaderboard.</p>
      <Link className="button button-primary" href="/">Return to TokenGod</Link>
    </main>
  );
}

