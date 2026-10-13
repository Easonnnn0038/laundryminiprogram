const app = getApp()
const { loadDeals } = require('../../utils/deals')
const groupLabels = { CLOTHES: '衣物', SHOES: '鞋类', HOME: '家纺卧室', IRON: '单烫', LEATHER: '皮衣护理', BAG: '包包' }

Page({
  data: { loading: true, error: '', catalog: [], visibleCatalog: [], groups: [], activeGroup: '', count: 0, total: '0.00', discount: '0.00', memberCardType: '', deal: null },
  onLoad(options) { this.initialGroup = options.group || 'CLOTHES'; this.dealCode=options.deal||''; this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady()
      if (!app.globalData.bound) throw new Error('请先在首页绑定手机号')
      const [catalog,deals] = await Promise.all([app.request('/pickup-catalog'),loadDeals(app)])
      const savedDraft = app.globalData.pickupDraft || wx.getStorageSync('pickupDraft') || {}
      this.selectedDeal=deals.find(item=>item.code===(this.dealCode || savedDraft.deal?.code))||this.selectedDeal||null
      const saved = savedDraft.quantities || {}
      const items = catalog.map(item => ({ ...item, quantity: saved[item.id] || 0 }))
      const groups = [...new Set(items.map(item => item.categoryGroup))].map(key => ({ key, label: groupLabels[key] || key }))
      const activeGroup = groups.some(item => item.key === this.initialGroup) ? this.initialGroup : (groups[0] && groups[0].key || '')
      const member = items.find(item => item.member)
      this.setData({ catalog: items, groups, activeGroup, visibleCatalog: items.filter(item => item.categoryGroup === activeGroup), memberCardType: member ? member.cardTypeName : '', deal: this.selectedDeal }, () => this.calculate())
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  selectGroup(e) {
    const activeGroup = e.currentTarget.dataset.group
    this.setData({ activeGroup, visibleCatalog: this.data.catalog.filter(item => item.categoryGroup === activeGroup) })
  },
  changeQuantity(e) {
    const id = Number(e.currentTarget.dataset.id), delta = Number(e.currentTarget.dataset.delta)
    const catalog = this.data.catalog.map(item => item.id === id ? { ...item, quantity: Math.max(0, Math.min(20, item.quantity + delta)) } : item)
    this.setData({ catalog, visibleCatalog: catalog.filter(item => item.categoryGroup === this.data.activeGroup) }, () => this.calculate())
  },
  calculate() {
    const selected = this.data.catalog.filter(item => item.quantity > 0)
    const original = selected.reduce((sum, item) => sum + Number(item.originalPrice || item.price) * item.quantity, 0)
    const total = selected.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    const quantities = {}; selected.forEach(item => { quantities[item.id] = item.quantity })
    app.globalData.pickupDraft = { quantities, selected, deal: this.data.deal }
    wx.setStorageSync('pickupDraft', app.globalData.pickupDraft)
    this.setData({ count: selected.reduce((sum, item) => sum + item.quantity, 0), total: total.toFixed(2), discount: (original - total).toFixed(2) })
  },
  next() { if (this.data.count) wx.navigateTo({ url: '/pages/appointment/appointment' }) }
})
