import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Desenvolvimento local igual à produção: o front (Vite) repassa /api para o
 * servidor local (`bun run api`), que serve as mesmas rotas das funções da
 * Vercel. Portas lidas do ambiente aqui (e não no script do package.json),
 * para funcionar igual no Windows, Linux e Mac.
 */
const PORTA_FRONT = Number(process.env.PORT) || 5173;
const PORTA_API = Number(process.env.API_PORT) || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: PORTA_FRONT,
    proxy: {
      "/api": { target: `http://localhost:${PORTA_API}`, changeOrigin: true },
    },
  },
});
