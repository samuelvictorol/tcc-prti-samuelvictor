# Documentação técnica — Notify Flow / Gate 5

Este diretório reúne os artefatos técnicos do **Notify Flow**, produto de software desenvolvido por **Samuel Victor Oliveira Lima** no contexto do Trabalho de Conclusão de Curso e do Programa de Residência em Tecnologia da Informação da Universidade Federal de Goiás (UFG), em parceria com o Tribunal de Justiça do Estado de Goiás (TJGO).

O repositório canônico informado para a entrega é:

- [samuelvictorol/tcc-prti-samuelvictor](https://github.com/samuelvictorol/tcc-prti-samuelvictor)

O Gate 5 consolida o produto executável, sua documentação de arquitetura, implantação, testes, segurança, privacidade e evidências. Conforme a orientação desta entrega, **não foi produzido um novo conjunto de slides**; o foco deste pacote é a documentação técnica e profissional do produto.

## Visão do produto

O Notify Flow é uma plataforma web de notificações multicanal orientada a consentimento. Ela centraliza contatos, grupos, convites, templates, conversas, filas e evidências de entrega para:

- WhatsApp Cloud API oficial;
- Telegram Bot API;
- Gmail por SMTP.

O produto busca reduzir o acoplamento entre regra de negócio e provedores externos, evitar o uso de automações não oficiais para disparos de WhatsApp, preservar consentimentos por canal e produzir rastreabilidade operacional de cada entrega.

## Índice da entrega

| Artefato | Finalidade |
|---|---|
| [Relatório Técnico do Gate 5 — DOCX](Relatorio-Tecnico-Notify-Flow-Gate-5-Samuel-Victor-Oliveira-Lima.docx) | Fonte editável do relatório final, mantendo a identidade acadêmica do Gate 4. |
| [Relatório Técnico do Gate 5 — PDF](Relatorio-Tecnico-Notify-Flow-Gate-5-Samuel-Victor-Oliveira-Lima.pdf) | Versão para leitura e depósito, sujeita à conferência institucional final. |
| [Checklist do Gate 5](GATE-5-CHECKLIST.md) | Conferência técnica, documental e de empacotamento antes da entrega. |
| [Arquitetura](ARCHITECTURE.md) | Componentes, fluxos, persistência, filas, realtime e decisões arquiteturais. |
| [Implantação](DEPLOYMENT.md) | Execução local, Docker, Render Blueprint, webhooks, operação e rollback. |
| [Testes e evidências](TESTING-AND-EVIDENCE.md) | Evidências reproduzíveis, evolução do Gate 4 e roteiro de validação manual. |
| [Segurança e privacidade](SECURITY-PRIVACY.md) | Controles técnicos, LGPD, retenção, riscos e responsabilidades operacionais. |
| [Regras dos canais](CHANNELS.md) | Limitações e políticas técnicas dos provedores. |
| [Mídias do aplicativo](app-media/README.md) | Convenção para armazenar prints e vídeos de demonstração sem expor dados. |
| [API](../api/README.md) | Organização interna, rotas, filas, webhooks, segurança e testes do backend. |
| [Frontend](../frontend/README.md) | Páginas, serviços, estado, realtime, build e proxy Nginx. |

> As versões DOCX e PDF foram geradas e conferidas visualmente. Antes do envio institucional, use o checklist para uma última conferência de identificação, nomes dos arquivos e integridade do pacote.

## Evidências consolidadas

Em **14 de agosto de 2026**, a validação automatizada disponível registrou:

| Marco | API | Frontend | Total | Observação |
|---|---:|---:|---:|---|
| Gate 4 | 322 | 192 | 514 | Base histórica registrada no relatório anterior. |
| Gate 5 | 374 | 244 | 618 | API com lint e testes; frontend com testes e build de produção. |

Também foram conferidos:

- `npm run check` na API, incluindo ESLint sem warnings e 374 testes;
- `npm test` no frontend, com 244 testes;
- `npm run build` no frontend, com build Vite concluído e 405 módulos transformados;
- `docker compose config --quiet`, sem erro de composição;
- ensaio funcional de disparo simultâneo para aproximadamente 20 a 30 usuários, com resultados e logs coerentes.

O ensaio de 20 a 30 usuários é uma **evidência funcional**, e não um benchmark controlado de capacidade. Não se deve inferir, a partir dele, SLA, throughput máximo ou comportamento sob carga prolongada.

## Estrutura do repositório

```text
notify-app/
├── api/                    # API Express, persistência, filas, provedores e testes
├── frontend/               # SPA Vue/Quasar, Nginx e testes de interface
├── docs/                   # documentação do produto e evidências do TCC
│   └── app-media/          # prints e vídeos selecionados para a entrega
├── docker-compose.yml      # ambiente local com API, frontend, MongoDB e Redis
├── render.yaml             # infraestrutura como código para o Render
├── .env.example            # catálogo local sem credenciais reais
└── README.md               # sumário executivo e ponto inicial do projeto
```

## Percurso recomendado de leitura

1. Leia o [README da raiz](../README.md) para conhecer problema, escopo e execução rápida.
2. Leia o relatório técnico do Gate 5 para a narrativa acadêmica completa.
3. Consulte [Arquitetura](ARCHITECTURE.md) e [Segurança e privacidade](SECURITY-PRIVACY.md) para avaliar decisões e riscos.
4. Use [Implantação](DEPLOYMENT.md) para reproduzir o ambiente.
5. Execute os comandos de [Testes e evidências](TESTING-AND-EVIDENCE.md).
6. Confira o [Checklist do Gate 5](GATE-5-CHECKLIST.md) antes de criar o arquivo de entrega.

## Histórico e rastreabilidade

O relatório do Gate 4 permanece como referência histórica do processo de testes e validação. O Gate 5 não apaga esse marco: ele o atualiza com a arquitetura e as funcionalidades concluídas, a evolução da suíte automatizada, a configuração white-label, a administração de armazenamento, o tratamento ampliado de webhooks, o ciclo de mídia e o refinamento dos templates e conjuntos multicanal.

Evidências devem ser identificadas por data, ambiente, versão/commit e resultado. Imagens ilustrativas não substituem logs, testes ou reprodução do procedimento.

## Geração segura do pacote

**Não compacte a raiz do repositório diretamente.** Ela pode conter `.env`, metadados Git, dependências instaladas, builds, caches, logs e outros artefatos locais que não fazem parte da entrega.

Use o script de empacotamento controlado [`scripts/package-gate5.ps1`](../scripts/package-gate5.ps1), executado a partir da raiz:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-gate5.ps1
```

O script deve preparar uma cópia sanitizada antes de gerar o arquivo final. Ainda assim, revise o conteúdo produzido e abra o ZIP em uma pasta separada antes de enviá-lo.

O pacote de entrega não deve conter:

- `.env` ou qualquer segredo real;
- `.git/`, tokens, cookies ou credenciais exportadas;
- `node_modules/`, `dist/`, caches, logs locais e temporários de ferramentas;
- dumps de banco, arquivos de mídia ou prints com dados pessoais sem anonimização.

Inclua o código-fonte, os arquivos de lock, `.env.example`, Dockerfiles, `docker-compose.yml`, `render.yaml`, documentação e mídias revisadas. A entrega deve permitir auditoria e reprodução sem revelar os dados do ambiente produtivo. Não substitua o script por `Compress-Archive` aplicado diretamente sobre `notify-app/`.

## Limites desta documentação

Esta documentação descreve o comportamento observado no código e nos testes disponíveis em 14 de agosto de 2026. Regras, preços e limites de Meta, Telegram, Gmail e Render podem mudar. Antes de qualquer implantação real, as políticas oficiais dos provedores e as obrigações jurídicas da organização devem ser revistas.
