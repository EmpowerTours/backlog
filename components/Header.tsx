import Link from "next/link";
import { Connect } from "./Connect";

export function Header() {
  return (
    <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="font-display text-xl font-extrabold tracking-tight text-text">
          backlog
        </span>
        <span className="hidden font-mono text-xs text-faint sm:inline">
          / onchain build ledger
        </span>
      </Link>
      <Connect />
    </header>
  );
}
