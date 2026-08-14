# Segurança, privacidade e governança de dados

## 1. Propósito e limites

O Notify Flow incorpora controles técnicos para consentimento, segregação de acesso, retenção e rastreabilidade. Esses controles **não tornam uma implantação automaticamente conforme à LGPD**. A organização controladora continua responsável por finalidade, base legal, transparência, contratos, encarregado, atendimento ao titular, segurança operacional e resposta a incidentes.

Este documento descreve a implementação observada no repositório em 14 de agosto de 2026 e os controles que devem existir no ambiente.

## 2. Papéis e atores

| Ator | Papel no sistema |
|---|---|
| Administrador | configura provedores, cadastra conteúdo, segmenta e inicia campanhas. |
| Contato/titular | autoriza canais, recebe mensagens, consulta dados e revoga permissões. |
| Organização operadora | define finalidade, público, conteúdo, retenção e procedimento de atendimento. |
| Provedores | Meta/WhatsApp, Telegram, Gmail, Render e MongoDB processam dados conforme seus termos. |
| Notify Flow | produto que orquestra as integrações e registra evidências operacionais. |

A definição jurídica de controlador e operador depende da implantação e dos contratos; não deve ser presumida apenas a partir do código.

## 3. Dados tratados

| Categoria | Exemplos | Finalidade técnica |
|---|---|---|
| Identificação | nome, telefone, email, username e IDs de provedor | correlacionar o destino e evitar duplicidade. |
| Consentimento | canal, estado, origem, data, comando e alteração administrativa | decidir elegibilidade e demonstrar a mudança. |
| Segmentação | convites, grupos e origem de entrada | selecionar públicos e explicar associação. |
| Comunicação | texto, mídia, metadados e identificadores de mensagem | compor envio, mostrar conversa e processar resposta. |
| Entrega | status, tentativas, erro, receipt e timestamps | operar fila e produzir auditoria. |
| Autenticação | email administrativo, hashes, refresh token, challenge e sessão de perfil | restringir acesso. |
| Configuração | IDs, segredos cifrados, marca e links | integrar provedores e personalizar a instância. |
| Operação | request ID, logs, eventos de webhook e auditoria de armazenamento | diagnóstico, segurança e governança. |

Evite inserir dados sensíveis ou excessivos em templates, logs, descrições de operador e nomes de arquivo.

## 4. Consentimento e regras de canal

### 4.1 Princípio

Uma identidade conhecida não equivale, por si só, a consentimento de campanha. O worker revalida:

- configuração do provedor;
- identidade real do canal;
- consentimento atual;
- estado do contato e do grupo;
- compatibilidade do conteúdo.

Uma entrega sem consentimento é marcada como ignorada, com motivo, sem interromper canais elegíveis.

### 4.2 WhatsApp Cloud

- O contato pode conceder autorização pelo comando configurado, pelo Meu perfil ou por ação administrativa confirmada.
- Mensagem livre de atendimento respeita a janela de 24 horas aberta pelo usuário.
- Fora da janela, a organização usa template aprovado, observando categoria, qualidade, cobrança e políticas da Meta.
- O recebimento de um evento técnico/unsupported não deve criar automaticamente um contato confiável.

### 4.3 Telegram

- O bot não inicia conversa privada arbitrária; o usuário precisa interagir.
- O `chat_id` conhecido permite resposta do bot, mas campanhas continuam sujeitas ao consentimento registrado pelo produto.
- Bloqueio do bot, `/stop` ou erro permanente devem revogar/impedir a elegibilidade correspondente.

### 4.4 Email

- Email conhecido não significa autorização automática para campanha.
- Quando o titular confirma um novo email pelo fluxo de chat, a aplicação pode ativar o consentimento de email conforme a jornada informada ao usuário.
- Opt-out precisa prevalecer sobre jobs ainda não enviados.

## 5. Autenticação e autorização

### Administrador

- senha armazenada por hash, nunca em texto no banco;
- access JWT de curta duração;
- refresh token revogável em cookie `HttpOnly`;
- `Secure` em produção HTTPS e política de cookie controlada;
- rate limit e bloqueio temporário contra tentativas abusivas;
- rotas administrativas protegidas por middleware de autenticação.

### Contato / Meu perfil

- fluxo separado da sessão administrativa;
- link assinado e de uso controlado para acesso por telefone/Telegram/email;
- validade padrão configurável, atualmente de até sete dias para link e sessão;
- segredo transportado no fragmento da URL quando aplicável, reduzindo exposição em logs HTTP;
- API retorna apenas dados do próprio contato autenticado;
- telefone de integrantes de grupos é mascarado na apresentação ao titular.

Links de acesso não devem ser encaminhados, registrados em analytics ou incluídos em screenshots.

## 6. Segredos e criptografia

### Em repouso na aplicação

Credenciais cadastradas pela interface são persistidas como settings protegidos e não devem voltar integralmente em consultas comuns. A UI recebe estado mascarado/configurado; a revelação administrativa usa rota específica e rate limit.

As finalidades de segredo são separadas:

- assinatura de access/refresh JWT;
- sessão do Meu perfil;
- criptografia de settings;
- hash de índices pesquisáveis;
- tokens de convite/perfil;
- verify token/app secret da Meta;
- secret token do Telegram.

### Em trânsito

Produção exige HTTPS. API, frontend e WebSocket usam o mesmo domínio público no Render. MongoDB Atlas deve exigir TLS; Redis deve permanecer privado.

### Em código e entrega

- `.env` é ignorado pelo Git;
- `.env.example` contém somente nomes e placeholders;
- `render.yaml` usa `sync: false`, geração de valor e referências entre serviços;
- variáveis `VITE_*` nunca podem conter segredo, pois entram no bundle público.

Se um segredo real já apareceu em commit, chat, print ou log, apenas removê-lo do arquivo não basta: ele deve ser revogado/rotacionado.

## 7. Validação de entrada e segurança HTTP

Controles presentes incluem:

- Zod nos DTOs;
- Helmet e headers de segurança;
- CORS por origem configurada;
- sanitização contra operadores Mongo indevidos;
- proteção contra HTTP parameter pollution;
- compressão, cookies e limites de requisição;
- rate limits separados para autenticação, API e webhooks;
- request ID e envelope de erro sem stack para o usuário final;
- sanitização de HTML para conteúdo permitido.

O frontend não é fronteira de segurança: validações de formulário e guards melhoram UX, mas o backend repete a autorização e a validação.

## 8. Webhooks

| Canal | Controle |
|---|---|
| WhatsApp Cloud | desafio GET com verify token; POST verificado com app secret/assinatura quando configurado; deduplicação por identificador do provedor. |
| Telegram | secret token no header, webhook HTTPS e processamento idempotente dos updates relevantes. |

Boas práticas:

- responda rapidamente e processe trabalho pesado de forma assíncrona;
- não registre headers de autorização/assinatura integralmente;
- preserve payload técnico somente pelo tempo necessário;
- trate repetição e desordem de eventos;
- rejeite assinatura inválida antes de alterar contato ou consentimento;
- monitore aumento de falhas e origens inesperadas.

## 9. Mídia e SSRF

URLs externas de mídia são uma superfície de SSRF e consumo de recurso. O serviço de mídia segura:

- exige protocolo suportado;
- resolve e valida o destino;
- bloqueia redes privadas, loopback e faixas reservadas;
- revalida redirecionamentos;
- limita tempo, tamanho e tipo real do conteúdo;
- aplica limites distintos para foto e vídeo;
- fornece URLs controladas/assinadas para mídia armazenada.

Uploads administrativos têm limite multipart e validação de tipo. O frontend bloqueia o salvamento do template enquanto o upload está pendente.

Ao apagar mídia, a aplicação deve primeiro verificar referências em templates, marca e envios. Mídia órfã pode ser removida após o período de segurança implementado.

## 10. Retenção e descarte

Valores abaixo representam defaults/índices observados e precisam ser conferidos no ambiente:

| Dado | Retenção técnica atual |
|---|---|
| notificações da central administrativa | 30 dias |
| alertas de webhook enviados por email | 30 dias |
| mensagens/conversas WhatsApp locais | 30 dias operacionais |
| backups de conversa | 90 dias por padrão configurável |
| logs gerais | 180 dias por padrão |
| receipts de provedor | 7 dias |
| atribuição de convite | janela de até 90 dias |
| link/sessão de Meu perfil | até 7 dias por padrão configurável |
| código de confirmação de email no chat | 15 minutos por padrão; reenvio limitado |
| mídia temporária de rascunho | ciclo curto, com limpeza de órfãos |

Índices TTL do MongoDB executam de forma assíncrona; expiração lógica deve ser validada pela aplicação e não depende de remoção física instantânea.

Antes de alterar retenção, considere finalidade, obrigação legal, suporte, contestação, custo e expectativa do titular.

## 11. Direitos e transparência do titular

O Meu perfil permite ao contato:

- consultar dados de identificação disponíveis;
- revisar permissões por canal;
- revogar consentimento;
- consultar histórico próprio de notificações;
- visualizar convites e grupos relacionados;
- sair do próprio grupo ou remover o próprio vínculo de convite, com confirmação;
- atualizar dados permitidos pelo fluxo.

Ativação de Telegram ou WhatsApp depende de interação real com o canal; a interface não deve fabricar um destino inexistente.

O sistema também oferece documentos legais públicos. A organização deve manter texto, versão, vigência e canal de contato coerentes com sua operação.

## 12. Exportação e limpeza administrativa

A tela White-label oferece administração de armazenamento por coleção e geral. Essas ações são sensíveis:

- exportação pode conter dados pessoais e deve ser autorizada, protegida e descartada;
- ZIP de mídia deve usar nomes seguros, sem path traversal;
- limpeza exige confirmação explícita e escopo resolvido;
- uma trava de manutenção reduz concorrência durante a operação;
- cada exportação/limpeza gera evento de auditoria com horário e contexto;
- o log de auditoria não torna uma exclusão reversível.

Recomenda-se princípio de menor privilégio e, para produção, autenticação reforçada ou papel administrativo específico para operações destrutivas.

## 13. Modelo resumido de ameaças

| Ameaça | Impacto | Controles atuais | Tratamento adicional |
|---|---|---|---|
| credencial de provedor exposta | envio indevido e acesso externo | settings protegidos, máscara e segredo fora do frontend | rotação, vault e alerta de uso anômalo |
| bypass de consentimento | mensagem indevida/LGPD | revalidação no worker e evento de consentimento | testes contínuos e revisão de regras |
| webhook falsificado | contato/status adulterado | assinatura/secret token | métricas e bloqueio por origem/anomalia |
| duplicação de evento/job | envio repetido | idempotência, IDs do provedor e estado persistido | chave de negócio e reconciliação periódica |
| SSRF por mídia | acesso à rede interna | validação DNS/IP/redirecionamento | egress proxy/rede restrita |
| XSS em HTML | roubo de sessão | sanitização e CSP | testes DAST e política mais estrita |
| exportação administrativa indevida | vazamento em massa | autenticação, confirmação e auditoria | RBAC, MFA e criptografia do export |
| limpeza acidental | perda de dados | confirmação, escopo e trava | backup testado e dupla aprovação |
| indisponibilidade Redis | fila parada | `REDIS_REQUIRED`, estado em Mongo | HA, alerta e runbook |
| sessão/link roubado | acesso ao perfil | expiração, token separado e fragmento | uso único, revogação e MFA opcional |

## 14. Resposta a incidentes

Procedimento mínimo:

1. identificar e classificar o incidente;
2. preservar logs necessários sem ampliar exposição;
3. conter o vetor (revogar token, bloquear origem, pausar fila);
4. avaliar contatos, dados e canais afetados;
5. restaurar de fonte confiável e validar integridade;
6. notificar responsáveis jurídicos/segurança;
7. cumprir comunicações aplicáveis ao titular e à ANPD;
8. documentar causa raiz e ações preventivas.

Não apague logs ou banco antes de preservar evidências compatíveis com a política da organização.

## 15. Checklist de segurança para produção

- [ ] TLS e domínio válidos;
- [ ] secrets únicos, fortes e rotacionáveis;
- [ ] credenciais externas de menor privilégio;
- [ ] Atlas e Redis sem exposição pública desnecessária;
- [ ] backup e restauração testados;
- [ ] webhooks assinados e monitorados;
- [ ] CSP/CORS/cookies revisados no domínio final;
- [ ] rate limits ajustados ao tráfego legítimo;
- [ ] política de retenção aprovada;
- [ ] documentos legais publicados e coerentes;
- [ ] canal de atendimento ao titular definido;
- [ ] plano de incidente e contatos de escalonamento definidos;
- [ ] dependências e imagens verificadas;
- [ ] exportações e prints da entrega anonimizados.

## 16. Responsabilidade dos provedores

O contato também está sujeito aos termos e práticas de Meta/WhatsApp, Telegram, Google/Gmail, Render e MongoDB Atlas. A organização deve manter contratos, avisos e subprocessadores atualizados. Alterações de política externa podem exigir mudança de código e nova avaliação de impacto.

