# TURF

Caderno de corridas. Há dois modos, e não se misturam.

- **Demonstração** (`/`, `/corridas`, `/caderno`, `/agentes`): cartão fictício ancorado a 2 de novembro de 2026, 14:30, Dublin. Cavalos, cotações e resultados são gerados. Não é uma casa de apostas e não entra no livro.
- **Livro** (`/livro`, `/livro/$id`, `/importar`): começa vazio. Corridas, preços e previsões ficam na base, por utilizador. Uma importação JSON/CSV é marcada como informada pelo utilizador. A ficha tem URL própria, favorito e as cinco regras. Não há provedor ligado.

O selo QUALIFICADA só existe depois de uma validação prospectiva. Contar corridas não calibra. O modelo deste repositório está experimental. As cinco perspectivas (forma, pista, mercado, estábulo, peso) são regras, não modelos separados.

Não é conselho de aposta. 18+.

## Correr

```bash
npm install
npm run dev
```

## Variáveis

Nenhuma vai para o cliente, e nenhuma deve ser commitada.

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Postgres durável. Sem ela, a pré-visualização usa PGLite nesta máquina e os dados desaparecem quando o processo reinicia. A plataforma ainda não tem base provisionada (`deploy.database` está falso). |
| `XAI_API_KEY` | Liga o chat. Sem ela, a resposta é a explicação das regras e diz que não houve chamada. |
| `XAI_MODEL` | Opcional. Por omissão `grok-4.5`, o nome publicado em [docs.x.ai](https://docs.x.ai/developers/grok-4-5). |
| `TURF_PROVIDER_URL`, `TURF_PROVIDER_KEY` | Ainda não há adaptador. Se faltarem, o livro fica vazio. Se existirem, nada é descarregado e a demonstração não serve de substituto. |

A quota do chat, por omissão, é 8 pedidos por utilizador por hora, 40 no total, e uma chamada de cada vez.

## O que não está feito

Não há feed ao vivo, calibração prospectiva nem rentabilidade validada. O ROI do caderno de demonstração descreve o gerador, não um histórico de apostas.
