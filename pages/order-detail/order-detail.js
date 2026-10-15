const app = getApp()
const { date, money } = require('../../utils/format')
const { testLoginKey } = require('../../config')
Page({
  data: { loading: true, paying: false, simulating: false, order: null, error: '' },
  onLoad(options) { this.id = options.id; this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      await app.ensureReady(); const order = await app.request(`/orders/${this.id}`)
      order.receiveTime = date(order.receiveTime)
      order.totalAmount = money(order.totalAmount); order.discountAmount = money(order.discountAmount)
      order.urgentSurcharge = money(order.urgentSurcharge); order.totalPaid = money(order.totalPaid)
      order.deliveryFee = money(order.deliveryFee); order.debtAmount = money(order.debtAmount)
      this.setData({ order })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  callStore() {
    if (this.data.order.storePhone) wx.makePhoneCall({ phoneNumber: this.data.order.storePhone })
  },
  copyOrderNo() { wx.setClipboardData({ data: this.data.order.orderNo }) },
  async simulateDelivery() {
    if (this.data.simulating) return
    const answer = await new Promise(resolve => wx.showModal({
      title: '仅模拟签收',
      content: '这会把本地测试订单直接移入历史订单；不产生真实付款、快递揽件或签收记录。继续吗？',
      success: resolve, fail: () => resolve({ confirm: false })
    }))
    if (!answer.confirm) return
    this.setData({ simulating: true })
    try {
      await app.request(`/orders/${this.id}/test-deliver`, {
        method: 'POST', header: { 'X-Miniapp-Test-Key': testLoginKey }
      })
      await this.load()
    } catch (e) { wx.showToast({ title: e.message || '模拟签收失败，请刷新订单', icon: 'none' }) }
    finally { this.setData({ simulating: false }) }
  },
  async pay() {
    this.setData({ paying: true, error: '' })
    try {
      const params = await app.request(`/orders/${this.id}/pay`, { method: 'POST' })
      if (params.status !== 'PAID') await wx.requestPayment({
        timeStamp: params.timeStamp, nonceStr: params.nonceStr, package: params.package,
        signType: params.signType, paySign: params.paySign
      })
      const result = await app.request(`/orders/${this.id}/payment-status`)
      if (result.status !== 'PAID') wx.showToast({ title: '支付结果确认中，请稍后刷新', icon: 'none' })
      await this.load()
    } catch (e) {
      if (!String(e.errMsg || '').includes('cancel')) this.setData({ error: e.message || '支付未完成，请稍后重试' })
    } finally { this.setData({ paying: false }) }
  }
})
