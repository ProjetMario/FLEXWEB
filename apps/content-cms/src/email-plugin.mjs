import { definePlugin } from 'emdash';
import { createBrevoDelivery } from './lib/brevo.mjs';
export const flexwebBrevo = () => ({ id: 'flexweb-brevo', version: '1.0.0', format: 'native', entrypoint: '@flexweb/content-cms/email', capabilities: ['hooks.email-transport:register'] });
export function createPlugin() { return definePlugin({ id: 'flexweb-brevo', version: '1.0.0', capabilities: ['hooks.email-transport:register'], hooks: { 'email:deliver': { exclusive: true, handler: createBrevoDelivery() } } }); }
export default createPlugin;
