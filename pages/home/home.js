const app = getApp()

const categories = [
  { key: 'CLOTHES', name: '衣物', position: 'p00' },
  { key: 'SHOES', name: '鞋类', position: 'p10' },
  { key: 'HOME', name: '家纺卧室', position: 'p20' },
  { key: 'IRON', name: '单烫', position: 'p01' },
  { key: 'LEATHER', name: '皮衣护理', position: 'p11' },
  { key: 'BAG', name: '包包', position: 'p21' }
]

Page({
  data: { loading: true, bound: false, error: '', categories },
  onShow() { this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try { await app.ensureReady(); this.setData({ bound: app.globalData.bound }) }
    catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  async bindPhone(e) {
    if (!e.detail.code) return this.setData({ error: '需要绑定手机号后才能预约上门取衣。' })
    this.setData({ loading: true, error: '' })
    try {
      const data = await app.request('/auth/bind-phone', { method: 'POST', data: { code: e.detail.code } })
      app.saveAuth(data); this.setData({ bound: true })
    } catch (err) { this.setData({ error: err.message }) }
    finally { this.setData({ loading: false }) }
  },
  retry() { app.globalData.ready = null; this.load() },
  openCategory(e) { wx.navigateTo({ url: `/pages/pickup-order/pickup-order?group=${e.currentTarget.dataset.group}` }) }
})
