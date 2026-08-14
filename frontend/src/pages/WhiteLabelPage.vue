<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '../components/PageHeader.vue'
import { errorMessage } from '../services/http.js'
import {
  clearStorageCollection,
  downloadStorageExport,
  fetchStorageAudit,
  fetchStorageCollections,
  fetchStorageUsage,
  normalizeCollectionMetadata,
  requestStorageExport,
  uploadBrandLogo,
  validateBrandLogoFile,
} from '../services/storage-admin.js'
import {
  DEFAULT_WHITELABEL,
  loadWhiteLabel,
  normalizeBranding,
  saveWhiteLabel,
  validateBranding,
} from '../services/whitelabel.js'

const $q = useQuasar()
const loading = ref(true)
const saving = ref(false)
const storageLoading = ref(false)
const storageMetadataLoading = ref(false)
const uploadingLogo = ref(false)
const logoFile = ref(null)
const logoUploadController = ref(null)
const storageMetadata = ref({ collections: [], global: null })
const storageAction = ref('')
const auditLoading = ref(false)
const auditEntries = ref([])
const auditPagination = reactive({ page: 1, limit: 20, total: 0 })
const auditFilters = reactive({ action: '', scope: '' })
const clearDialog = ref(false)
const clearTarget = ref(null)
const clearConfirmation = ref('')
const clearAcknowledged = ref(false)
const clearing = ref(false)
const logoFailed = ref(false)
const storage = ref({
  database: '',
  totalBytes: 0,
  dataBytes: 0,
  storageBytes: 0,
  indexBytes: 0,
  collections: [],
  measuredAt: null,
})
const form = reactive(normalizeBranding(DEFAULT_WHITELABEL))

const chartPalette = ['#35BCA4', '#248BD6', '#D9514E', '#7B61C8', '#E6A23C', '#137D6C', '#EC6F9E', '#618398']
const collectionMetadataByKey = computed(() => new Map(
  storageMetadata.value.collections
    .map(normalizeCollectionMetadata)
    .filter((item) => item.key)
    .map((item) => [item.key, item]),
))
const collections = computed(() => {
  const usageItems = Array.isArray(storage.value.collections) ? storage.value.collections : []
  const byKey = new Map()
  for (const usage of usageItems) {
    const key = String(usage.key || usage.collection || usage.name || '').trim()
    if (!key) continue
    byKey.set(key, { ...collectionMetadataByKey.value.get(key), ...usage, key })
  }
  for (const [key, metadata] of collectionMetadataByKey.value.entries()) {
    if (!byKey.has(key)) byKey.set(key, { ...metadata, key })
  }
  return [...byKey.values()]
    .map((item, index) => ({
      ...normalizeCollectionMetadata(item),
      bytes: Number(item.totalBytes || item.storageBytes || 0),
      color: chartPalette[index % chartPalette.length],
    }))
    .sort((a, b) => b.bytes - a.bytes)
})
const collectionBytes = computed(() => collections.value.reduce((sum, item) => sum + item.bytes, 0))
const reportedTotalBytes = computed(() => Number(storage.value.totalBytes || storage.value.storageBytes || 0))
const overheadBytes = computed(() => Math.max(0, reportedTotalBytes.value - collectionBytes.value))
const chartItems = computed(() => [
  ...collections.value,
  ...(overheadBytes.value > 0 ? [{
    name: 'Outros',
    bytes: overheadBytes.value,
    color: '#AAB9B6',
    overhead: true,
  }] : []),
])
const chartTotalBytes = computed(() => Math.max(collectionBytes.value + overheadBytes.value, 1))
const chartSegments = computed(() => {
  const circumference = 2 * Math.PI * 48
  let cursor = 0
  return chartItems.value.map((item) => {
    const ratio = item.bytes / chartTotalBytes.value
    const segment = {
      ...item,
      dasharray: `${ratio * circumference} ${circumference}`,
      dashoffset: -cursor * circumference,
    }
    cursor += ratio
    return segment
  })
})
const measuredAt = computed(() => {
  if (!storage.value.measuredAt) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    .format(new Date(storage.value.measuredAt))
})
const globalStorage = computed(() => normalizeCollectionMetadata({
  key: 'all',
  name: 'Banco completo',
  help: 'Exporta os dados administrativos permitidos. Credenciais, autenticação, auditoria e outras coleções protegidas permanecem fora das ações destrutivas.',
  ...(storageMetadata.value.global || {}),
}))
const clearPhrase = computed(() => clearTarget.value?.confirmationPhrase || '')
const canConfirmClear = computed(() => Boolean(
  clearTarget.value?.clearable
  && clearAcknowledged.value
  && clearPhrase.value
  && clearConfirmation.value === clearPhrase.value,
))
const auditPageCount = computed(() => Math.max(1, Math.ceil(auditPagination.total / auditPagination.limit)))
const auditActionOptions = [
  { label: 'Todas as operações', value: '' },
  { label: 'Exportações', value: 'export' },
  { label: 'Limpezas', value: 'clear' },
]
const auditScopeOptions = computed(() => [
  { label: 'Todos os escopos', value: '' },
  { label: 'Banco completo', value: 'all' },
  ...collections.value.map((item) => ({ label: item.name, value: item.key })),
])

function collectionHelp(collection) {
  return collection.help || `Armazena os registros administrativos de ${collection.name}. A disponibilidade para exportar ou limpar é definida de forma segura pelo servidor.`
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const amount = bytes / (1024 ** unit)
  return `${amount.toLocaleString('pt-BR', { maximumFractionDigits: unit ? 2 : 0 })} ${units[unit]}`
}

function resetForm(branding) {
  Object.assign(form, normalizeBranding(branding), { footer: { ...normalizeBranding(branding).footer } })
  logoFailed.value = false
}

async function loadBranding() {
  const branding = await loadWhiteLabel(true)
  resetForm(branding)
}

async function loadStorage() {
  storageLoading.value = true
  try {
    const result = await fetchStorageUsage()
    storage.value = {
      ...storage.value,
      ...result,
      collections: Array.isArray(result.collections) ? result.collections : [],
    }
  } catch (error) {
    $q.notify({ type: 'warning', message: errorMessage(error, 'Não foi possível calcular o consumo do banco agora.') })
  } finally {
    storageLoading.value = false
  }
}

async function loadStorageMetadata() {
  storageMetadataLoading.value = true
  try {
    const result = await fetchStorageCollections()
    storageMetadata.value = {
      ...result,
      global: result.global || null,
      collections: result.collections.map(normalizeCollectionMetadata),
    }
  } catch (error) {
    $q.notify({ type: 'warning', message: errorMessage(error, 'Não foi possível carregar as ações de armazenamento.') })
  } finally {
    storageMetadataLoading.value = false
  }
}

async function loadAudit(reset = false) {
  if (reset) auditPagination.page = 1
  auditLoading.value = true
  try {
    const result = await fetchStorageAudit({
      page: auditPagination.page,
      limit: auditPagination.limit,
      action: auditFilters.action || undefined,
      scope: auditFilters.scope || undefined,
    })
    auditEntries.value = result.items
    auditPagination.total = result.total
  } catch (error) {
    auditEntries.value = []
    $q.notify({ type: 'warning', message: errorMessage(error, 'Não foi possível carregar a auditoria de armazenamento.') })
  } finally {
    auditLoading.value = false
  }
}

async function refreshStorageAdmin() {
  await Promise.allSettled([loadStorage(), loadStorageMetadata(), loadAudit()])
}

async function uploadLogo(file) {
  if (!file) return
  const validation = validateBrandLogoFile(file)
  if (validation) {
    logoFile.value = null
    $q.notify({ type: 'warning', message: validation })
    return
  }
  logoUploadController.value?.abort()
  const controller = new AbortController()
  logoUploadController.value = controller
  uploadingLogo.value = true
  try {
    const asset = await uploadBrandLogo(file, { signal: controller.signal })
    if (!asset.url) throw new Error('O servidor não retornou a URL pública do logo.')
    form.logoUrl = asset.url
    logoFailed.value = false
    logoFile.value = null
    $q.notify({ type: 'positive', message: 'Logo enviado. Salve a identidade para aplicá-lo.' })
  } catch (error) {
    logoFile.value = null
    if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') {
      $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível enviar o logo.') })
    }
  } finally {
    if (logoUploadController.value === controller) {
      logoUploadController.value = null
      uploadingLogo.value = false
    }
  }
}

async function exportStorage(target, format) {
  if (!target?.exportable) return
  const key = `${target.key}:${format}`
  storageAction.value = key
  try {
    downloadStorageExport(await requestStorageExport({ collection: target.key, format }))
    $q.notify({
      type: 'positive',
      message: `Exportação sanitizada ${format.toUpperCase()} preparada. Ela serve para consulta e auditoria, não para restauração integral.`,
    })
    await loadAudit()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível exportar os dados.') })
  } finally {
    storageAction.value = ''
  }
}

function requestClear(target) {
  if (!target?.clearable || !target.confirmationPhrase) return
  clearTarget.value = target
  clearConfirmation.value = ''
  clearAcknowledged.value = false
  clearDialog.value = true
}

async function confirmClear() {
  if (!canConfirmClear.value) return
  clearing.value = true
  try {
    await clearStorageCollection({
      collection: clearTarget.value.key,
      confirmation: clearConfirmation.value,
    })
    $q.notify({ type: 'positive', message: `${clearTarget.value.name} foi limpo conforme solicitado.` })
    clearDialog.value = false
    await refreshStorageAdmin()
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível limpar os dados.') })
  } finally {
    clearing.value = false
  }
}

function auditTime(entry) {
  const value = entry.createdAt || entry.timestamp || entry.at || entry.date
  if (!value) return 'Data não informada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

function auditLabel(entry) {
  const outcome = String(entry.action || '').split('.').at(-1)
  const summary = entry.context?.deleted != null
    ? `${Number(entry.context.deleted).toLocaleString('pt-BR')} registro(s)`
    : (entry.context?.mediaCount != null ? `${Number(entry.context.mediaCount).toLocaleString('pt-BR')} mídia(s)` : '')
  return [entry.message || entry.label || 'Operação de armazenamento', outcome, summary].filter(Boolean).join(' · ')
}

function auditScope(entry) {
  return String(entry.collection || entry.scope || entry.target || entry.context?.scope || 'geral')
}

async function save() {
  const validation = validateBranding(form)
  if (validation) {
    $q.notify({ type: 'warning', message: validation })
    return
  }
  saving.value = true
  try {
    const saved = await saveWhiteLabel(form)
    resetForm(saved)
    $q.notify({ type: 'positive', message: 'Identidade visual salva e aplicada em todo o sistema.' })
  } catch (error) {
    $q.notify({ type: 'negative', message: errorMessage(error, 'Não foi possível salvar a identidade visual.') })
  } finally {
    saving.value = false
  }
}

function restoreDefaults() {
  resetForm(DEFAULT_WHITELABEL)
  $q.notify({ type: 'info', message: 'Padrão Notify Flow restaurado na prévia. Salve para confirmar.' })
}

onMounted(async () => {
  await Promise.allSettled([loadBranding(), loadStorage(), loadStorageMetadata(), loadAudit()])
  loading.value = false
})

onBeforeUnmount(() => logoUploadController.value?.abort())
</script>

<template>
  <q-page>
    <div class="page-container white-label-page">
      <PageHeader
        eyebrow="Personalização"
        title="Whitelabel"
        description="Adapte a identidade do sistema para sua operação. O Notify Flow permanece disponível como configuração inicial segura."
        icon="palette"
      >
        <template #actions>
          <q-btn outline no-caps icon="restart_alt" label="Restaurar padrão" :disable="uploadingLogo" @click="restoreDefaults" />
          <q-btn unelevated no-caps color="primary" icon="save" label="Salvar identidade" :loading="saving" :disable="loading || uploadingLogo" @click="save" />
        </template>
      </PageHeader>

      <q-inner-loading :showing="loading" label="Carregando identidade visual..." />

      <section class="brand-layout">
        <q-card flat class="glass-card editor-card">
          <q-card-section class="card-heading">
            <q-avatar color="primary" text-color="white" icon="edit_square" />
            <div><span>IDENTIDADE</span><h2>Marca e aparência</h2></div>
          </q-card-section>
          <q-card-section class="brand-form">
            <q-input v-model="form.appName" outlined label="Nome do sistema *" maxlength="80" counter />
            <q-input v-model="form.pageTitle" outlined label="Título da aba do navegador *" maxlength="120" counter />
            <q-input
              v-model="form.logoUrl"
              outlined
              clearable
              label="URL HTTPS do logo"
              hint="Use uma imagem pública quadrada ou horizontal. Sem URL, o ícone padrão permanece."
              class="full-span"
              :disable="uploadingLogo"
              @update:model-value="logoFailed = false"
            >
              <template #prepend><q-icon name="image" /></template>
            </q-input>
            <div class="full-span logo-upload-row">
              <q-file
                v-model="logoFile"
                outlined
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                label="Ou envie um logo personalizado"
                hint="JPG ou PNG, até 5 MB. O endereço seguro será preenchido acima."
                :loading="uploadingLogo"
                :disable="uploadingLogo"
                @update:model-value="uploadLogo"
              >
                <template #prepend><q-icon name="cloud_upload" /></template>
                <template #append>
                  <q-spinner v-if="uploadingLogo" color="primary" size="22px" />
                </template>
              </q-file>
              <q-banner v-if="uploadingLogo" dense rounded class="logo-upload-status" role="status" aria-live="polite">
                <template #avatar><q-spinner color="primary" /></template>
                Enviando e preparando o logo. O botão Salvar ficará bloqueado até a conclusão.
              </q-banner>
            </div>

            <div v-for="field in [
              { key: 'primaryColor', label: 'Cor principal' },
              { key: 'secondaryColor', label: 'Cor secundária' },
              { key: 'accentColor', label: 'Cor de destaque' },
              { key: 'backgroundColor', label: 'Cor de fundo' },
            ]" :key="field.key" class="color-field">
              <q-input v-model="form[field.key]" outlined :label="`${field.label} *`" maxlength="7">
                <template #prepend><span class="color-swatch" :style="{ background: form[field.key] }" /></template>
                <template #append>
                  <q-icon name="colorize" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-color v-model="form[field.key]" no-header-tabs format-model="hex" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <q-separator class="full-span" />
            <div class="full-span section-label"><strong>Rodapé institucional</strong><span>Visível nas áreas públicas e administrativas.</span></div>
            <q-input v-model="form.footer.text" outlined label="Texto do rodapé" maxlength="120" />
            <q-input v-model="form.footer.websiteUrl" outlined label="Site" type="url"><template #prepend><q-icon name="language" /></template></q-input>
            <q-input v-model="form.footer.instagramUrl" outlined label="Instagram" type="url" class="full-span"><template #prepend><q-icon name="mdi-instagram" /></template></q-input>
          </q-card-section>
        </q-card>

        <q-card flat class="glass-card preview-card">
          <q-card-section class="card-heading">
            <q-avatar color="secondary" text-color="dark" icon="preview" />
            <div><span>PRÉVIA</span><h2>Como sua marca aparece</h2></div>
          </q-card-section>
          <q-card-section>
            <div
              class="brand-preview"
              :style="{
                '--preview-primary': form.primaryColor,
                '--preview-secondary': form.secondaryColor,
                '--preview-accent': form.accentColor,
                '--preview-background': form.backgroundColor,
              }"
            >
              <header>
                <span class="preview-logo">
                  <img v-if="form.logoUrl && !logoFailed" :src="form.logoUrl" alt="Prévia do logo" referrerpolicy="no-referrer" @error="logoFailed = true">
                  <q-icon v-else name="notifications_active" />
                </span>
                <strong>{{ form.appName || 'Notify Flow' }}</strong>
                <span class="preview-pill">Online</span>
              </header>
              <main>
                <span>VISÃO GERAL</span>
                <h3>{{ form.pageTitle || 'Central de notificações' }}</h3>
                <p>Uma identidade consistente em todos os canais, convites e páginas públicas.</p>
                <button type="button">Ação principal</button>
              </main>
              <footer>
                <span>{{ form.footer.text || DEFAULT_WHITELABEL.footer.text }}</span>
                <span>Instagram · Site</span>
              </footer>
            </div>
          </q-card-section>
        </q-card>
      </section>

      <q-card flat class="glass-card storage-card">
        <q-card-section class="storage-heading">
          <div class="card-heading">
            <q-avatar color="primary" text-color="white" icon="storage" />
            <div><span>ARMAZENAMENTO</span><h2>Consumo do MongoDB</h2><p v-if="storage.database">Banco {{ storage.database }}<template v-if="measuredAt"> · medido em {{ measuredAt }}</template></p></div>
          </div>
          <div class="storage-toolbar" aria-label="Ações gerais de armazenamento">
            <q-btn outline no-caps icon="data_object" label="JSON" :loading="storageAction === 'all:json'" :disable="!globalStorage.exportable || Boolean(storageAction)" @click="exportStorage(globalStorage, 'json')"><q-tooltip>{{ globalStorage.exportable ? 'Exportar dados sanitizados para consulta em JSON; não é um backup restaurável' : 'A exportação geral está protegida pelo servidor' }}</q-tooltip></q-btn>
            <q-btn outline no-caps icon="folder_zip" label="ZIP" :loading="storageAction === 'all:zip'" :disable="!globalStorage.exportable || Boolean(storageAction)" @click="exportStorage(globalStorage, 'zip')"><q-tooltip>{{ globalStorage.exportable ? 'Exportar dados sanitizados e mídias permitidas; não é um backup restaurável' : 'A exportação geral está protegida pelo servidor' }}</q-tooltip></q-btn>
            <q-btn outline no-caps color="negative" icon="delete_sweep" label="Limpar" :disable="!globalStorage.clearable || storageMetadataLoading" @click="requestClear(globalStorage)"><q-tooltip>{{ globalStorage.clearable ? 'Abrir confirmação forte de limpeza geral' : 'Configuração, autenticação e auditoria nunca são limpas por esta tela' }}</q-tooltip></q-btn>
            <q-btn flat round icon="refresh" :loading="storageLoading || storageMetadataLoading" aria-label="Atualizar consumo e permissões" @click="refreshStorageAdmin"><q-tooltip>Atualizar consumo, ações e auditoria</q-tooltip></q-btn>
          </div>
        </q-card-section>

        <q-linear-progress v-if="storageLoading" indeterminate color="primary" />
        <q-card-section class="storage-export-notice">
          <q-icon name="privacy_tip" />
          <span>As exportações são sanitizadas: segredos, credenciais, hashes e campos criptografados não são incluídos. Os arquivos servem para consulta e auditoria, não para restaurar integralmente o sistema.</span>
        </q-card-section>
        <q-card-section class="storage-metrics">
          <div><span>Uso geral</span><strong>{{ formatBytes(storage.totalBytes || storage.storageBytes) }}</strong></div>
          <div><span>Dados</span><strong>{{ formatBytes(storage.dataBytes) }}</strong></div>
          <div><span>Índices</span><strong>{{ formatBytes(storage.indexBytes) }}</strong></div>
          <div><span>Coleções</span><strong>{{ collections.length }}</strong></div>
        </q-card-section>

        <q-card-section v-if="chartItems.length" class="storage-visualization">
          <div class="donut-wrap" role="img" aria-label="Distribuição do uso do banco por coleção">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle class="donut-track" cx="60" cy="60" r="48" />
              <circle
                v-for="segment in chartSegments"
                :key="segment.name"
                class="donut-segment"
                cx="60"
                cy="60"
                r="48"
                :stroke="segment.color"
                :stroke-dasharray="segment.dasharray"
                :stroke-dashoffset="segment.dashoffset"
              />
            </svg>
            <div><strong>{{ formatBytes(chartTotalBytes) }}</strong><span>Distribuição</span></div>
          </div>
          <div class="collection-list">
            <div v-for="collection in chartItems" :key="collection.key || collection.name" class="collection-row">
              <div class="collection-identity">
                <span class="collection-dot" :style="{ background: collection.color }" />
                <div>
                  <strong>{{ collection.name }}</strong>
                  <span v-if="collection.overhead">Metadados e overhead do banco</span>
                  <span v-else>{{ Number(collection.count || 0).toLocaleString('pt-BR') }} documento(s)</span>
                </div>
                <q-icon v-if="!collection.overhead" name="help_outline" class="collection-help" tabindex="0" :aria-label="`Sobre ${collection.name}`"><q-tooltip max-width="320px">{{ collectionHelp(collection) }}</q-tooltip></q-icon>
              </div>
              <div class="collection-bar"><span :style="{ width: `${Math.max(2, (collection.bytes / chartTotalBytes) * 100)}%`, background: collection.color }" /></div>
              <strong class="collection-size">{{ formatBytes(collection.bytes) }}</strong>
              <div v-if="!collection.overhead" class="collection-actions" :aria-label="`Ações de ${collection.name}`">
                <q-btn flat dense no-caps icon="data_object" label="JSON" :loading="storageAction === `${collection.key}:json`" :disable="!collection.exportable || Boolean(storageAction)" @click="exportStorage(collection, 'json')"><q-tooltip>{{ collection.exportable ? `Exportar ${collection.name} em JSON sanitizado (não restaurável)` : 'Coleção protegida: exportação indisponível' }}</q-tooltip></q-btn>
                <q-btn flat dense no-caps icon="folder_zip" label="ZIP" :loading="storageAction === `${collection.key}:zip`" :disable="!collection.exportable || Boolean(storageAction)" @click="exportStorage(collection, 'zip')"><q-tooltip>{{ collection.exportable ? `Exportar ${collection.name} em ZIP sanitizado (não restaurável)` : 'Coleção protegida: exportação indisponível' }}</q-tooltip></q-btn>
                <q-btn flat dense no-caps color="negative" icon="delete_outline" label="Limpar" :disable="!collection.clearable" @click="requestClear(collection)"><q-tooltip>{{ collection.clearable ? `Limpar ${collection.name} com confirmação` : 'Coleção protegida: limpeza indisponível' }}</q-tooltip></q-btn>
                <q-icon v-if="collection.protected" name="lock" color="grey-6" aria-label="Coleção protegida"><q-tooltip>O servidor protege esta coleção contra ações administrativas perigosas.</q-tooltip></q-icon>
              </div>
            </div>
          </div>
        </q-card-section>
        <q-card-section v-else-if="!storageLoading" class="storage-empty">
          <q-icon name="storage" /><strong>Nenhuma coleção com consumo mensurável</strong><span>Atualize para consultar novamente.</span>
        </q-card-section>
      </q-card>

      <q-card flat class="glass-card audit-card">
        <q-card-section class="audit-heading">
          <div class="card-heading">
            <q-avatar color="dark" text-color="white" icon="terminal" />
            <div><span>AUDITORIA</span><h2>Console de armazenamento</h2><p>Exportações e limpezas ficam registradas. A própria auditoria não pode ser limpa nesta tela.</p></div>
          </div>
          <div class="audit-filters">
            <q-select v-model="auditFilters.action" dense outlined emit-value map-options :options="auditActionOptions" label="Operação" @update:model-value="loadAudit(true)" />
            <q-select v-model="auditFilters.scope" dense outlined emit-value map-options :options="auditScopeOptions" label="Escopo" @update:model-value="loadAudit(true)" />
            <q-btn flat round icon="refresh" :loading="auditLoading" aria-label="Atualizar auditoria" @click="loadAudit()"><q-tooltip>Atualizar auditoria</q-tooltip></q-btn>
          </div>
        </q-card-section>
        <q-linear-progress v-if="auditLoading" indeterminate color="primary" />
        <q-card-section class="audit-console" aria-live="polite">
          <ol v-if="auditEntries.length">
            <li v-for="(entry, index) in auditEntries" :key="entry.id || entry._id || `${auditPagination.page}-${index}`">
              <time :datetime="entry.createdAt || entry.timestamp || ''">{{ auditTime(entry) }}</time>
              <span class="audit-action">{{ entry.action || 'evento' }}</span>
              <strong>{{ auditScope(entry) }}</strong>
              <span>{{ auditLabel(entry) }}</span>
              <small v-if="entry.actor?.email || entry.actorEmail || entry.adminEmail">por {{ entry.actor?.email || entry.actorEmail || entry.adminEmail }}</small>
            </li>
          </ol>
          <div v-else-if="!auditLoading" class="audit-empty"><q-icon name="fact_check" /> Nenhuma operação corresponde aos filtros.</div>
        </q-card-section>
        <q-card-actions v-if="auditPageCount > 1" align="center">
          <q-pagination v-model="auditPagination.page" :max="auditPageCount" :max-pages="7" direction-links boundary-links @update:model-value="loadAudit()" />
        </q-card-actions>
      </q-card>

      <q-dialog v-model="clearDialog" persistent>
        <q-card class="clear-dialog" role="alertdialog" aria-labelledby="clear-storage-title" aria-describedby="clear-storage-description">
          <q-card-section class="clear-dialog__header">
            <q-avatar color="negative" text-color="white" icon="warning" />
            <div><span>OPERAÇÃO IRREVERSÍVEL</span><h2 id="clear-storage-title">Limpar {{ clearTarget?.name }}</h2></div>
          </q-card-section>
          <q-card-section id="clear-storage-description" class="clear-dialog__body">
            <q-banner rounded class="bg-red-1 text-negative">
              Os registros permitidos pelo servidor serão excluídos definitivamente. Configurações, administradores, segredos e auditoria continuam protegidos.
            </q-banner>
            <p>{{ clearTarget?.help }}</p>
            <p>Para confirmar, marque a ciência e digite exatamente:</p>
            <code>{{ clearPhrase }}</code>
            <q-checkbox v-model="clearAcknowledged" color="negative" label="Entendo que esta ação não pode ser desfeita e que a exportação sanitizada não restaura campos criptografados ou credenciais." />
            <q-input v-model="clearConfirmation" outlined autofocus label="Frase de confirmação" :disable="clearing" @keyup.enter="confirmClear" />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat no-caps label="Cancelar" :disable="clearing" v-close-popup />
            <q-btn unelevated no-caps color="negative" icon="delete_forever" label="Limpar definitivamente" :disable="!canConfirmClear" :loading="clearing" @click="confirmClear" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<style scoped>
.white-label-page { position: relative; }
.brand-layout { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr); gap: 20px; }
.editor-card, .preview-card, .storage-card, .audit-card { overflow: hidden; }
.card-heading, .storage-heading { display: flex; align-items: center; gap: 13px; }
.card-heading span { color: var(--brand-dark); font-size: .68rem; font-weight: 850; letter-spacing: .12em; }
.card-heading h2, .card-heading p { margin: 0; }
.card-heading h2 { margin-top: 2px; font-size: 1.1rem; }
.card-heading p { margin-top: 3px; color: var(--muted); font-size: .75rem; }
.brand-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.full-span { grid-column: 1 / -1; }
.color-field { min-width: 0; }
.color-swatch { width: 22px; height: 22px; border: 1px solid rgba(3,21,21,.12); border-radius: 7px; }
.section-label { display: flex; flex-direction: column; gap: 3px; }
.section-label span { color: var(--muted); font-size: .78rem; }
.logo-upload-row { display: grid; gap: 8px; }
.logo-upload-status { border: 1px solid color-mix(in srgb, var(--brand) 20%, transparent); background: color-mix(in srgb, var(--mint) 16%, white); color: var(--brand-dark); font-size: .76rem; }
.brand-preview { overflow: hidden; border: 1px solid rgba(3,21,21,.1); border-radius: 20px; background: var(--preview-background); box-shadow: 0 18px 45px rgba(3,62,55,.09); }
.brand-preview header { display: flex; align-items: center; gap: 9px; padding: 14px; background: white; }
.preview-logo { display: grid; width: 35px; height: 35px; overflow: hidden; border-radius: 11px; background: linear-gradient(135deg, var(--preview-secondary), var(--preview-primary)); place-items: center; }
.preview-logo img { width: 100%; height: 100%; object-fit: contain; }
.brand-preview header strong { min-width: 0; overflow: hidden; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
.preview-pill { border-radius: 999px; padding: 3px 7px; background: color-mix(in srgb, var(--preview-primary) 18%, white); color: var(--preview-accent); font-size: .62rem; font-weight: 800; }
.brand-preview main { min-height: 250px; padding: 38px 24px; background: radial-gradient(circle at 95% 0, color-mix(in srgb, var(--preview-secondary) 42%, transparent), transparent 60%), var(--preview-background); }
.brand-preview main > span { color: var(--preview-accent); font-size: .66rem; font-weight: 850; letter-spacing: .12em; }
.brand-preview h3 { margin: 8px 0; font-size: clamp(1.4rem, 3vw, 2.1rem); letter-spacing: -.045em; }
.brand-preview p { color: var(--muted); line-height: 1.5; }
.brand-preview button { margin-top: 12px; border: 0; border-radius: 10px; padding: 10px 16px; background: var(--preview-primary); color: white; font: inherit; font-weight: 750; }
.brand-preview footer { display: flex; justify-content: space-between; gap: 10px; padding: 12px 14px; background: white; color: var(--muted); font-size: .68rem; }
.storage-card, .audit-card { margin-top: 20px; }
.storage-heading { justify-content: space-between; padding: 20px 22px 10px; }
.storage-heading > .card-heading { min-width: 0; }
.storage-toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
.storage-export-notice { display: flex; align-items: flex-start; gap: 9px; margin: 4px 22px 12px; border: 1px solid color-mix(in srgb, var(--brand) 18%, transparent); border-radius: 12px; padding: 10px 12px; background: color-mix(in srgb, var(--mint) 10%, white); color: var(--muted); font-size: .73rem; line-height: 1.45; }
.storage-export-notice .q-icon { flex: 0 0 auto; color: var(--brand); font-size: 19px; }
.storage-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.storage-metrics > div { padding: 15px; border: 1px solid color-mix(in srgb, var(--brand) 14%, transparent); border-radius: 15px; background: color-mix(in srgb, var(--mint) 11%, white); }
.storage-metrics span, .storage-metrics strong { display: block; }
.storage-metrics span { color: var(--muted); font-size: .72rem; }
.storage-metrics strong { margin-top: 7px; font-size: 1.15rem; }
.storage-visualization { display: grid; grid-template-columns: minmax(210px, .7fr) minmax(0, 1.3fr); align-items: center; gap: 30px; padding-bottom: 26px; }
.donut-wrap { position: relative; width: min(260px, 100%); margin: auto; aspect-ratio: 1; }
.donut-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.donut-track, .donut-segment { fill: none; stroke-width: 14; }
.donut-track { stroke: rgba(3,21,21,.07); }
.donut-segment { transition: stroke-dasharray .3s; }
.donut-wrap > div { position: absolute; inset: 30%; display: grid; align-content: center; text-align: center; }
.donut-wrap strong, .donut-wrap span { display: block; }
.donut-wrap strong { font-size: 1.15rem; }
.donut-wrap span { color: var(--muted); font-size: .7rem; }
.collection-list { display: grid; gap: 8px; min-width: 0; max-height: 520px; overflow: auto; padding-right: 4px; }
.collection-row { display: grid; grid-template-columns: minmax(170px, .9fr) minmax(90px, .8fr) auto; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.56); }
.collection-identity { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-width: 0; }
.collection-dot { width: 9px; height: 9px; border-radius: 99px; }
.collection-identity strong, .collection-identity div > span { display: block; }
.collection-identity strong { overflow: hidden; font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.collection-identity div > span { margin-top: 2px; color: var(--muted); font-size: .65rem; }
.collection-help { color: var(--brand); cursor: help; }
.collection-size { font-size: .73rem; white-space: nowrap; }
.collection-actions { display: flex; grid-column: 1 / -1; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 2px; border-top: 1px solid rgba(3,21,21,.06); padding-top: 5px; }
.collection-bar { height: 7px; overflow: hidden; border-radius: 99px; background: rgba(3,21,21,.07); }
.collection-bar span { display: block; height: 100%; border-radius: inherit; }
.storage-empty { display: grid; min-height: 210px; align-content: center; justify-items: center; gap: 7px; color: var(--muted); text-align: center; }
.storage-empty .q-icon { color: var(--brand); font-size: 40px; }
.audit-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px 22px 12px; }
.audit-filters { display: grid; grid-template-columns: minmax(150px, 190px) minmax(150px, 210px) auto; align-items: center; gap: 8px; }
.audit-console { min-height: 190px; max-height: 430px; overflow: auto; background: #082d29; color: #d9fff8; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.audit-console ol { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.audit-console li { display: grid; grid-template-columns: 145px minmax(70px, .5fr) minmax(100px, .6fr) minmax(180px, 1.4fr) auto; gap: 12px; align-items: baseline; padding: 9px 10px; border-bottom: 1px solid rgba(217,255,248,.09); font-size: .72rem; }
.audit-console time, .audit-console small { color: #91bdb6; }
.audit-action { color: #82f8e6; text-transform: uppercase; }
.audit-empty { display: grid; min-height: 155px; place-content: center; justify-items: center; gap: 9px; color: #91bdb6; }
.audit-empty .q-icon { font-size: 34px; }
.clear-dialog { width: min(580px, calc(100vw - 24px)); border-radius: 22px; }
.clear-dialog__header { display: flex; align-items: center; gap: 13px; }
.clear-dialog__header span { color: #b4232e; font-size: .67rem; font-weight: 900; letter-spacing: .12em; }
.clear-dialog__header h2 { margin: 2px 0 0; font-size: 1.2rem; }
.clear-dialog__body { display: grid; gap: 13px; }
.clear-dialog__body p { margin: 0; color: var(--muted); line-height: 1.45; }
.clear-dialog__body code { overflow-wrap: anywhere; border: 1px dashed rgba(180,35,46,.35); border-radius: 10px; padding: 10px; background: #fff3f4; color: #8e1822; font-weight: 800; }
@media (max-width: 960px) { .brand-layout { grid-template-columns: 1fr; } .storage-visualization { grid-template-columns: 1fr; } .audit-heading { align-items: stretch; flex-direction: column; } }
@media (max-width: 680px) { .brand-form, .storage-metrics { grid-template-columns: 1fr 1fr; } .brand-form > :not(.color-field) { grid-column: 1 / -1; } }
@media (max-width: 620px) { .storage-heading { align-items: stretch; flex-direction: column; } .storage-toolbar { justify-content: stretch; } .storage-toolbar .q-btn { flex: 1; } .audit-filters { grid-template-columns: 1fr 1fr auto; } .audit-console li { grid-template-columns: 1fr auto; gap: 4px 10px; } .audit-console li > span:nth-of-type(2), .audit-console li > small { grid-column: 1 / -1; } }
@media (max-width: 480px) { .brand-form, .storage-metrics { grid-template-columns: 1fr; } .collection-row { grid-template-columns: minmax(0, 1fr) auto; } .collection-bar { grid-column: 1 / -1; grid-row: 2; } .collection-actions { justify-content: stretch; } .collection-actions .q-btn { flex: 1; } .brand-preview footer { flex-direction: column; } .audit-filters { grid-template-columns: 1fr; } }
</style>
