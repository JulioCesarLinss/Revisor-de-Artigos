import { criarServidor } from "./servidor";

/**
 * Servidor local da API (desenvolvimento). No Vercel, as funções em `api/`
 * não usam este entrypoint — cada arquivo vira uma função serverless.
 * Uso: `bun run api`.
 */
const PORTA = Number(process.env.PORT ?? 8787);

criarServidor().listen(PORTA, "0.0.0.0", () => {
  console.log(`[api] NormaReview AI ouvindo em http://0.0.0.0:${PORTA}/api/health`);
});
