import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import { CONTAINER } from "../shared";

/* ==========================================================================
 * Navbar
 * ========================================================================== */

export function Navbar() {
  const links = [
    { href: "#how", label: "How it works" },
    { href: "#features", label: "Features" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-md">
      <div className={`${CONTAINER} flex h-16 items-center gap-4`}>
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <BrandMark size={28} />
          <BrandWordmark />
        </Link>

        <nav className="ml-6 hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            to="/console"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open console
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
