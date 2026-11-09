import { criarServidor } from "./servidor";

/**
 * Servidor local da API (desenvolvimento). No Vercel, as funções em `api/`
 * não usam este entrypoint — cada arquivo vira uma função serverless.
 * Uso: `bun run api` (o Bun carrega o .env.local sozinho). O `bun run dev`
 * repassa /api para cá (proxy no vite.config.ts).
 */
const PORTA = Number(process.env.API_PORT) || 8787;

criarServidor().listen(PORTA, "0.0.0.0", () => {
  console.log(`[api] NormaReview AI ouvindo em http://localhost:${PORTA}/api/health`);
});
