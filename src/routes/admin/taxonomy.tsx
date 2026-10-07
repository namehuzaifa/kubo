import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTaxonomyItem,
  listTaxonomy,
  reorderTaxonomy,
  saveTaxonomyItem,
  type SaveTaxonomyInput,
  type TaxonomyItem,
} from "@/lib/taxonomy.functions";
import {
  DRIVE_SIDES,
  DRIVE_SIDE_LABELS,
  TAXONOMIES,
  TAXONOMY_LABELS,
  type DriveSide,
  type TaxonomyName,
} from "@/integrations/supabase/admin-schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageField } from "@/components/admin/ImageField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TaxonomySearch = { tab?: TaxonomyName | undefined };

export const Route = createFileRoute("/admin/taxonomy")({
  validateSearch: (search: Record<string, unknown>): TaxonomySearch => {
    const tab = search["tab"];
    return { tab: TAXONOMIES.includes(tab as TaxonomyName) ? (tab as TaxonomyName) : undefined };
  },
  component: TaxonomyAdmin,
});

function TaxonomyAdmin() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const active = tab ?? "makes";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Browse lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These drive the filters and browse tiles on the public site.
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(value) => void navigate({ search: { tab: value as TaxonomyName } })}
      >
        <TabsList>
          {TAXONOMIES.map((taxonomy) => (
            <TabsTrigger key={taxonomy} value={taxonomy}>
              {TAXONOMY_LABELS[taxonomy]}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAXONOMIES.map((taxonomy) => (
          <TabsContent key={taxonomy} value={taxonomy} className="pt-4">
            <TaxonomyList taxonomy={taxonomy} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function TaxonomyList({ taxonomy }: { taxonomy: TaxonomyName }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const queryKey = ["admin", "taxonomy", taxonomy];
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => listTaxonomy({ data: { taxonomy, includeInactive: true } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const items = data?.items ?? [];

  const save = useMutation({
    mutationFn: (input: SaveTaxonomyInput) => saveTaxonomyItem({ data: input }),
    onSuccess: (result) => {
      if (result.error) toast.error(result.error);
      else void refresh();
    },
  });

  const imageLabel = taxonomy === "makes" ? "Logo URL" : "Image URL";

  async function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved!);
    const result = await reorderTaxonomy({
      data: {
        taxonomy,
        order: reordered.map((item, position) => ({ id: item.id, sortOrder: position + 1 })),
      },
    });
    if (result.error) toast.error(result.error);
    else void refresh();
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const name = draft.trim();
          if (!name) return;
          save.mutate({ taxonomy, name, sortOrder: items.length + 1 });
          setDraft("");
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`new-${taxonomy}`} className="text-xs">
            Add to {TAXONOMY_LABELS[taxonomy]}
          </Label>
          <Input
            id={`new-${taxonomy}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={taxonomy === "makes" ? "e.g. Suzuki" : "e.g. Pickup"}
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={!draft.trim() || save.isPending}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {data?.error ? <p className="text-sm text-destructive">{data.error}</p> : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden lg:table-cell">{imageLabel}</TableHead>
              {taxonomy === "countries" ? (
                <>
                  <TableHead className="w-44">Takes</TableHead>
                  <TableHead className="w-28">Products</TableHead>
                </>
              ) : null}
              <TableHead className="w-28">Shown</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              [0, 1, 2, 3].map((key) => (
                <TableRow key={key}>
                  <TableCell colSpan={taxonomy === "countries" ? 7 : 5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={taxonomy === "countries" ? 7 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nothing in this list yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <Row
                  key={item.id}
                  item={item}
                  taxonomy={taxonomy}
                  first={index === 0}
                  last={index === items.length - 1}
                  onMove={(direction) => void move(index, direction)}
                  onSaved={refresh}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Switching an entry off hides it from the site but keeps the vehicles that use it. Deleting
        is only possible once no vehicle references it.
      </p>
    </div>
  );
}

function Row({
  item,
  taxonomy,
  first,
  last,
  onMove,
  onSaved,
}: {
  item: TaxonomyItem;
  taxonomy: TaxonomyName;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [imageUrl, setImageUrl] = useState(item.image_url ?? "");

  async function persist(
    patch: Partial<{
      name: string;
      imageUrl: string;
      isActive: boolean;
      vehicleCount: number | null;
      driveSide: DriveSide;
    }>,
  ) {
    const result = await saveTaxonomyItem({
      data: {
        taxonomy,
        id: item.id,
        name: patch.name ?? name,
        imageUrl: patch.imageUrl ?? imageUrl,
        ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
        ...(patch.vehicleCount === undefined ? {} : { vehicleCount: patch.vehicleCount }),
        ...(patch.driveSide === undefined ? {} : { driveSide: patch.driveSide }),
      },
    });
    if (result.error) toast.error(result.error);
    else onSaved();
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            disabled={first}
            onClick={() => onMove(-1)}
            title="Move up"
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={last}
            onClick={() => onMove(1)}
            title="Move down"
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
      </TableCell>

      <TableCell>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name !== item.name && void persist({ name: name.trim() })}
          className="max-w-56"
        />
      </TableCell>

      <TableCell className="hidden lg:table-cell">
        <ImageField
          value={imageUrl}
          bucket="site-assets"
          folder={taxonomy}
          placeholder={taxonomy === "makes" ? "Logo URL, or upload →" : "Image URL, or upload →"}
          className="max-w-lg"
          onCommit={(url) => {
            setImageUrl(url);
            if (url !== (item.image_url ?? "")) void persist({ imageUrl: url });
          }}
        />
      </TableCell>

      {taxonomy === "countries" ? (
        <TableCell>
          <Select
            value={item.drive_side}
            onValueChange={(value) => void persist({ driveSide: value as DriveSide })}
          >
            <SelectTrigger aria-label={`Steering ${item.name} takes`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRIVE_SIDES.map((side) => (
                <SelectItem key={side} value={side}>
                  {DRIVE_SIDE_LABELS[side]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
      ) : null}

      {taxonomy === "countries" ? (
        <TableCell>
          <Input
            type="number"
            min="0"
            defaultValue={item.vehicle_count ?? ""}
            onBlur={(event) => {
              const raw = event.target.value.trim();
              const next = raw === "" ? null : Number(raw);
              if (next !== (item.vehicle_count ?? null)) void persist({ vehicleCount: next });
            }}
            className="w-24"
          />
        </TableCell>
      ) : null}

      <TableCell>
        <Switch
          checked={item.is_active}
          onCheckedChange={(checked) => void persist({ isActive: checked })}
          aria-label={`Show ${item.name} on the site`}
        />
      </TableCell>

      <TableCell>
        <ConfirmDialog
          title={`Delete "${item.name}"?`}
          description="It will be removed from this list and from the filters on the website. If any vehicle still uses it, the delete is refused — switch it off instead."
          onConfirm={async () => {
            const result = await deleteTaxonomyItem({ data: { taxonomy, id: item.id } });
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(`"${item.name}" deleted`);
            onSaved();
          }}
          trigger={
            <Button variant="ghost" size="icon" title="Delete">
              <Trash2 className="size-4 text-destructive" />
              <span className="sr-only">Delete {item.name}</span>
            </Button>
          }
        />
      </TableCell>
    </TableRow>
  );
}
