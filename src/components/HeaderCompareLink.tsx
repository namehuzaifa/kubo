import { Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";

import { useCompare } from "@/hooks/use-compare";

/**
 * The compare arrows in the header, with however many vehicles are lined up.
 *
 * The count comes from browser storage, so it is only rendered once the hook
 * reports it has read it — otherwise the server would render no badge and the
 * browser would render one, which React reports as a hydration mismatch.
 */
export function HeaderCompareLink() {
  const { ids, ready } = useCompare();
  const count = ready ? ids.length : 0;

  return (
    <Link
      to="/compare"
      aria-label={count > 0 ? `Compare ${count} vehicles` : "Compare vehicles"}
      className="relative flex size-9 items-center justify-center rounded-full bg-background text-foreground/80 shadow-card transition-colors hover:text-brand"
    >
      <Repeat className="size-4" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
