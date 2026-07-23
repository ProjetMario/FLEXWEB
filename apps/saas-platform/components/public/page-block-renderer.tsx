import { HeaderBlock } from "./blocks/header-block";
import { TextBlock } from "./blocks/text-block";
import { ServicesBlock } from "./blocks/services-block";
import { CTABlock } from "./blocks/cta-block";
import type { PageSection } from "@prisma/client";

interface PageBlockRendererProps {
  sections: PageSection[];
  organizationId: string;
}

export async function PageBlockRenderer({ sections, organizationId }: PageBlockRendererProps) {
  return (
    <div className="space-y-16">
      {sections.map((section) => (
        <BlockSection key={section.id} section={section} organizationId={organizationId} />
      ))}
    </div>
  );
}

async function BlockSection({
  section,
  organizationId,
}: {
  section: PageSection;
  organizationId: string;
}) {
  const config = section.config as Record<string, unknown>;

  switch (section.type) {
    case "header":
      return <HeaderBlock config={config} />;
    case "text":
      return <TextBlock config={config} />;
    case "services":
      return <ServicesBlock config={config} organizationId={organizationId} />;
    case "cta":
      return <CTABlock config={config} />;
    default:
      return null;
  }
}
