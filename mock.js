const progress = [
  { label: '已收衣', done: true, current: false },
  { label: '工厂处理中', done: true, current: false },
  { label: '返回门店', done: true, current: false },
  { label: '可以取衣', done: true, current: true },
  { label: '已完成', done: false, current: false }
]

const current = {
  id: 9001,
  orderNo: 'DEMO202610050001',
  status: 'NOTIFIED',
  statusLabel: '可以取衣',
  totalCount: 2,
  receiveTime: '2026-10-04T15:30:00',
  urgent: false,
  storeName: '小木棒洗衣示范门店',
  storePhone: '021-55556666',
  storeAddress: '上海市示范路 88 号',
  pickupCode: '1024',
  totalAmount: 76,
  discountAmount: 6,
  urgentSurcharge: 0,
  totalPaid: 70,
  paymentMethod: '微信',
  items: [
    { id: 1, categoryName: '西装上衣', color: '藏青色', brand: '', special: '轻柔洗护', statusLabel: '已回店' },
    { id: 2, categoryName: '长裤', color: '黑色', brand: '', special: '', statusLabel: '已回店' }
  ],
  progress
}

const history = {
  ...current,
  id: 9002,
  orderNo: 'DEMO202609280001',
  status: 'PICKED_UP',
  statusLabel: '已完成',
  receiveTime: '2026-09-28T10:20:00',
  pickupCode: '',
  progress: progress.map(step => ({ ...step, done: true, current: step.label === '已完成' }))
}

const catalog = [
  { id: 101, categoryGroup: 'CLOTHES', name: '西装上衣', originalPrice: 48, price: 42.24, unit: '件', remark: '', member: true, cardTypeName: '8.8折卡' },
  { id: 102, categoryGroup: 'CLOTHES', name: '长裤', originalPrice: 28, price: 24.64, unit: '条', remark: '', member: true, cardTypeName: '8.8折卡' },
  { id: 103, categoryGroup: 'CLOTHES', name: '羽绒服', originalPrice: 68, price: 59.84, unit: '件', remark: '起', member: true, cardTypeName: '8.8折卡' },
  { id: 104, categoryGroup: 'SHOES', name: '运动鞋', originalPrice: 45, price: 39.6, unit: '双', remark: '', member: true, cardTypeName: '8.8折卡' },
  { id: 105, categoryGroup: 'HOME', name: '床单', originalPrice: 35, price: 30.8, unit: '件', remark: '', member: true, cardTypeName: '8.8折卡' },
  { id: 106, categoryGroup: 'IRON', name: '衬衫单烫', originalPrice: 18, price: 15.84, unit: '件', remark: '', member: true, cardTypeName: '8.8折卡' },
  { id: 107, categoryGroup: 'LEATHER', name: '皮衣护理', originalPrice: 168, price: 147.84, unit: '件', remark: '起', member: true, cardTypeName: '8.8折卡' },
  { id: 108, categoryGroup: 'BAG', name: '手提包护理', originalPrice: 128, price: 112.64, unit: '只', remark: '起', member: true, cardTypeName: '8.8折卡' }
]
let pickupOrder
let addresses = [{ id: 1, contactName: '演示顾客', detailAddress: '示范路 88 号 2 栋 101 室', isDefault: true }]
let nextAddressId = 2

function summary(order) {
  const { items, progress, totalAmount, discountAmount, urgentSurcharge, totalPaid, paymentMethod, ...value } = order
  return value
}

module.exports = {
  login: () => ({ token: 'tourist-demo-token', bound: true, phone: '138****0000' }),
  request(path, options = {}) {
    if (path === '/profile') return { bound: true, phone: '138****0000' }
    if (path === '/auth/bind-phone') return this.login()
    if (path === '/orders') return [summary(current)]
    if (path === '/orders?history=true') return [summary(history)]
    if (path === '/orders/9001') return { ...current }
    if (path === '/orders/9002') return { ...history }
    if (path === '/pickup-catalog') return catalog.map(item => ({ ...item }))
    if (path === '/pickup-defaults') return { contactName: '演示顾客', pickupAddress: '示范路 88 号 2 栋 101 室' }
    if (path === '/addresses' && (!options.method || options.method === 'GET')) return addresses.map(item => ({ ...item }))
    if (path === '/addresses' && options.method === 'POST') {
      if (options.data.isDefault || !addresses.length) addresses = addresses.map(item => ({ ...item, isDefault: false }))
      const value = { id: nextAddressId++, ...options.data, isDefault: Boolean(options.data.isDefault || !addresses.length) }
      addresses.push(value); return { ...value }
    }
    const addressMatch = path.match(/^\/addresses\/(\d+)(\/default)?$/)
    if (addressMatch) {
      const id = Number(addressMatch[1])
      if (addressMatch[2] && options.method === 'POST') { addresses = addresses.map(item => ({ ...item, isDefault: item.id === id })); return {} }
      if (options.method === 'PUT') {
        if (options.data.isDefault) addresses = addresses.map(item => ({ ...item, isDefault: false }))
        addresses = addresses.map(item => item.id === id ? { ...item, ...options.data } : item); return addresses.find(item => item.id === id)
      }
      if (options.method === 'DELETE') { const removed = addresses.find(item => item.id === id); addresses = addresses.filter(item => item.id !== id); if (removed && removed.isDefault && addresses.length) addresses[0].isDefault = true; return {} }
    }
    if (path === '/pickup-orders' && options.method === 'POST') {
      const items = options.data.items.map(selected => {
        const category = catalog.find(item => item.id === selected.categoryId)
        return { categoryId: category.id, categoryName: category.name, unit: category.unit, quantity: selected.quantity, unitPrice: category.price, subtotal: category.price * selected.quantity }
      })
      const estimatedAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
      const originalAmount = items.reduce((sum, item) => sum + catalog.find(c => c.id === item.categoryId).originalPrice * item.quantity, 0)
      pickupOrder = { id: 9101, pickupNo: 'PUDEMO20261005001', status: 'SUBMITTED', originalAmount, discountAmount: originalAmount - estimatedAmount, estimatedAmount, paidAmount: 0, ...options.data, items }
      return { ...pickupOrder }
    }
    if (path === '/pickup-orders') return pickupOrder ? [{ ...pickupOrder }] : []
    if (path === '/pickup-orders/9101') return { ...pickupOrder }
    throw new Error('演示数据不支持该请求')
  }
}
