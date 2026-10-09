const app = getApp()
Page({
  data: { loading: true, bound: false, phone: '', memberCard: null, memberError: '', error: '' },
  onShow() { this.load() },
  async load() {
    this.setData({ loading: true, error: '', memberError: '' })
    try {
      await app.ensureReady()
      const data = await app.request('/profile')
      this.setData({ ...data, memberCard: null })
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
    catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  async bindPhone(e) {
    if (!e.detail.code) return this.setData({ error: '需要绑定手机号才能查看本人订单，您可以稍后重试。' })
    this.setData({ loading: true, error: '' })
    try { const data = await app.request('/auth/bind-phone', { method: 'POST', data: { code: e.detail.code } }); app.saveAuth(data); await this.load() }
    catch (err) { this.setData({ error: err.message, loading: false }) }
  },
  openAddresses() {
    if (!this.data.bound) return this.setData({ error: '请先绑定手机号' })
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
  showPrivacy() { wx.showModal({ title: '隐私说明', content: '手机号只用于匹配本人洗衣订单和接收您主动授权的订单通知，不会在小程序中公开。', showCancel: false }) },
  showNotice() { wx.showToast({ title: '通知模板配置后开放', icon: 'none' }) }
})
