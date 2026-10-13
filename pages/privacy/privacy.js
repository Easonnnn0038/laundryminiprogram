Page({
  clearDrafts() {
    for (const key of ['pickupDraft', 'appointmentDraft', 'addressDraft']) wx.removeStorageSync(key)
    getApp().globalData.pickupDraft = null
    wx.showToast({ title: '本机草稿已清除', icon: 'success' })
  }
})
