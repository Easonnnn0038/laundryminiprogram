const { apiBaseUrl, testLoginKey } = require('./config')
const touristMode = (() => {
  try { return wx.getAccountInfoSync().miniProgram.appId === 'touristappid' }
  catch (_) { return false }
})()
const serverTestMode = touristMode && Boolean(testLoginKey)
const localMockMode = touristMode && !serverTestMode
const mock = localMockMode ? require('./mock') : null

App({
  globalData: { token: wx.getStorageSync('token') || '', bound: false, ready: null, pickupDraft: null, ordersTab: '', mockMode: touristMode, serverTestMode },
  onLaunch() { this.globalData.ready = this.login() },
  login() {
    if (localMockMode) {
      const data = mock.login()
      this.saveAuth(data)
      return Promise.resolve(data)
    }
    if (serverTestMode) return this.request('/auth/test-login', { method: 'POST', auth: false, header: { 'X-Miniapp-Test-Key': testLoginKey } })
      .then(data => { this.saveAuth(data); return data })
    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => this.request('/auth/login', { method: 'POST', data: { code }, auth: false })
          .then(data => { this.saveAuth(data); resolve(data) }).catch(reject),
        fail: reject
      })
    })
  },
  saveAuth(data) {
    this.globalData.token = data.token
    this.globalData.bound = data.bound
    wx.setStorageSync('token', data.token)
  },
  request(path, options = {}) {
    if (localMockMode) return Promise.resolve().then(() => mock.request(path, options))
    return new Promise((resolve, reject) => {
      wx.request({
        url: apiBaseUrl + path,
        method: options.method || 'GET',
        data: options.data,
        header: { ...(options.header || {}), ...(options.auth === false ? {} : { Authorization: `Bearer ${this.globalData.token}` }) },
        success: ({ statusCode, data }) => {
          if (statusCode >= 200 && statusCode < 300 && data.code === 200) resolve(data.data)
          else reject(new Error(data && data.message ? data.message : '请求失败，请稍后重试'))
        },
        fail: () => reject(new Error('网络连接失败，请检查后重试'))
      })
    })
  },
  ensureReady() {
    if (!this.globalData.ready) this.globalData.ready = this.login()
    return this.globalData.ready.catch(error => { this.globalData.ready = null; throw error })
  }
})
