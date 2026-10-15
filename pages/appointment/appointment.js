const app = getApp()

function tomorrow() {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function requestId() { return `pickup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }

Page({
  data: { loading: true, submitting: false, error: '', selected: [], deal: null, voucherCode: '', count: 0, total: '0.00', addresses: [], addressIndex: 0, appointmentDate: tomorrow(), slots: ['09:00-12:00', '13:00-17:00', '18:00-20:00'], slotIndex: 0, remark: '', requestId: requestId(), deliveryContactName: '', deliveryPhone: '', deliveryRegion: [], deliveryAddress: '' },
  onShow() { this.load() },
  onHide() { this.saveDraft() },
  saveDraft() {
    if (!app.globalData.pickupDraft?.selected?.length) return
    const selectedKey = app.globalData.pickupDraft.selected.map(item => `${item.id}:${item.quantity}`).join(',')
    wx.setStorageSync('appointmentDraft', {
      selectedKey, addressId: this.data.addresses[this.data.addressIndex]?.id,
      appointmentDate: this.data.appointmentDate, slotIndex: this.data.slotIndex,
      remark: this.data.remark, voucherCode: this.data.voucherCode, requestId: this.data.requestId,
      deliveryContactName: this.data.deliveryContactName, deliveryPhone: this.data.deliveryPhone,
      deliveryRegion: this.data.deliveryRegion, deliveryAddress: this.data.deliveryAddress
    })
  },
  async load() {
    this.setData({ error: '' })
    const draft = app.globalData.pickupDraft || wx.getStorageSync('pickupDraft')
    if (!draft || !draft.selected || !draft.selected.length) return wx.navigateBack()
    app.globalData.pickupDraft = draft
    const selectedKey = draft.selected.map(item => `${item.id}:${item.quantity}`).join(',')
    const saved = wx.getStorageSync('appointmentDraft') || {}
    if (saved.selectedKey === selectedKey) this.setData({ appointmentDate: saved.appointmentDate || tomorrow(), slotIndex: saved.slotIndex || 0, remark: saved.remark || '', voucherCode: saved.voucherCode || '', requestId: saved.requestId || requestId(), deliveryContactName: saved.deliveryContactName || '', deliveryPhone: saved.deliveryPhone || '', deliveryRegion: saved.deliveryRegion || [], deliveryAddress: saved.deliveryAddress || '' })
    this.setData({ loading: true, selected: draft.selected, deal: draft.deal || null, count: draft.selected.reduce((sum, item) => sum + item.quantity, 0), total: draft.selected.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2) })
    try {
      let addresses = (await app.request('/addresses')).map(item => ({ ...item, isDefault: Boolean(item.isDefault) }))
      if (!addresses.length) {
        const fallback = await app.request('/pickup-defaults')
        if (fallback.contactName && fallback.pickupAddress) addresses = [{ id: null, contactName: fallback.contactName, detailAddress: fallback.pickupAddress, isDefault: true }]
      }
      const savedIndex = addresses.findIndex(item => item.id === saved.addressId)
      const addressIndex = savedIndex >= 0 ? savedIndex : Math.max(0, addresses.findIndex(item => item.isDefault))
      const current = addresses[addressIndex]
      this.setData({ addresses, addressIndex,
        deliveryContactName: this.data.deliveryContactName || current?.contactName || '',
        deliveryAddress: this.data.deliveryAddress || current?.detailAddress || '' })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  selectAddress(e) { this.setData({ addressIndex: Number(e.detail.value) }); this.saveDraft() },
  selectDeliveryRegion(e) { this.setData({ deliveryRegion: e.detail.value }); this.saveDraft() },
  inputDelivery(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); this.saveDraft() },
  selectDate(e) { this.setData({ appointmentDate: e.detail.value }); this.saveDraft() },
  selectSlot(e) { this.setData({ slotIndex: Number(e.detail.value) }); this.saveDraft() },
  inputRemark(e) { this.setData({ remark: e.detail.value }); this.saveDraft() },
  inputVoucher(e) { this.setData({ voucherCode: e.detail.value.trim().toUpperCase() }); this.saveDraft() },
  manageAddresses() { wx.navigateTo({ url: '/pages/addresses/addresses' }) },
  backToCatalog() { wx.navigateBack() },
  async submit() {
    const address = this.data.addresses[this.data.addressIndex]
    if (!address) return this.setData({ error: '请先新增联系人和上门地址' })
    if (!this.data.deliveryContactName.trim() || !/^1\d{10}$/.test(this.data.deliveryPhone.trim())
      || this.data.deliveryRegion.length !== 3 || !this.data.deliveryAddress.trim())
      return this.setData({ error: '请填写完整的寄回收件人、手机号和地址' })
    if (this.data.deal && !this.data.voucherCode) return this.setData({ error: '请输入团购券码' })
    this.setData({ submitting: true, error: '' })
    try {
      const dealRemark = this.data.deal ? `【团购套餐】${this.data.deal.name}，参考价¥${this.data.deal.price}；门店核对适用范围和核销方式。` : ''
      const order = await app.request('/pickup-orders', { method: 'POST', data: {
        requestId: this.data.requestId, contactName: address.contactName, pickupAddress: address.detailAddress,
        appointmentDate: this.data.appointmentDate, appointmentSlot: this.data.slots[this.data.slotIndex], remark: [dealRemark, this.data.remark.trim()].filter(Boolean).join('\n'),
        items: this.data.selected.map(item => ({ categoryId: item.id, quantity: item.quantity })),
        dealCode: this.data.deal && this.data.deal.code, dealPlatform: this.data.deal && this.data.deal.platform,
        voucherCode: this.data.deal ? this.data.voucherCode : null,
        deliveryContactName: this.data.deliveryContactName.trim(), deliveryPhone: this.data.deliveryPhone.trim(),
        deliveryProvince: this.data.deliveryRegion[0], deliveryCity: this.data.deliveryRegion[1],
        deliveryDistrict: this.data.deliveryRegion[2], deliveryAddress: this.data.deliveryAddress.trim()
      } })
      app.globalData.pickupDraft = null
      wx.removeStorageSync('pickupDraft')
      wx.removeStorageSync('appointmentDraft')
      const amount = this.data.deal ? `团购参考价 ¥${this.data.deal.price}\n验衣后确认洗护费与寄回运费。` : `洗护预估 ¥${Number(order.estimated_amount || order.estimatedAmount).toFixed(2)}\n验衣后通知最终账单，付款后快递寄回。`
      await wx.showModal({ title: '预约已提交', content: amount, showCancel: false, confirmText: '查看预约' })
      app.globalData.ordersTab = 'pickup'
      wx.switchTab({ url: '/pages/orders/orders' })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ submitting: false }) }
  }
})
