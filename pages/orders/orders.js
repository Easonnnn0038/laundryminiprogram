const app = getApp()
const { date } = require('../../utils/format')
Page({
  data: { tab: 'current', bound: false, loading: true, orders: [], error: '' },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(wx.stopPullDownRefresh) },
  selectTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady(); const bound = app.globalData.bound
      const orders = bound ? await app.request(`/orders?history=${this.data.tab === 'history'}`) : []
      this.setData({ bound, orders: orders.map(item => ({ ...item, receiveTime: date(item.receiveTime) })) })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  openOrder(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }) },
  goHome() { wx.switchTab({ url: '/pages/home/home' }) }
})
