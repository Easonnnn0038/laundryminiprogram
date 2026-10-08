const app = getApp()

Page({
  data: { loading: true, saving: false, error: '', addresses: [], editing: false, editId: null, contactName: '', detailAddress: '', isDefault: false },
  onLoad() { this.load() },
  async load() {
    this.setData({ loading: true, error: '' })
    try { this.setData({ addresses: (await app.request('/addresses')).map(item => ({ ...item, isDefault: Boolean(item.isDefault) })) }) }
    catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ loading: false }) }
  },
  add() { this.setData({ editing: true, editId: null, contactName: '', detailAddress: '', isDefault: !this.data.addresses.length }) },
  edit(e) {
    const item = this.data.addresses.find(address => address.id === Number(e.currentTarget.dataset.id))
    this.setData({ editing: true, editId: item.id, contactName: item.contactName, detailAddress: item.detailAddress, isDefault: item.isDefault })
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  toggleDefault(e) { this.setData({ isDefault: e.detail.value }) },
  cancel() { this.setData({ editing: false, error: '' }) },
  async save() {
    if (!this.data.contactName.trim()) return this.setData({ error: '请填写联系人姓名' })
    if (!this.data.detailAddress.trim()) return this.setData({ error: '请填写完整上门地址' })
    this.setData({ saving: true, error: '' })
    try {
      const path = this.data.editId ? `/addresses/${this.data.editId}` : '/addresses'
      await app.request(path, { method: this.data.editId ? 'PUT' : 'POST', data: { contactName: this.data.contactName.trim(), detailAddress: this.data.detailAddress.trim(), isDefault: this.data.isDefault } })
      this.setData({ editing: false }); await this.load()
    } catch (e) { this.setData({ error: e.message }) }
    finally { this.setData({ saving: false }) }
  },
  async setDefault(e) {
    try { await app.request(`/addresses/${e.currentTarget.dataset.id}/default`, { method: 'POST' }); await this.load() }
    catch (err) { this.setData({ error: err.message }) }
  },
  async remove(e) {
    const result = await wx.showModal({ title: '删除地址？', content: '删除后无法恢复。' })
    if (!result.confirm) return
    try { await app.request(`/addresses/${e.currentTarget.dataset.id}`, { method: 'DELETE' }); await this.load() }
    catch (err) { this.setData({ error: err.message }) }
  }
})
