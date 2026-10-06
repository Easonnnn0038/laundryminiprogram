const app = getApp()

const groupLabels = {
  CLOTHES: '衣物类', SHOES: '鞋类', HOME: '家纺卧室',
  IRON: '单烫类', LEATHER: '皮衣护理', BAG: '包包类'
}

function tomorrow() {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function requestId() { return `pickup_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` }

Page({
  data: {
    loading: true, submitting: false, error: '', catalog: [], visibleCatalog: [], groups: [], activeGroup: '', orders: [], total: '0.00', originalTotal: '0.00', discount: '0.00', count: 0, requestId: requestId(), memberCardType: '',
    contactName: '', pickupAddress: '', appointmentDate: tomorrow(),
    slots: ['09:00-12:00', '13:00-17:00', '18:00-20:00'], slotIndex: 0, remark: ''
  },
  onLoad() { this.load() },
  async load() {
    try {
      await app.ensureReady()
      if (!app.globalData.bound) throw new Error('请先在首页绑定手机号')
      const [catalog, orders, defaults] = await Promise.all([app.request('/pickup-catalog'), app.request('/pickup-orders'), app.request('/pickup-defaults')])
      const member = catalog.find(item => item.member)
      const items = catalog.map(item => ({ ...item, quantity: 0 }))
      const groups = [...new Set(items.map(item => item.categoryGroup))].map(key => ({ key, label: groupLabels[key] || key }))
      const activeGroup = groups.length ? groups[0].key : ''
      this.setData({
        catalog: items, visibleCatalog: items.filter(item => item.categoryGroup === activeGroup), groups, activeGroup,
        contactName: defaults.contactName || '', pickupAddress: defaults.pickupAddress || '',
        memberCardType: member ? member.cardTypeName : '',
        orders: orders.map(item => ({ ...item, statusLabel: this.statusLabel(item.status) }))
      })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  changeQuantity(e) {
    const id = Number(e.currentTarget.dataset.id), delta = Number(e.currentTarget.dataset.delta)
    const catalog = this.data.catalog.map(item => item.id === id ? { ...item, quantity: Math.max(0, Math.min(20, item.quantity + delta)) } : item)
    this.setData({ catalog, visibleCatalog: catalog.filter(item => item.categoryGroup === this.data.activeGroup) }, () => this.calculate())
  },
  selectGroup(e) {
    const activeGroup = e.currentTarget.dataset.group
    this.setData({ activeGroup, visibleCatalog: this.data.catalog.filter(item => item.categoryGroup === activeGroup) })
  },
  calculate() {
    const selected = this.data.catalog.filter(item => item.quantity > 0)
    const originalTotal = selected.reduce((sum, item) => sum + Number(item.originalPrice || item.price) * item.quantity, 0)
    const total = selected.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    this.setData({ count: selected.reduce((sum, item) => sum + item.quantity, 0), originalTotal: originalTotal.toFixed(2), discount: (originalTotal - total).toFixed(2), total: total.toFixed(2) })
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  selectDate(e) { this.setData({ appointmentDate: e.detail.value }) },
  selectSlot(e) { this.setData({ slotIndex: Number(e.detail.value) }) },
  statusLabel(status) { return ({SUBMITTED:'待门店接单',PENDING_PAYMENT:'待付款',PAID:'待门店接单',CONFIRMED:'等待上门',PICKED_UP:'已取回待收衣',INSPECTED:'已验衣',CONVERTED:'已转正式订单',CANCELLED:'已取消'})[status] || status },
  async submit() {
    if (!this.data.contactName.trim()) return this.setData({ error: '请填写联系人姓名' })
    if (!this.data.pickupAddress.trim()) return this.setData({ error: '请填写详细上门地址' })
    const items = this.data.catalog.filter(item => item.quantity > 0).map(item => ({ categoryId: item.id, quantity: item.quantity }))
    if (!items.length) return this.setData({ error: '请至少选择一件衣物' })
    this.setData({ submitting: true, error: '' })
    try {
      const order = await app.request('/pickup-orders', { method: 'POST', data: {
        requestId: this.data.requestId, contactName: this.data.contactName.trim(), pickupAddress: this.data.pickupAddress.trim(),
        appointmentDate: this.data.appointmentDate, appointmentSlot: this.data.slots[this.data.slotIndex],
        remark: this.data.remark.trim(), items
      } })
      await wx.showModal({ title: '预约成功', content: `预估金额 ¥${Number(order.estimated_amount || order.estimatedAmount).toFixed(2)}\n门店取衣验收后按实际衣物结算。`, showCancel: false })
      const orders = await app.request('/pickup-orders')
      const catalog = this.data.catalog.map(item => ({ ...item, quantity: 0 }))
      this.setData({ catalog, visibleCatalog: catalog.filter(item => item.categoryGroup === this.data.activeGroup), orders: orders.map(item => ({ ...item, statusLabel: this.statusLabel(item.status) })), total: '0.00', originalTotal: '0.00', discount: '0.00', count: 0, remark: '', requestId: requestId() })
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ submitting: false }) }
  }
})
