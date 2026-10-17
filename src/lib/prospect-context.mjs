// Only public, bounded fields enter the quote form. No CRM ID/contact data.
export const isProspectSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 160;

export function publicProspectContext(prospect) {
  return {slug: prospect.slug, name: prospect.name, city: prospect.city, activity: prospect.activity || ''};
}

export function validProspectContext(value, expectedSlug) {
  return value && isProspectSlug(expectedSlug) && value.slug === expectedSlug
    && typeof value.name === 'string' && value.name.length > 1 && value.name.length <= 200
    && typeof value.city === 'string' && value.city.length <= 100
    && typeof value.activity === 'string' && value.activity.length <= 100;
}
