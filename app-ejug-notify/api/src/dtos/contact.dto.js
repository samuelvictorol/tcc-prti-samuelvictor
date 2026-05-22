function toContactDTO (contact) {
  if (!contact) return null

  return {
    id: contact._id,
    _id: contact._id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    document: contact.document,
    source: contact.source,
    hasOptIn: contact.hasOptIn,
    optInAt: contact.optInAt,
    optOutAt: contact.optOutAt,
    active: contact.active,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt
  }
}

function toContactListDTO (contacts) {
  return contacts.map(toContactDTO)
}

module.exports = {
  toContactDTO,
  toContactListDTO
}
