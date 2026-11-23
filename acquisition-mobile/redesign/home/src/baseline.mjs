// Preserve the working form, consent island, measurement, metadata and FAQ of
// catalogue candidate 6b04922cb721fd1ae1c8d810, including their exact scripts.
// The older StudioLanding source predates the inline form and project gallery.
import { parse } from "parse5";
import fr from "../baseline/fr.html?raw";
import en from "../baseline/en.html?raw";

export function publishedContent(lang) {
  const source = lang === "en" ? en : fr;
  const document = parse(source, { sourceCodeLocationInfo: true });
  const elements = [];
  function collect(node) {
    if (node.tagName) elements.push(node);
    for (const child of node.childNodes || []) collect(child);
  }
  collect(document);
  const attr = (node, name) => node.attrs.find((attr) => attr.name === name)?.value;
  const tag = (name) => elements.find((node) => node.tagName === name);
  const byId = (id) => elements.find((node) => attr(node, "id") === id);
  const markup = ({ sourceCodeLocation: at }) => source.slice(at.startOffset, at.endOffset);
  const head = tag("head").sourceCodeLocation;
  const body = tag("body").sourceCodeLocation;
  const footer = tag("footer");
  const nav = markup(elements.find(node => attr(node, "class") === "studio-nav"));
  const toggle = markup(elements.find(node => attr(node, "class") === "studio-menu-toggle"));
  // A keyboard visitor opening the service menu can tab directly to its links.
  const header = markup(tag("header")).replace(toggle, "").replace(nav, toggle + " " + nav);
  return {
    head: source.slice(head.startTag.endOffset, head.endTag.startOffset),
    header: header
      .replace('class="studio-nav"', 'id="studio-navigation" class="studio-nav"')
      .replace('aria-label="Français"', 'aria-label="FR – Français"')
      .replace('aria-label="English"', 'aria-label="EN – English"'),
    contact: markup(byId("contact")),
    faq: markup(byId("faq")),
    footer: markup(footer),
    scriptsAndConsent: source.slice(footer.sourceCodeLocation.endOffset, body.endTag.startOffset),
  };
}
