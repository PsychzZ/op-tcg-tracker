"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/cards", label: "Karten" },
  { href: "/watchlist", label: "Watchlist" },
];

export function MainNav({ isOwner }: { isOwner: boolean }) {
  const path = usePathname();
  const links = isOwner ? [...LINKS, { href: "/settings/invites", label: "Invites" }] : LINKS;
  return (
    <nav className="flex gap-1 text-sm">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors",
              active ? "bg-raised text-ink" : "text-muted hover:text-ink hover:bg-raised/60",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
