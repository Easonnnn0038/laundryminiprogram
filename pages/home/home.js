const app = getApp()
const { date } = require('../../utils/format')

Page({
  data: { loading: true, bound: false, orders: [], error: '' },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(wx.stopPullDownRefresh) },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady()
      const bound = app.globalData.bound
      const orders = bound ? await app.request('/orders') : []
      this.setData({ bound, orders: orders.map(item => ({ ...item, receiveTime: date(item.receiveTime) })) })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  async bindPhone(e) {
    if (!e.detail.code) return this.setData({ error: '需要绑定手机号才能查看本人订单，您可以稍后重试。' })
    this.setData({ loading: true, error: '' })
    try {
      const data = await app.request('/auth/bind-phone', { method: 'POST', data: { code: e.detail.code } })
      app.saveAuth(data); await this.load()
    } catch (err) { this.setData({ error: err.message, loading: false }) }
  },
  retry() { app.globalData.ready = null; this.load() },
  openOrder(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }) },
  openOrders() { wx.switchTab({ url: '/pages/orders/orders' }) }
})
