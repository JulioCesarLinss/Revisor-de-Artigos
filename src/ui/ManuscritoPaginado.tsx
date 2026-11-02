import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Intervalo } from "../rules/types";
import { partesFormatadas, type TrechoFormatado } from "../workspace/formatacao.js";

interface Props {
  valor: string;
  onChange: (valor: string) => void;
  /** Trechos destacados (posições no texto bruto), em ordem e sem sobreposição. */
  destaques?: Intervalo[];
  /** Muda a cada "Localizar": leva a tela até o primeiro trecho. */
  pedidoDestaque?: number;
  /** O usuário clicou dentro de um trecho destacado: a marca dele deve sumir. */
  onRemoverDestaque?: (trecho: Intervalo) => void;
  /** Negrito, itálico e sublinhado (posições no texto bruto). */
  formatacao?: TrechoFormatado[];
  /** A seleção ou o cursor mudou (posições no texto bruto). */
  onSelecao?: (inicio: number, fim: number) => void;
}

const SEM_DESTAQUES: Intervalo[] = [];
const SEM_FORMATACAO: TrechoFormatado[] = [];
/** Impede a quebra de linha entre uma palavra inclinada e o que está colado nela. */
const SEM_QUEBRA = "⁠";

/** Separa palavras e espaços nos pontos onde o texto pode quebrar de linha. */
function pedacos(texto: string): string[] {
  return texto.split(/(\s+|(?<=-))/).filter((p) => p.length > 0);
}

/** Largura de uma folha A4 a 96dpi (210mm). */
const LARGURA_FOLHA_PX = 794;
/** Altura útil de conteúdo por folha: 297mm (1123px) menos as margens internas. */
const ALTURA_UTIL_PX = 950;

/**
 * Repagina o texto bruto em fatias contíguas (uma por folha), quebrando na
 * **linha** em que o texto deixa de caber — como um documento do Word: o
 * parágrafo que começa no fim de uma folha continua no topo da seguinte.
 * Medição no espelho oculto (mesma tipografia/largura do miolo da folha);
 * busca binária por prefixo com predicado estrito, e recuo para não cortar
 * no meio de uma palavra (o espaço final fica na fatia anterior).
 */
function paginar(texto: string, medidor: HTMLDivElement | null, larguraMiolo: number): string[] {
  if (texto.length === 0) return [""];
  if (!medidor) return [texto];

  // Largura idêntica à do textarea real (muda em telas estreitas).
  medidor.style.width = `${larguraMiolo}px`;
  const medir = (t: string): number => {
    medidor.textContent = t;
    return medidor.offsetHeight;
  };

  if (medir(texto) < ALTURA_UTIL_PX) return [texto];

  const paginas: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    const resto = texto.slice(inicio);
    if (medir(resto) < ALTURA_UTIL_PX) {
      paginas.push(resto);
      break;
    }

    // Maior prefixo que ainda cabe na folha (altura monotônica no comprimento).
    let baixo = 1;
    let alto = resto.length;
    let corte = 1;
    while (baixo <= alto) {
      const meio = (baixo + alto) >> 1;
      if (medir(resto.slice(0, meio)) < ALTURA_UTIL_PX) {
        corte = meio;
        baixo = meio + 1;
      } else {
        alto = meio - 1;
      }
    }

    // Não corta no meio da palavra: recua até depois do último espaço.
    let snap = corte;
    while (snap > 1 && !/\s/.test(resto.charAt(snap - 1))) snap--;
    if (snap <= 1) snap = corte; // palavra maior que a página: garante progresso

    paginas.push(resto.slice(0, snap));
    inicio += snap;
  }
  return paginas;
}

function iguais(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/**
 * Rascunho em folhas A4 — **editor contínuo** (comportamento Word/Google Docs):
 * um único fluxo de texto dentro das folhas, sem bloco/caixa por parágrafo.
 * Cada folha tem um textarea invisível como "campo" (só texto); o texto bruto
 * é a fonte de verdade e é repaginado a cada tecla, de modo que o que não
 * cabe numa folha continua automaticamente na seguinte. Enter desce uma linha;
 * dois Enter deixam a linha em branco que separa parágrafos. O cursor é
 * restaurado pela posição absoluta após repaginar.
 *
 * Destaque e formatação: textarea não pinta parte do texto, então cada folha
 * tem por trás uma camada espelho, que é o texto que o usuário vê, com os
 * trechos em <mark> e os estilos. O textarea fica por cima com as letras
 * transparentes: só o cursor e a seleção aparecem. Por isso os estilos não podem
 * mudar a largura das letras, ou o cursor se desalinharia: o negrito é um
 * contorno, e o itálico é a letra normal inclinada (a fonte real tem outra largura).
 */
export function ManuscritoPaginado({
  valor,
  onChange,
  destaques = SEM_DESTAQUES,
  pedidoDestaque,
  onRemoverDestaque,
  formatacao = SEM_FORMATACAO,
  onSelecao,
}: Props) {
  const medidorRef = useRef<HTMLDivElement | null>(null);
  const editoresRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const camadasRef = useRef<(HTMLDivElement | null)[]>([]);
  const marcaRef = useRef<HTMLElement | null>(null);
  const [paginas, setPaginas] = useState<string[]>(() => [valor]);
  /** Cursor/seleção absolutos (posição no texto bruto) a restaurar. */
  const cursor = useRef<{ inicio: number; fim: number } | null>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;
  /** Último texto paginado: o que veio da digitação não precisa ser medido de novo. */
  const textoPaginado = useRef<string | null>(null);

  const repaginar = (texto: string) => {
    textoPaginado.current = texto;
    const proximas = paginar(texto, medidorRef.current, editoresRef.current[0]?.clientWidth ?? 680);
    setPaginas((atuais) => (iguais(atuais, proximas) ? atuais : proximas));
  };

  // Texto que mudou por fora (arquivo, correção, Desfazer): repagina antes do
  // paint (sem piscar a troca de fatias).
  useLayoutEffect(() => {
    if (textoPaginado.current !== valor) repaginar(valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  // Recalcula quando as fontes terminarem de carregar (métricas podem mudar).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    document.fonts.ready.then(() => repaginar(valorRef.current)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaura o cursor absoluto na folha que o contém (executa a cada render,
  // para consumir a referência mesmo quando a paginação não muda).
  useLayoutEffect(() => {
    const alvo = cursor.current;
    if (!alvo) return;
    cursor.current = null;
    let inicio = 0;
    for (let i = 0; i < paginas.length; i++) {
      const fim = inicio + paginas[i].length;
      const ultimo = i === paginas.length - 1;
      if (alvo.inicio >= inicio && (alvo.inicio < fim || (ultimo && alvo.inicio <= fim))) {
        const el = editoresRef.current[i];
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(
              Math.max(0, Math.min(alvo.inicio - inicio, el.value.length)),
              Math.max(0, Math.min(alvo.fim - inicio, el.value.length)),
            );
          } catch {
            /* seleção indisponível: segue sem restaurar */
          }
        }
        return;
      }
      inicio = fim;
    }
  });

  // A camada de destaque acompanha a rolagem interna da folha também quando
  // ela aparece (o onScroll só cobre rolagens que acontecem depois).
  useLayoutEffect(() => {
    camadasRef.current.forEach((camadaEl, i) => {
      const editor = editoresRef.current[i];
      if (camadaEl && editor) camadaEl.scrollTop = editor.scrollTop;
    });
  });

  // Novo "Localizar": leva a folha até o primeiro trecho (centralizado na tela).
  // Só no pedido: uma marca que some enquanto o usuário digita não rola a página.
  useEffect(() => {
    if (pedidoDestaque === undefined) return;
    marcaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pedidoDestaque]);

  const inicioDaPagina = (pagina: number): number => {
    let inicio = 0;
    for (let i = 0; i < pagina; i++) inicio += paginas[i].length;
    return inicio;
  };

  const montar = (pagina: number, textoDaPagina: string): string =>
    paginas.map((p, i) => (i === pagina ? textoDaPagina : p)).join("");

  /**
   * Pagina junto com o aviso ao pai: as folhas e o texto mudam no mesmo render.
   * Se as folhas viessem depois, o textarea voltaria por um instante ao texto
   * antigo e, ao receber o novo, o navegador jogaria o cursor para o fim.
   */
  const aplicar = (novo: string) => {
    repaginar(novo);
    onChange(novo);
  };

  const editar = (pagina: number, texto: string) => {
    const el = editoresRef.current[pagina];
    const ini = inicioDaPagina(pagina);
    cursor.current = {
      inicio: ini + (el?.selectionStart ?? texto.length),
      fim: ini + (el?.selectionEnd ?? texto.length),
    };
    aplicar(montar(pagina, texto));
  };

  /** Clique dentro de um trecho destacado apaga só a marca dele. */
  const clicar = (pagina: number, el: HTMLTextAreaElement) => {
    const posicao = inicioDaPagina(pagina) + el.selectionStart;
    const trecho = destaques.find((t) => posicao >= t.inicio && posicao <= t.fim);
    if (trecho) onRemoverDestaque?.(trecho);
  };

  /** Um pedaço do texto da folha (de `de` até `ate`) com seus estilos. */
  const pintar = (ini: number, texto: string, de: number, ate: number) =>
    partesFormatadas(texto.slice(de, ate), ini + de, formatacao).map((parte) => {
      const classes = parte.estilos.map((e) => `texto-${e}`).join(" ");
      if (!parte.estilos.includes("italico")) {
        return (
          <span key={parte.inicio} className={classes || undefined}>
            {parte.texto}
          </span>
        );
      }
      // Inclinar exige caixas (inline-block); cada uma é um pedaço que não quebra,
      // e o que encosta em outro trecho fica colado, como no textarea.
      const antes = texto[parte.inicio - ini - 1];
      const depois = texto[parte.inicio - ini + parte.texto.length];
      return (
        <Fragment key={parte.inicio}>
          {antes && !/\s/.test(antes) && SEM_QUEBRA}
          {pedacos(parte.texto).map((pedaco, i) =>
            /^\s+$/.test(pedaco) ? (
              <span key={i} className={classes}>
                {pedaco}
              </span>
            ) : (
              <span key={i} className={`${classes} texto-inclinado`}>
                {pedaco}
              </span>
            ),
          )}
          {depois && !/\s/.test(depois) && SEM_QUEBRA}
        </Fragment>
      );
    });

  /** Camada espelho da folha: o texto visível, com estilos e trechos destacados em <mark>. */
  const camada = (pagina: number, texto: string) => {
    const ini = inicioDaPagina(pagina);
    const naFolha = destaques.filter((t) => t.fim > ini && t.inicio < ini + texto.length);
    let lido = 0;
    return (
      <div
        className="folha-texto folha-destaque-camada"
        aria-hidden="true"
        ref={(el) => {
          camadasRef.current[pagina] = el;
        }}
      >
        {naFolha.map((t) => {
          const de = Math.max(t.inicio - ini, 0);
          const ate = Math.min(t.fim - ini, texto.length);
          const inicioAntes = lido;
          lido = ate;
          return (
            <Fragment key={t.inicio}>
              {pintar(ini, texto, inicioAntes, de)}
              <mark
                className="folha-destaque"
                ref={(el) => {
                  // O primeiro trecho, na folha onde ele começa, recebe a rolagem.
                  if (el && t === destaques[0] && t.inicio >= ini) marcaRef.current = el;
                }}
              >
                {pintar(ini, texto, de, ate)}
              </mark>
            </Fragment>
          );
        })}
        {pintar(ini, texto, lido, texto.length)}
      </div>
    );
  };

  return (
    <div className="folhas-area">
      <p className="folhas-dica">
        Rascunho em folhas A4: o texto flui continuamente e continua na folha seguinte ao chegar ao fim.{" "}
        <kbd className="atalho-tecla">Enter</kbd> desce uma linha · dois{" "}
        <kbd className="atalho-tecla">Enter</kbd> novo parágrafo.
      </p>

      {/* Espelho oculto de medição — mesma tipografia e largura do miolo da folha. */}
      <div className="folha-medidor folha-texto" ref={medidorRef} aria-hidden="true" />

      {paginas.map((texto, folhaIdx) => (
        <div
          key={`folha-${folhaIdx}`}
          className="folha-a4"
          role="group"
          aria-label={`Folha ${folhaIdx + 1} de ${paginas.length}`}
          style={{ width: LARGURA_FOLHA_PX }}
        >
          <div className="folha-miolo">
            {camada(folhaIdx, texto)}
            <textarea
              ref={(el) => {
                editoresRef.current[folhaIdx] = el;
              }}
              className="folha-texto folha-texto-area"
              aria-label={`Manuscrito — folha ${folhaIdx + 1} de ${paginas.length}`}
              value={texto}
              placeholder="Digite ou cole o manuscrito aqui…"
              spellCheck={false}
              onChange={(e) => editar(folhaIdx, e.target.value)}
              onClick={(e) => clicar(folhaIdx, e.currentTarget)}
              onSelect={(e) => {
                const ini = inicioDaPagina(folhaIdx);
                onSelecao?.(ini + e.currentTarget.selectionStart, ini + e.currentTarget.selectionEnd);
              }}
              onScroll={(e) => {
                // Mantém a camada de destaque alinhada se o textarea rolar.
                const camadaEl = camadasRef.current[folhaIdx];
                if (camadaEl) camadaEl.scrollTop = e.currentTarget.scrollTop;
              }}
            />
          </div>
          <span className="folha-num" aria-hidden="true">
            {folhaIdx + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
