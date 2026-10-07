export function PageHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="bg-brand-dark py-14 text-brand-foreground">
      <div className="mx-auto max-w-[1400px] px-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-brand-foreground/75">{subtitle}</p>
      </div>
    </section>
  );
}