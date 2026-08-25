import { Crown, Waves } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="TokenGod home">
      <span className="brand-mark" aria-hidden="true">
        <Crown className="brand-crown" size={18} strokeWidth={2.6} />
        <Waves className="brand-wave" size={24} strokeWidth={2.8} />
      </span>
      <span className="brand-word">TokenGod</span>
      <span className="brand-beta">BETA</span>
    </Link>
  );
}

