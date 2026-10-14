Page({
  data: { busy: false, mockMode: getApp().globalData.mockMode, accountClosed: getApp().globalData.accountClosed },
  clearDrafts() {
    for (const key of ['pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
    getApp().globalData.pickupDraft = null
    wx.showToast({ title: '本机草稿已清除', icon: 'success' })
  },
  async requestDeletion() {
    if (this.data.busy) return
    this.setData({ busy: true })
    try {
      const result = await getApp().request('/account/deletion-request', { method: 'POST' })
      await wx.showModal({ title: '申请已登记', content: result.message, showCancel: false })
    } catch (e) { await wx.showModal({ title: '申请未提交', content: e.message, showCancel: false }) }
    finally { this.setData({ busy: false }) }
  },
  async closeAccount() {
    if (this.data.busy) return
    const choice = await wx.showModal({ title: '确认注销账户？', content: '注销后会清除账户绑定和仅由您使用的常用地址。未完成的服务须先办结；必要的交易资料仍可能保留并由门店核验。', confirmText: '确认注销' })
    if (!choice.confirm) return
    this.setData({ busy: true })
    try {
      const result = await getApp().request('/account', { method: 'DELETE' })
      if (result.status === 'ACCOUNT_CLOSED') {
        getApp().closeLocalAccount()
        this.setData({ accountClosed: true })
      }
      await wx.showModal({ title: result.status === 'ACCOUNT_CLOSED' ? '账户已注销' : '暂不能注销', content: result.message, showCancel: false })
      if (result.status === 'ACCOUNT_CLOSED') wx.switchTab({ url: '/pages/profile/profile' })
    } catch (e) { await wx.showModal({ title: '注销未完成', content: e.message, showCancel: false }) }
    finally { this.setData({ busy: false }) }
  }
})
