# Proxy de mercado do Pulse

Worker público e sem credenciais usado somente para encaminhar a rota de preço
BTC de 15 minutos da Polymarket, que não aceita chamadas diretas do navegador.

## Publicação

1. Crie os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no
   repositório. O token precisa apenas de permissão para editar Workers.
2. Execute manualmente o workflow `Deploy market proxy`.
3. Copie a URL `https://pulse-polymarket-proxy.<conta>.workers.dev` exibida pelo
   workflow.
4. Crie a variável de repositório `PULSE_POLYMARKET_PROXY_ORIGIN` com essa URL.
5. Execute novamente o workflow `Deploy Pulse to GitHub Pages`.

O endpoint público será `<worker>/crypto/crypto-price`. O Worker aceita somente
requisições GET válidas para BTC, variante de 15 minutos, além de `/health`.
