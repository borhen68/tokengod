import { Waves } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="TokenGod home">
      <span className="brand-mark" aria-hidden="true">
        <Waves size={20} strokeWidth={2.4} />
      </span>
      <span className="brand-word">TokenGod</span>
    </Link>
  );
}
