import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WHITELABEL,
  isSafePublicBrandUrl,
  normalizeBranding,
  safeBrandUrl,
  validateBranding,
} from '../src/services/whitelabel.js'
import {
  normalizeCollectionMetadata,
  storageExportFilename,
  validateBrandLogoFile,
} from '../src/services/storage-admin.js'

function source(relativePath) {
  return readFileSync(fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url)), 'utf8')
}

describe('identidade whitelabel', () => {
  it('mantém o Notify Flow e a Aito Softwares como configuração inicial', () => {
    expect(DEFAULT_WHITELABEL.appName).toBe('Notify Flow')
    expect(DEFAULT_WHITELABEL.footer.text).toBe('Powered by @aitosoftwares')
    expect(DEFAULT_WHITELABEL.footer.websiteUrl).toBe('https://aitosoftwares.com/')
  })

  it('normaliza identidade e bloqueia URLs ou cores inseguras', () => {
    const branding = normalizeBranding({
      appName: 'Minha Central',
      pageTitle: 'Minha Central | Alertas',
      logoUrl: 'javascript:alert(1)',
      primaryColor: '#123abc',
      secondaryColor: 'red',
      accentColor: '#654321',
      footer: { text: 'Criado por Nós', websiteUrl: 'https://example.com' },
    })

    expect(branding.appName).toBe('Minha Central')
    expect(branding.logoUrl).toBe('')
    expect(branding.primaryColor).toBe('#123ABC')
    expect(branding.secondaryColor).toBe(DEFAULT_WHITELABEL.secondaryColor)
    expect(safeBrandUrl('data:image/png;base64,abc')).toBe('')
    expect(safeBrandUrl('http://example.com/logo.png')).toBe('')
    expect(validateBranding({ ...branding, primaryColor: 'green' })).toContain('formato #RRGGBB')
  })

  it('preserva links institucionais desativados e aceita somente URLs HTTPS públicas', () => {
    const withoutLinks = normalizeBranding({
      branding: {
        identity: { name: 'Central', title: 'Central', logoUrl: null },
        links: { instagram: null, website: '' },
      },
    })

    expect(withoutLinks.footer.instagramUrl).toBe('')
    expect(withoutLinks.footer.websiteUrl).toBe('')
    expect(normalizeBranding(withoutLinks).footer).toMatchObject({ instagramUrl: '', websiteUrl: '' })
    expect(isSafePublicBrandUrl('https://example.com/logo.png')).toBe(true)
    expect(isSafePublicBrandUrl('https://localhost/logo.png')).toBe(false)
    expect(isSafePublicBrandUrl('https://127.0.0.1/logo.png')).toBe(false)
    expect(isSafePublicBrandUrl('https://user:secret@example.com/logo.png')).toBe(false)
  })

  it('expõe página, navegação, aplicação global e rodapé em todas as rotas', () => {
    const app = source('App.vue')
    const page = source('pages/WhiteLabelPage.vue')
    const layout = source('layouts/MainLayout.vue')
    const router = source('router/index.js')

    expect(app).toContain('<WhiteLabelFooter v-if="!layoutOwnsFooter" />')
    expect(app).toContain("route.name === 'my-profile'")
    expect(app).toContain('whiteLabel.load()')
    expect(layout).toContain("label: 'Whitelabel'")
    expect(layout).toContain('<WhiteLabelBrand')
    expect(source('pages/LoginPage.vue')).toContain('<WhiteLabelBrand')
    expect(source('pages/ProfilePage.vue')).toContain('<WhiteLabelBrand')
    expect(source('pages/PublicInvitePage.vue')).toContain('branding.logoUrl')
    expect(router).toContain("path: 'whitelabel'")
    expect(page).toContain('fetchStorageUsage()')
    expect(page).toContain('Consumo do MongoDB')
    expect(page).toContain('class="donut-segment"')
    expect(page).toContain("name: 'Outros'")
    expect(page).toContain('Metadados e overhead do banco')
    expect(page).toContain('saveWhiteLabel(form)')
    expect(page).toContain('uploadBrandLogo(file')
    expect(page).toContain('requestStorageExport({ collection: target.key, format })')
    expect(page).toContain('<q-dialog v-model="clearDialog" persistent>')
    expect(page).toContain('clearConfirmation.value === clearPhrase.value')
    expect(page).toContain('Console de armazenamento')
    expect(page).toContain('collectionHelp(collection)')
    expect(layout).toContain('<q-footer class="app-footer">')
    expect(source('pages/ProfilePage.vue')).toContain('<q-footer class="profile-footer">')
    expect(source('components/WhiteLabelBrand.vue')).toContain('referrerpolicy="no-referrer"')
    expect(source('pages/PublicInvitePage.vue')).toContain('@error="onPublicLogoError"')
    expect(source('services/whitelabel.js')).toContain('identity: {')
    expect(source('services/whitelabel.js')).toContain('background: branding.backgroundColor')
  })

  it('valida logos e respeita as capacidades de cada coleção fornecidas pelo servidor', () => {
    expect(validateBrandLogoFile({ type: 'image/png', size: 1024 })).toBe('')
    expect(validateBrandLogoFile({ type: 'image/webp', size: 1024 })).toContain('JPG')
    expect(validateBrandLogoFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toContain('5 MB')

    expect(normalizeCollectionMetadata({
      key: 'contacts',
      label: 'Contatos',
      help: 'Dados dos contatos.',
      exportable: true,
      clearable: false,
      confirmationPhrase: 'LIMPAR CONTATOS',
    })).toMatchObject({
      key: 'contacts',
      name: 'Contatos',
      exportable: true,
      clearable: false,
      protected: true,
    })

    const service = source('services/storage-admin.js')
    expect(service).toContain("body.append('purpose', 'branding')")
    expect(service).toContain("http.get('/system/storage-export'")
    expect(service).toContain("http.post('/system/storage-clear'")
    expect(service).toContain("http.get('/system/storage-audit'")
    expect(storageExportFilename('attachment; filename="backup-seguro.zip"')).toBe('backup-seguro.zip')
    expect(storageExportFilename("attachment; filename*=UTF-8''relat%C3%B3rio.json")).toBe('relatório.json')
  })
})
