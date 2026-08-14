# Mídias e evidências visuais do aplicativo

Este diretório é reservado a screenshots e vídeos selecionados para o relatório e para a demonstração técnica do Notify Flow.

## Estrutura

```text
app-media/
├── README.md
├── screenshots/   # imagens estáticas em PNG/JPG/WebP
└── videos/        # demonstrações curtas em MP4/WebM
```

Os arquivos `.gitkeep` apenas preservam os diretórios vazios no Git e podem ser mantidos.

## Regra principal

Uma mídia é **evidência complementar**, não substituto para teste reproduzível. Todo print/vídeo usado no Gate 5 deve ser relacionado a um cenário de [`TESTING-AND-EVIDENCE.md`](../TESTING-AND-EVIDENCE.md), sempre que aplicável.

## Convenção de nomes

Use nomes sem espaços, acentos ou dados pessoais:

```text
YYYY-MM-DD_<cenario>_<tela>_<resultado>.<ext>
```

Exemplos:

```text
2026-08-14_N01_notificacoes_lote-parcial.png
2026-08-14_W03_whatsapp-template_entregue.png
2026-08-14_B01_realtime_whatsapp.webm
```

Não use telefone, email, nome real, chat ID, user ID, token ou request ID sensível no nome do arquivo.

## Metadados de evidência

Para cada arquivo relevante, registre na tabela abaixo ou em uma tabela equivalente no relatório:

| Arquivo | Cenário | Data/Timezone | Ambiente | Commit/versão | Resultado | Anonimização |
|---|---|---|---|---|---|---|
| `screenshots/exemplo.png` | N01 | 14/08/2026 BRT | local | `<commit>` | aprovado | contato sintético |

Remova a linha de exemplo quando as mídias reais forem adicionadas.

## Checklist de anonimização

Antes de salvar:

- [ ] substitua nomes por contatos sintéticos;
- [ ] masque telefone, email, username, IDs e códigos;
- [ ] recorte barras do navegador quando exibirem token/link assinado;
- [ ] oculte Bearer tokens, app passwords, webhook secrets e cookies;
- [ ] remova QR Codes reais que concedam acesso;
- [ ] não mostre `.env`, console de rede ou payload com credencial;
- [ ] confira reflexos, notificações do sistema e abas visíveis;
- [ ] remova metadados de localização/autor quando necessário;
- [ ] use somente dados cuja inclusão na entrega foi autorizada.

Em caso de dúvida, recrie o cenário com dados sintéticos em vez de editar superficialmente uma evidência de produção.

## Capturas recomendadas para o Gate 5

### Administração

- Início: saúde, canais configurados e console sem segredos;
- Contatos: identidades e consentimentos mascarados;
- Templates: biblioteca e conjunto multicanal;
- Notificações: revisão, lote e detalhe por contato/canal;
- WhatsApp: conversas, janela de 24 horas e tab Webhook;
- Telegram: conversa, grupos e tab Webhook;
- Convites: editor e página pública responsiva;
- Meu perfil: dados, permissões, convites/grupos e histórico;
- White-label: marca e gráfico de armazenamento;
- auditoria de exportação/limpeza em ambiente descartável.

### Vídeos curtos

- autorização por convite e comando;
- envio multicanal e atualização de status;
- mensagem chegando via webhook/realtime;
- revogação no Meu perfil;
- aplicação de uma configuração White-label.

Prefira vídeos de 30 a 90 segundos, resolução legível e sem áudio ambiente confidencial. Evite múltiplos vídeos longos com conteúdo redundante.

## Formatos

- PNG: interfaces e texto pequeno;
- JPG/WebP: imagens fotográficas sem necessidade de pixel exato;
- MP4/H.264: maior compatibilidade para apresentação;
- WebM: alternativa menor para navegador.

Mantenha o arquivo original somente quando necessário. Para a entrega, use versão otimizada que continue legível.

## Integridade

Quando uma mídia for evidência central, calcule SHA-256:

```powershell
Get-FileHash .\screenshots\arquivo.png -Algorithm SHA256
```

O hash pode ser registrado no relatório ou em manifesto separado. Alterar ou recomprimir o arquivo muda o hash.

## Direitos autorais

Use apenas imagens, logos e conteúdos próprios, licenciados ou permitidos para fins acadêmicos. Ao mostrar interfaces de terceiros, limite a captura ao necessário para demonstrar a integração e identifique a fonte/provedor no texto do relatório.

