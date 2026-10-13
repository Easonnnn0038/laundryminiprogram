const app = getApp()
const { date, money } = require('../../utils/format')
Page({
  data: { loading: true, order: null, error: '' },
  onLoad(options) { this.id = options.id; this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady(); const order = await app.request(`/orders/${this.id}`)
      order.receiveTime = date(order.receiveTime)
      order.totalAmount = money(order.totalAmount); order.discountAmount = money(order.discountAmount)
      order.urgentSurcharge = money(order.urgentSurcharge); order.totalPaid = money(order.totalPaid)
      this.setData({ order })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  callStore() {
    if (this.data.order.storePhone) wx.makePhoneCall({ phoneNumber: this.data.order.storePhone })
  },
  copyOrderNo() { wx.setClipboardData({ data: this.data.order.orderNo }) }
})
