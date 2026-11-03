# Arquivo histórico

Branch `turf-historico`, em cima de `turf-ledger`. O `main` publicado não foi alterado.

## Decisões

- Os dados históricos são por utilizador. Não há base partilhada e não foi criada base paga. Sem `DATABASE_URL`, a pré-visualização usa PGLite e perde-se quando o processo reinicia.
- O catálogo de 431 atributos está em `src/lib/history/catalog.ts`. Não havia, nos anexos do workspace, uma folha separada com esses 431 nomes. O catálogo cobre os vinte grupos pedidos. Atributos fora dele são recusados, não ignorados.
- Entidades normalizadas para identidade, corrida, participação, preço, incidente, recuperação, facto extensível, feature e modelo. O facto (`h_facts`) guarda atributos do catálogo que não têm coluna própria.
- Correções acrescentam revisão. A projeção corrente muda, a versão anterior fica em `h_runner_revisions` ou numa nova linha de facto.
- `origin = example` é visível e fica fora de cobertura real, azarão real e treino.
- Importação JSON e CSV. O CSV usa secções `#` com cabeçalho fixo. Uma secção desconhecida é erro, não é ignorada. Exemplo em `examples/history.sample.csv`. A chave `auto` grava o hash do conteúdo. O mesmo pacote com outra chave não duplica. A mesma chave com outro pacote é recusada.
- O treino experimental compara vitória com mercado, vitória sem o preço, e top 3. Guarda bins de fiabilidade. Não promove.
- O perfil do cavalo mostra condições, parcerias, medições importadas e a janela depois de um prazo anunciado. Sem parciais, diz que não há série.

- Provedor externo continua desligado.

## Como correr

```bash
npm run dev
```

Importar em Fontes. O ciclo de uma corrida está na ficha do arquivo e só relê o que já foi gravado.

## O que falta por bloqueio externo

- Credenciais e licença de uma fonte oficial de corridas, preços e resultados.
- `DATABASE_URL` para o arquivo sobreviver a um reinício em produção.
- Base real suficiente e validação prospectiva antes de qualquer modelo deixar de ser experimental.
