const app = getApp()
Page({
  data: { loading: true, bound: false, phone: '', error: '' },
  onShow() { this.load() },
  async load() {
    try { await app.ensureReady(); const data = await app.request('/profile'); this.setData(data) }
    catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  async bindPhone(e) {
    if (!e.detail.code) return this.setData({ error: '需要绑定手机号才能查看本人订单，您可以稍后重试。' })
    this.setData({ loading: true, error: '' })
    try { const data = await app.request('/auth/bind-phone', { method: 'POST', data: { code: e.detail.code } }); app.saveAuth(data); await this.load() }
    catch (err) { this.setData({ error: err.message, loading: false }) }
  },
  showPrivacy() { wx.showModal({ title: '隐私说明', content: '手机号只用于匹配本人洗衣订单和接收您主动授权的订单通知，不会在小程序中公开。', showCancel: false }) },
  showNotice() { wx.showToast({ title: '通知模板配置后开放', icon: 'none' }) }
})
