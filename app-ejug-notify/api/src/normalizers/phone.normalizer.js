function onlyDigits (value) {
  return String(value || '').replace(/\D/g, '')
}

function normalizePhone (value) {
  const digits = onlyDigits(value)

  if (!digits) return ''

  if (digits.startsWith('55')) return digits

  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`
  }

  return digits
}

module.exports = {
  onlyDigits,
  normalizePhone
}
