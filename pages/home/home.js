const app = getApp()
const { loadDeals } = require('../../utils/deals')

const categories = [
  { key: 'CLOTHES', name: '衣物', position: 'p00' },
  { key: 'SHOES', name: '鞋类', position: 'p10' },
  { key: 'HOME', name: '家纺卧室', position: 'p20' },
  { key: 'IRON', name: '单烫', position: 'p01' },
  { key: 'LEATHER', name: '皮衣护理', position: 'p11' },
  { key: 'BAG', name: '包包', position: 'p21' }
]

Page({
  data: { loading: true, bound: false, error: '', categories, featuredDeals: [] },
  onShow() { this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try { await app.ensureReady(); const deals=await loadDeals(app);this.setData({ bound: app.globalData.bound,featuredDeals:deals.filter(item=>item.featured) }) }
    catch (e) { this.setData({ bound: false, error: ['请先登录', '登录已过期，请重新登录'].includes(e.message) ? '' : e.message }) }
    finally { this.setData({ loading: false }) }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }) },
  retry() { app.globalData.ready = null; this.load() },
  openDeals() { wx.navigateTo({ url: '/pages/deals/deals' }) },
  openDeal(e) { wx.navigateTo({ url: `/pages/pickup-order/pickup-order?group=${e.currentTarget.dataset.group}&deal=${e.currentTarget.dataset.code}` }) },
  openCategory(e) { wx.navigateTo({ url: `/pages/pickup-order/pickup-order?group=${e.currentTarget.dataset.group}` }) }
})
