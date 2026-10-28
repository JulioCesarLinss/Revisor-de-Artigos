import {
  getFirestore,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp, configurado } from "./config";
import type { EstadoWorkspace } from "../workspace/armazenamento";
import type { PerfilUsuario } from "../perfil/perfil";

/**
 * Módulo `firebase/persistencia` — espelhamento dos dados do usuário no
 * Firestore, por uid (`usuarios/{uid}/...`). Projeto de arquivo único:
 * - `usuarios/{uid}/dados/workspace` → EstadoWorkspace (texto, original, histórico)
 * - `usuarios/{uid}/dados/perfil`    → PerfilUsuario
 *
 * Degradação elegante: sem Firebase configurado (ou sem uid), todas as
 * funções são no-op/null e o app segue com o localStorage como fonte.
 * A Security Rules deve garantir que cada usuário só lê/escreve o próprio
 * caminho (`request.auth.uid == uid`).
 */

let db: Firestore | null = null;

function firestore(): Firestore | null {
  if (!configurado) return null;
  const app = firebaseApp();
  if (!app) return null;
  if (!db) db = getFirestore(app);
  return db;
}

function caminhoUsuario(uid: string, documento: string) {
  const base = firestore();
  return base ? doc(base, "usuarios", uid, "dados", documento) : null;
}

/** Salva o workspace do usuário. Devolve false quando não há Firebase/uid. */
export async function salvarWorkspaceNuvem(
  uid: string,
  estado: EstadoWorkspace,
): Promise<boolean> {
  const ref = caminhoUsuario(uid, "workspace");
  if (!ref) return false;
  try {
    await setDoc(ref, { ...estado, atualizadoEm: Date.now() });
    return true;
  } catch {
    return false; // regras/rede: nunca quebra o fluxo local
  }
}

/** Carrega o workspace salvo; null quando ausente ou indisponível. */
export async function carregarWorkspaceNuvem(uid: string): Promise<EstadoWorkspace | null> {
  const ref = caminhoUsuario(uid, "workspace");
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as Omit<EstadoWorkspace, "atualizadoEm">) : null;
  } catch {
    return null;
  }
}

/** Sem conexão, o Firestore segura a promessa até voltar: desistimos antes. */
const PRAZO_APAGAR_MS = 10_000;

/**
 * Apaga o workspace do usuário na nuvem ("Descartar tudo"). Sem isso, o
 * /revisar recarregaria o manuscrito da nuvem ao ver o dispositivo vazio.
 * O perfil não é tocado. Devolve false sem Firebase/uid, em erro ou sem
 * confirmação do servidor dentro do prazo.
 */
export async function apagarWorkspaceNuvem(uid: string): Promise<boolean> {
  const ref = caminhoUsuario(uid, "workspace");
  if (!ref) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const prazo = new Promise<false>((resolver) => {
      timer = setTimeout(() => resolver(false), PRAZO_APAGAR_MS);
    });
    return await Promise.race([deleteDoc(ref).then(() => true as const), prazo]);
  } catch {
    return false; // regras/rede: a tela avisa o usuário
  } finally {
    clearTimeout(timer);
  }
}

/** Salva o perfil do usuário na nuvem (nome, e-mail, perfil). */
export async function salvarPerfilNuvem(uid: string, perfil: PerfilUsuario): Promise<boolean> {
  const ref = caminhoUsuario(uid, "perfil");
  if (!ref) return false;
  try {
    // Escrita por campo com merge: nunca apaga campos antigos do documento
    // (ex.: documentos com `instituicao` mantêm o campo apenas dormente).
    await setDoc(
      ref,
      { nome: perfil.nome, email: perfil.email, perfil: perfil.perfil, atualizadoEm: Date.now() },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}

/** Carrega o perfil salvo na nuvem; null quando ausente ou indisponível. */
export async function carregarPerfilNuvem(uid: string): Promise<PerfilUsuario | null> {
  const ref = caminhoUsuario(uid, "perfil");
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data() as Partial<PerfilUsuario>;
    return {
      nome: d.nome ?? "",
      email: d.email ?? "",
      perfil: d.perfil ?? "graduacao",
    };
  } catch {
    return null;
  }
}
