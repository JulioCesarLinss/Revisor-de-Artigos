import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface Props {
  valor: string;
  onChange: (valor: string) => void;
}

/** Largura de uma folha A4 a 96dpi (210mm). */
const LARGURA_FOLHA_PX = 794;
/** Altura útil de conteúdo por folha: 297mm (1123px) menos as margens internas. */
const ALTURA_UTIL_PX = 950;
/** Espaço entre parágrafos (margin-bottom de .folha-paragrafo). */
const GAP_PX = 18;

/**
 * Rascunho em folhas A4: o texto bruto (fonte de verdade) é dividido em
 * parágrafos, cada parágrafo é medido num espelho oculto com a mesma tipografia
 * da folha e distribuído nas folhas; quando a folha chega ao limite, o
 * parágrafo seguinte quebra para a próxima folha A4 — sem cortar conteúdo.
 * Clicar em um parágrafo abre a edição inline dele (Esc sai da edição).
 */
export function ManuscritoPaginado({ valor, onChange }: Props) {
  const paragrafos = useMemo(() => valor.split(/\n{2,}/), [valor]);
  const chaveConteudo = paragrafos.join("\u0000");

  const medidorRef = useRef<HTMLDivElement | null>(null);
  const [alturas, setAlturas] = useState<number[] | null>(null);

  // Medição (1ª passagem): o espelho oculto replica a tipografia da folha.
  useLayoutEffect(() => {
    const el = medidorRef.current;
    if (!el) return;
    const medidos = Array.from(el.children).map((f) => (f as HTMLElement).offsetHeight);
    const assinatura = medidos.join(",");
    if (assinatura !== (alturas ?? []).join(",")) setAlturas(medidos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveConteudo]);

  // Distribuição (2ª passagem): acumula alturas até estourar a folha.
  const folhas = useMemo<number[][] | null>(() => {
    if (!alturas || alturas.length !== paragrafos.length) return null;
    const paginas: number[][] = [];
    let atual: number[] = [];
    let soma = 0;
    paragrafos.forEach((_, i) => {
      const altura = alturas[i];
      if (atual.length > 0 && soma + altura > ALTURA_UTIL_PX) {
        paginas.push(atual);
        atual = [];
        soma = 0;
      }
      atual.push(i);
      soma += altura + GAP_PX;
    });
    if (atual.length > 0) paginas.push(atual);
    return paginas;
  }, [alturas, paragrafos.length]);

  // Edição inline por parágrafo, com restauração do cursor ao repaginar.
  const [editando, setEditando] = useState<number | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const selecao = useRef<{ inicio: number; fim: number } | null>(null);

  const trocarParagrafo = (indice: number, texto: string) => {
    const el = editorRef.current;
    if (el) selecao.current = { inicio: el.selectionStart, fim: el.selectionEnd };
    const proximos = [...paragrafos];
    proximos[indice] = texto;
    onChange(proximos.join("\n\n"));
  };

  useEffect(() => {
    if (editando === null) return;
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement !== el) {
      el.focus();
      if (selecao.current) {
        try {
          el.setSelectionRange(selecao.current.inicio, selecao.current.fim);
        } catch {
          /* ignora */
        }
        selecao.current = null;
      }
    }
  });

  const adicionarParagrafo = () => {
    const ultima = paragrafos.length - 1;
    if (paragrafos[ultima]?.trim() === "") {
      setEditando(ultima);
      return;
    }
    onChange([...paragrafos, ""].join("\n\n"));
    setEditando(paragrafos.length);
  };

  const renderParagrafo = (indiceGlobal: number) => {
    const texto = paragrafos[indiceGlobal];
    if (editando === indiceGlobal) {
      return (
        <textarea
          key={`p-${indiceGlobal}`}
          ref={editorRef}
          className="folha-editor"
          aria-label={`Editar parágrafo ${indiceGlobal + 1}`}
          value={texto}
          rows={Math.max(2, Math.ceil(texto.length / 80))}
          spellCheck={false}
          onChange={(e) => trocarParagrafo(indiceGlobal, e.target.value)}
          onBlur={() => setEditando(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // Evita que o Esc global do modo revisar também dispare.
              e.stopPropagation();
              setEditando(null);
            }
          }}
        />
      );
    }
    return (
      <p
        key={`p-${indiceGlobal}`}
        className={`folha-paragrafo ${texto.trim() === "" ? "vazio" : ""}`}
        title="Clique para editar este parágrafo"
        onClick={() => setEditando(indiceGlobal)}
      >
        {texto.trim() === "" ? <span className="folha-vazio">parágrafo vazio — clique para escrever</span> : texto}
      </p>
    );
  };

  return (
    <div className="folhas-area">
      <p className="folhas-dica">
        Rascunho em folhas A4: cada folha quebra automaticamente quando chega ao limite. Clique em um parágrafo para
        editá-lo; <kbd className="atalho-tecla">Esc</kbd> conclui a edição.
      </p>

      {/* Espelho oculto de medição — mesma tipografia e largura do miolo da folha. */}
      <div className="folha-medidor" ref={medidorRef} aria-hidden="true">
        {paragrafos.map((t, i) => (
          <p key={`m-${i}`} className={`folha-paragrafo ${t.trim() === "" ? "vazio" : ""}`}>
            {t.trim() === "" ? "parágrafo vazio — clique para escrever" : t}
          </p>
        ))}
      </div>

      {(folhas ?? [[]]).map((indices, folhaIdx) => (
        <div
          key={`folha-${folhaIdx}`}
          className="folha-a4"
          role="group"
          aria-label={`Folha ${folhaIdx + 1} de ${folhas?.length ?? 1}`}
          style={{ width: LARGURA_FOLHA_PX }}
        >
          {indices.map((indiceGlobal) => renderParagrafo(indiceGlobal))}
          {folhaIdx === (folhas?.length ?? 1) - 1 && (
            <button className="folha-adicionar" type="button" onClick={adicionarParagrafo}>
              ＋ Novo parágrafo
            </button>
          )}
          <span className="folha-num" aria-hidden="true">
            {folhaIdx + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
