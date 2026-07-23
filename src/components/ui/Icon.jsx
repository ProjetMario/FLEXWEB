import * as Lucide from "lucide-react";

/**
 * Renders a Lucide icon by name string.
 */
export function Icon({ name, className = "" }) {
  const Component = Lucide[name] || Lucide.Circle;
  return <Component className={className} aria-hidden="true" />;
}
