import { Repeat } from "lucide-react";
import { toast } from "sonner";

import { useCompare, COMPARE_LIMIT } from "@/hooks/use-compare";
import { cn } from "@/lib/utils";

/**
 * The compare arrows on a vehicle card. The card is a link, so the click has to
 * be stopped from bubbling or tapping this would navigate instead.
 */
export function CompareVehicleButton({ vehicleId, title }: { vehicleId: string; title: string }) {
  const { has, toggle } = useCompare();
  const active = has(vehicleId);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove ${title} from compare` : `Add ${title} to compare`}
      title={active ? "Remove from compare" : "Add to compare"}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background shadow-card transition-colors",
        active ? "text-brand" : "text-foreground/80 hover:text-brand",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const result = toggle(vehicleId);
        if (result.full) {
          toast.info(`You can compare ${COMPARE_LIMIT} vehicles at a time — remove one first.`);
          return;
        }
        toast.success(result.added ? `${title} added to compare` : `${title} removed from compare`);
      }}
    >
      <Repeat className="size-4" />
    </button>
  );
}
