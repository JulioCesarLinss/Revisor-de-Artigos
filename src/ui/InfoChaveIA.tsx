import { useId, useState } from "react";

interface Props {
  /** Título do quadro, com o ⓘ ao lado. */
  titulo: string;
  /** Nível do título: h2 na revisão, h3 no perfil. */
  nivel?: "h2" | "h3";
  /** Quando informado, mostra uma seta que recolhe/expande o conteúdo do quadro. */
  recolhido?: boolean;
  onAlternarRecolhimento?: () => void;
}

/**
 * Título do quadro do assistente com um ⓘ que abre, logo abaixo, como o
 * assistente funciona e como conseguir a chave — Gemini (grátis para
 * começar) ou OpenAI (paga). O app reconhece o serviço pelo formato da
 * chave (src/ai/assistente.ts): AIza… vai para o Gemini, sk-… para a OpenAI.
 */
export function InfoChaveIA({ titulo, nivel = "h2", recolhido, onAlternarRecolhimento }: Props) {
  const [aberto, setAberto] = useState(false);
  const idCaixa = useId();
  const Titulo = nivel;

  return (
    <>
      <div className="info-titulo">
        <Titulo>{titulo}</Titulo>
        <button
          type="button"
          className="info-botao"
          aria-expanded={aberto}
          aria-controls={idCaixa}
          aria-label="Como funciona e como conseguir a chave da API"
          title="Como funciona e como conseguir a chave da API"
          onClick={() => setAberto((a) => !a)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-5" />
            <path d="M12 8h.01" />
          </svg>
        </button>
        {onAlternarRecolhimento && (
          <button
            type="button"
            className="info-seta-botao"
            aria-expanded={!recolhido}
            aria-label={recolhido ? "Mostrar o conteúdo do assistente" : "Esconder o conteúdo do assistente"}
            title={recolhido ? "Mostrar" : "Esconder"}
            onClick={onAlternarRecolhimento}
          >
            <span className={`gemini-seta${recolhido ? "" : " aberta"}`} aria-hidden="true">
              ▾
            </span>
          </button>
        )}
      </div>

      {aberto && (
        <div className="info-caixa" id={idCaixa} role="region" aria-label="Sobre a chave da API">
          <p className="info-caixa-titulo">Como funciona</p>
          <p>
            Com uma chave, cada aviso ganha o botão <strong>Sugerir com IA</strong>: só o parágrafo daquele aviso é
            enviado, e a IA devolve uma versão reescrita, que você aceita, edita ou ignora. Por segurança, a chave{" "}
            <strong>não fica guardada</strong>: vale até você fechar esta aba ou sair da conta (aí é só colar de
            novo) e não vai para o nosso servidor. Cole a chave de um dos serviços
            abaixo: o app reconhece qual é.
          </p>

          <div className="info-opcao">
            <p className="info-caixa-titulo">
              Opção 1 — Gemini, do Google <span className="info-selo">grátis para começar</span>
            </p>
            <ol>
              <li>
                Acesse{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  aistudio.google.com/apikey
                </a>{" "}
                e entre com uma conta Google. Não pede cartão.
              </li>
              <li>
                Clique em <strong>Create API key</strong> (Criar chave de API) e copie a chave (começa com{" "}
                <code>AIza</code>).
              </li>
              <li>
                Cole no campo e clique em <strong>Ativar assistente</strong>.
              </li>
            </ol>
            <p className="info-caixa-nota">
              O plano gratuito tem limite de pedidos por minuto e por dia. Nele, o Google pode usar os textos enviados
              para melhorar os próprios produtos — evite usar com trabalhos que ainda não podem ser divulgados.
            </p>
          </div>

          <div className="info-opcao">
            <p className="info-caixa-titulo">
              Opção 2 — OpenAI <span className="info-selo info-selo-pago">paga</span>
            </p>
            <ol>
              <li>
                Acesse{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  platform.openai.com/api-keys
                </a>{" "}
                e entre ou crie uma conta.
              </li>
              <li>
                Em <strong>Billing</strong>, adicione créditos: a API é cobrada por uso, à parte do ChatGPT Plus.
              </li>
              <li>
                Clique em <strong>Create new secret key</strong> e copie a chave (começa com <code>sk-</code>). Ela só
                aparece uma vez.
              </li>
              <li>
                Cole no campo e clique em <strong>Ativar assistente</strong>.
              </li>
            </ol>
          </div>

          <p className="info-caixa-nota">
            Não compartilhe a chave: quem tiver ela usa a sua cota ou os seus créditos. A chave gratuita do Gemini,
            sem cartão cadastrado, não gera cobrança. Para tirá-la antes de fechar a aba, use{" "}
            <strong>Remover chave</strong> no Perfil.
          </p>
        </div>
      )}
    </>
  );
}
