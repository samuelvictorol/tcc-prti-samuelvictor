function normalizeString (value) {
  return String(value || '').trim()
}

function normalizeUpper (value) {
  return normalizeString(value).toUpperCase()
}

function normalizeMessageBody (value) {
  return String(value || '').trim().replace(/\r\n/g, '\n')
}

module.exports = {
  normalizeString,
  normalizeUpper,
  normalizeMessageBody
}
