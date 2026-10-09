import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { clientAddress, clientId, consumeRate, refreshProxyHosts, trustedProxy } from './abuse-limits.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
// The proxy container may not resolve yet at boot; the periodic refresh picks it up.
await refreshProxyHosts().catch(error => console.warn(error.message));
trustedProxy('127.0.0.1'); // Fail fast on an invalid TRUSTED_PROXY_ADDRESSES.
const refresh = setInterval(() => { void refreshProxyHosts().catch(() => {}); }, 30_000);
refresh.unref();
app.set('trust proxy', (address: string) => trustedProxy(address));
app.use(helmet());
app.use((request: Parameters<typeof clientAddress>[0], response: { status: (status: number) => { json: (body: object) => void } }, next: () => void) => {
  if (consumeRate('http', clientId(clientAddress(request)), 240)) next();
  else response.status(429).json({ message: 'Trop de requêtes. Réessayez dans une minute.' });
});
app.useBodyParser('json', { limit: '512kb' });
app.setGlobalPrefix('api');
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT || 3000), '0.0.0.0');
