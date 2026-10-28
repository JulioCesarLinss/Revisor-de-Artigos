const CHAVE = "normareview.sessao";

/**
 * Sessão local simulada (sem backend de autenticação): marca apenas que o
 * usuário passou pela tela de login. "Lembrar de mim" persiste no dispositivo
 * (localStorage); caso contrário, a sessão vale só para a aba atual
 * (sessionStorage). Usada quando o Firebase não está configurado.
 *
 * Quem depende da sessão (o hook useAutorizacao) se inscreve em `ouvirSessao`:
 * entrar ou sair avisa na hora — sem isso, o login local navegava para
 * /revisar e a guarda de rotas, ainda com o estado antigo, voltava ao /login.
 */

/** Sessão sem storage disponível (navegação privada restrita etc.). */
let sessaoEmMemoria = false;
const ouvintes = new Set<(ativa: boolean) => void>();

function avisar(): void {
  const ativa = sessaoAtiva();
  for (const ouvinte of ouvintes) ouvinte(ativa);
}

/** Inscreve um ouvinte de mudanças da sessão; devolve a função que cancela. */
export function ouvirSessao(ouvinte: (ativa: boolean) => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function sessaoAtiva(): boolean {
  try {
    return sessaoEmMemoria || sessionStorage.getItem(CHAVE) === "1" || localStorage.getItem(CHAVE) === "1";
  } catch {
    return sessaoEmMemoria;
  }
}

/** Tipo da sessão ativa: "lembrada" (localStorage) ou "aba" (sessionStorage). */
export type TipoSessao = "lembrada" | "aba";

export function tipoSessao(): TipoSessao | null {
  try {
    if (localStorage.getItem(CHAVE) === "1") return "lembrada";
    if (sessionStorage.getItem(CHAVE) === "1") return "aba";
    return null;
  } catch {
    return null;
  }
}

export function iniciarSessao(lembrar: boolean): void {
  try {
    if (lembrar) localStorage.setItem(CHAVE, "1");
    else sessionStorage.setItem(CHAVE, "1");
  } catch {
    sessaoEmMemoria = true; // armazenamento indisponível: sessão apenas em memória
  }
  avisar();
}

export function encerrarSessao(): void {
  sessaoEmMemoria = false;
  try {
    sessionStorage.removeItem(CHAVE);
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
  avisar();
}
