import { definePlugin } from 'emdash';
export const flexwebPublication = () => ({ id: 'flexweb-publication', version: '1.0.0', format: 'native', entrypoint: '@flexweb/content-cms/plugin', adminEntry: '@flexweb/content-cms/admin' });
export function createPlugin() {
  return definePlugin({ id: 'flexweb-publication', version: '1.0.0', admin: { entry: '@flexweb/content-cms/admin', pages: [{ path: '/publication', label: 'Publication du site', icon: 'rocket-launch' }] } });
}
export default createPlugin;
