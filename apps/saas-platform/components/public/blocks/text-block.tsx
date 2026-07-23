interface TextBlockProps {
  config: Record<string, unknown>;
}

export function TextBlock({ config }: TextBlockProps) {
  const content = String(config.content ?? "");
  const align = String(config.align ?? "left") as "left" | "center" | "right";

  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  return (
    <section className={`prose max-w-none ${alignClass}`}>
      <p className="text-lg leading-relaxed text-foreground">{content}</p>
    </section>
  );
}
