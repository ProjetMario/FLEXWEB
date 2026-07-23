interface HeaderBlockProps {
  config: Record<string, unknown>;
}

export function HeaderBlock({ config }: HeaderBlockProps) {
  const title = String(config.title ?? "");
  const subtitle = config.subtitle ? String(config.subtitle) : null;
  const align = String(config.align ?? "center") as "left" | "center" | "right";

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return (
    <section className={`space-y-4 ${alignClass}`}>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-xl text-muted-foreground">{subtitle}</p>}
    </section>
  );
}
