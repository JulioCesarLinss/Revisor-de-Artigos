import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { configurado, firebaseAuth } from "./config";
import { ouvirSessao, sessaoAtiva } from "../sessao";

/**
 * Módulo `firebase/auth` — autenticação email/senha via Firebase Auth.
 * Segue o princípio de transparência do projeto: a sessão é real (uid do
 * Firebase) e as falhas viram motivo legível para a UI (H9), nunca stacktrace.
 *
 * Quando o Firebase não está configurado, as funções devolvem motivo claro e o
 * hook `useAutorizacao` cai no modo local (sessão simulada) — nada quebra.
 */

export type ResultadoAuth =
  | { ok: true; uid: string; email: string | null }
  | { ok: false; motivo: string };

/** Converte códigos do Firebase em linguagem de gente (heurística 9). */
export function traduzirErroAuth(erro: unknown): string {
  const codigo = (erro as { code?: string })?.code ?? "";
  const mapa: Record<string, string> = {
    "auth/invalid-email": "O e-mail informado não é válido.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/wrong-password": "Senha incorreta. Verifique e tente novamente.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Já existe uma conta com este e-mail. Faça login.",
    "auth/weak-password": "A senha é muito fraca. Use ao menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente de novo.",
    "auth/network-request-failed": "Falha de rede. Verifique sua conexão.",
  };
  return (
    mapa[codigo] ??
    "Não foi possível concluir a autenticação. Tente novamente."
  );
}

/** Cria conta email/senha; no sucesso o e-mail é confirmável pelo Firebase. */
export async function cadastrar(
  email: string,
  senha: string,
  nome?: string,
): Promise<ResultadoAuth> {
  const auth = firebaseAuth();
  if (!auth) return { ok: false, motivo: "Firebase não configurado neste ambiente." };
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
    if (nome?.trim()) await updateProfile(cred.user, { displayName: nome.trim() });
    return { ok: true, uid: cred.user.uid, email: cred.user.email };
  } catch (erro) {
    return { ok: false, motivo: traduzirErroAuth(erro) };
  }
}

/** Autentica email/senha. */
export async function entrar(email: string, senha: string): Promise<ResultadoAuth> {
  const auth = firebaseAuth();
  if (!auth) return { ok: false, motivo: "Firebase não configurado neste ambiente." };
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
    return { ok: true, uid: cred.user.uid, email: cred.user.email };
  } catch (erro) {
    return { ok: false, motivo: traduzirErroAuth(erro) };
  }
}

/** Encerra a sessão no Firebase (no-op quando não configurado). */
export async function sair(): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    /* ignora: a UI já navega para /login */
  }
}

export interface EstadoAutorizacao {
  /** Verdadeiro quando a primeira verificação de sessão terminou. */
  pronto: boolean;
  /** Usuário autenticado (Firebase ou modo local). */
  autenticado: boolean;
  /** uid do Firebase; null no modo local ou sem sessão. */
  uid: string | null;
  /** Usuário Firebase completo; null no modo local. */
  user: User | null;
}

/**
 * Hook de estado de autorização. Com Firebase, observa `onAuthStateChanged`;
 * sem Firebase, cai na sessão local simulada (o app continua funcionando).
 * Não chama hooks condicionalmente — só registra o observador quando configurado.
 */
export function useAutorizacao(): EstadoAutorizacao {
  const [estado, setEstado] = useState<EstadoAutorizacao>(() => {
    // Estado inicial: com Firebase aguardamos o primeiro callback; sem, é local.
    if (!configurado) {
      return { pronto: true, autenticado: sessaoAtiva(), uid: null, user: null };
    }
    return { pronto: false, autenticado: false, uid: null, user: null };
  });

  useEffect(() => {
    // Modo local: acompanha o login/logout simulado (sessao.ts avisa na hora).
    if (!configurado) {
      return ouvirSessao((ativa) => setEstado({ pronto: true, autenticado: ativa, uid: null, user: null }));
    }
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setEstado({
        pronto: true,
        autenticado: user !== null,
        uid: user?.uid ?? null,
        user,
      });
    });
  }, []);

  return estado;
}
