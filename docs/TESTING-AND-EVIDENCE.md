# Testes, validação e evidências — Gate 5

## 1. Objetivo

Este documento registra o que foi efetivamente verificado no Notify Flow, diferencia tipos de teste e fornece um roteiro reproduzível para a banca, orientador ou equipe técnica.

Os números apresentados são contagens de testes aprovados, e não percentual de cobertura de código.

## 2. Resumo executivo

Em **14 de agosto de 2026**, a suíte atual apresentou:

| Camada | Comando | Resultado |
|---|---|---:|
| API | `npm run check` | lint aprovado + 374 testes aprovados |
| Frontend | `npm test` | 244 testes aprovados |
| Total | soma das duas suítes | **618 testes aprovados** |
| Build | `npm run build` | build Vite de produção concluído, 405 módulos transformados |
| Infra local | `docker compose config --quiet` | configuração válida |

Comparação com o marco anterior:

| Marco | API | Frontend | Total | Evolução absoluta |
|---|---:|---:|---:|---:|
| Gate 4 | 322 | 192 | 514 | — |
| Gate 5 | 374 | 244 | 618 | +104 |

A suíte cresceu aproximadamente **20,2%** em quantidade de casos entre os dois marcos. Esse indicador demonstra ampliação de cenários automatizados, mas não mede sozinho qualidade, cobertura ou ausência de defeitos.

## 3. Classificação das evidências

| Tipo | O que demonstra | O que não demonstra |
|---|---|---|
| Teste unitário/de contrato | comportamento determinístico de funções, managers, DTOs e componentes | integração real e disponibilidade do provedor |
| Teste HTTP | contrato e segurança de rotas com servidor controlado | configuração completa de produção |
| Build | compilação e empacotamento do frontend | correção funcional de cada jornada |
| Validação do Compose | coerência sintática e resolução das variáveis obrigatórias | saúde dos provedores externos |
| Smoke test | funcionamento básico de uma implantação | desempenho sustentado ou cobertura exaustiva |
| Ensaio funcional multicanal | processamento observado de um lote real/controlado | SLA ou capacidade máxima |
| Screenshot/vídeo | evidência visual de uma execução | prova isolada de regra interna ou segurança |

## 4. Reproduzindo a suíte

Use Node.js 20 ou superior e instale dependências a partir dos lockfiles.

### 4.1 API

```powershell
Set-Location api
npm ci
npm run check
```

`npm run check` executa:

```text
npm run lint && npm test
```

O lint usa ESLint com `--max-warnings=0`. Os testes usam o runner nativo do Node com concorrência um para reduzir interferência entre recursos compartilhados.

### 4.2 Frontend

```powershell
Set-Location frontend
npm ci
npm test
npm run build
```

Os testes usam Vitest. O build usa Vite e deve gerar `frontend/dist/` sem erro.

### 4.3 Infraestrutura declarativa

```powershell
Set-Location ..
docker compose config --quiet
```

Quando houver Docker:

```powershell
docker compose up --build -d
docker compose ps
Invoke-WebRequest http://localhost:8080/healthz
Invoke-WebRequest http://localhost:8080/api/health
```

Registre versão do Docker, sistema operacional, data, commit e quaisquer adaptações locais.

## 5. Cobertura funcional da API

A suíte atual contém casos nos seguintes domínios observados no repositório:

- autenticação administrativa, refresh, logout e bloqueios;
- validação DTO/Zod e envelopes de erro;
- criptografia de settings e apresentação mascarada de credenciais;
- contatos, identidades, deduplicação e proveniência de cadastro;
- consentimento, autorização, revogação e revalidação antes do envio;
- convites, links, atribuição, grupos e sincronização por convite;
- templates por canal, clonagem, conjuntos e variáveis fixas/dinâmicas;
- payloads WhatsApp Cloud, idiomas, componentes e parâmetros nomeados;
- upload, referência, retenção e remoção de mídia;
- fila BullMQ, idempotência, retries, recuperação e resultados parciais;
- tratamento específico do bloqueio Meta 131049;
- webhooks Telegram e WhatsApp, assinatura, deduplicação e eventos técnicos;
- receipts e reconciliação de status do WhatsApp;
- conversas, janela de 24 horas, paginação e backup;
- comandos de chat e vínculo do Meu perfil;
- confirmação de email via chat;
- documentos legais, privacidade e histórico do titular;
- central administrativa, alertas por email e retenção;
- white-label, uso/exportação/limpeza de armazenamento e auditoria.

Esta lista descreve áreas cobertas por testes, não uma declaração de cobertura integral de todas as linhas ou combinações.

## 6. Cobertura funcional do frontend

Os testes Vitest exercitam, entre outros:

- sessão administrativa, refresh e expiração;
- login público e acesso ao Meu perfil;
- máscaras e normalização de email/telefone;
- contatos, grupos, convites e permissões;
- builders e previews de Telegram, WhatsApp e Gmail;
- conjuntos de templates e seleção multicanal;
- revisão de campanha e detalhamento por contato/canal;
- chats e paginação de mensagens;
- janela de atendimento do WhatsApp;
- eventos Socket.IO e prevenção de atualização duplicada;
- tratamento de webhooks e eventos técnicos;
- configurações independentes e credenciais mascaradas;
- White-label, marca, links úteis e armazenamento;
- sanitização de HTML e URLs apresentadas ao usuário.

## 7. Ensaio funcional de disparo em massa

Durante a evolução do produto foi realizado um ensaio funcional com aproximadamente **20 a 30 usuários simultâneos**. O fluxo multicanal concluiu as entregas elegíveis observadas e os logs representaram corretamente sucessos, falhas e canais não autorizados.

O ensaio validou:

- formação do lote;
- processamento sem interrupção global por falha individual;
- separação de estado por usuário e canal;
- registro do resultado por entrega;
- visualização administrativa consistente.

### Limite da evidência

O ensaio não utilizou protocolo formal de performance, amostragem estatística, ambiente dedicado, aquecimento, duração prolongada nem instrumentação completa de latência/recursos. Portanto:

- não define capacidade máxima;
- não estabelece SLA;
- não permite extrapolar linearmente para centenas ou milhares de destinatários;
- não substitui teste de carga antes de uma adoção de maior escala.

## 8. Matriz de aceite manual

Registre cada execução com data, ambiente, commit, operador e evidência associada.

| ID | Cenário | Resultado esperado | Evidência recomendada |
|---|---|---|---|
| A01 | Login administrativo válido | painel abre e refresh mantém sessão | print sanitizado + log sem segredo |
| A02 | Login administrativo inválido | erro genérico e rate limit aplicável | resposta HTTP/request ID |
| C01 | Contato autoriza WhatsApp | identidade/consentimento atualizados sem duplicar contato | chat + ficha do contato |
| C02 | Contato revoga canal | jobs posteriores são ignorados nesse canal | consent event + entrega `skipped` |
| C03 | Email informado no chat | código enviado e associação ocorre somente após confirmação | conversa e email sanitizados |
| T01 | `/help` no Telegram | bot lista comandos permitidos | print do chat |
| T02 | Mídia Telegram | foto/vídeo chega ou falha com diagnóstico | chat + log |
| W01 | Texto dentro de 24 h | resposta livre é aceita | chat + timestamp da janela |
| W02 | Texto fora de 24 h | UI bloqueia texto livre e indica template | print do bloqueio |
| W03 | Template Meta | nome, idioma e parâmetros aprovados são enviados | payload sanitizado + receipt |
| W04 | Meta 131049 | entrega é agrupada e reagendada uma única vez | detalhe da campanha |
| H01 | Webhook inválido | assinatura/segredo inválido é rejeitado | status HTTP + log técnico |
| H02 | Evento técnico | evento é preservado sem criar contato indevido | tab Webhook |
| N01 | Campanha em três canais | cada canal produz estado independente | dialog de detalhe |
| N02 | Destino sem consentimento | canal fica `skipped`, demais continuam | linha por contato/canal |
| I01 | Convite público | link correto registra atribuição | convite + contato |
| P01 | Meu perfil | titular vê somente os próprios dados | sessão de contato sintético |
| P02 | Revogação pelo titular | permissão é alterada após confirmação | perfil + consent event |
| S01 | Exportar coleção | arquivo é baixado e auditoria registrada | hash do arquivo + console |
| S02 | Limpar coleção | confirmação, trava e auditoria ocorrem | ambiente descartável apenas |
| B01 | Realtime | mensagem aparece sem refresh e sem som duplicado | vídeo curto |
| D01 | Restart | aplicação sobe e campanhas persistidas são reconciliadas | logs antes/depois |

## 9. Evidências por requisito

| Requisito | Evidência automatizada | Evidência funcional |
|---|---|---|
| consentimento por canal | testes de managers/DTOs/identidades | perfil, contato e entrega ignorada |
| fila resiliente | testes de fila/recovery/idempotência | lote parcial e retries |
| WhatsApp oficial | testes de payload/webhook/receipt | mensagem real e status Meta |
| Telegram | testes de comandos/templates/webhook | conversa real do bot |
| Gmail HTML/texto | testes de sanitização/composição | email recebido |
| realtime | testes de serviços/componentes | mensagem sem reload |
| privacidade do titular | testes de perfil/memberships | sessão sintética separada |
| white-label | testes de settings/componentes | marca aplicada nas páginas |
| armazenamento | testes de export/clear/trava | ambiente descartável e log de auditoria |
| implantação | build e Compose config | health checks no ambiente alvo |

## 10. Organização de screenshots e vídeos

Use [`docs/app-media`](app-media/README.md). Cada evidência deve informar:

- ID do cenário;
- data/hora e timezone;
- ambiente (`local`, `staging` ou demonstração);
- commit ou versão;
- resultado;
- observação sobre anonimização.

Não use prints com tokens, passwords, emails privados, números completos, chat IDs, user IDs, cookies ou URLs assinadas.

## 11. Critérios de severidade sugeridos

| Severidade | Definição | Exemplo |
|---|---|---|
| Crítica | exposição de segredo/dado ou envio indevido em escala | bypass de consentimento |
| Alta | perda de função principal sem contorno seguro | worker não processa nenhum canal |
| Média | falha parcial com contorno e sem risco de dado | preview divergente do payload |
| Baixa | problema visual/documental sem alterar regra | desalinhamento responsivo |

Falhas críticas e altas impedem a entrega. Falhas médias precisam de decisão documentada; baixas podem entrar no backlog quando não prejudicam demonstração ou compreensão.

## 12. Testes adicionais recomendados

Antes de produção com volume maior:

- teste de carga com dados sintéticos e taxa controlada;
- soak test de fila e Socket.IO;
- chaos test de indisponibilidade de Redis/Mongo/provedor;
- teste de restauração completa, incluindo GridFS;
- varredura de dependências e imagem de container;
- DAST contra o ambiente de staging;
- teste de acessibilidade nas jornadas públicas;
- teste cruzado de navegadores e dispositivos móveis;
- simulação de rotação/revogação de credenciais;
- teste de retenção/TTL com relógio controlado.

## 13. Registro de execução

Copie este bloco para cada rodada relevante:

```text
Data/hora:
Timezone:
Ambiente:
Commit/versão:
Node/npm:
Docker/Compose:
MongoDB/Redis:
Comandos executados:
Resultado API:
Resultado frontend:
Resultado build:
Resultado Compose/health:
Falhas conhecidas:
Responsável:
Links/arquivos de evidência:
```

