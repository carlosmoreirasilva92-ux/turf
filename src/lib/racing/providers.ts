export type ProviderState =
  | { id: "none"; connected: false; reason: string }
  | { id: string; connected: false; reason: string };

/** No provider is called. A missing credential does not fall back to the demo. */
export function providerState(env: NodeJS.ProcessEnv = process.env): ProviderState {
  const url = env.TURF_PROVIDER_URL?.trim();
  const key = env.TURF_PROVIDER_KEY?.trim();
  if (!url && !key) {
    return {
      id: "none",
      connected: false,
      reason:
        "Nenhuma fonte externa está ligada. Falta TURF_PROVIDER_URL e TURF_PROVIDER_KEY. O livro fica vazio até uma importação, que é marcada como informada pelo utilizador.",
    };
  }
  return {
    id: "configured-unused",
    connected: false,
    reason:
      "Há variáveis de provedor, mas este adaptador ainda não faz pedidos. Nada foi descarregado e a demonstração não substitui a fonte.",
  };
}
