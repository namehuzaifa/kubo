import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteNavItem,
  deletePageBlock,
  getNavItems,
  getPageContent,
  getSiteSettings,
  reorderNavItems,
  reorderPageBlocks,
  saveNavItem,
  savePageBlock,
  savePageContent,
  saveSiteSettings,
  type NavItem,
  type PageBlock,
} from "@/lib/content.functions";
import {
  EDITABLE_PAGES,
  PAGE_BLOCK_LABELS,
  PAGES_WITH_HERO_IMAGE,
  type ContactSettings,
  type EditablePage,
} from "@/integrations/supabase/admin-schema";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ImageField } from "@/components/admin/ImageField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["contact-details", "menu", ...EDITABLE_PAGES] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  "contact-details": "Brand & contact",
  menu: "Menu",
  home: "Home",
  "how-to-buy": "How To Buy",
  about: "About Us",
  contact: "Contact Us",
};

type ContentSearch = { tab?: Tab | undefined };

export const Route = createFileRoute("/admin/content")({
  validateSearch: (search: Record<string, unknown>): ContentSearch => {
    const tab = search["tab"];
    return { tab: TABS.includes(tab as Tab) ? (tab as Tab) : undefined };
  },
  component: ContentAdmin,
});

function ContentAdmin() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const active = tab ?? "contact-details";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Website content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the wording on the public pages and the contact details shown across the site.
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(value) => void navigate({ search: { tab: value as Tab } })}
      >
        <TabsList>
          {TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {TAB_LABELS[name]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="contact-details" className="pt-4">
          <ContactDetails />
        </TabsContent>

        <TabsContent value="menu" className="pt-4">
          <MenuEditor />
        </TabsContent>

        {EDITABLE_PAGES.map((slug) => (
          <TabsContent key={slug} value={slug} className="pt-4">
            <PageEditor slug={slug} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ContactDetails() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "site-settings"],
    queryFn: () => getSiteSettings(),
  });

  if (isPending) return <Skeleton className="h-96 w-full" />;
  return (
    <ContactDetailsForm
      contact={data!.contact}
      queryClient={queryClient}
      busy={busy}
      setBusy={setBusy}
    />
  );
}

function ContactDetailsForm({
  contact,
  queryClient,
  busy,
  setBusy,
}: {
  contact: ContactSettings;
  queryClient: ReturnType<typeof useQueryClient>;
  busy: boolean;
  setBusy: (value: boolean) => void;
}) {
  // The logo is not a plain text input, so it is held here and submitted
  // alongside the rest of the form rather than read out of FormData.
  const [logoUrl, setLogoUrl] = useState(contact.logo_url ?? "");

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Brand & contact details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            const result = await saveSiteSettings({
              data: {
                name: String(form.get("name")),
                tagline: String(form.get("tagline")),
                phone: String(form.get("phone")),
                email: String(form.get("email")),
                address: String(form.get("address")),
                logo_url: logoUrl,
                currency_label: String(form.get("currency_label")),
              },
            });
            setBusy(false);
            if (result.error) toast.error(result.error);
            else {
              toast.success("Saved");
              void queryClient.invalidateQueries({ queryKey: ["admin", "site-settings"] });
            }
          }}
        >
          <div className="grid gap-2">
            <Label>Logo</Label>
            <ImageField
              value={logoUrl}
              bucket="site-assets"
              folder="brand"
              placeholder="Logo URL, or upload →"
              onCommit={setLogoUrl}
            />
            <p className="text-xs text-muted-foreground">
              Shown in the site header and the dashboard sidebar. Leave it empty to use a lettermark
              built from the company name. A transparent PNG or SVG works best.
            </p>
          </div>

          <Text name="name" label="Company name" defaultValue={contact.name} />
          <Text name="tagline" label="Tagline" defaultValue={contact.tagline} />
          <Text
            name="phone"
            label="Phone"
            defaultValue={contact.phone}
            hint="Shown in the top menu, the footer and on the Contact page."
          />
          <Text name="email" label="Email" type="email" defaultValue={contact.email} />
          <Text
            name="currency_label"
            label="Currency badge"
            defaultValue={contact.currency_label}
            hint="Shown in the header, e.g. JPY, ¥"
          />
          <div className="grid gap-2">
            <Label htmlFor="address">Office address</Label>
            <Textarea id="address" name="address" rows={2} defaultValue={contact.address} />
          </div>
          <Button type="submit" disabled={busy} className="justify-self-start">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function MenuEditor() {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");

  const queryKey = ["admin", "nav-items"];
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => getNavItems({ data: { includeInactive: true } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const items = data?.items ?? [];

  async function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved!);
    const result = await reorderNavItems({
      data: {
        order: reordered.map((item, position) => ({ id: item.id, sortOrder: position + 1 })),
      },
    });
    if (result.error) toast.error(result.error);
    else void refresh();
  }

  if (isPending) return <Skeleton className="h-96 w-full" />;

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Top menu</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!label.trim() || !href.trim()) return;
            const result = await saveNavItem({
              data: { label: label.trim(), href: href.trim(), sortOrder: items.length + 1 },
            });
            if (result.error) toast.error(result.error);
            else {
              setLabel("");
              setHref("");
              void refresh();
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="nav-label" className="text-xs">
              Label
            </Label>
            <Input
              id="nav-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Finance"
              className="w-44"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nav-href" className="text-xs">
              Link
            </Label>
            <Input
              id="nav-href"
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="/finance"
              className="w-56"
            />
          </div>
          <Button type="submit" disabled={!label.trim() || !href.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>

        <ul className="divide-y divide-border">
          {items.map((item, index) => (
            <MenuRow
              key={item.id}
              item={item}
              first={index === 0}
              last={index === items.length - 1}
              onMove={(direction) => void move(index, direction)}
              onSaved={refresh}
            />
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          A link starting with <code>/</code> stays inside the site; anything else opens in a new
          tab. Switching an entry off hides it from the menu without deleting it.
        </p>
      </CardContent>
    </Card>
  );
}

function MenuRow({
  item,
  first,
  last,
  onMove,
  onSaved,
}: {
  item: NavItem;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [href, setHref] = useState(item.href);

  async function persist(patch: Partial<{ label: string; href: string; isActive: boolean }>) {
    const result = await saveNavItem({
      data: {
        id: item.id,
        label: patch.label ?? label,
        href: patch.href ?? href,
        ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      },
    });
    if (result.error) toast.error(result.error);
    else onSaved();
  }

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
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

      <Input
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => label.trim() && label !== item.label && void persist({ label: label.trim() })}
        className="h-9 w-40"
      />
      <Input
        value={href}
        onChange={(event) => setHref(event.target.value)}
        onBlur={() => href.trim() && href !== item.href && void persist({ href: href.trim() })}
        className="h-9 w-56 font-mono text-xs"
      />

      <Switch
        checked={item.is_active}
        onCheckedChange={(checked) => void persist({ isActive: checked })}
        aria-label={`Show ${item.label} in the menu`}
      />

      <ConfirmDialog
        title={`Remove "${item.label}" from the menu?`}
        description="The page itself is not deleted — only the menu entry."
        onConfirm={async () => {
          const result = await deleteNavItem({ data: { id: item.id } });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Removed from the menu");
          onSaved();
        }}
        trigger={
          <Button variant="ghost" size="icon" title="Delete">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        }
      />
    </li>
  );
}

/* -------------------------------------------------------------------------- */

function PageEditor({ slug }: { slug: EditablePage }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [draftBlock, setDraftBlock] = useState("");
  // null means "not touched yet" — fall back to whatever is stored.
  const [heroImage, setHeroImage] = useState<string | null>(null);

  const queryKey = ["admin", "page-content", slug];
  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => getPageContent({ data: { slug, includeInactive: true } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const blockLabels = PAGE_BLOCK_LABELS[slug];

  if (isPending) return <Skeleton className="h-96 w-full" />;

  const page = data!.page;
  const blocks = data!.blocks;

  if (!page) {
    return <p className="text-sm text-destructive">This page has no content row yet.</p>;
  }

  async function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= blocks.length) return;
    const reordered = [...blocks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(next, 0, moved!);
    const result = await reorderPageBlocks({
      data: {
        order: reordered.map((block, position) => ({ id: block.id, sortOrder: position + 1 })),
      },
    });
    if (result.error) toast.error(result.error);
    else void refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Page copy</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <a
                href={slug === "home" ? "/" : `/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View page
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setBusy(true);
                const result = await savePageContent({
                  data: {
                    slug,
                    title: String(form.get("title")),
                    heroTitle: String(form.get("heroTitle")),
                    heroSubtitle: String(form.get("heroSubtitle")),
                    body: String(form.get("body") ?? ""),
                    heroImageUrl: heroImage ?? page.hero_image_url ?? "",
                    ctaLabel: String(form.get("ctaLabel") ?? ""),
                    ctaHref: String(form.get("ctaHref") ?? ""),
                    metaTitle: String(form.get("metaTitle")),
                    metaDescription: String(form.get("metaDescription")),
                  },
                });
                setBusy(false);
                if (result.error) toast.error(result.error);
                else {
                  toast.success("Page saved");
                  void refresh();
                }
              }}
            >
              <Text
                name="title"
                label="Menu label"
                defaultValue={page.title}
                hint="How this page is named in the navigation."
              />
              <Text name="heroTitle" label="Heading" defaultValue={page.hero_title} />
              <div className="grid gap-2">
                <Label htmlFor={`${slug}-subtitle`}>Intro line</Label>
                <Textarea
                  id={`${slug}-subtitle`}
                  name="heroSubtitle"
                  rows={2}
                  defaultValue={page.hero_subtitle ?? ""}
                />
              </div>

              {PAGES_WITH_HERO_IMAGE.includes(slug) ? (
                <>
                  <div className="grid gap-2">
                    <Label>Hero image</Label>
                    <ImageField
                      value={heroImage ?? page.hero_image_url ?? ""}
                      bucket="site-assets"
                      folder={`pages/${slug}`}
                      placeholder="Background image URL, or upload →"
                      onCommit={setHeroImage}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sits behind the heading at low opacity. A wide, dark photo works best.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Text
                      name="ctaLabel"
                      label="Button label"
                      defaultValue={page.cta_label ?? ""}
                    />
                    <Text
                      name="ctaHref"
                      label="Button link"
                      defaultValue={page.cta_href ?? ""}
                      hint="For example /all-stock"
                    />
                  </div>
                </>
              ) : null}

              {slug === "about" ? (
                <div className="grid gap-2">
                  <Label htmlFor={`${slug}-body`}>Body text</Label>
                  <Textarea
                    id={`${slug}-body`}
                    name="body"
                    rows={12}
                    defaultValue={page.body ?? ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave a blank line between paragraphs.
                  </p>
                </div>
              ) : (
                <input type="hidden" name="body" defaultValue={page.body ?? ""} />
              )}

              <Text
                name="metaTitle"
                label="Browser tab title"
                defaultValue={page.meta_title ?? ""}
              />
              <div className="grid gap-2">
                <Label htmlFor={`${slug}-meta`}>Search description</Label>
                <Textarea
                  id={`${slug}-meta`}
                  name="metaDescription"
                  rows={2}
                  defaultValue={page.meta_description ?? ""}
                />
              </div>

              <Button type="submit" disabled={busy} className="justify-self-start">
                {busy ? "Saving…" : "Save page"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {blockLabels ? (
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{blockLabels.plural}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const title = draftBlock.trim();
                if (!title) return;
                const result = await savePageBlock({
                  data: { pageSlug: slug, title, sortOrder: blocks.length + 1 },
                });
                if (result.error) toast.error(result.error);
                else {
                  setDraftBlock("");
                  void refresh();
                }
              }}
            >
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor={`${slug}-new-block`} className="text-xs">
                  Add a {blockLabels.singular}
                </Label>
                <Input
                  id={`${slug}-new-block`}
                  value={draftBlock}
                  onChange={(event) => setDraftBlock(event.target.value)}
                  placeholder={slug === "about" ? "e.g. 20+ years" : "e.g. 6. Delivery"}
                />
              </div>
              <Button type="submit" size="icon" disabled={!draftBlock.trim()}>
                <Plus className="size-4" />
              </Button>
            </form>

            {blocks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              <ul className="space-y-3">
                {blocks.map((block, index) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    slug={slug}
                    first={index === 0}
                    last={index === blocks.length - 1}
                    onMove={(direction) => void move(index, direction)}
                    onSaved={refresh}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BlockRow({
  block,
  slug,
  first,
  last,
  onMove,
  onSaved,
}: {
  block: PageBlock;
  slug: EditablePage;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [body, setBody] = useState(block.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(block.cta_label ?? "");
  const [ctaHref, setCtaHref] = useState(block.cta_href ?? "");

  // Only the home page's blocks are promo panels with artwork and a button.
  const isPanel = slug === "home";
  const endsAtValue = block.ends_at ? block.ends_at.slice(0, 10) : "";

  async function persist(
    patch: Partial<{
      title: string;
      body: string;
      imageUrl: string;
      ctaLabel: string;
      ctaHref: string;
      endsAt: string;
      isActive: boolean;
    }>,
  ) {
    const result = await savePageBlock({
      data: {
        pageSlug: slug,
        id: block.id,
        title: patch.title ?? title,
        body: patch.body ?? body,
        ...(patch.imageUrl === undefined ? {} : { imageUrl: patch.imageUrl }),
        ...(patch.ctaLabel === undefined ? {} : { ctaLabel: patch.ctaLabel }),
        ...(patch.ctaHref === undefined ? {} : { ctaHref: patch.ctaHref }),
        ...(patch.endsAt === undefined ? {} : { endsAt: patch.endsAt }),
        ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      },
    });
    if (result.error) toast.error(result.error);
    else onSaved();
  }

  return (
    <li className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-1">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() =>
            title.trim() && title !== block.title && void persist({ title: title.trim() })
          }
          className="h-8"
        />
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

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => body !== (block.body ?? "") && void persist({ body })}
        rows={2}
        placeholder="Description"
        className="text-sm"
      />

      {isPanel ? (
        <div className="space-y-2 border-t border-border pt-2">
          <ImageField
            value={block.image_url ?? ""}
            bucket="site-assets"
            folder="home"
            placeholder="Panel image, or upload →"
            onCommit={(url) => void persist({ imageUrl: url })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={ctaLabel}
              onChange={(event) => setCtaLabel(event.target.value)}
              onBlur={() => ctaLabel !== (block.cta_label ?? "") && void persist({ ctaLabel })}
              placeholder="Button label"
              className="h-8 text-sm"
            />
            <Input
              value={ctaHref}
              onChange={(event) => setCtaHref(event.target.value)}
              onBlur={() => ctaHref !== (block.cta_href ?? "") && void persist({ ctaHref })}
              placeholder="/new-arrivals"
              className="h-8 font-mono text-xs"
            />
          </div>
          {block.variant === "sale" ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Countdown ends
              <Input
                type="date"
                defaultValue={endsAtValue}
                onChange={(event) => void persist({ endsAt: event.target.value })}
                className="h-8 w-40 text-sm"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            checked={block.is_active}
            onCheckedChange={(checked) => void persist({ isActive: checked })}
          />
          Shown on the page
        </label>

        <ConfirmDialog
          title={`Delete "${block.title}"?`}
          description="It will be removed from the page. This cannot be undone."
          onConfirm={async () => {
            const result = await deletePageBlock({ data: { id: block.id } });
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Removed");
            onSaved();
          }}
          trigger={
            <Button variant="ghost" size="icon" title="Delete">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          }
        />
      </div>
    </li>
  );
}

function Text({
  name,
  label,
  defaultValue,
  type = "text",
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
