# Checklist de entrega — Gate 5

Use este documento como conferência final do produto de software e do relatório técnico. Ele separa **evidência já verificada** de itens que dependem de revisão humana ou do ambiente de destino.

## 1. Identificação acadêmica

- [ ] Nome do discente, orientador, curso/programa, instituição e ano conferidos no relatório.
- [ ] Título do trabalho idêntico na capa, folha de rosto, metadados e nome do arquivo.
- [ ] Modalidade de entrega confirmada como projeto de aplicação/produto de software.
- [ ] Sumário, listas, numeração de páginas e referências atualizados após a última edição.
- [ ] Ortografia, coerência das siglas e conformidade com o modelo institucional revisadas.
- [ ] DOCX final abre sem alerta de reparo.
- [ ] PDF final foi gerado a partir do DOCX aprovado e inspecionado página a página.

## 2. Artefatos obrigatórios deste pacote

- [ ] `README.md` da raiz funciona como sumário do projeto.
- [ ] `docs/README.md` funciona como índice da documentação técnica.
- [ ] Relatório Técnico do Gate 5 em DOCX presente em `docs/`.
- [ ] Relatório Técnico do Gate 5 em PDF presente em `docs/`.
- [ ] `docs/ARCHITECTURE.md` revisado contra o código entregue.
- [ ] `docs/DEPLOYMENT.md` testado em um ambiente limpo ou equivalente.
- [ ] `docs/TESTING-AND-EVIDENCE.md` contém comandos e resultados reproduzíveis.
- [ ] `docs/SECURITY-PRIVACY.md` contém riscos, controles e responsabilidades.
- [ ] `api/README.md` e `frontend/README.md` descrevem os respectivos módulos.
- [ ] `docs/app-media/` contém apenas evidências selecionadas e anonimizadas.
- [x] Nenhum novo conjunto de slides foi solicitado para esta preparação documental.

## 3. Evidência técnica verificada em 14/08/2026

- [x] API: `npm run check` concluído, incluindo lint sem warnings.
- [x] API: 374 testes automatizados aprovados.
- [x] Frontend: 244 testes automatizados aprovados.
- [x] Total atual: 618 testes automatizados aprovados.
- [x] Frontend: `npm run build` concluído com Vite e 405 módulos transformados.
- [x] Compose: `docker compose config --quiet` concluído sem erro.
- [x] Marco histórico do Gate 4 documentado: 514 testes (322 API + 192 frontend).
- [x] Ensaio funcional com aproximadamente 20 a 30 usuários simultâneos registrado como bem-sucedido.
- [x] O ensaio funcional não é apresentado como benchmark, SLA ou teste formal de carga.

## 4. Reexecução recomendada antes do envio

Na raiz do projeto:

```powershell
Set-Location api
npm ci
npm run check

Set-Location ..\frontend
npm ci
npm test
npm run build

Set-Location ..
docker compose config --quiet
```

Quando houver ambiente Docker disponível:

```powershell
Copy-Item .env.example .env
# Preencha apenas valores locais/temporários.
docker compose up --build -d
docker compose ps
Invoke-WebRequest http://localhost:8080/healthz
Invoke-WebRequest http://localhost:8080/api/health
```

- [ ] Todos os comandos acima foram executados após a última alteração de código.
- [ ] Falhas, warnings relevantes e diferenças de ambiente foram documentados.
- [ ] O smoke test validou login, contatos, templates, envio, fila, webhooks e opt-out.
- [ ] Containers foram encerrados de forma segura após o teste, quando aplicável.

## 5. Critérios funcionais de aceite

- [ ] Configurações de Telegram, WhatsApp Cloud e Gmail são independentes.
- [ ] Canal incompleto não impede o uso dos canais configurados.
- [ ] Contato sem consentimento não recebe campanha naquele canal e gera motivo auditável.
- [ ] Disparo global aceita um, dois ou três canais, conforme os templates selecionados.
- [ ] Uma falha externa individual não interrompe as demais entregas do lote.
- [ ] Receipts do WhatsApp atualizam o estado da entrega correspondente.
- [ ] Resposta livre do WhatsApp respeita a janela de atendimento de 24 horas.
- [ ] Telegram e WhatsApp exibem mensagens recebidas e comandos suportados.
- [ ] `/notify-me`, `/login`, `/meu-perfil`, `/help` e comandos de revogação foram verificados.
- [ ] Convites, grupos e conjuntos de templates preservam seus vínculos.
- [ ] `/meu-perfil` restringe o titular aos próprios dados, consentimentos e histórico.
- [ ] Exportação/limpeza de armazenamento exige confirmação e gera registro administrativo.
- [ ] Upload de mídia bloqueia o salvamento enquanto está em andamento e limpa mídia órfã quando aplicável.
- [ ] Marca white-label permanece consistente em telas públicas e administrativas.

## 6. Segurança, privacidade e segredos

- [ ] Nenhum `.env` real está dentro do pacote.
- [ ] Tokens da Meta/Telegram, app passwords, JWTs, URIs e chaves foram revogados ou removidos de prints e logs.
- [ ] `.env.example` contém apenas placeholders seguros.
- [ ] CORS e `PUBLIC_APP_URL` apontam para o domínio HTTPS correto do ambiente.
- [ ] Verify token, app secret e webhook secret foram configurados fora do Git.
- [ ] Cookies seguros e `TRUST_PROXY` estão adequados à borda HTTPS.
- [ ] MongoDB exige TLS, autenticação e restrição de rede.
- [ ] Redis não está exposto publicamente.
- [ ] Imagens e vídeos em `docs/app-media/` foram anonimizados.
- [ ] Política de retenção e procedimento de atendimento ao titular foram aprovados pela organização responsável.
- [ ] Backup e restauração foram testados sem reutilizar dados pessoais de produção.

## 7. WhatsApp Cloud / Meta

- [ ] WABA, Phone Number ID e número público pertencem ao mesmo ambiente configurado.
- [ ] App está no modo adequado e com permissões/revisão correspondentes ao teste.
- [ ] Webhook HTTPS foi verificado e o campo `messages` está assinado.
- [ ] Templates usados na demonstração existem, estão aprovados e usam nome/idioma idênticos.
- [ ] Ordem, tipo e quantidade dos parâmetros correspondem ao modelo aprovado.
- [ ] URLs dinâmicas contêm somente o sufixo aceito pela Meta.
- [ ] Método de pagamento e limites da conta foram conferidos, quando necessários.
- [ ] Erros externos são exibidos como retorno do provedor, sem prometer entrega.

## 8. Telegram e Gmail

- [ ] Bot Telegram identificado com `getMe` e webhook HTTPS registrado com segredo.
- [ ] O bot não tenta iniciar conversa privada com usuário que nunca interagiu.
- [ ] Mídia Telegram usa URL pública validada ou upload suportado.
- [ ] Gmail usa app password/credencial adequada e remetente autorizado.
- [ ] HTML de email está sanitizado e a versão textual é coerente.
- [ ] Email opcional de aviso de mensagem recebida foi testado sem criar loop de notificações.

## 9. Implantação e operação

- [ ] `render.yaml` foi revisado no dashboard antes da sincronização do Blueprint.
- [ ] Frontend, API privada e Key Value estão na mesma região.
- [ ] `MONGODB_URI` é fornecida pelo ambiente e não pelo repositório.
- [ ] Health checks `/healthz` e `/api/health` estão verdes.
- [ ] Proxy `/api` e `/socket.io` funciona pelo mesmo domínio do frontend.
- [ ] Logs de deploy não revelam segredos.
- [ ] Plano de rollback identifica imagem/commit estável e estratégia de migração compatível.
- [ ] Limites e custos atuais dos provedores foram revistos nas fontes oficiais.

## 10. Preparação do arquivo de entrega

Não compacte diretamente a pasta de trabalho. Use o empacotador controlado da raiz:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-gate5.ps1
```

- [ ] `scripts/package-gate5.ps1` foi executado a partir da raiz do repositório.
- [ ] A raiz `notify-app/` não foi enviada por `Compress-Archive`, Explorador de Arquivos ou ferramenta equivalente sem filtragem.

- [ ] Código-fonte, lockfiles, Dockerfiles, Compose, Blueprint e documentação incluídos.
- [ ] `.git/`, `.env*` reais, `node_modules/`, `dist/`, `coverage/`, caches e logs excluídos.
- [ ] Temporários de ferramentas e artefatos intermediários excluídos.
- [ ] Dumps, uploads e backups reais excluídos ou substituídos por amostras anônimas.
- [ ] Arquivo final aberto em outra pasta/máquina para conferir integridade.
- [ ] Conteúdo do ZIP comparado com as exclusões previstas pelo script.
- [ ] Hash SHA-256 calculado e anotado no protocolo de entrega, se aceito pela instituição.
- [ ] URL do repositório conferida: <https://github.com/samuelvictorol/tcc-prti-samuelvictor>.

Exemplo para calcular o hash:

```powershell
Get-FileHash .\Notify-Flow-Gate-5.zip -Algorithm SHA256
```

## 11. Declaração de limites

- [ ] O relatório diferencia testes automatizados, smoke tests, ensaios funcionais e benchmarks.
- [ ] Não há alegação de conformidade jurídica automática com a LGPD.
- [ ] Não há garantia de entrega ou imunidade a bloqueios por provedores.
- [ ] Não há promessa de capacidade superior àquela efetivamente testada.
- [ ] Dependências externas, custos e políticas mutáveis estão explicitados.
