function toCampaignDTO (campaign) {
  if (!campaign) return null

  return {
    id: campaign._id,
    _id: campaign._id,
    name: campaign.name,
    group: campaign.group,
    template: campaign.template,
    scheduledAt: campaign.scheduledAt,
    status: campaign.status,
    stats: campaign.stats,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt
  }
}

function toCampaignListDTO (campaigns) {
  return campaigns.map(toCampaignDTO)
}

module.exports = {
  toCampaignDTO,
  toCampaignListDTO
}
