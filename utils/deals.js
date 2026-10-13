const fallback = require('../data/deals').deals
const art = Object.fromEntries(fallback.map(item => [item.code, item.position]))
function normalize(items) { return items.map(item => ({ ...item, scope: item.description || item.scope,
  group: item.categoryGroups && item.categoryGroups[0] || item.group, position: art[item.code] || 'd00' })) }
async function loadDeals(app) { try { return normalize(await app.request('/deals')) } catch (_) { if (app.globalData.mockMode) return fallback; throw _ } }
module.exports = { loadDeals }
