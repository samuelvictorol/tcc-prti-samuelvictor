import { computed, reactive, readonly } from 'vue'
import { http, unwrap } from './http.js'

export const DEFAULT_WHITELABEL = Object.freeze({
  appName: 'Notify Flow',
  pageTitle: 'Notify Flow | Central de notificações',
  logoUrl: '',
  primaryColor: '#35BCA4',
  secondaryColor: '#82F8E6',
  accentColor: '#137D6C',
  backgroundColor: '#F4FBF9',
  footer: Object.freeze({
    text: 'Powered by @aitosoftwares',
    instagramUrl: 'https://www.instagram.com/aitosoftwares/',
    websiteUrl: 'https://aitosoftwares.com/',
  }),
})

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const state = reactive({
  branding: cloneDefaults(),
  loaded: false,
  loading: false,
})

let pendingLoad

function cloneDefaults() {
  return {
    ...DEFAULT_WHITELABEL,
    footer: { ...DEFAULT_WHITELABEL.footer },
  }
}

function text(value, fallback, maxLength = 120) {
  const normalized = String(value ?? '').trim()
  return (normalized || fallback).slice(0, maxLength)
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key)
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10
    || parts[0] === 127
    || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] >= 224
}

function isPrivateIpv6(hostname) {
  const normalized = String(hostname || '').toLowerCase()
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
    || normalized.startsWith('2001:db8:')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:169.254.')
    || normalized.startsWith('::ffff:172.')
    || normalized.startsWith('::ffff:192.168.')
}

export function isSafePublicBrandUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    const hostname = url.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase()
    if (url.protocol !== 'https:' || (url.port && url.port !== '443') || !hostname || url.username || url.password) return false
    if (
      hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.local')
      || hostname.endsWith('.internal')
      || hostname.endsWith('.lan')
    ) return false
    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return false
    const isIpv6 = hostname.includes(':')
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    if (!isIpv4 && !isIpv6 && !hostname.includes('.')) return false
    return true
  } catch {
    return false
  }
}

export function safeBrandUrl(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  if (!normalized) return fallback
  if (!isSafePublicBrandUrl(normalized)) return fallback
  return new URL(normalized).toString()
}

export function normalizeBranding(value = {}) {
  const source = value?.branding || value || {}
  const identity = source.identity || source
  const colors = source.colors || source
  const links = source.links || source.footer || {}
  const footer = source.footer || {}
  const hasLinksConfiguration = hasOwn(source, 'links')
    || hasOwn(links, 'instagram')
    || hasOwn(links, 'instagramUrl')
    || hasOwn(links, 'website')
    || hasOwn(links, 'websiteUrl')
  const instagramConfigured = hasOwn(links, 'instagram') || hasOwn(links, 'instagramUrl')
  const websiteConfigured = hasOwn(links, 'website') || hasOwn(links, 'websiteUrl')
  return {
    appName: text(identity.name ?? identity.appName, DEFAULT_WHITELABEL.appName, 80),
    pageTitle: text(identity.title ?? identity.pageTitle, identity.name || identity.appName || DEFAULT_WHITELABEL.pageTitle, 120),
    logoUrl: safeBrandUrl(identity.logoUrl),
    primaryColor: HEX_COLOR.test(String(colors.primary ?? colors.primaryColor ?? ''))
      ? String(colors.primary ?? colors.primaryColor).toUpperCase()
      : DEFAULT_WHITELABEL.primaryColor,
    secondaryColor: HEX_COLOR.test(String(colors.secondary ?? colors.secondaryColor ?? ''))
      ? String(colors.secondary ?? colors.secondaryColor).toUpperCase()
      : DEFAULT_WHITELABEL.secondaryColor,
    accentColor: HEX_COLOR.test(String(colors.accent ?? colors.accentColor ?? ''))
      ? String(colors.accent ?? colors.accentColor).toUpperCase()
      : DEFAULT_WHITELABEL.accentColor,
    backgroundColor: HEX_COLOR.test(String(colors.background ?? colors.backgroundColor ?? ''))
      ? String(colors.background ?? colors.backgroundColor).toUpperCase()
      : DEFAULT_WHITELABEL.backgroundColor,
    footer: {
      text: text(footer.text, DEFAULT_WHITELABEL.footer.text, 120),
      instagramUrl: instagramConfigured
        ? safeBrandUrl(links.instagram ?? links.instagramUrl)
        : (hasLinksConfiguration ? '' : DEFAULT_WHITELABEL.footer.instagramUrl),
      websiteUrl: websiteConfigured
        ? safeBrandUrl(links.website ?? links.websiteUrl)
        : (hasLinksConfiguration ? '' : DEFAULT_WHITELABEL.footer.websiteUrl),
    },
  }
}

export function validateBranding(value) {
  const branding = value?.branding || value || {}
  if (!String(branding.appName || '').trim()) return 'Informe o nome exibido no sistema.'
  if (!String(branding.pageTitle || '').trim()) return 'Informe o título da aba do navegador.'
  for (const [label, field] of [
    ['principal', 'primaryColor'],
    ['secundária', 'secondaryColor'],
    ['de destaque', 'accentColor'],
    ['de fundo', 'backgroundColor'],
  ]) {
    if (!HEX_COLOR.test(String(branding[field] || ''))) return `Informe uma cor ${label} válida no formato #RRGGBB.`
  }
  for (const [label, url] of [
    ['logo', branding.logoUrl],
    ['Instagram', branding.footer?.instagramUrl],
    ['site', branding.footer?.websiteUrl],
  ]) {
    if (url && !isSafePublicBrandUrl(url)) return `Informe uma URL HTTPS pública e segura para ${label}.`
  }
  return ''
}

export function applyBranding(value) {
  const branding = normalizeBranding(value)
  Object.assign(state.branding, branding, { footer: { ...branding.footer } })

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.style.setProperty('--brand', branding.primaryColor)
    root.style.setProperty('--brand-dark', branding.accentColor)
    root.style.setProperty('--mint', branding.secondaryColor)
    root.style.setProperty('--q-primary', branding.primaryColor)
    root.style.setProperty('--q-secondary', branding.secondaryColor)
    root.style.setProperty('--q-accent', branding.accentColor)
    root.style.setProperty('--app-background', branding.backgroundColor)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', branding.primaryColor)
    document.title = branding.pageTitle
  }
  return branding
}

export async function loadWhiteLabel(force = false) {
  if (state.loaded && !force) return state.branding
  if (pendingLoad && !force) return pendingLoad
  state.loading = true
  pendingLoad = http.get('/settings/whitelabel')
    .then((response) => applyBranding(unwrap(response) || {}))
    .catch(() => applyBranding(DEFAULT_WHITELABEL))
    .finally(() => {
      state.loaded = true
      state.loading = false
      pendingLoad = null
    })
  return pendingLoad
}

export async function saveWhiteLabel(value) {
  const branding = normalizeBranding(value)
  const payload = {
    branding: {
      identity: {
        name: branding.appName,
        title: branding.pageTitle,
        logoUrl: branding.logoUrl,
      },
      colors: {
        primary: branding.primaryColor,
        secondary: branding.secondaryColor,
        accent: branding.accentColor,
        background: branding.backgroundColor,
      },
      links: {
        instagram: branding.footer.instagramUrl || null,
        website: branding.footer.websiteUrl || null,
      },
      footer: { text: branding.footer.text },
    },
  }
  const response = unwrap(await http.put('/settings/whitelabel', payload)) || payload
  return applyBranding(response.branding || response)
}

export function useWhiteLabel() {
  return {
    branding: readonly(state.branding),
    loaded: computed(() => state.loaded),
    loading: computed(() => state.loading),
    load: loadWhiteLabel,
    apply: applyBranding,
  }
}
