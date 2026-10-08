import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Props {
  valor: string;
  onChange: (valor: string) => void;
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
 * cabe numa folha continua automaticamente na seguinte. Enter insere quebra
 * de parágrafo (linha em branco, como o modelo do documento); Shift+Enter,
 * quebra de linha dentro do parágrafo. O cursor é restaurado pela posição
 * absoluta após repaginar.
 */
export function ManuscritoPaginado({ valor, onChange }: Props) {
  const medidorRef = useRef<HTMLDivElement | null>(null);
  const editoresRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [paginas, setPaginas] = useState<string[]>(() => [valor]);
  /** Cursor/seleção absolutos (posição no texto bruto) a restaurar. */
  const cursor = useRef<{ inicio: number; fim: number } | null>(null);
  const valorRef = useRef(valor);
  valorRef.current = valor;

  // Repagina antes do paint (sem piscar a troca de fatias).
  useLayoutEffect(() => {
    const proximas = paginar(valor, medidorRef.current, editoresRef.current[0]?.clientWidth ?? 680);
    setPaginas((atuais) => (iguais(atuais, proximas) ? atuais : proximas));
  }, [valor]);

  // Recalcula quando as fontes terminarem de carregar (métricas podem mudar).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    document.fonts.ready
      .then(() => {
        const proximas = paginar(valorRef.current, medidorRef.current, editoresRef.current[0]?.clientWidth ?? 680);
        setPaginas((atuais) => (iguais(atuais, proximas) ? atuais : proximas));
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaura o cursor absoluto na folha que o contém (executa a cada render,
  // para consumir a referência mesmo quando a paginação não muda).
  useEffect(() => {
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

  const inicioDaPagina = (pagina: number): number => {
    let inicio = 0;
    for (let i = 0; i < pagina; i++) inicio += paginas[i].length;
    return inicio;
  };

  const montar = (pagina: number, textoDaPagina: string): string =>
    paginas.map((p, i) => (i === pagina ? textoDaPagina : p)).join("");

  const editar = (pagina: number, texto: string) => {
    const el = editoresRef.current[pagina];
    const ini = inicioDaPagina(pagina);
    cursor.current = {
      inicio: ini + (el?.selectionStart ?? texto.length),
      fim: ini + (el?.selectionEnd ?? texto.length),
    };
    onChange(montar(pagina, texto));
  };

  const teclar = (pagina: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault(); // o texto é controlado: quem insere é o onChange abaixo
    const el = e.currentTarget;
    const ini = inicioDaPagina(pagina);
    const inserido = e.shiftKey ? "\n" : "\n\n"; // Enter = parágrafo; Shift+Enter = linha
    const novo = el.value.slice(0, el.selectionStart) + inserido + el.value.slice(el.selectionEnd);
    cursor.current = {
      inicio: ini + el.selectionStart + inserido.length,
      fim: ini + el.selectionStart + inserido.length,
    };
    onChange(montar(pagina, novo));
  };

  return (
    <div className="folhas-area">
      <p className="folhas-dica">
        Rascunho em folhas A4: o texto flui continuamente e continua na folha seguinte ao chegar ao fim.{" "}
        <kbd className="atalho-tecla">Enter</kbd> novo parágrafo ·{" "}
        <kbd className="atalho-tecla">Shift+Enter</kbd> quebra de linha.
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
            onKeyDown={(e) => teclar(folhaIdx, e)}
          />
          <span className="folha-num" aria-hidden="true">
            {folhaIdx + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
