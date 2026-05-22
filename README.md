# EJUG Notify — App TCC Gate 3

Sistema institucional para cadastro de contatos, turmas, templates e campanhas de notificação via **WhatsApp Business Platform / Cloud API**.

Repositório do projeto:

```txt
https://github.com/samuelvictorol/tcc-prti-samuelvictor
```

---

## 1. Contexto do projeto

O **EJUG Notify** é uma solução de software proposta para apoiar a **Escola Judicial de Goiás (EJUG/TJGO)** no envio de notificações, lembretes e comunicados institucionais para grandes grupos de alunos, servidores e participantes de cursos, eventos e turmas.

A motivação do projeto surgiu a partir de um problema prático: ferramentas baseadas em automação de WhatsApp Web ou uso de chips comuns apresentam alto risco de bloqueio por comportamento interpretado como spam, especialmente quando utilizadas para bases grandes de contatos.

A proposta do sistema é substituir esse modelo frágil por uma arquitetura profissional baseada na **WhatsApp Business Platform / Cloud API**, com:

- envio oficial via API da Meta;
- consentimento prévio dos contatos;
- templates de mensagens aprovados;
- controle de opt-out;
- fila assíncrona de envio;
- logs de auditoria;
- dashboard administrativo;
- segmentação por turmas/grupos;
- separação clara entre protótipo acadêmico e implantação produtiva.

---

## 2. O que este projeto entrega

- API Node.js/Express com MongoDB.
- Frontend Vue 3/Vite moderno e responsivo.
- Redis/BullMQ para fila de mensagens.
- Docker Compose com API, frontend, MongoDB e Redis.
- Estrutura com controllers, managers, DTOs, normalizers, services e models.
- Integração preparada para Meta WhatsApp Cloud API.
- Sistema resiliente: o app não quebra se as variáveis da Meta estiverem vazias.
- Aviso visual no frontend quando a integração Meta/WhatsApp ainda não está configurada.
- Modo acadêmico/local permitindo cadastro de contatos, turmas, templates e campanhas sem envio real.

---

## 3. O que o app faz

O sistema permite que administradores da EJUG cadastrem contatos, organizem esses contatos em grupos ou turmas, criem templates de notificações e preparem campanhas institucionais de forma controlada.

Principais funcionalidades:

- autenticação administrativa;
- dashboard inicial;
- cadastro e listagem de contatos;
- registro de consentimento para recebimento de mensagens;
- organização de contatos em grupos/turmas;
- criação de templates de mensagens;
- criação de campanhas de notificação;
- envio rápido de notificação;
- processamento assíncrono dos envios via fila;
- integração preparada para WhatsApp Cloud API;
- webhook para recebimento de eventos da Meta;
- logs e status das mensagens;
- aviso visual quando as credenciais da Meta ainda não estão configuradas.

Mesmo sem as variáveis da Meta configuradas, o sistema continua funcionando para navegação, cadastros, simulação de fluxo e validação acadêmica do MVP. O envio real é bloqueado de forma segura e o frontend informa que a integração oficial ainda não foi configurada.

---

## 4. Como funciona a integração pelo Meta/WhatsApp

O envio oficial **não utiliza QR Code, WhatsApp Web, pareamento de celular ou automação de chip**.

O fluxo correto é:

1. Criar um app no **Meta for Developers**.
2. Adicionar o produto **WhatsApp** ao app.
3. Criar ou vincular uma **WhatsApp Business Account (WABA)**.
4. Adicionar/verificar um número institucional.
5. Obter:
   - `WHATSAPP_PHONE_NUMBER_ID`;
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`;
   - `WHATSAPP_ACCESS_TOKEN`.
6. Configurar o webhook no painel da Meta.
7. Criar templates de mensagens.
8. Enviar mensagens por meio da Cloud API.

Fluxo simplificado:

```txt
Administrador
    ↓
Frontend EJUG Notify
    ↓
API Backend
    ↓
Campaign Manager
    ↓
Fila Redis/BullMQ
    ↓
WhatsApp Service
    ↓
Meta WhatsApp Cloud API
    ↓
Contato final
```

Quando uma mensagem é enviada, a Meta pode retornar eventos para o webhook do sistema, como:

- mensagem enviada;
- mensagem entregue;
- mensagem lida;
- falha no envio;
- resposta do usuário;
- solicitação de opt-out.

---

## 5. Modelo de dados explicado

O modelo de dados foi pensado para separar claramente contatos, grupos, templates, campanhas, mensagens e consentimentos.

### 5.1 User/Admin

Representa o usuário administrativo que acessa o painel.

Campos principais:

- `name`: nome do administrador;
- `email`: e-mail de login;
- `passwordHash`: senha criptografada;
- `role`: perfil de acesso;
- `createdAt`: data de criação.

Uso:

- autenticação;
- controle administrativo;
- auditoria futura.

---

### 5.2 Contact

Representa uma pessoa que pode receber notificações.

Campos principais:

- `name`: nome do contato;
- `phone`: telefone normalizado;
- `email`: e-mail opcional;
- `document`: CPF, matrícula ou identificador opcional;
- `source`: origem do cadastro;
- `hasOptIn`: indica se autorizou receber mensagens;
- `optInAt`: data do aceite;
- `optOutAt`: data de saída;
- `createdAt`: data de cadastro.

Uso:

- base de destinatários;
- controle de consentimento;
- segmentação por grupos.

---

### 5.3 Group

Representa uma turma, curso, evento ou agrupamento institucional.

Campos principais:

- `name`: nome do grupo/turma;
- `description`: descrição;
- `contacts`: contatos vinculados;
- `status`: ativo/inativo;
- `createdAt`: data de criação.

Exemplos:

- Curso de Formação Inicial;
- Turma EJUG 2026;
- Evento de Capacitação;
- Grupo de Magistrados;
- Grupo de Servidores.

---

### 5.4 MessageTemplate

Representa um modelo de mensagem usado em campanhas.

Campos principais:

- `name`: nome interno do template;
- `category`: categoria da mensagem;
- `body`: conteúdo da mensagem;
- `variables`: variáveis dinâmicas;
- `metaTemplateName`: nome do template aprovado na Meta;
- `language`: idioma;
- `status`: status interno.

Exemplo de mensagem:

```txt
Olá, {{nome}}!

Este é um lembrete da EJUG:
sua aula "{{curso}}" acontecerá em {{data}}, às {{hora}}.

Local/link: {{link}}
```

Uso:

- padronizar comunicação;
- reduzir risco de mensagens indevidas;
- preparar compatibilidade com templates oficiais da Meta.

---

### 5.5 Campaign

Representa uma campanha de envio.

Campos principais:

- `name`: nome da campanha;
- `group`: grupo/turma alvo;
- `template`: template utilizado;
- `status`: rascunho, agendada, processando, concluída ou cancelada;
- `scheduledAt`: data/hora de envio;
- `createdBy`: administrador responsável;
- `stats`: estatísticas de envio.

Uso:

- organizar disparos;
- controlar lotes;
- auditar comunicações institucionais.

---

### 5.6 MessageLog

Representa cada envio individual gerado por uma campanha.

Campos principais:

- `campaign`: campanha relacionada;
- `contact`: contato destinatário;
- `phone`: telefone usado no envio;
- `status`: pendente, enviado, entregue, lido, falhou ou bloqueado;
- `providerMessageId`: identificador retornado pela Meta;
- `errorMessage`: erro, quando houver;
- `sentAt`: data de envio;
- `deliveredAt`: data de entrega;
- `readAt`: data de leitura.

Uso:

- rastreabilidade;
- relatórios;
- reprocessamento;
- auditoria.

---

### 5.7 ConsentLog

Registra eventos de consentimento.

Campos principais:

- `contact`: contato relacionado;
- `type`: opt-in ou opt-out;
- `source`: origem do consentimento;
- `details`: detalhes adicionais;
- `createdAt`: data do registro.

Uso:

- LGPD;
- auditoria;
- comprovação de consentimento;
- controle de descadastro.

---

## 6. Estrutura de pastas

A estrutura foi organizada para facilitar manutenção, evolução e clareza arquitetural.

```txt
/
├── api/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── dtos/
│   │   ├── enums/
│   │   ├── errors/
│   │   ├── jobs/
│   │   ├── managers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── normalizers/
│   │   ├── queues/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── boot/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── router/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.vue
│   │   └── main.js
│   ├── Dockerfile
│   └── package.json
│
├── docs/
├── docker-compose.yml
├── .env
├── .env.example
└── README.md
```

---

## 7. Organização interna da API

### 7.1 Controllers

Os controllers recebem as requisições HTTP e delegam a regra de negócio para os managers.

Exemplo:

```txt
contact.controller.js
    ↓
contact.manager.js
```

Responsabilidades dos controllers:

- receber parâmetros;
- chamar manager adequado;
- retornar resposta HTTP;
- tratar erros de forma padronizada.

---

### 7.2 Managers

Os managers concentram as regras de negócio.

Exemplos:

- `contact.manager.js`;
- `group.manager.js`;
- `template.manager.js`;
- `campaign.manager.js`;
- `message.manager.js`;
- `webhook.manager.js`.

Responsabilidades dos managers:

- validar regras de negócio;
- consultar models;
- orquestrar ações;
- impedir operações inválidas;
- preparar dados para filas ou serviços externos.

---

### 7.3 DTOs

Os DTOs controlam quais dados entram e saem da API.

Objetivos:

- evitar tráfego desnecessário;
- proteger dados sensíveis;
- padronizar resposta dos endpoints;
- desacoplar banco de dados da API pública.

Exemplos:

- `contact.dto.js`;
- `campaign.dto.js`;
- `template.dto.js`;
- `message.dto.js`.

---

### 7.4 Normalizers

Os normalizers tratam dados antes de salvar ou consultar.

Exemplos:

- normalização de telefone;
- limpeza de texto;
- normalização de paginação;
- conversão de termos de busca.

Isso evita deixar lógica de formatação espalhada em controllers ou managers.

---

### 7.5 Services

Os services isolam integrações externas.

Principal exemplo:

- `whatsapp.service.js`.

Responsabilidades:

- montar payload para Meta;
- enviar mensagem para Cloud API;
- validar configuração;
- tratar erros de provider;
- retornar resultado padronizado.

---

### 7.6 Queues e Jobs

A fila evita que uma campanha grande trave a API.

Componentes:

- Redis;
- BullMQ;
- `message.queue.js`;
- `message.worker.js`.

Fluxo:

```txt
Campanha criada
    ↓
Contatos elegíveis buscados
    ↓
Jobs individuais adicionados na fila
    ↓
Worker processa mensagens
    ↓
WhatsApp Service envia pela API
    ↓
Status é salvo no banco
```

---

## 8. Como rodar localmente

### 8.1 Pré-requisitos

Instale:

- Docker;
- Docker Compose;
- Git;
- Node.js, opcional para rodar fora do Docker.

---

### 8.2 Subir o ambiente completo

Na raiz do projeto:

```bash
docker compose down -v
docker compose up
```

Serviços esperados:

```txt
Frontend: http://localhost:5173
API Health: http://localhost:3000/api/health
MongoDB: mongodb://localhost:27017
Redis: redis://localhost:6379
```

> Observação: a versão local do Docker Compose pode ser mantida sem `build`, usando imagens base `node:20-alpine`, para reduzir problemas de travamento no BuildKit/provenance.

---

### 8.3 Criar usuário administrador

Após os containers subirem, em outro terminal:

```bash
docker compose exec api npm run seed
```

Credenciais locais:

```txt
E-mail: admin@ejug.local
Senha: admin123
```

---

### 8.4 Acessar o painel

Abra:

```txt
http://localhost:5173
```

Faça login e utilize os módulos disponíveis:

- Dashboard;
- Contatos;
- Grupos/Turmas;
- Templates;
- Campanhas;
- Notificação rápida.

---

## 9. Caso o Docker trave no BuildKit/provenance

Se o ambiente local ainda estiver usando `build:` em algum compose antigo ou Dockerfile, pode ocorrer travamento em etapas como `resolving provenance for metadata file`.

PowerShell:

```powershell
$env:DOCKER_BUILDKIT=0
$env:COMPOSE_DOCKER_CLI_BUILD=0
docker compose up
```

Git Bash:

```bash
DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose up
```

Também é recomendado verificar se não existem arquivos adicionais como:

```txt
docker-compose.override.yml
compose.yml
compose.yaml
```

---

## 10. Variáveis de ambiente

Arquivo base:

```txt
.env.example
```

Crie o `.env` quando necessário:

```bash
cp .env.example .env
```

### 10.1 Variáveis gerais

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:5173
API_URL=http://localhost:3000/api
```

Descrição:

- `NODE_ENV`: ambiente da aplicação;
- `PORT`: porta da API;
- `APP_URL`: URL do frontend;
- `API_URL`: URL pública da API.

---

### 10.2 Banco de dados e fila

```env
MONGO_URI=mongodb://mongo:27017/ejug_notify
REDIS_URL=redis://redis:6379
```

Descrição:

- `MONGO_URI`: conexão com MongoDB;
- `REDIS_URL`: conexão com Redis usado pela fila BullMQ.

---

### 10.3 Autenticação

```env
JWT_SECRET=troque-essa-chave-em-producao
JWT_EXPIRES_IN=8h
```

Descrição:

- `JWT_SECRET`: chave usada para assinar tokens;
- `JWT_EXPIRES_IN`: tempo de expiração do login.

Em produção, gere uma chave forte:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 10.4 WhatsApp Cloud API

```env
WHATSAPP_API_VERSION=v20.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=ejug-local-verify-token
```

Descrição:

- `WHATSAPP_API_VERSION`: versão da Graph API;
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número no painel da Meta;
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: ID da conta WhatsApp Business;
- `WHATSAPP_ACCESS_TOKEN`: token de acesso da Meta;
- `WHATSAPP_VERIFY_TOKEN`: token criado pelo próprio desenvolvedor para validar webhook.

Importante:

- se essas variáveis não estiverem configuradas, o app não quebra;
- o backend retorna status informando ausência de configuração;
- o frontend exibe aviso;
- cadastros e fluxos internos continuam disponíveis;
- apenas o envio real pela Meta fica indisponível.

---

### 10.5 Controle da fila

```env
MESSAGE_RATE_LIMIT_PER_SECOND=10
MESSAGE_MAX_RETRIES=3
MESSAGE_RETRY_BACKOFF_MS=30000
```

Descrição:

- `MESSAGE_RATE_LIMIT_PER_SECOND`: limite interno de processamento por segundo;
- `MESSAGE_MAX_RETRIES`: número máximo de tentativas;
- `MESSAGE_RETRY_BACKOFF_MS`: intervalo entre novas tentativas.

Esse controle é usado para estabilidade, governança e respeito aos limites da API oficial.

---

### 10.6 Janela de envio

```env
DEFAULT_CAMPAIGN_WINDOW_START=08:00
DEFAULT_CAMPAIGN_WINDOW_END=18:00
```

Descrição:

- define uma janela padrão para campanhas;
- evita envio fora do horário institucional;
- pode ser evoluído para regras por turma, evento ou perfil.

---

### 10.7 Opt-out

```env
OPT_OUT_KEYWORDS=SAIR,PARAR,CANCELAR,STOP
```

Descrição:

- palavras que indicam descadastro;
- ao receber uma dessas respostas, o sistema pode marcar o contato como opt-out;
- impede novos envios para contatos descadastrados.

---

## 11. Segurança

A solução adota princípios de segurança desde o MVP.

### 11.1 Autenticação

- login administrativo com JWT;
- senha armazenada com hash;
- rotas administrativas protegidas;
- separação entre usuário autenticado e ações públicas de webhook.

---

### 11.2 Proteção de dados

- uso de DTOs para evitar exposição excessiva;
- não trafegar senha ou hash nas respostas;
- separação entre dados internos e dados retornados ao frontend;
- possibilidade de ocultar campos sensíveis em respostas públicas.

---

### 11.3 Consentimento e LGPD

O sistema foi desenhado considerando:

- registro de opt-in;
- registro de opt-out;
- origem do consentimento;
- data/hora do aceite;
- bloqueio de envio para contatos sem consentimento;
- trilha de auditoria.

Em contexto institucional, a base legal e as regras de tratamento devem ser validadas com a área jurídica/responsável pela proteção de dados.

---

### 11.4 Webhook

O webhook da Meta utiliza `WHATSAPP_VERIFY_TOKEN` para validação inicial.

Fluxo:

```txt
Meta envia desafio de verificação
    ↓
API compara verify token recebido com o .env
    ↓
Se for válido, responde o challenge
    ↓
Webhook é ativado
```

---

### 11.5 Evita automação não oficial

O sistema não utiliza:

- WhatsApp Web;
- leitura de QR Code;
- simulação de usuário;
- múltiplos chips;
- automação de navegador;
- técnicas para burlar bloqueio.

A proposta é baseada em:

- WhatsApp Business Platform;
- API oficial;
- templates;
- consentimento;
- logs;
- governança.

---

## 12. Tecnologias utilizadas

### Backend

- Node.js;
- Express;
- MongoDB;
- Mongoose;
- Redis;
- BullMQ;
- JWT;
- bcrypt;
- Axios;
- dotenv;
- CORS;
- Helmet;
- Morgan.

### Frontend

- Vue 3;
- Vite;
- Vue Router;
- JavaScript;
- Axios;
- CSS responsivo;
- estrutura modular de páginas, services, composables e componentes.

### Infraestrutura local

- Docker;
- Docker Compose;
- containers separados para API, frontend, MongoDB e Redis.

### Integração externa

- Meta for Developers;
- WhatsApp Business Platform;
- WhatsApp Cloud API;
- Webhooks da Meta.

---

## 13. Fluxo funcional do sistema

### 13.1 Cadastro de contato

```txt
Administrador cadastra contato
    ↓
Telefone é normalizado
    ↓
Contato é salvo no MongoDB
    ↓
DTO retorna dados seguros ao frontend
```

### 13.2 Registro de consentimento

```txt
Contato autoriza mensagens
    ↓
Sistema marca hasOptIn = true
    ↓
Registra data/hora
    ↓
Cria ConsentLog
```

### 13.3 Criação de grupo/turma

```txt
Administrador cria turma
    ↓
Seleciona contatos
    ↓
Sistema vincula contatos à turma
    ↓
Turma fica disponível para campanhas
```

### 13.4 Criação de template

```txt
Administrador cria template
    ↓
Define texto e variáveis
    ↓
Sistema salva modelo interno
    ↓
Em produção, template correspondente deve existir/aprovar na Meta
```

### 13.5 Criação e envio de campanha

```txt
Administrador cria campanha
    ↓
Seleciona grupo/turma
    ↓
Seleciona template
    ↓
Sistema busca contatos elegíveis
    ↓
Cria jobs individuais na fila
    ↓
Worker processa cada mensagem
    ↓
WhatsApp Service envia pela Meta
    ↓
Status é salvo no banco
```

### 13.6 Recebimento de status via webhook

```txt
Meta envia evento ao webhook
    ↓
API identifica mensagem
    ↓
Atualiza status
    ↓
Registra evento/log
    ↓
Dashboard pode exibir resultado
```

---

## 14. Diferenciais da proposta

- Solução alinhada ao uso oficial do WhatsApp;
- redução do risco de bloqueio de chips;
- arquitetura preparada para grandes bases;
- rastreabilidade das comunicações;
- governança de consentimento;
- separação clara de responsabilidades;
- potencial de expansão para outras escolas judiciais;
- compatível com evolução para SaaS institucional;
- fácil execução local via Docker Compose.

---

## 15. Limitações do MVP

Nesta etapa do Gate 3, o projeto representa uma base técnica inicial e funcional, mas ainda possui limitações esperadas:

- envio real depende de credenciais da Meta;
- templates oficiais ainda precisam ser aprovados no painel da Meta;
- dashboard pode ser evoluído;
- permissões por perfil podem ser refinadas;
- auditoria pode receber mais granularidade;
- integração com sistemas internos da EJUG ainda não foi implementada;
- homologação jurídica/LGPD depende da instituição.

---

## 16. Próximos passos

Evoluções recomendadas:

- implementar perfis de acesso;
- criar dashboard analítico de entregabilidade;
- importar contatos via CSV;
- criar módulo de aprovação interna de campanhas;
- integrar templates oficiais da Meta;
- permitir agendamento de campanhas;
- implementar logs avançados;
- criar relatórios em PDF;
- integrar com sistemas acadêmicos da EJUG;
- estruturar ambiente de homologação;
- preparar deploy em nuvem;
- formalizar documentação de LGPD e governança.

---

## 17. Resumo executivo

O **EJUG Notify** propõe uma solução institucional para comunicação em larga escala via WhatsApp, substituindo métodos frágeis baseados em chips e WhatsApp Web por uma arquitetura oficial com API da Meta, fila de processamento, consentimento, templates, logs e dashboard.

A solução atende ao objetivo do Gate 3 por apresentar:

- primeiros módulos do sistema;
- modelo de dados inicial;
- estrutura técnica organizada;
- documentação do funcionamento;
- ambiente local reproduzível;
- repositório de código disponível;
- base para evolução acadêmica e produtiva.
