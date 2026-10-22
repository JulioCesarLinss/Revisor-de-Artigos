import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Módulo `firebase` — configuração do Client SDK (decisão de arquitetura:
 * SDK no navegador para o MVP). A fonte de verdade das credenciais são as
 * env vars com prefixo VITE_ (seguras para o cliente; a proteção real vem das
 * Security Rules do Firestore, não do ocultar a config).
 *
 * Degradação elegante (mesmo princípio do DC-03 da IA): enquanto o Firebase
 * não estiver configurado, `configurado` é false e o app segue 100% local.
 */

/** Config pública de um app web do Firebase (não é segredo — é exposta ao cliente). */
export interface ConfigFirebase {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/** Lê a config das env vars VITE_ (ausentes = não configurado). */
export function lerConfigAmbiente(): ConfigFirebase {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

/**
 * O Firebase está pronto? Mínimo para Auth + Firestore: apiKey, projectId e
 * appId. Sem isso, tratamos como "não configurado" e caímos no modo local.
 */
export function estaConfigurado(cfg: ConfigFirebase): boolean {
  return Boolean(cfg.apiKey?.trim() && cfg.projectId?.trim() && cfg.appId?.trim());
}

const config = lerConfigAmbiente();

/** Verdadeiro quando o Firebase está configurado neste ambiente. */
export const configurado = estaConfigurado(config);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/** App Firebase inicializado (singleton). Null quando não configurado. */
export function firebaseApp(): FirebaseApp | null {
  if (!configurado) return null;
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(config as Required<ConfigFirebase>);
  return app;
}

/** Instância de Auth (singleton). Null quando não configurado. */
export function firebaseAuth(): Auth | null {
  const a = firebaseApp();
  if (!a) return null;
  if (!auth) auth = getAuth(a);
  return auth;
}
