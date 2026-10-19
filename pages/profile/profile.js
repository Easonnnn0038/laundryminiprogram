const app = getApp()
Page({
  data: { loading: true, closed: false, bound: false, authenticated: false, loggingOut: false, phone: '', memberCard: null, memberError: '', error: '' },
  onShow() { this.load() },
  async load() {
    if (app.globalData.accountClosed) return this.setData({ loading: false, closed: true, authenticated: false, error: '' })
    this.setData({ loading: true, closed: false, error: '', memberError: '' })
    try {
      await app.ensureReady()
      const data = await app.request('/profile')
      this.setData({ ...data, authenticated: true, memberCard: null })
      if (data.bound) {
        try {
          const memberCard = await app.request('/member-card')
          if (memberCard.active) {
            memberCard.balanceText = Number(memberCard.balance || 0).toFixed(2)
            memberCard.totalConsumeText = Number(memberCard.totalConsume || 0).toFixed(2)
          }
          this.setData({ memberCard })
        } catch (_) {
          this.setData({ memberError: '会员卡信息暂时无法加载' })
        }
      }
    }
    catch (e) { this.setData({ bound: false, authenticated: false, error: ['请先登录', '登录已过期，请重新登录'].includes(e.message) ? '' : e.message }) }
    finally { this.setData({ loading: false }) }
  },
  async reopenAccount() {
    this.setData({ loading: true, error: '' })
    try { await app.reopenAccount(); wx.navigateTo({ url: '/pages/login/login' }) }
    catch (e) { this.setData({ loading: false, error: e.message }) }
  },
  goLogin() { wx.navigateTo({ url: '/pages/login/login' }) },
  async logout() {
    if (this.data.loggingOut) return
    const choice = await wx.showModal({ title: '退出登录？', content: '退出后需重新登录，未提交的本机草稿会清除。', confirmText: '退出登录' })
    if (!choice.confirm) return
    this.setData({ loggingOut: true })
    app.logout()
    wx.reLaunch({ url: '/pages/login/login' })
  },
  openAddresses() {
    if (!this.data.bound) return this.goLogin()
    wx.navigateTo({ url: '/pages/addresses/addresses' })
  },
  recharge() {
    const options = this.data.memberCard && this.data.memberCard.rechargeOptions || []
    if (!options.length) return wx.showToast({ title: '暂无可用充值档位', icon: 'none' })
    wx.showActionSheet({
      itemList: options.map(item => `${item.name}　¥${Number(item.amount).toFixed(0)}`),
      success: ({ tapIndex }) => this.confirmRecharge(options[tapIndex])
    })
  },
  async confirmRecharge(option) {
    const phone = this.data.memberCard.storePhone
    const result = await wx.showModal({
      title: `充值 ¥${Number(option.amount).toFixed(0)}`,
      content: `当前请联系${this.data.memberCard.storeName || '办卡门店'}完成付款，到账后余额会自动更新。`,
      showCancel: Boolean(phone), cancelText: '暂不', confirmText: phone ? '联系门店' : '知道了'
    })
    if (result.confirm && phone) wx.makePhoneCall({ phoneNumber: phone })
  },
  showPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  showDeletion() { this.showPrivacy() },
  showNotice() { wx.showToast({ title: '通知模板配置后开放', icon: 'none' }) }
})
