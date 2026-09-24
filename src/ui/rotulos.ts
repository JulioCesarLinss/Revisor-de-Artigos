import { CATALOGO } from "../rules/catalogo";

/**
 * Heurística 6 (Nielsen) — reconhecimento em vez de memorização: traduz o id
 * interno da regra (ex.: "R001") para o título legível do catálogo, para que
 * a interface não exija que o usuário decore os códigos. Devolve null quando
 * o id não pertence ao catálogo (ex.: sugestão geral da IA).
 */
export function tituloDaRegra(regraId: string | null | undefined): string | null {
  if (!regraId) return null;
  return CATALOGO.find((regra) => regra.id === regraId)?.titulo ?? null;
}
