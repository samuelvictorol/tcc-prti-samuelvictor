import { http, unwrap } from './http.js'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_LOGO_BYTES = 5 * 1024 * 1024

function asArray(value, keys = []) {
  if (Array.isArray(value)) return value
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key]
  }
  return []
}

function safeFilename(value, fallback) {
  const normalized = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .trim()
  return normalized || fallback
}

function dispositionFilename(disposition) {
  const header = String(disposition || '')
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try { return decodeURIComponent(encoded) } catch { return encoded }
  }
  return header.match(/filename="?([^";]+)"?/i)?.[1] || ''
}

export function storageExportFilename(disposition, fallback = 'notify-flow-export.json') {
  return safeFilename(dispositionFilename(disposition), fallback)
}

export function validateBrandLogoFile(file) {
  if (!file) return 'Selecione uma imagem.'
  if (!IMAGE_TYPES.has(String(file.type || '').toLowerCase())) {
    return 'Use uma imagem JPG ou PNG.'
  }
  if (Number(file.size || 0) > MAX_LOGO_BYTES) return 'O logo deve ter no máximo 5 MB.'
  return ''
}

export async function uploadBrandLogo(file, options = {}) {
  const validation = validateBrandLogoFile(file)
  if (validation) throw Object.assign(new Error(validation), { code: 'INVALID_BRAND_LOGO' })

  const body = new FormData()
  body.append('file', file)
  body.append('mediaType', 'image')
  body.append('purpose', 'branding')
  const data = unwrap(await http.post('/media', body, {
    timeout: 600000,
    signal: options.signal,
  })) || {}

  return {
    ...data,
    id: String(data.id || data.assetId || data.mediaAssetId || data._id || ''),
    url: String(data.url || data.publicUrl || data.mediaUrl || ''),
  }
}

export async function fetchStorageUsage() {
  return unwrap(await http.get('/system/storage-usage')) || {}
}

export async function fetchStorageCollections() {
  const payload = unwrap(await http.get('/system/storage-collections')) || {}
  const collections = asArray(payload, ['collections', 'items', 'rows'])
  return {
    ...payload,
    collections,
    global: payload.global || payload.all || payload.general || null,
  }
}

export async function fetchStorageAudit(params = {}) {
  const payload = unwrap(await http.get('/system/storage-audit', { params })) || {}
  const items = asArray(payload, ['items', 'logs', 'events', 'rows', 'audit'])
  const pagination = payload.pagination || payload.meta || payload
  return {
    items,
    page: Number(pagination.page || params.page || 1),
    limit: Number(pagination.limit || params.limit || 20),
    total: Number(pagination.total || pagination.count || items.length),
  }
}

export async function requestStorageExport({ collection = 'all', format = 'json' } = {}) {
  const response = await http.get('/system/storage-export', {
    params: { collection, format },
    responseType: 'blob',
    timeout: 600000,
  })
  const fallback = `notify-flow-${safeFilename(collection, 'all')}.${format === 'zip' ? 'zip' : 'json'}`
  return {
    blob: response.data instanceof Blob ? response.data : new Blob([response.data]),
    filename: storageExportFilename(response.headers?.['content-disposition'], fallback),
  }
}

export function downloadStorageExport(result) {
  const url = URL.createObjectURL(result.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = result.filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function clearStorageCollection({ collection, confirmation }) {
  return unwrap(await http.post('/system/storage-clear', { collection, confirmation })) || {}
}

export function normalizeCollectionMetadata(item = {}) {
  const key = String(item.key || item.collection || item.name || '').trim()
  return {
    ...item,
    key,
    name: String(item.label || item.title || item.displayName || item.name || key),
    help: String(item.help || item.description || item.purpose || ''),
    exportable: item.exportable === true,
    clearable: item.clearable === true,
    confirmationPhrase: String(item.confirmationPhrase || item.confirmation || ''),
    protected: item.protected === true || item.clearable === false,
  }
}
