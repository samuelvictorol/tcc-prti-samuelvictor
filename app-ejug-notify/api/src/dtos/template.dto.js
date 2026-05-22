function toTemplateDTO (template) {
  if (!template) return null

  return {
    id: template._id,
    _id: template._id,
    name: template.name,
    category: template.category,
    language: template.language,
    metaTemplateName: template.metaTemplateName,
    body: template.body,
    status: template.status,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  }
}

function toTemplateListDTO (templates) {
  return templates.map(toTemplateDTO)
}

module.exports = {
  toTemplateDTO,
  toTemplateListDTO
}
