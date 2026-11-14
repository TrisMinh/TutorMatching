import { browserSession } from './browserSession';
import { GatewayClient } from './GatewayClient';

export const gatewayClient = new GatewayClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  session: browserSession,
});

export * from './GatewayClient';
