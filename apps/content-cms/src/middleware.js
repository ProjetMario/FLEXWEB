// Astro requires an explicit middleware for manual i18n routing. EmDash owns
// these routes and its integration middleware retains all authentication checks.
/** @type {import('astro').MiddlewareHandler} */
export const onRequest = (_context, next) => next();
