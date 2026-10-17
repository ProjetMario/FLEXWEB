// Only public, bounded fields enter the quote form. No CRM ID/contact data.
export const isProspectSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 160;

export function publicProspectContext(prospect) {
  return {slug: prospect.slug, name: prospect.name, city: prospect.city, activity: prospect.activity || ''};
}

export function validProspectContext(value, expectedSlug) {
  return value && isProspectSlug(expectedSlug) && value.slug === expectedSlug
    && typeof value.name === 'string' && value.name.trim().length > 1 && value.name.length <= 160
    && typeof value.city === 'string' && value.city.trim().length > 0 && value.city.length <= 100
    && typeof value.activity === 'string' && value.activity.trim().length > 0 && value.activity.length <= 100;
}
