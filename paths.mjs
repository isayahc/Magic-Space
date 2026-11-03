import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(process.env.OI_ROOT || fileURLToPath(new URL('../Open-Industries', import.meta.url)));
export const out = fileURLToPath(new URL('.', import.meta.url));
