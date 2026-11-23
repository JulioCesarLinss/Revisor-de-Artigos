import { useState } from "react";
import type { DiagnosticoGemini, ResultadoDiagnostico } from "../ai/gemini";
import { ResultadoAnaliseIA, type Conferencia } from "./ResultadoAnaliseIA";

export type { Conferencia };

interface Props {
  /** Verdadeiro quando o Gemini está disponível (chave no servidor). */
  configurado: boolean;
  /** Verdadeiro enquanto o Gemini responde. */
  carregando: boolean;
  /** Resultado da última consulta; null = ainda não pedida. */
  resultado: ResultadoDiagnostico | null;
  /** Verdadeiro quando há texto e o app não está ocupado. */
  podePedir: boolean;
  /** Reanalisa pelas regras e pede o diagnóstico com o manuscrito atual. */
  onPedir: () => void;
  /** Navega até o trecho apontado no manuscrito. */
  onFocar: (diagnostico: DiagnosticoGemini) => void;
  /** Descarta o diagnóstico exibido (o manuscrito não é tocado). */
  onExcluir: () => void;
  /** "Já resolvi": tira da lista o apontamento (pelo id). */
  onResolver: (id: number) => void;
  /** "Conferir": pergunta ao Gemini se o apontamento foi resolvido no texto atual. */
  onConferir: (diagnostico: DiagnosticoGemini) => void;
  /** Resultado do "Conferir" de cada apontamento, pelo id. */
  conferencias: Record<number, Conferencia>;
}

/**
 * Diagnóstico do manuscrito com o Gemini, pedido no botão próprio do painel.
 * Segunda opinião sobre o texto inteiro: sempre abaixo da análise normativa
 * local, nunca no lugar dela (DC-02), e nunca quebrando o fluxo (DC-03).
 * O texto só sai para o Google quando o usuário clica — e o aviso diz isso.
 */
export function PainelGemini({
  configurado,
  carregando,
  resultado,
  podePedir,
  onPedir,
  onFocar,
  onExcluir,
  onResolver,
  onConferir,
  conferencias,
}: Props) {
  const [instrucoesAbertas, setInstrucoesAbertas] = useState(true);

  return (
    <div className="resumo-card">
      <h2 className="gemini-titulo">
        <button
          type="button"
          className="gemini-alternar"
          onClick={() => setInstrucoesAbertas((aberto) => !aberto)}
          aria-expanded={instrucoesAbertas}
          aria-controls="gemini-instrucoes"
          title={instrucoesAbertas ? "Esconder as instruções" : "Mostrar as instruções"}
        >
          <span>Diagnóstico com Gemini</span>
          <span className={`gemini-seta${instrucoesAbertas ? " aberta" : ""}`} aria-hidden="true">
            ▾
          </span>
        </button>
      </h2>
      <div id="gemini-instrucoes" hidden={!instrucoesAbertas}>
        {/* H6: legenda explica o que é e de onde vem, sem exigir memorização. */}
        <p className="resumo-legenda">
          Obtenha uma avaliação do seu texto como artigo: se a estrutura está completa, se falta informação, se o
          argumento faz sentido e o que melhorar na escrita. O que você corrigir sai da lista.
        </p>
        {configurado && (
          <>
            <h3 className="gemini-subtitulo">Como funciona</h3>
            <p className="ia-status">
              O texto do artigo será enviado ao Google Gemini para uma avaliação complementar. Você receberá sugestões
              de melhoria e poderá compará-las com os apontamentos da revisão normativa.
            </p>
          </>
        )}
      </div>

      {!configurado ? (
        <p className="ia-status">
          O diagnóstico com Gemini não está disponível no momento. O restante da revisão funciona normalmente.
        </p>
      ) : (
        <>
          <div className="gemini-acoes">
            <button
              className="btn btn-primary"
              type="button"
              onClick={onPedir}
              disabled={!podePedir || carregando}
              aria-busy={carregando || undefined}
              title={podePedir ? "Envia o manuscrito ao Gemini e mostra os apontamentos aqui" : "Cole, digite ou anexe o manuscrito para pedir o diagnóstico"}
            >
              {resultado === null ? "Pedir diagnóstico ao Gemini" : "Pedir novo diagnóstico"}
            </button>
          </div>
        </>
      )}

      {carregando && (
        <p className="ia-status" role="status" aria-live="polite">
          <span className="status-spinner status-spinner-sm" aria-hidden="true" /> Gemini analisando o manuscrito…
        </p>
      )}

      {/* O mesmo resultado do Assistente opcional (ResultadoAnaliseIA). */}
      {!carregando && resultado !== null && (
        <ResultadoAnaliseIA
          resultado={resultado}
          tituloErro="Não foi possível consultar o Gemini"
          rotuloLista="Diagnósticos do Gemini"
          podeConferir={configurado}
          onFocar={onFocar}
          onResolver={onResolver}
          onConferir={onConferir}
          conferencias={conferencias}
          onExcluir={onExcluir}
          rotuloExcluir="Excluir diagnóstico"
        />
      )}
    </div>
  );
}
