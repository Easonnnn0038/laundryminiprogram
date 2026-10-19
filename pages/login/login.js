const app = getApp()

Page({
  data: { loading: true, submitting: false, closed: false, demo: app.globalData.mockMode && !app.globalData.serverTestMode, wechatMode: !app.globalData.mockMode, mode: 'password', phone: '', password: '', code: '', error: '' },
  onShow() { this.prepare() },
  async prepare() {
    if (app.globalData.accountClosed) return this.setData({ loading: false, closed: true, error: '' })
    this.setData({ loading: true, closed: false, error: '' })
    try {
      if ((this.data.demo || this.data.wechatMode) && !app.globalData.loggedOut) await app.ensureReady()
      else if (app.globalData.token) {
        await app.ensureReady()
        if (app.globalData.bound) return wx.switchTab({ url: '/pages/home/home' })
      }
    } catch (error) {
      if (error.message !== '登录已过期，请重新登录') this.setData({ error: error.message })
    } finally { this.setData({ loading: false }) }
  },
  changeMode(event) { this.setData({ mode: event.currentTarget.dataset.mode, error: '', code: '' }) },
  inputPhone(event) { this.setData({ phone: event.detail.value.trim(), error: '' }) },
  inputPassword(event) { this.setData({ password: event.detail.value, error: '' }) },
  inputCode(event) { this.setData({ code: event.detail.value.trim(), error: '' }) },
  async submitPassword() {
    if (this.data.submitting) return
    if (!/^1\d{10}$/.test(this.data.phone)) return this.setData({ error: '请输入 11 位手机号' })
    if (!this.data.password) return this.setData({ error: '请输入密码' })
    this.setData({ submitting: true, error: '' })
    try {
      await app.passwordLogin(this.data.phone, this.data.password)
      this.setData({ password: '' })
      wx.switchTab({ url: '/pages/home/home' })
    } catch (error) { this.setData({ error: error.message }) }
    finally { this.setData({ submitting: false }) }
  },
  async bindPhone(event) {
    if (!event.detail.code) return this.setData({ error: '未完成手机号授权，可稍后重试。' })
    this.setData({ submitting: true, error: '' })
    try {
      if (app.globalData.loggedOut) await app.login()
      else await app.ensureReady()
      const data = await app.request('/auth/bind-phone', { method: 'POST', data: { code: event.detail.code } })
      app.saveAuth(data)
      wx.switchTab({ url: '/pages/home/home' })
    } catch (error) { this.setData({ error: error.message }) }
    finally { this.setData({ submitting: false }) }
  },
  async reopenAccount() {
    this.setData({ loading: true, error: '' })
    try { await app.reopenAccount(); this.setData({ closed: false }); await this.prepare() }
    catch (error) { this.setData({ error: error.message, loading: false }) }
  },
  async enterDemo() {
    if (app.globalData.loggedOut) await app.login()
    wx.switchTab({ url: '/pages/home/home' })
  },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) }
})
