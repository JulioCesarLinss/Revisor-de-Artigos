import { createPublicKey, verify, type KeyObject } from "node:crypto";

/**
 * Módulo `firebase/tokenServidor` — **somente servidor** (usa `node:crypto`;
 * nunca importar no navegador). Confere o ID token do Firebase Auth que a tela
 * envia em `Authorization: Bearer <token>`, seguindo o roteiro oficial de
 * verificação com biblioteca de terceiros: assinatura RS256 com as chaves
 * públicas do Google, `aud` = id do projeto, `iss` do securetoken, prazos e
 * `sub` (uid) preenchido. Não exige conta de serviço nem segredo novo.
 */

const URL_CERTIFICADOS =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
/** Tolerância de relógio entre a Vercel e o Google, em segundos. */
const TOLERANCIA_S = 60;
/** Sem Cache-Control legível, recarrega os certificados após 1 hora. */
const CACHE_PADRAO_MS = 60 * 60 * 1000;
/** kid desconhecido só força nova busca se a última tiver mais de 1 minuto. */
const INTERVALO_MINIMO_BUSCA_MS = 60 * 1000;

/** Devolve a chave pública do `kid` do token; null quando não existe. */
export type ResolverChave = (kid: string) => Promise<KeyObject | null>;

export interface UsuarioVerificado {
  uid: string;
}

/** Id do projeto Firebase no servidor (o mesmo valor público da config web). */
export function projetoFirebaseServidor(): string {
  if (typeof process === "undefined") return "";
  const valor = process.env?.FIREBASE_PROJECT_ID ?? process.env?.VITE_FIREBASE_PROJECT_ID;
  return typeof valor === "string" ? valor.trim() : "";
}

/** Extrai o token de `Authorization: Bearer <token>`; null quando ausente. */
export function extrairBearer(cabecalho: string | string[] | undefined): string | null {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho;
  if (typeof valor !== "string") return null;
  const casou = /^Bearer\s+(\S+)$/i.exec(valor.trim());
  return casou ? casou[1] : null;
}

function decodificarJson(parte: string): Record<string, unknown> | null {
  try {
    const valor: unknown = JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
    return typeof valor === "object" && valor !== null && !Array.isArray(valor)
      ? (valor as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

let cache: { chaves: Map<string, KeyObject>; expiraEm: number; buscadoEm: number } | null = null;

async function buscarCertificados(): Promise<void> {
  const resposta = await fetch(URL_CERTIFICADOS);
  if (!resposta.ok) throw new Error(`certificados: HTTP ${resposta.status}`);
  const dados = (await resposta.json()) as Record<string, unknown>;
  const chaves = new Map<string, KeyObject>();
  for (const [kid, pem] of Object.entries(dados)) {
    if (typeof pem === "string") chaves.set(kid, createPublicKey(pem));
  }
  const maxAge = /max-age=(\d+)/.exec(resposta.headers.get("cache-control") ?? "");
  const agora = Date.now();
  cache = {
    chaves,
    expiraEm: agora + (maxAge ? Number(maxAge[1]) * 1000 : CACHE_PADRAO_MS),
    buscadoEm: agora,
  };
}

/** Resolver padrão: certificados públicos do Google, com cache por max-age. */
export const chavesGoogle: ResolverChave = async (kid) => {
  try {
    const agora = Date.now();
    const desatualizado = cache === null || agora >= cache.expiraEm;
    const kidNovo = cache !== null && !cache.chaves.has(kid) && agora - cache.buscadoEm > INTERVALO_MINIMO_BUSCA_MS;
    if (desatualizado || kidNovo) await buscarCertificados();
    return cache?.chaves.get(kid) ?? null;
  } catch {
    return null; // rede/Google indisponível: o token simplesmente não é aceito
  }
};

/**
 * Confere um ID token do Firebase. Devolve o uid quando tudo confere e null
 * em qualquer falha — nunca lança. `agoraS` (segundos) existe para os testes.
 */
export async function verificarTokenFirebase(
  token: string,
  projeto: string,
  resolver: ResolverChave = chavesGoogle,
  agoraS: number = Math.floor(Date.now() / 1000),
): Promise<UsuarioVerificado | null> {
  if (projeto.length === 0) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  const [cabecalhoB64, corpoB64, assinaturaB64] = partes;

  const cabecalho = decodificarJson(cabecalhoB64);
  const corpo = decodificarJson(corpoB64);
  if (!cabecalho || !corpo) return null;
  if (cabecalho.alg !== "RS256" || typeof cabecalho.kid !== "string") return null;

  const { aud, iss, sub, exp, iat, auth_time: authTime } = corpo;
  if (aud !== projeto) return null;
  if (iss !== `https://securetoken.google.com/${projeto}`) return null;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > 128) return null;
  if (typeof exp !== "number" || exp <= agoraS - TOLERANCIA_S) return null;
  if (typeof iat !== "number" || iat > agoraS + TOLERANCIA_S) return null;
  if (typeof authTime !== "number" || authTime > agoraS + TOLERANCIA_S) return null;

  const chave = await resolver(cabecalho.kid);
  if (!chave) return null;
  try {
    const valido = verify(
      "RSA-SHA256",
      Buffer.from(`${cabecalhoB64}.${corpoB64}`),
      chave,
      Buffer.from(assinaturaB64, "base64url"),
    );
    return valido ? { uid: sub } : null;
  } catch {
    return null;
  }
}
