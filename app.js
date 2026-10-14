const { apiBaseUrl, testLoginKey } = require('./config')
const touristMode = (() => {
  try { return wx.getAccountInfoSync().miniProgram.appId === 'touristappid' }
  catch (_) { return false }
})()
const serverTestMode = touristMode && Boolean(testLoginKey)
const localMockMode = touristMode && !serverTestMode
const mock = localMockMode ? require('./mock') : null

App({
  globalData: { token: wx.getStorageSync('token') || '', bound: false, ready: null, pickupDraft: wx.getStorageSync('pickupDraft') || null, ordersTab: '', mockMode: touristMode, serverTestMode, offline: false, reauth: null, accountClosed: Boolean(wx.getStorageSync('accountClosed')) },
  onLaunch() {
    if (wx.onNetworkStatusChange) wx.onNetworkStatusChange(({ isConnected }) => { this.globalData.offline = !isConnected })
    if (!this.globalData.accountClosed) this.globalData.ready = this.login()
  },
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
    const owner = wx.getStorageSync('draftOwner') || ''
    if (owner && owner !== (data.phone || '')) {
      for (const key of ['pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
      this.globalData.pickupDraft = null
    }
    wx.setStorageSync('draftOwner', data.phone || '')
    this.globalData.token = data.token
    this.globalData.bound = data.bound
    wx.setStorageSync('token', data.token)
  },
  closeLocalAccount() {
    this.globalData.accountClosed = true
    this.globalData.token = ''
    this.globalData.bound = false
    this.globalData.ready = null
    this.globalData.pickupDraft = null
    for (const key of ['token', 'draftOwner', 'pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
    wx.setStorageSync('accountClosed', true)
  },
  reopenAccount() {
    this.globalData.accountClosed = false
    wx.removeStorageSync('accountClosed')
    this.globalData.ready = this.login()
    return this.globalData.ready
  },
  request(path, options = {}) {
    if (this.globalData.accountClosed) return Promise.reject(new Error('账户已注销，请在“我的”页面重新开通'))
    if (localMockMode) return Promise.resolve().then(() => mock.request(path, options))
    const method = options.method || 'GET'
    const send = attempt => new Promise((resolve, reject) => {
      wx.request({
        url: apiBaseUrl + path,
        method,
        timeout: 15000,
        data: options.data,
        header: { ...(options.header || {}), ...(options.auth === false ? {} : { Authorization: `Bearer ${this.globalData.token}` }) },
        success: ({ statusCode, data }) => {
          this.globalData.offline = false
          if (statusCode >= 200 && statusCode < 300 && data && data.code === 200) return resolve(data.data)
          if (statusCode === 401 && options.auth !== false && !options._reauthed) {
            this.globalData.token = ''; this.globalData.bound = false; wx.setStorageSync('token', '')
            if (!this.globalData.reauth) {
              this.globalData.ready = this.login()
              this.globalData.reauth = this.globalData.ready.finally(() => { this.globalData.reauth = null })
            }
            return this.globalData.reauth.then(() => method === 'GET'
              ? this.request(path, { ...options, _reauthed: true }).then(resolve, reject)
              : reject(new Error('登录已恢复，请再次点击刚才的操作')),
            () => reject(new Error('登录已失效，请检查网络后重试')))
          }
          if (method === 'GET' && attempt === 0 && [502, 503, 504].includes(statusCode)) return send(1).then(resolve, reject)
          reject(new Error(data && data.message ? data.message : '请求失败，请稍后重试'))
        },
        fail: () => {
          if (method === 'GET' && attempt === 0) return send(1).then(resolve, reject)
          this.globalData.offline = true
          if (wx.showToast) wx.showToast({ title: '网络不可用，请检查后重试', icon: 'none' })
          reject(new Error('网络连接失败，请检查后重试'))
        }
      })
    })
    return send(0)
  },
  ensureReady() {
    if (this.globalData.accountClosed) return Promise.reject(new Error('账户已注销，请在“我的”页面重新开通'))
    if (!this.globalData.ready) this.globalData.ready = this.login()
    return this.globalData.ready.catch(error => { this.globalData.ready = null; throw error })
  }
})
