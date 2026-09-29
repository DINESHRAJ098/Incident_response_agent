import { Link } from "react-router";
import { BrandMark } from "@/components/BrandMark";
import { CONTAINER } from "../shared";

export function Footer() {
  return (
    <footer className="py-10">
      <div className={`${CONTAINER} flex flex-col items-center justify-between gap-4 sm:flex-row`}>
        <div className="flex items-center gap-2.5">
          <BrandMark size={24} />
          <span className="text-[13px] text-muted-foreground">
            <span className="text-foreground">Incident AI</span> — incident response with a
            memory
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="#how"
            className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </a>
          <Link
            to="/console"
            className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Console
          </Link>
        </div>
      </div>
    </footer>
  );
}
