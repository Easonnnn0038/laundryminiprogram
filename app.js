const { apiBaseUrl, testLoginKey } = require('./config')
const touristMode = (() => {
  try { return wx.getAccountInfoSync().miniProgram.appId === 'touristappid' }
  catch (_) { return false }
})()
const serverTestMode = touristMode && Boolean(testLoginKey)
const localMockMode = touristMode && !serverTestMode
const mock = localMockMode ? require('./mock') : null

App({
  globalData: { token: wx.getStorageSync('token') || '', bound: false, ready: null, pickupDraft: wx.getStorageSync('pickupDraft') || null, ordersTab: '', mockMode: touristMode, serverTestMode, offline: false, reauth: null, accountClosed: Boolean(wx.getStorageSync('accountClosed')), loggedOut: Boolean(wx.getStorageSync('loggedOut')), authGeneration: 0 },
  onLaunch() {
    if (wx.onNetworkStatusChange) wx.onNetworkStatusChange(({ isConnected }) => { this.globalData.offline = !isConnected })
    if (!this.globalData.accountClosed && !this.globalData.loggedOut) {
      if (localMockMode || !touristMode) this.globalData.ready = this.login()
      else if (this.globalData.token && wx.getStorageSync('authSource') === 'password') this.globalData.ready = this.restoreSession()
      else if (this.globalData.token) { this.globalData.token = ''; wx.removeStorageSync('token') }
    }
  },
  restoreSession() {
    const generation = this.globalData.authGeneration
    return this.request('/profile').then(data => {
      if (generation !== this.globalData.authGeneration) throw new Error('请先登录')
      this.globalData.bound = data.bound
      return data
    })
  },
  passwordLogin(phone, password) {
    const generation = this.globalData.authGeneration
    return this.request('/auth/password-login', { method: 'POST', auth: false, data: { phone, password } })
      .then(data => {
        if (generation !== this.globalData.authGeneration) throw new Error('请先登录')
        this.saveAuth(data); wx.setStorageSync('authSource', 'password'); return data
      })
  },
  login() {
    const generation = this.globalData.authGeneration
    if (localMockMode) {
      const data = mock.login()
      this.saveAuth(data)
      return Promise.resolve(data)
    }
    if (serverTestMode) return this.request('/auth/test-login', { method: 'POST', auth: false, header: { 'X-Miniapp-Test-Key': testLoginKey } })
      .then(data => {
        if (generation !== this.globalData.authGeneration) throw new Error('请先登录')
        this.saveAuth(data); return data
      })
    return new Promise((resolve, reject) => {
      wx.login({
        success: ({ code }) => this.request('/auth/login', { method: 'POST', data: { code }, auth: false })
          .then(data => {
            if (generation !== this.globalData.authGeneration) throw new Error('请先登录')
            this.saveAuth(data); resolve(data)
          }).catch(reject),
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
    this.globalData.ready = Promise.resolve(data)
    this.globalData.loggedOut = false
    wx.setStorageSync('token', data.token)
    wx.removeStorageSync('loggedOut')
  },
  logout() {
    this.globalData.authGeneration++
    this.globalData.token = ''
    this.globalData.bound = false
    this.globalData.ready = null
    this.globalData.reauth = null
    this.globalData.pickupDraft = null
    this.globalData.loggedOut = true
    for (const key of ['token', 'authSource', 'draftOwner', 'pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
    wx.setStorageSync('loggedOut', true)
  },
  closeLocalAccount() {
    this.globalData.authGeneration++
    this.globalData.accountClosed = true
    this.globalData.token = ''
    this.globalData.bound = false
    this.globalData.ready = null
    this.globalData.pickupDraft = null
    for (const key of ['token', 'authSource', 'draftOwner', 'pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
    wx.setStorageSync('accountClosed', true)
  },
  reopenAccount() {
    this.globalData.accountClosed = false
    this.globalData.loggedOut = false
    wx.removeStorageSync('accountClosed')
    wx.removeStorageSync('loggedOut')
    if (localMockMode || !touristMode) { this.globalData.ready = this.login(); return this.globalData.ready }
    this.globalData.ready = null
    return Promise.resolve()
  },
  request(path, options = {}) {
    if (this.globalData.accountClosed) return Promise.reject(new Error('账户已注销，请在“我的”页面重新开通'))
    if (this.globalData.loggedOut && options.auth !== false) return Promise.reject(new Error('请先登录'))
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
          if (statusCode === 401 && options.auth !== false && !touristMode && !this.globalData.loggedOut && !options._reauthed) {
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
          if (statusCode === 401 && options.auth !== false) {
            this.globalData.token = ''; this.globalData.bound = false; this.globalData.ready = null
            wx.removeStorageSync('token')
            wx.removeStorageSync('authSource')
            return reject(new Error('登录已过期，请重新登录'))
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
    if (this.globalData.loggedOut) return Promise.reject(new Error('请先登录'))
    if (!this.globalData.ready) {
      if (localMockMode || !touristMode) this.globalData.ready = this.login()
      else if (this.globalData.token) this.globalData.ready = this.restoreSession()
      else return Promise.reject(new Error('请先登录'))
    }
    return this.globalData.ready.catch(error => { this.globalData.ready = null; throw error })
  }
})
