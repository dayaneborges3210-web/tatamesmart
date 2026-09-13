# TatameSmart — o que o Codex deve fazer

Site no ar: https://smarttatame.com.br
Repositório: https://github.com/dayaneborges3210-web/tatamesmart

## WhatsApp automático (padrão Metalcore/AutoCore)

Evolution API 2.3.7 no VPS:
- URL: http://129.121.55.118 (HTTPS self-signed: https://129.121.55.118)
- Header: apikey
- Envio: POST {base}/message/sendText/{instance}  { number, text }
- QR: GET {base}/instance/connect/{instance}
- Criar: POST {base}/instance/create { instanceName, qrcode:true, integration:"WHATSAPP-BAILEYS" }

O servidor do Grok NÃO alcança o IP (fetch failed).
O Chrome SIM (CORS libera https://smarttatame.com.br).
QR e teste DEVEM sair do navegador (src/lib/evo-browser.ts).

Empresa mãe (só contato@smarttatame.com.br): grava URL + token uma vez.
Cada academia: instância própria (ts + id), só lê o QR no celular dela.
Não reutilizar a instância tatamesmart nas escolas cliente.

Cobrança: 5 dias inicio, 4-1 lembrete, dia vencimento, depois atraso. 1 msg por fatura por dia.
