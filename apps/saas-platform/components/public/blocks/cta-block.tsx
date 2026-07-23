import Link from "next/link";

interface CTABlockProps {
  config: Record<string, unknown>;
}

export function CTABlock({ config }: CTABlockProps) {
  const title = String(config.title ?? "");
  const buttonText = String(config.buttonText ?? "");
  const buttonHref = String(config.buttonHref ?? "#");

  return (
    <section className="rounded-xl bg-primary px-6 py-12 text-center text-primary-foreground">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-6">
        <Link
          href={buttonHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-background/90"
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
