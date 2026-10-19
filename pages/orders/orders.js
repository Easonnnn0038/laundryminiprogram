const app = getApp()
const { date } = require('../../utils/format')
Page({
  data: { tab: 'current', bound: false, loading: true, orders: [], error: '' },
  onShow() {
    if (app.globalData.ordersTab) { this.setData({ tab: app.globalData.ordersTab }); app.globalData.ordersTab = '' }
    this.load()
  },
  onPullDownRefresh() { this.load().finally(wx.stopPullDownRefresh) },
  selectTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady(); const bound = app.globalData.bound
      const pickup = this.data.tab === 'pickup'
      const orders = bound ? await app.request(pickup ? '/pickup-orders' : `/orders?history=${this.data.tab === 'history'}`) : []
      this.setData({ bound, orders: pickup ? orders.map(item => ({ ...item, statusLabel: this.statusLabel(item.status) })) : orders.map(item => ({ ...item, receiveTime: date(item.receiveTime) })) })
    } catch (e) { this.setData({ bound: false, error: ['请先登录', '登录已过期，请重新登录'].includes(e.message) ? '' : e.message }) }
    finally { this.setData({ loading: false }) }
  },
  statusLabel(status) { return ({SUBMITTED:'待门店接单',PENDING_PAYMENT:'待付款',PAID:'待门店接单',CONFIRMED:'等待上门',PICKED_UP:'已取回待收衣',INSPECTED:'已验衣',CONVERTED:'已转正式订单',CANCELLED:'已取消'})[status] || status },
  openOrder(e) { if (this.data.tab !== 'pickup') wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }) },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }) }
})
