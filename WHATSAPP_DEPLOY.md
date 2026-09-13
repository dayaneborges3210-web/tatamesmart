# Publicacao pelo Grok

Manter projeto, dominio e banco atuais. Este trabalho nao publicou o site.

## Antes do deploy

- Aplicar migracoes 0021_wa_dispatch_claims.sql e 0022_wa_instances.sql no banco existente pelo mecanismo de migracao do projeto.
- Salvar URL da Evolution e token GLOBAL somente pela empresa mae (contato@smarttatame.com.br). O token de um cartao do manager pode ser individual: ele nao substitui AUTHENTICATION_API_KEY.
- Definir TATAMESMART_BOT_KEY como segredo privado. Scheduler deve chamar /api/wa-bot com header x-bot-key. A chave antiga em query string foi removida.
- Trocar a senha administrativa antiga via procedimento seguro e invalidar sessoes antigas antes do lancamento. O codigo nao restaura mais senhas padrao. TATAMESMART_OWNER_INITIAL_PASSWORD (16+ caracteres) so cria a conta se ela ainda nao existir; nao altera conta existente.

## Conexao

Backend cria instancias com token global e token individual aleatorio persistido. /api/wa-creds entrega somente a credencial individual da academia autenticada. QR, estado e teste continuam client-side. Nomes novos sao ts + hash completo do ID (40 caracteres de hash); chips antigos nao sao reutilizados ou apagados. Cada academia, inclusive a mae, deve conectar o seu chip no QR novo.

Para o VPS conhecido 129.121.55.118, o transporte backend conecta ao IP fixo mas usa whatsapp.metalcoreerp.com.br para SNI e validacao TLS. Nao desativa validacao de certificado nem depende do DNS desse nome. Se o IP/certificado mudar, atualizar o transporte. Se a rede do Grok bloquear o IP, essa restricao ainda precisa ser resolvida na hospedagem ou com relay autenticado no VPS. Codigo local nao prova conectividade do Grok.

Navegador usa HTTPS da URL cadastrada. Acesso por IP pode exigir aceitar o certificado no navegador. Nenhum teste real de envio foi feito neste trabalho.

## Validacao obrigatoria em preview

1. Login mae: salvar configuracao e confirmar ausencia de erro. Cliente nao pode salvar configuracao central.
2. Duas academias novas: sem dados demo, IDs e tokens diferentes. Nunca retornar token global em /api/wa-creds.
3. QR de cada academia; leitura por dois celulares distintos; confirmar estado open e teste recebido no owner_phone.
4. Fatura: fase correta em -5/-4/-1/0/+1 dias; dois disparos simultaneos nao duplicam envio.
5. Scheduler real sem navegador aberto; alarme da agenda no owner_phone; conferir resultado e historico.
6. Fazer deploy somente apos os testes reais. Nao alterar DNS nem criar novo banco.

## Entrega incerta

wa_dispatch_claims reserva antes do envio e registra sent ou uncertain. Timeout/erro apos tentativa nao autoriza reenvio automatico no mesmo dia, pois a mensagem pode ter sido entregue. Consultar Evolution antes de qualquer reprocessamento manual. Nao apagar claims para tentar novamente sem verificacao.

## Testes locais

`node --test scripts/whatsapp-security.test.cjs`

Testes locais verificam nomes distintos, senha existente preservada, reserva atomica por academia/dia e credenciais individuais com mocks. Nao substituem teste contra Evolution 2.3.7 em producao.
