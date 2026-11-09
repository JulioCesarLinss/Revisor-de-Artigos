/** Entrega bytes ao usuário como um arquivo baixado pelo navegador. */
export function baixarArquivo(bytes: Uint8Array, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo ao navegador de iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
