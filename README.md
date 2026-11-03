# TURF

Caderno de corridas em português europeu. O cartão de hoje fica ancorado a uma hora, o modelo nomeia um cavalo e cinco agentes (forma, pista, mercado, estábulo e peso) podem alinhar, discordar ou abster-se. Há também um agente de IA que lê o mesmo cartão travado. Não é conselho de aposta.

Cartão de demonstração, com cotações travadas. Não há feed ao vivo.

```bash
npm install
npm run dev
```

O agente de IA precisa de `XAI_API_KEY` no servidor. Sem essa variável, a mesa de regras continua e o chat diz que não está ligado.

No Railway o build usa `NITRO_PRESET=node-server` (ver `railway.json`) e o processo arranca com `npm start`.
