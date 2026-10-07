import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";

import { listSavedVehicles, removeSavedVehicle } from "@/lib/account.functions";
import { toCardVehicle } from "@/lib/inventory-view";
import { VehicleCard } from "@/components/VehicleCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/account/saved")({
  component: SavedVehicles,
});

function SavedVehicles() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["account", "saved"],
    queryFn: () => listSavedVehicles(),
  });

  const remove = useMutation({
    mutationFn: async (vehicleId: string) => {
      const result = await removeSavedVehicle({ data: { vehicleId } });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["account", "saved"] });
      void queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["account", "saved-ids"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const vehicles = data?.vehicles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Saved vehicles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your shortlist. Send one inquiry covering everything here and we will quote the lot.
        </p>
      </div>

      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-72" />
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Heart className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">Nothing saved yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Tap the heart on any vehicle to keep it here while you decide.
            </p>
            <Button asChild className="mt-2">
              <Link to="/all-stock" search={{}}>
                Browse stock
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <div key={vehicle.slug} className="relative">
                <VehicleCard vehicle={toCardVehicle(vehicle)} />
                <Button
                  variant="secondary"
                  size="icon"
                  title="Remove from saved"
                  className="absolute right-2 top-2 z-10 shadow-card"
                  onClick={() => remove.mutate(vehicle.id)}
                >
                  <X className="size-4" />
                  <span className="sr-only">Remove {vehicle.title} from saved</span>
                </Button>
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <h2 className="text-sm font-bold">Ready for a quotation?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mention these stock numbers in your message and we will price them together.
                </p>
              </div>
              <Button asChild>
                <Link to="/inquiry">Send an inquiry</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
