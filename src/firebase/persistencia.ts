import {
  getFirestore,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp, configurado } from "./config";
import { validarWorkspace, type EstadoWorkspace } from "../workspace/armazenamento";
import { validarBiblioteca, type Artigo, type Biblioteca } from "../workspace/artigos";
import type { PerfilUsuario } from "../perfil/perfil";

/**
 * Módulo `firebase/persistencia` — espelhamento dos dados do usuário no
 * Firestore, por uid (`usuarios/{uid}/...`):
 * - `usuarios/{uid}/dados/artigos`      → índice: artigo aberto e ids dos artigos
 * - `usuarios/{uid}/dados/artigo-{id}`  → EstadoWorkspace de cada artigo (até 3)
 * - `usuarios/{uid}/dados/perfil`       → PerfilUsuario
 * - `usuarios/{uid}/dados/workspace`    → formato antigo (um só manuscrito):
 *   só lido, para virar o primeiro artigo de quem ainda não tem o índice.
 * Um documento por artigo: três textos longos juntos poderiam passar do
 * limite de 1 MB de um documento do Firestore.
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

const DOC_INDICE = "artigos";
const docArtigo = (id: string) => `artigo-${id}`;

/** Salva o conteúdo de um artigo. Devolve false sem Firebase/uid ou em erro. */
export async function salvarArtigoNuvem(uid: string, id: string, estado: EstadoWorkspace): Promise<boolean> {
  const ref = caminhoUsuario(uid, docArtigo(id));
  if (!ref) return false;
  try {
    await setDoc(ref, { ...estado, atualizadoEm: Date.now() });
    return true;
  } catch {
    return false; // regras/rede: nunca quebra o fluxo local
  }
}

/** Salva a lista de artigos e qual está aberto (sem o conteúdo deles). */
export async function salvarIndiceNuvem(uid: string, b: Biblioteca): Promise<boolean> {
  const ref = caminhoUsuario(uid, DOC_INDICE);
  if (!ref) return false;
  try {
    await setDoc(ref, { ativo: b.ativo, ids: b.artigos.map((a) => a.id), atualizadoEm: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** Apaga um artigo da nuvem, desistindo sem conexão (como apagarWorkspaceNuvem). */
export async function apagarArtigoNuvem(uid: string, id: string): Promise<boolean> {
  const ref = caminhoUsuario(uid, docArtigo(id));
  if (!ref) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const prazo = new Promise<false>((resolver) => {
      timer = setTimeout(() => resolver(false), PRAZO_APAGAR_MS);
    });
    return await Promise.race([deleteDoc(ref).then(() => true as const), prazo]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Carrega os artigos da conta. Sem o índice, usa o formato antigo (um só
 * manuscrito), que vira o primeiro artigo. null quando não há nada salvo
 * ou a nuvem não responde.
 */
export async function carregarBibliotecaNuvem(uid: string): Promise<Biblioteca | null> {
  const indiceRef = caminhoUsuario(uid, DOC_INDICE);
  if (!indiceRef) return null;
  try {
    const indice = await getDoc(indiceRef);
    if (indice.exists()) {
      const { ativo, ids } = indice.data() as { ativo?: unknown; ids?: unknown };
      if (!Array.isArray(ids)) return null;
      const artigos = await Promise.all(
        ids
          .filter((id): id is string => typeof id === "string")
          .map(async (id): Promise<Artigo | null> => {
            const ref = caminhoUsuario(uid, docArtigo(id));
            const snap = ref ? await getDoc(ref) : null;
            const dados = snap?.exists() ? (snap.data() as { atualizadoEm?: unknown }) : null;
            const estado = validarWorkspace(dados);
            if (!estado) return null;
            return { id, atualizadoEm: typeof dados?.atualizadoEm === "number" ? dados.atualizadoEm : 0, estado };
          }),
      );
      return validarBiblioteca({ ativo, artigos: artigos.filter(Boolean) });
    }
    const antigo = await carregarWorkspaceNuvem(uid);
    const estado = validarWorkspace(antigo);
    return estado ? validarBiblioteca({ ativo: "", artigos: [{ id: "artigo-1", atualizadoEm: Date.now(), estado }] }) : null;
  } catch {
    return null;
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
