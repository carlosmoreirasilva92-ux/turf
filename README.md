# TURF

Caderno de corridas. Há dois modos, e não se misturam.

- **Hoje** (`/`, `/ao-vivo/$id`): cartão do dia lido, sem chave, do JSON público da Sporting Life. Preço mostrado no momento da leitura, não é SP nem uma casa. Se a fonte falhar, a página fica vazia: a demonstração não a substitui. Uma cópia para o livro fica marcada como tua.
- **Demonstração** (`/corridas`, `/caderno`, `/agentes`): cartão fictício ancorado a 2 de novembro de 2026, 14:30, Dublin. Cavalos, cotações e resultados são gerados. Não é uma casa de apostas e não entra no livro.
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

## Arquivo histórico

O arquivo (`/cavalos`, `/arquivo`, `/fontes`) é outro sítio, também vazio até uma importação.

- Identidade estável por chave. Dois cavalos com o mesmo nome e chaves diferentes não são fundidos: ficam pendentes de correspondência.
- Peso corporal (`bodyKg`) e peso carregado (`carriedLb`) são campos diferentes.
- Queda sem causa publicada mostra «Causa não informada». Sem prazo anunciado, «Retorno não informado».
- Azarão usa a regra versionada `longshot-example-1` (odd decimal 10 como exemplo, não como definição universal). Sem preço com hora observada, não há classificação.
- O arquivo aceita JSON e CSV em Fontes. O mesmo conteúdo não se grava duas vezes. A matriz dos 431 atributos está em `docs/CATALOGO.md` e no ecrã Catálogo. Preenchimento: vazio até importação.
- O treino experimental compara o modelo com o mercado, sem o preço, e no alvo de top 3. Continua experimental.
- Não há feed. Faltam `TURF_PROVIDER_URL` e `TURF_PROVIDER_KEY`. Nada disto é cotação ao vivo.

Decisões e como retomar: [docs/HISTORICO.md](docs/HISTORICO.md).

