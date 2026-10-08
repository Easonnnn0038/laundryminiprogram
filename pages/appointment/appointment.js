const app = getApp()

function tomorrow() {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function requestId() { return `pickup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }

Page({
  data: { loading: true, submitting: false, error: '', selected: [], count: 0, total: '0.00', addresses: [], addressIndex: 0, appointmentDate: tomorrow(), slots: ['09:00-12:00', '13:00-17:00', '18:00-20:00'], slotIndex: 0, remark: '', requestId: requestId() },
  onShow() { this.load() },
  async load() {
    const draft = app.globalData.pickupDraft
    if (!draft || !draft.selected || !draft.selected.length) return wx.navigateBack()
    this.setData({ loading: true, selected: draft.selected, count: draft.selected.reduce((sum, item) => sum + item.quantity, 0), total: draft.selected.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2) })
    try {
      let addresses = (await app.request('/addresses')).map(item => ({ ...item, isDefault: Boolean(item.isDefault) }))
      if (!addresses.length) {
        const fallback = await app.request('/pickup-defaults')
        if (fallback.contactName && fallback.pickupAddress) addresses = [{ id: null, contactName: fallback.contactName, detailAddress: fallback.pickupAddress, isDefault: true }]
      }
      const addressIndex = Math.max(0, addresses.findIndex(item => item.isDefault))
      this.setData({ addresses, addressIndex })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  selectAddress(e) { this.setData({ addressIndex: Number(e.detail.value) }) },
  selectDate(e) { this.setData({ appointmentDate: e.detail.value }) },
  selectSlot(e) { this.setData({ slotIndex: Number(e.detail.value) }) },
  inputRemark(e) { this.setData({ remark: e.detail.value }) },
  manageAddresses() { wx.navigateTo({ url: '/pages/addresses/addresses' }) },
  backToCatalog() { wx.navigateBack() },
  async submit() {
    const address = this.data.addresses[this.data.addressIndex]
    if (!address) return this.setData({ error: '请先新增联系人和上门地址' })
    this.setData({ submitting: true, error: '' })
    try {
      const order = await app.request('/pickup-orders', { method: 'POST', data: {
        requestId: this.data.requestId, contactName: address.contactName, pickupAddress: address.detailAddress,
        appointmentDate: this.data.appointmentDate, appointmentSlot: this.data.slots[this.data.slotIndex], remark: this.data.remark.trim(),
        items: this.data.selected.map(item => ({ categoryId: item.id, quantity: item.quantity }))
      } })
      app.globalData.pickupDraft = null
      await wx.showModal({ title: '预约已提交', content: `预估金额 ¥${Number(order.estimated_amount || order.estimatedAmount).toFixed(2)}\n门店确认后将按约定时间上门。`, showCancel: false, confirmText: '查看预约' })
      app.globalData.ordersTab = 'pickup'
      wx.switchTab({ url: '/pages/orders/orders' })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ submitting: false }) }
  }
})
