import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApontamentoConferido,
  DiagnosticoGemini,
  ParagrafoNumerado,
  ResultadoConferencia,
  ResultadoDiagnostico,
} from "../ai/gemini";
import type { Intervalo } from "../rules/types";
import type { Conferencia } from "../ui/ResultadoAnaliseIA";
import { acompanharApontamentos, posicionarApontamentos } from "../workspace/apontamentos.js";
import { localizarApontamento, unirTrechos } from "../workspace/destaques.js";
import type { PosicaoParagrafo } from "../workspace/paragrafos.js";

/** Quanto tempo o "Corrigido" do Conferir fica visível antes de o apontamento sair. */
const TEMPO_CORRIGIDO_MS = 2000;

interface Opcoes {
  /** Análise salva com o artigo e o texto a que ela se refere (ao abrir a tela). */
  salvo: { diagnostico: ResultadoDiagnostico | null; texto: string } | null;
  bruto: string;
  posicoes: PosicaoParagrafo[];
  /** Marca o parágrafo (posições relativas a ele; sem elas, o parágrafo todo). */
  marcar: (paragrafo: number, relativos?: Intervalo[]) => void;
  /** Marca trechos em posições absolutas do texto. */
  destacar: (trechos: Intervalo[]) => void;
  /** Leva para o histórico os apontamentos que saíram da lista. */
  registrar: (resolvidos: DiagnosticoGemini[], prefixo?: string) => void;
  /** Mensagem na linha de status da tela. */
  avisar: (mensagem: string) => void;
  /** Quem faz a análise e a conferência (servidor da plataforma ou a chave do usuário). */
  diagnosticar: (paragrafos: ParagrafoNumerado[]) => Promise<ResultadoDiagnostico>;
  conferir: (paragrafos: ParagrafoNumerado[], apontamento: ApontamentoConferido) => Promise<ResultadoConferencia>;
  /** Nome usado nas mensagens, ex.: "Diagnóstico do Gemini". */
  nome: string;
}

/**
 * Análise do manuscrito com IA (avaliação do artigo + apontamentos), com tudo
 * que acompanha a lista: posição de cada apontamento, os de linguagem saindo
 * ao serem corrigidos, "Conferir", "Já resolvi", "Localizar" e o registro no
 * histórico. Usada duas vezes na tela Revisar: pelo Diagnóstico com Gemini
 * (chave da plataforma) e pelo Assistente opcional (chave do usuário) — o
 * comportamento é o mesmo; muda só quem responde.
 */
export function useAnaliseIA(o: Opcoes) {
  // Ao abrir, cada apontamento ganha a posição do trecho no texto atual (os
  // salvos por versões antigas não tinham), para acompanhar a edição.
  const [diagnostico, setDiagnostico] = useState<ResultadoDiagnostico | null>(() => {
    const d = o.salvo?.diagnostico ?? null;
    return d?.ok ? { ...d, diagnosticos: posicionarApontamentos(d.diagnosticos, o.salvo!.texto) } : d;
  });
  // Texto a que as posições dos apontamentos se referem.
  const [textoDiagnosticado, setTextoDiagnosticado] = useState<string | null>(() =>
    o.salvo?.diagnostico?.ok ? o.salvo.texto : null,
  );
  const [carregando, setCarregando] = useState(false);
  const [conferencias, setConferencias] = useState<Record<number, Conferencia>>({});
  const ocupado = useRef(false);

  const { bruto, posicoes, marcar, destacar, registrar, avisar, diagnosticar, conferir, nome } = o;

  // O texto mudou: o apontamento de linguagem cujo trecho foi corrigido sai da
  // lista (e do resumo) e vai para o histórico; os outros acompanham. Sem chamar a IA.
  useEffect(() => {
    if (!diagnostico?.ok || textoDiagnosticado === null || textoDiagnosticado === bruto) return;
    const { diagnosticos, resolvidos } = acompanharApontamentos(diagnostico.diagnosticos, textoDiagnosticado, bruto);
    setDiagnostico({ ...diagnostico, diagnosticos });
    setTextoDiagnosticado(bruto);
    registrar(resolvidos);
  }, [diagnostico, textoDiagnosticado, bruto, registrar]);

  /** Localizar um apontamento: todos os erros que a IA apontou no mesmo parágrafo. */
  const localizar = useCallback(
    (alvo: DiagnosticoGemini) => {
      // Com a posição acompanhada, marca direto; os vizinhos do mesmo parágrafo também.
      const naPosicao = alvo.posicao;
      const doAlvo = naPosicao && posicoes.find((p) => p.inicio <= naPosicao.inicio && naPosicao.inicio <= p.fim);
      if (naPosicao && doAlvo) {
        const mesmos = (diagnostico?.ok ? diagnostico.diagnosticos : [alvo]).flatMap((d) =>
          d.posicao && d.posicao.inicio >= doAlvo.inicio && d.posicao.inicio <= doAlvo.fim ? [d.posicao] : [],
        );
        const trechos = unirTrechos([naPosicao, ...mesmos]);
        // O trecho foi apagado por inteiro: marca o parágrafo onde ele estava.
        if (trechos.length === 0) return marcar(posicoes.indexOf(doAlvo) + 1);
        return destacar(trechos);
      }
      const textos = posicoes.map((p) => bruto.slice(p.inicio, p.fim));
      const achado = localizarApontamento(textos, alvo);
      // Nada confiável no texto: marca o parágrafo que a IA citou.
      if (!achado) return marcar(alvo.paragrafo);
      const apontamentos = diagnostico?.ok ? diagnostico.diagnosticos : [alvo];
      marcar(
        achado.paragrafo,
        apontamentos.flatMap((d) => {
          const local = localizarApontamento(textos, d);
          return local?.paragrafo === achado.paragrafo ? [local.posicao] : [];
        }),
      );
    },
    [posicoes, bruto, diagnostico, marcar, destacar],
  );

  /** Tira um apontamento da lista pelo id (o manuscrito não é tocado). */
  const tirar = useCallback((id: number) => {
    setDiagnostico((d) => (d?.ok ? { ...d, diagnosticos: d.diagnosticos.filter((a) => a.id !== id) } : d));
  }, []);

  /** "Já resolvi": o usuário tira um apontamento sobre o artigo (e ele vai para o histórico). */
  const resolver = useCallback(
    (id: number) => {
      const alvo = diagnostico?.ok ? diagnostico.diagnosticos.find((d) => d.id === id) : undefined;
      tirar(id);
      if (alvo) registrar([alvo], "Marcado como resolvido");
      avisar("Apontamento marcado como resolvido.");
    },
    [diagnostico, tirar, registrar, avisar],
  );

  /**
   * "Conferir" de um apontamento sobre o artigo: vai o texto atual e o
   * apontamento; a IA diz se foi resolvido. Resolvido: mostra "Corrigido"
   * por um instante e tira da lista; senão, diz o que falta.
   */
  const conferirApontamento = useCallback(
    async (alvo: DiagnosticoGemini) => {
      const id = alvo.id;
      if (id === undefined) return;
      setConferencias((c) => ({ ...c, [id]: { estado: "conferindo" } }));
      const paragrafos = posicoes.map((p) => ({ index: p.index, texto: bruto.slice(p.inicio, p.fim) }));
      const r = await conferir(paragrafos, {
        paragrafo: alvo.paragrafo,
        categoria: alvo.categoria,
        descricao: alvo.descricao,
        sugestao: alvo.sugestao,
      });
      const resultado: Conferencia = !r.ok
        ? { estado: "erro", motivo: r.motivo }
        : r.resolvido
          ? { estado: "resolvido", explicacao: r.explicacao }
          : { estado: "pendente", explicacao: r.explicacao };
      setConferencias((c) => ({ ...c, [id]: resultado }));
      if (resultado.estado === "resolvido") {
        avisar("Apontamento conferido pela IA: corrigido.");
        setTimeout(() => {
          tirar(id);
          registrar([alvo], "Conferido pelo Gemini");
        }, TEMPO_CORRIGIDO_MS);
      }
    },
    [posicoes, bruto, conferir, tirar, registrar, avisar],
  );

  /** Tira a análise da tela, sem mensagem (ex.: outro arquivo aberto). */
  const limpar = useCallback(() => {
    setDiagnostico(null);
    setConferencias({});
    setTextoDiagnosticado(null);
  }, []);

  /** "Excluir": descarta a análise (mantém o manuscrito e a análise normativa). */
  const excluir = useCallback(() => {
    limpar();
    avisar(`${nome} excluído.`);
  }, [limpar, avisar, nome]);

  /** Pede a análise do texto enviado; uma de cada vez. */
  const pedir = useCallback(
    async (paragrafos: ParagrafoNumerado[], texto: string) => {
      if (ocupado.current) return;
      ocupado.current = true;
      setDiagnostico(null);
      setConferencias({});
      setCarregando(true);
      try {
        const r = await diagnosticar(paragrafos);
        // As posições valem para o texto enviado; se ele mudou durante a espera,
        // o acompanhamento acima ajusta no próximo render.
        setDiagnostico(
          r.ok ? { ...r, diagnosticos: posicionarApontamentos(r.diagnosticos, texto), geradoEm: Date.now() } : r,
        );
        setTextoDiagnosticado(texto);
        if (r.ok) avisar(`${nome} — ${r.diagnosticos.length} apontamento(s).`);
      } finally {
        ocupado.current = false;
        setCarregando(false);
      }
    },
    [diagnosticar, avisar, nome],
  );

  return {
    diagnostico,
    textoDiagnosticado,
    carregando,
    conferencias,
    pedir,
    excluir,
    limpar,
    localizar,
    resolver,
    conferirApontamento,
  };
}

/** Das duas análises, a mais recente (é a que entra no resumo, sem contar o mesmo problema duas vezes). */
export function analiseMaisRecente(
  ...analises: (ResultadoDiagnostico | null)[]
): ResultadoDiagnostico | null {
  let escolhida: ResultadoDiagnostico | null = null;
  for (const a of analises) {
    if (!a?.ok) continue;
    if (!escolhida?.ok || (a.geradoEm ?? 0) > (escolhida.geradoEm ?? 0)) escolhida = a;
  }
  return escolhida;
}
