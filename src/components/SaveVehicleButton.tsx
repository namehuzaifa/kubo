import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { listSavedVehicleIds, toggleSavedVehicle } from "@/lib/account.functions";
import { useAdminSession } from "@/hooks/use-admin-session";
import { cn } from "@/lib/utils";

/**
 * The heart on a vehicle card.
 *
 * The saved ids are fetched once under a shared query key, so a grid of cards
 * costs one request rather than one per card. The card itself is a link, so the
 * click has to be stopped from bubbling or tapping the heart would navigate.
 */
export function SaveVehicleButton({ vehicleId, title }: { vehicleId: string; title: string }) {
  const { session } = useAdminSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["account", "saved-ids"],
    queryFn: () => listSavedVehicleIds(),
    enabled: Boolean(session),
    staleTime: 60_000,
  });

  const saved = (data?.ids ?? []).includes(vehicleId);

  const toggle = useMutation({
    mutationFn: async () => {
      const result = await toggleSavedVehicle({ data: { vehicleId } });
      if (result.error) throw new Error(result.error);
      return result.saved;
    },
    onSuccess: (isSaved) => {
      toast.success(isSaved ? `${title} saved` : `${title} removed from saved`);
      void queryClient.invalidateQueries({ queryKey: ["account", "saved-ids"] });
      void queryClient.invalidateQueries({ queryKey: ["account", "saved"] });
      void queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      title={saved ? "Remove from saved" : "Save for later"}
      className={cn(
        "flex size-8 items-center justify-center rounded-full bg-background shadow-card transition-colors",
        saved ? "text-brand" : "text-foreground/80 hover:text-brand",
      )}
      onClick={(event) => {
        // The whole card is a link.
        event.preventDefault();
        event.stopPropagation();

        if (!session) {
          toast.info("Sign in to save vehicles");
          void navigate({ to: "/login", search: { redirect: "/all-stock" } });
          return;
        }
        toggle.mutate();
      }}
    >
      <Heart className={cn("size-4", saved && "fill-current")} />
    </button>
  );
}
