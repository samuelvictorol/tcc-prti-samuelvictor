function toGroupDTO (group) {
  if (!group) return null

  return {
    id: group._id,
    _id: group._id,
    name: group.name,
    description: group.description,
    contacts: group.contacts || [],
    active: group.active,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt
  }
}

function toGroupListDTO (groups) {
  return groups.map(toGroupDTO)
}

module.exports = {
  toGroupDTO,
  toGroupListDTO
}
