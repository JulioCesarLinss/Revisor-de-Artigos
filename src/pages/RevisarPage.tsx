import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { statusIA, sugerirReescrita } from "../ai/assistente";
import { diagnosticarComGemini, geminiConfigurado } from "../ai/geminiCliente";
import type { DiagnosticoGemini, ParagrafoNumerado, ResultadoDiagnostico } from "../ai/gemini";
import { carregarConfigIA, salvarConfigIA } from "../perfil/perfil";
import type { ConfiguracaoIA, SugestaoIA } from "../ai/types";
import { aplicarCorrecao } from "../document/acoes";
import { aplicarSugestao } from "../document/aplicarSugestao";
import { lerArquivo, type ResultadoUpload } from "../document/arquivo";
import { importarTexto } from "../document/importar.js";
import { iniciarRevisao, type AnaliseRevisao } from "../review/orquestrar";
import type { Intervalo, Problema } from "../rules/types";
import { PainelGemini } from "../ui/PainelGemini";
import { PainelHistorico } from "../ui/PainelHistorico";
import { ManuscritoPaginado } from "../ui/ManuscritoPaginado";
import { PainelSecoes } from "../ui/PainelSecoes";
import { PainelSugestao } from "../ui/PainelSugestao";
import { ProblemaCard } from "../ui/ProblemaCard";
import { Resumo } from "../ui/Resumo";
import { registrar, type RegistroAlteracao } from "../workspace/historico";
import { ajustarTrechos, localizarApontamento, unirTrechos } from "../workspace/destaques.js";
import {
  ajustarFormatacao,
  alternarEstilo,
  estilosEm,
  type Estilo,
  type TrechoFormatado,
} from "../workspace/formatacao.js";
import { posicoesParagrafos } from "../workspace/paragrafos";
import { desempilhar, empilhar } from "../workspace/desfazer";
import { gerarDocx, MIME_DOCX, nomeExportado } from "../exportar/docx";
import { baixarArquivo } from "../exportar/baixar";
import { carregarWorkspace, salvarWorkspace } from "../workspace/armazenamento";
import { useAutorizacao } from "../firebase/auth";
import { carregarWorkspaceNuvem, salvarWorkspaceNuvem } from "../firebase/persistencia";

/** Espera após a última tecla antes de reanalisar (as regras são instantâneas). */
const ATRASO_REANALISE_MS = 500;
/** Teclas digitadas com menos que isso de intervalo viram um único passo do "Desfazer". */
const PAUSA_NOVO_PASSO_MS = 1000;

/** Texto e formatação juntos: um passo do "Desfazer", e a base de `trechos` no estado da tela. */
interface TextoFormatado {
  texto: string;
  trechos: TrechoFormatado[];
}

const BOTOES_FORMATO: { estilo: Estilo; letra: string; rotulo: string; atalho: string; classe: string }[] = [
  { estilo: "negrito", letra: "N", rotulo: "Negrito", atalho: "Ctrl+B", classe: "texto-negrito" },
  { estilo: "italico", letra: "I", rotulo: "Itálico", atalho: "Ctrl+I", classe: "texto-inclinado" },
  { estilo: "sublinhado", letra: "S", rotulo: "Sublinhado", atalho: "Ctrl+U", classe: "texto-sublinhado" },
];
const TECLAS_FORMATO: Record<string, Estilo> = { b: "negrito", i: "italico", u: "sublinhado" };

/** Marcas no editor: valem para `texto`; `pedido` muda a cada "Localizar" (leva a tela até elas). */
interface Destaque {
  texto: string;
  trechos: Intervalo[];
  pedido: number;
}

/** Tela /revisar — editor de revisão interativa (conteúdo original do App). */
export default function RevisarPage() {
  // uid do Firebase (quando configurado) — chave da persistência na nuvem.
  const { uid } = useAutorizacao();
  // Workspace restaurado do dispositivo (uma única leitura, no primeiro render):
  // o rascunho e o histórico sobrevivem à troca de rotas e alimentam /historico.
  const [salvo] = useState(carregarWorkspace);
  const location = useLocation();

  // Upload de arquivo (aba Revisar): seletor + arrastar-e-soltar na folha.
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);

  const [bruto, setBruto] = useState(salvo?.bruto ?? "");
  // Contadores da barra: vêm do texto atual, a cada tecla (não dependem do "Analisar").
  const contagem = useMemo(() => importarTexto(bruto), [bruto]);

  // Negrito, itálico e sublinhado. Mudança de texto que não veio da digitação
  // (correção, sugestão): as faixas acompanham, ainda neste render.
  const [formato, setFormato] = useState<TextoFormatado>({ texto: bruto, trechos: salvo?.formatacao ?? [] });
  if (formato.texto !== bruto) {
    setFormato({ texto: bruto, trechos: ajustarFormatacao(formato.trechos, formato.texto, bruto) });
  }
  /** Botões ligados: o que se digitar agora sai nesses estilos. */
  const [estilosAtivos, setEstilosAtivos] = useState<Estilo[]>([]);
  const selecao = useRef({ inicio: 0, fim: 0 });

  /** Cursor ou seleção mudou: os botões passam a mostrar os estilos daquele ponto. */
  const aoSelecionar = useCallback(
    (inicio: number, fim: number) => {
      if (selecao.current.inicio === inicio && selecao.current.fim === fim) return;
      selecao.current = { inicio, fim };
      setEstilosAtivos(estilosEm(formato.trechos, inicio, fim));
    },
    [formato.trechos],
  );
  /**
   * A análise começa no botão "Analisar"; a partir daí os avisos acompanham
   * as correções. Um texto restaurado (volta de outra tela) é trabalho em
   * andamento e já chega analisado; um arquivo novo espera o clique.
   */
  const [acompanhando, setAcompanhando] = useState(() => !!salvo && salvo.bruto.trim().length > 0);
  const [analise, setAnalise] = useState<AnaliseRevisao | null>(() =>
    salvo && salvo.bruto.trim().length > 0 ? iniciarRevisao(salvo.bruto) : null,
  );

  // Destaque no editor: "Localizar" marca os erros do parágrafo (ou o parágrafo,
  // nas seções, no /historico e nos avisos sobre ele todo). Cada marca é
  // independente: clicar nela ou alterá-la apaga só ela.
  const posicoes = useMemo(() => posicoesParagrafos(bruto), [bruto]);
  const pedidosLocalizar = useRef(1);
  const [destaque, setDestaque] = useState<Destaque | null>(() => {
    const alvo = (location.state as { alvo?: number } | null)?.alvo;
    const paragrafo = typeof alvo === "number" ? posicoes[alvo - 1] : undefined;
    return paragrafo ? { texto: bruto, trechos: [paragrafo], pedido: pedidosLocalizar.current } : null;
  });

  // O texto mudou (tecla, correção, Desfazer): a marca tocada some e as outras
  // acompanham, ainda neste render, para nunca aparecerem fora do lugar.
  if (destaque && destaque.texto !== bruto) {
    const trechos = ajustarTrechos(destaque.trechos, destaque.texto, bruto);
    setDestaque(trechos.length > 0 ? { ...destaque, texto: bruto, trechos } : null);
  }

  /** Marca posições relativas ao parágrafo; sem elas, o parágrafo inteiro. */
  const marcar = useCallback(
    (paragrafo: number, relativos?: Intervalo[]) => {
      const alvo = posicoes[paragrafo - 1];
      if (!alvo) return;
      const trechos = relativos?.length
        ? unirTrechos(relativos.map((r) => ({ inicio: alvo.inicio + r.inicio, fim: alvo.inicio + r.fim })))
        : [{ inicio: alvo.inicio, fim: alvo.fim }];
      pedidosLocalizar.current += 1;
      setDestaque({ texto: bruto, trechos, pedido: pedidosLocalizar.current });
    },
    [posicoes, bruto],
  );

  const focar = useCallback((paragrafo: number) => marcar(paragrafo), [marcar]);

  /** Localizar um aviso: todos os erros do parágrafo, medidos no texto atual. */
  const localizarProblema = useCallback(
    (problema: Problema) => {
      const atuais = iniciarRevisao(bruto).problemas.filter((p) => p.paragrafo === problema.paragrafo);
      const clicado = atuais.find((p) => p.id === problema.id);
      marcar(problema.paragrafo, clicado?.posicoes && atuais.flatMap((p) => p.posicoes ?? []));
    },
    [bruto, marcar],
  );

  const removerMarca = useCallback((trecho: Intervalo) => {
    setDestaque((d) => {
      const trechos = d ? d.trechos.filter((t) => t.inicio !== trecho.inicio) : [];
      return d && trechos.length > 0 ? { ...d, trechos } : null;
    });
  }, []);

  // Sprint 3 — assistência IA (opcional; DC-03). A chave salva em /perfil
  // é carregada aqui, para não precisar ser digitada duas vezes.
  const [configIA, setConfigIA] = useState<ConfiguracaoIA | null>(() => carregarConfigIA());
  const [chaveInput, setChaveInput] = useState("");
  const [sugestaoAtiva, setSugestaoAtiva] = useState<SugestaoIA | null>(null);
  const [carregandoSugestao, setCarregandoSugestao] = useState<string | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);

  /**
   * Heurística 9 (Nielsen) — reconhecer, diagnosticar e recuperar erros:
   * guarda o problema que originou o último pedido, para que o relatório de
   * erro mostre o que falhou e ofereça a recuperação ("Tentar novamente").
   */
  const [ultimoPedido, setUltimoPedido] = useState<Problema | null>(null);
  const [historico, setHistorico] = useState<RegistroAlteracao[]>(salvo?.historico ?? []);

  // Texto original do arquivo enviado — base para "Voltar ao original" no /historico.
  const [textoOriginal, setTextoOriginal] = useState<string | null>(salvo?.textoOriginal ?? null);

  // Heurística 1 (Nielsen) — visibilidade do status do sistema
  const [ocupadoCom, setOcupadoCom] = useState<string | null>(null);
  const [statusSistema, setStatusSistema] = useState<string | null>(null);

  /**
   * "Desfazer": estados anteriores do texto, só na memória desta tela (não vão
   * para o dispositivo nem para a nuvem). Correções e sugestões aceitas são um
   * passo cada; a digitação vira um passo a cada pausa de PAUSA_NOVO_PASSO_MS.
   */
  const [pilhaDesfazer, setPilhaDesfazer] = useState<TextoFormatado[]>([]);
  const ultimaTecla = useRef(0);

  /** Com seleção, aplica na seleção; sem ela, vale para o que se digitar a seguir. */
  const alternarFormato = useCallback(
    (estilo: Estilo) => {
      const { inicio, fim } = selecao.current;
      if (fim > inicio) {
        const trechos = alternarEstilo(formato.trechos, estilo, inicio, fim);
        setPilhaDesfazer((p) => empilhar(p, formato));
        setFormato({ texto: formato.texto, trechos });
        setEstilosAtivos(estilosEm(trechos, inicio, fim));
      } else {
        setEstilosAtivos((a) => (a.includes(estilo) ? a.filter((e) => e !== estilo) : [...a, estilo]));
      }
    },
    [formato],
  );

  // Exportar: nome do arquivo anexado (base do nome exportado) e o menu aberto.
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [menuExportar, setMenuExportar] = useState(false);
  const exportarRef = useRef<HTMLSpanElement | null>(null);

  const estadoIA = statusIA(configIA);
  // Gemini: a chave vive só no servidor (api/gemini) — aqui consultamos se ele
  // está ativo (null = ainda sem resposta da consulta).
  const [geminiAtivo, setGeminiAtivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void geminiConfigurado().then((ativo) => {
      if (vivo) setGeminiAtivo(ativo);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Ocupado quando há análise/versão em processamento ou sugestão IA pendente.
  const processando = ocupadoCom !== null || carregandoSugestao !== null;

  // Diagnóstico com Gemini (DC-03): só pelo botão próprio do painel — o texto
  // sai para o Google apenas quando o usuário pede. A análise local roda antes,
  // então uma falha da IA não atrasa o fluxo.
  // O diagnóstico vem do workspace salvo: ele sobrevive à troca de abas
  // (esta tela desmonta ao navegar) até um novo pedido, outro arquivo ou exclusão.
  const [diagnostico, setDiagnostico] = useState<ResultadoDiagnostico | null>(salvo?.diagnostico ?? null);
  const [analisandoGemini, setAnalisandoGemini] = useState(false);
  // Texto que gerou o diagnóstico atual: se o manuscrito mudar, o painel avisa.
  const [textoDiagnosticado, setTextoDiagnosticado] = useState<string | null>(salvo?.textoDiagnosticado ?? null);
  const geminiOcupado = useRef(false);

  /** Localizar um apontamento: todos os erros que a IA apontou no mesmo parágrafo. */
  const localizarDiagnostico = useCallback(
    (alvo: DiagnosticoGemini) => {
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
    [posicoes, bruto, diagnostico, marcar],
  );

  /** Exclui o diagnóstico atual (mantém o manuscrito e a análise normativa). */
  const excluirDiagnostico = useCallback(() => {
    setDiagnostico(null);
    setTextoDiagnosticado(null);
    setStatusSistema("Diagnóstico do Gemini excluído.");
  }, []);

  const pedirDiagnostico = useCallback(async (paragrafos: ParagrafoNumerado[], texto: string) => {
    if (geminiAtivo === false || geminiOcupado.current) return; // uma consulta por vez
    geminiOcupado.current = true;
    setDiagnostico(null);
    setAnalisandoGemini(true);
    try {
      const diagnosticado = await diagnosticarComGemini(paragrafos);
      setDiagnostico(diagnosticado);
      setTextoDiagnosticado(texto);
      if (diagnosticado.ok) {
        setStatusSistema(`Diagnóstico do Gemini — ${diagnosticado.diagnosticos.length} apontamento(s).`);
      }
    } finally {
      geminiOcupado.current = false;
      setAnalisandoGemini(false);
    }
  }, [geminiAtivo]);

  /**
   * Botão do painel do Gemini: reanalisa pelas regras na hora, para a
   * numeração dos parágrafos enviada bater com o texto atual (e o
   * "Localizar" levar ao lugar certo), e então pede o diagnóstico.
   */
  const pedirGemini = useCallback(() => {
    const resultado = iniciarRevisao(bruto);
    setAnalise(resultado);
    setAcompanhando(true);
    void pedirDiagnostico(resultado.manuscrito.paragrafos, bruto);
  }, [bruto, pedirDiagnostico]);

  /** Botão "Analisar" (ou Ctrl+Enter): verifica o texto e liga o acompanhamento. */
  const analisar = useCallback(() => {
    if (bruto.trim().length === 0) return;
    const resultado = iniciarRevisao(bruto);
    setAnalise(resultado);
    setAcompanhando(true);
    setStatusSistema(`Análise concluída — ${resultado.resumo.total} problema(s) encontrado(s).`);
  }, [bruto]);

  // Depois do "Analisar", os avisos acompanham o texto: pouco depois da última
  // alteração (tecla, correção rápida, sugestão aceita), a análise é refeita e
  // os avisos já resolvidos somem. Se a análise já é deste texto, nada a fazer.
  useEffect(() => {
    if (!acompanhando || (analise?.manuscrito.bruto ?? "") === bruto) return;
    const t = setTimeout(() => {
      setAnalise(bruto.trim().length > 0 ? iniciarRevisao(bruto) : null);
    }, ATRASO_REANALISE_MS);
    return () => clearTimeout(t);
  }, [acompanhando, bruto, analise]);

  // Persiste o workspace a cada mudança: /historico lê daqui e o rascunho
  // sobrevive à navegação entre rotas.
  useEffect(() => {
    salvarWorkspace({ bruto, textoOriginal, historico, formatacao: formato.trechos, diagnostico, textoDiagnosticado });
  }, [bruto, textoOriginal, historico, formato.trechos, diagnostico, textoDiagnosticado]);

  // Com Firebase, carrega da nuvem quando o dispositivo local está vazio
  // (primeiro acesso deste dispositivo à conta).
  const nuvemCarregada = useRef(false);
  useEffect(() => {
    if (!uid || nuvemCarregada.current) return;
    nuvemCarregada.current = true;
    void carregarWorkspaceNuvem(uid).then((nuvem) => {
      if (!nuvem || bruto.trim().length > 0) return; // só preenche vazio
      setBruto(nuvem.bruto);
      setFormato({ texto: nuvem.bruto, trechos: nuvem.formatacao ?? [] });
      setTextoOriginal(nuvem.textoOriginal ?? null);
      setHistorico(nuvem.historico ?? []);
      setDiagnostico(nuvem.diagnostico ?? null);
      setTextoDiagnosticado(nuvem.textoDiagnosticado ?? null);
    });
  }, [uid, bruto]);

  // Com Firebase, espelha o workspace na nuvem com debounce (evita gravar a
  // cada tecla). O localStorage continua sendo a fonte imediata/offline.
  useEffect(() => {
    if (!uid) return;
    const estado = { bruto, textoOriginal, historico, formatacao: formato.trechos, diagnostico, textoDiagnosticado };
    const t = setTimeout(() => {
      void salvarWorkspaceNuvem(uid, estado);
    }, 1200);
    return () => clearTimeout(t);
  }, [uid, bruto, textoOriginal, historico, formato.trechos, diagnostico, textoDiagnosticado]);

  /**
   * Heurística 7 (Nielsen) — flexibilidade e eficiência de uso: acelerador de
   * teclado para analisar (Ctrl+Enter), ignorado enquanto o app está ocupado.
   */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key !== "Enter") return;
      if (processando || bruto.trim().length === 0) return;
      e.preventDefault();
      analisar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [analisar, bruto, processando]);

  /** Digitação: um passo do "Desfazer" a cada pausa (não um por tecla). */
  const editar = useCallback(
    (novo: string) => {
      const agora = Date.now();
      if (agora - ultimaTecla.current > PAUSA_NOVO_PASSO_MS) setPilhaDesfazer((p) => empilhar(p, formato));
      ultimaTecla.current = agora;
      setBruto(novo);
      setFormato({ texto: novo, trechos: ajustarFormatacao(formato.trechos, formato.texto, novo, estilosAtivos) });
    },
    [formato, estilosAtivos],
  );

  /** Volta o texto ao estado anterior à última alteração. */
  const desfazer = useCallback(() => {
    const passo = desempilhar(pilhaDesfazer);
    if (!passo) return;
    const { texto } = passo.estado;
    setPilhaDesfazer(passo.pilha);
    setBruto(texto);
    setFormato(passo.estado);
    setEstilosAtivos(estilosEm(passo.estado.trechos, selecao.current.inicio, selecao.current.fim));
    ultimaTecla.current = 0; // a próxima digitação abre um passo novo
    if (acompanhando) setAnalise(texto.trim().length > 0 ? iniciarRevisao(texto) : null);
    setStatusSistema("Última alteração desfeita.");
  }, [pilhaDesfazer, acompanhando]);

  /** Lembra, no status, quantos avisos ainda havia no texto exportado. */
  const avisoPendente = analise && analise.problemas.length > 0
    ? ` Atenção: a análise ainda aponta ${analise.problemas.length} aviso(s).`
    : "";

  /** Baixa o texto revisado em .docx com formatação ABNT básica. */
  const exportarDocx = useCallback(() => {
    setMenuExportar(false);
    const nome = nomeExportado(nomeArquivo);
    try {
      baixarArquivo(gerarDocx(bruto, formato.trechos), nome, MIME_DOCX);
      setStatusSistema(`"${nome}" gerado com formatação ABNT básica.${avisoPendente}`);
    } catch {
      setStatusSistema("Não foi possível gerar o arquivo .docx. Tente novamente.");
    }
  }, [bruto, formato.trechos, nomeArquivo, avisoPendente]);

  /** Copia o texto revisado para colar no Word ou no Google Docs. */
  const copiarTexto = useCallback(async () => {
    setMenuExportar(false);
    try {
      await navigator.clipboard.writeText(bruto);
      setStatusSistema(`Texto copiado — cole no Word ou no Google Docs.${avisoPendente}`);
    } catch {
      setStatusSistema("O navegador não permitiu copiar. Selecione o texto no editor e use Ctrl+C.");
    }
  }, [bruto, avisoPendente]);

  // Menu "Exportar": fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuExportar) return;
    const aoClicar = (e: MouseEvent) => {
      if (!exportarRef.current?.contains(e.target as Node)) setMenuExportar(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuExportar(false);
    };
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [menuExportar]);

  /** Lê o arquivo no cliente e carrega o texto como novo rascunho (a análise espera o "Analisar"). */
  const receberArquivo = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setErroUpload(null);
    setArrastando(false);
    setOcupadoCom(`Lendo "${file.name}"…`);

    let resultado: ResultadoUpload;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      resultado = await lerArquivo({ nome: file.name, bytes });
    } catch {
      resultado = { ok: false, motivo: `Não foi possível ler "${file.name}" — o arquivo pode estar corrompido.` };
    }

    if (!resultado.ok) {
      // H9: o erro diz o quê, por quê e o que fazer (recuperação).
      setErroUpload(resultado.motivo);
      setOcupadoCom(null);
      setStatusSistema(null);
      return;
    }

    setBruto(resultado.texto);
    setFormato({ texto: resultado.texto, trechos: [] }); // a importação traz só o texto
    setEstilosAtivos([]);
    selecao.current = { inicio: 0, fim: 0 };
    setTextoOriginal(resultado.texto); // guarda o original do upload p/ "Voltar ao original"
    setDestaque(null); // o texto novo invalida um destaque antigo
    setDiagnostico(null); // o diagnóstico anterior pertencia ao texto anterior
    setTextoDiagnosticado(null);
    setAnalise(null); // avisos do texto anterior não valem para o novo
    setAcompanhando(false);
    setPilhaDesfazer([]); // o "Desfazer" não atravessa para outro arquivo
    setNomeArquivo(file.name);
    setOcupadoCom(null);
    setStatusSistema(`Arquivo "${file.name}" carregado — clique em Analisar para verificar o texto.`);
  }, []);

  const corrigir = useCallback(
    (problema: Problema) => {
      if (!problema.acao) return;
      const corrigido = aplicarCorrecao(bruto, problema.acao, problema.paragrafo);
      setPilhaDesfazer((p) => empilhar(p, formato));
      setBruto(corrigido);
      setAnalise(iniciarRevisao(corrigido));
      setHistorico((h) =>
        registrar(h, { origem: "manual", descricao: "correção rápida aplicada", paragrafo: problema.paragrafo }),
      );
      setStatusSistema(`Correção aplicada no parágrafo ${problema.paragrafo} — análise atualizada.`);
    },
    [bruto, formato],
  );

  const pedirSugestao = useCallback(
    async (problema: Problema) => {
      if (!configIA || !analise) return;
      const par = analise.manuscrito.paragrafos.find((p) => p.index === problema.paragrafo);
      if (!par) return;

      setCarregandoSugestao(problema.id);
      setErroIA(null);
      setUltimoPedido(problema); // H9: contexto do pedido para diagnóstico/recuperação
      const resultado = await sugerirReescrita(configIA, par.texto, problema.paragrafo, {
        regraId: problema.regraId,
        mensagem: problema.mensagem,
        referencia: problema.referencia,
      });
      setCarregandoSugestao(null);

      if (resultado.ok) {
        setSugestaoAtiva(resultado.sugestao);
        setStatusSistema("Sugestão recebida da IA — revise antes de aceitar.");
      } else {
        setErroIA(resultado.motivo);
        setStatusSistema(null);
      }
    },
    [configIA, analise],
  );

  const aceitarSugestao = useCallback(
    (textoFinal: string) => {
      if (!sugestaoAtiva) return;
      const novo = aplicarSugestao(bruto, sugestaoAtiva, textoFinal);
      setPilhaDesfazer((p) => empilhar(p, formato));
      setBruto(novo);
      setAnalise(iniciarRevisao(novo));
      setHistorico((h) =>
        registrar(h, {
          origem: "ia",
          descricao: sugestaoAtiva.regraId ? `sugestão aceita (${sugestaoAtiva.regraId})` : "sugestão aceita",
          paragrafo: sugestaoAtiva.paragrafo,
        }),
      );
      setStatusSistema(`Sugestão aceita no parágrafo ${sugestaoAtiva.paragrafo} — análise atualizada.`);
      setSugestaoAtiva(null);
    },
    [bruto, formato, sugestaoAtiva],
  );

  /**
   * H9 — relatório de erro completo para a falha do assistente IA:
   * o quê (Ocorreu um erro) → por quê (motivo legível) → como recuperar.
   */
  const renderErroIA = () => (
    <div className="ia-erro" role="alert">
      <strong className="ia-erro-titulo">Ocorreu um erro ao pedir a sugestão</strong>
      <span>{erroIA}</span>
      <span className="ia-erro-acoes">
        {ultimoPedido && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              const problema = ultimoPedido;
              setErroIA(null);
              void pedirSugestao(problema);
            }}
          >
            Tentar novamente
          </button>
          )}
        <button className="btn" type="button" onClick={() => setErroIA(null)}>
          Fechar
        </button>
      </span>
    </div>
  );

  return (
    <main className="app-main" id="conteudo">
      <section className="canvas-col" aria-label="Manuscrito em revisão">
        {/* H1: a linha de status só existe quando há status a mostrar. */}
        {(carregandoSugestao !== null || ocupadoCom !== null || analisandoGemini || statusSistema) && (
          <p className="status-sistema" role="status" aria-live="polite">
            {carregandoSugestao !== null ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                Pedindo sugestão à IA…
              </>
            ) : ocupadoCom !== null ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                {ocupadoCom}
              </>
            ) : analisandoGemini ? (
              <>
                <span className="status-spinner" aria-hidden="true" />
                Diagnóstico do Gemini em andamento…
              </>
            ) : (
              statusSistema
            )}
          </p>
        )}

        <div className="canvas-toolbar">
          <span className="stat">
            <strong>{contagem.paragrafos.length}</strong> parágrafos
          </span>
          <span className="stat">
            <strong>{contagem.totalPalavras}</strong> palavras
          </span>
          <span className="formato-botoes" role="group" aria-label="Formatação do texto">
            {BOTOES_FORMATO.map((b) => (
              <button
                key={b.estilo}
                className="btn btn-formato"
                type="button"
                aria-label={b.rotulo}
                aria-pressed={estilosAtivos.includes(b.estilo)}
                title={`${b.rotulo} (${b.atalho}): aplica no texto selecionado ou no que você digitar a seguir`}
                // Sem isto, o clique tiraria o foco do editor e o cursor sumiria.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => alternarFormato(b.estilo)}
              >
                <span className={b.classe}>{b.letra}</span>
              </button>
            ))}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {/* Desfazer: substitui as cópias por etapa (só em memória). */}
            <button
              className="btn"
              type="button"
              onClick={desfazer}
              disabled={pilhaDesfazer.length === 0 || processando}
              title={
                pilhaDesfazer.length === 0
                  ? "Nada para desfazer ainda"
                  : `Desfaz a última alteração (${pilhaDesfazer.length} disponível(is))`
              }
            >
              ↶ Desfazer
            </button>
            {/* Anexar: pequeno botão ao lado de Analisar (substitui "Carregar exemplo"). */}
            <input
              ref={inputFileRef}
              type="file"
              accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={(e) => {
                void receberArquivo(e.target.files?.[0]);
                e.target.value = ""; // permite reenviar o mesmo arquivo
              }}
            />
            <button
              className="btn btn-anexar"
              type="button"
              disabled={processando}
              onClick={() => inputFileRef.current?.click()}
              title="Anexar manuscrito (.docx, .txt ou .md) — ou arraste o arquivo direto para a folha"
            >
              <svg
                className="btn-anexar-icone"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Anexar
            </button>
            <button
              className="btn btn-accent"
              type="button"
              onClick={analisar}
              disabled={bruto.trim().length === 0 || processando}
              aria-busy={processando || undefined}
              title={
                /* H9: quando bloqueado, o botão explica por quê e como destravar. */
                bruto.trim().length === 0
                  ? "Anexe, cole ou digite o manuscrito para habilitar a análise"
                  : "Verifica o manuscrito contra o catálogo de regras normativas; depois, os avisos acompanham suas correções"
              }
            >
              Analisar <kbd className="atalho-tecla" aria-hidden="true">Ctrl+↵</kbd>
            </button>
            {/* Exportar: o fim da revisão — o texto corrigido sai do app. */}
            <span className="exportar-wrap" ref={exportarRef}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setMenuExportar((aberto) => !aberto)}
                disabled={bruto.trim().length === 0 || processando}
                aria-haspopup="menu"
                aria-expanded={menuExportar}
                title={
                  bruto.trim().length === 0
                    ? "Anexe, cole ou digite o manuscrito para poder exportar"
                    : "Baixar o texto revisado em .docx ou copiá-lo"
                }
              >
                Exportar ▾
              </button>
              {menuExportar && (
                <span className="exportar-menu" role="menu" aria-label="Exportar o texto revisado">
                  <button type="button" role="menuitem" className="exportar-item" onClick={exportarDocx}>
                    <strong>Baixar .docx</strong>
                    <small>Word, com formatação ABNT básica</small>
                  </button>
                  <button type="button" role="menuitem" className="exportar-item" onClick={() => void copiarTexto()}>
                    <strong>Copiar texto</strong>
                    <small>Para colar no Word ou no Google Docs</small>
                  </button>
                </span>
              )}
            </span>
          </span>
        </div>

        {/* Upload: erro legível com recuperação (H9). */}
        {erroUpload && (
          <div className="upload-erro" role="alert">
            <strong>Não foi possível carregar o arquivo</strong>
            <span>{erroUpload}</span>
            <button className="btn" type="button" onClick={() => setErroUpload(null)}>
              Fechar
            </button>
          </div>
        )}

        {/* Arrastar-e-soltar: só reage a arquivos, preserva o drag interno. */}
        <div
          className={`canvas-page ${arrastando ? "arrastando" : ""}`}
          onKeyDown={(e) => {
            const estilo = TECLAS_FORMATO[e.key.toLowerCase()];
            if (!estilo || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
            e.preventDefault(); // Ctrl+U abriria o código-fonte da página
            alternarFormato(estilo);
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setArrastando(false);
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setArrastando(false);
            void receberArquivo(e.dataTransfer.files?.[0]);
          }}
        >
          {/* Folhas A4 editáveis; os erros localizados aparecem destacados. */}
          <ManuscritoPaginado
            valor={bruto}
            onChange={editar}
            destaques={destaque?.trechos}
            pedidoDestaque={destaque?.pedido}
            onRemoverDestaque={removerMarca}
            formatacao={formato.trechos}
            onSelecao={aoSelecionar}
          />
        </div>
      </section>

      <aside className="inspector" aria-label="Resultado da análise">
        <Resumo analise={analise} diagnostico={diagnostico} />

        {/* Sprint 3 — configuração da assistência IA (opcional) */}
        <div className="resumo-card">
          <h2>Assistente IA (opcional)</h2>
          {estadoIA === "pronta" ? (
            <p className="ia-status ia-pronta">
              Assistente configurado. Sugestões aparecem como <em>assistência</em>, nunca como decisão normativa.
            </p>
          ) : (
            <div className="ia-config">
              <p className="ia-status">
                Sem IA o fluxo continua completo: regras, relatório e correções. Configure uma chave para receber
                sugestões de reescrita.
              </p>
              <input
                type="password"
                className="ia-input"
                placeholder="Chave da API (OpenAI ou compatível)"
                value={chaveInput}
                onChange={(e) => setChaveInput(e.target.value)}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={chaveInput.trim().length === 0}
                onClick={() => {
                  const config = { apiKey: chaveInput.trim() };
                  setConfigIA(config);
                  salvarConfigIA(config); // disponível também em /perfil
                  setChaveInput("");
                }}
              >
                Ativar assistente
              </button>
            </div>
          )}
          {erroIA && renderErroIA()}
        </div>

        {/* Diagnóstico do Gemini — só quando o usuário pede, no botão do painel. */}
        <PainelGemini
          configurado={geminiAtivo !== false}
          carregando={analisandoGemini}
          resultado={diagnostico}
          podePedir={bruto.trim().length > 0 && !processando && !analisandoGemini}
          desatualizado={diagnostico !== null && textoDiagnosticado !== null && textoDiagnosticado !== bruto}
          onPedir={pedirGemini}
          onFocar={localizarDiagnostico}
          onExcluir={excluirDiagnostico}
        />

        {analise && <PainelSecoes secoes={analise.secoes} onFocarSecao={(indices) => {
          const primeiro = indices[0];
          if (primeiro) focar(primeiro);
        }} />}

        {analise && analise.problemas.length === 0 && (
          <div className="empty-card">
            <h3>Nenhum problema encontrado</h3>
            <p>O texto passou por todas as verificações do catálogo.</p>
          </div>
        )}

        {sugestaoAtiva && analise && (
          <PainelSugestao
            sugestao={sugestaoAtiva}
            manuscrito={analise.manuscrito}
            onAceitar={aceitarSugestao}
            onIgnorar={() => setSugestaoAtiva(null)}
            sugerindo={carregandoSugestao !== null}
          />
        )}

        {/* Contador que acompanha as correções: cai a cada aviso resolvido. */}
        {analise && analise.problemas.length > 0 && (
          <p className="avisos-restantes" role="status" aria-live="polite">
            <strong>{analise.problemas.length}</strong>{" "}
            {analise.problemas.length === 1 ? "aviso restante" : "avisos restantes"}
          </p>
        )}

        {/* Parágrafos marcados como título: o botão "Aplicar correção" não
            aparece — a correção determinística poderia estragar o título. */}
        {analise?.problemas.map((p) => (
          <ProblemaCard
            key={p.id}
            problema={p}
            onCorrigir={corrigir}
            onLocalizar={() => localizarProblema(p)}
            onSugerir={estadoIA === "pronta" ? () => pedirSugestao(p) : undefined}
            sugerindo={carregandoSugestao === p.id}
            listarAcao={!analise.manuscrito.paragrafos.find((x) => x.index === p.paragrafo)?.ehTitulo}
          />
        ))}

        <PainelHistorico historico={historico} />
      </aside>
    </main>
  );
}
