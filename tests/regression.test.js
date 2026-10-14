const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const storage = new Map()

function loadPage(relative, app, wxOverrides = {}) {
  let definition
  global.getApp = () => app
  global.Page = value => { definition = value }
  global.wx = {
    navigateTo() {}, navigateBack() {}, switchTab() {}, showModal: async () => {},
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key), ...wxOverrides
  }
  const filename = path.join(root, relative)
  delete require.cache[require.resolve(filename)]
  require(filename)
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) }
  page.setData = (patch, done) => { Object.assign(page.data, patch); if (done) done() }
  return page
}

test('套餐从选衣页完整传递到预约备注', async () => {
  storage.clear()
  const requests = []
  const app = {
    globalData: { bound: true, pickupDraft: null },
    ensureReady: async () => {},
    request: async (url, options = {}) => {
      requests.push({ url, options })
      if (url === '/pickup-catalog') return [{ id: 1, categoryGroup: 'CLOTHES', price: 15, originalPrice: 20 }]
      if (url === '/deals') return require('../data/deals').deals
      if (url === '/addresses') return [{ contactName: '测试', detailAddress: '测试地址', isDefault: true }]
      if (url === '/pickup-orders') return { estimatedAmount: 15 }
      throw new Error(`unexpected ${url}`)
    }
  }
  const pickup = loadPage('pages/pickup-order/pickup-order.js', app)
  pickup.initialGroup = 'CLOTHES'
  pickup.selectedDeal = require('../data/deals').deals[0]
  await pickup.load()
  pickup.data.catalog[0].quantity = 1
  pickup.calculate()
  assert.equal(app.globalData.pickupDraft.deal.code, 'MIX_1')

  const appointment = loadPage('pages/appointment/appointment.js', app)
  await appointment.load()
  assert.equal(appointment.data.deal.code, 'MIX_1')
  appointment.data.voucherCode = 'TEST-001'
  await appointment.submit()
  const submitted = requests.find(item => item.url === '/pickup-orders').options.data
  assert.match(submitted.remark, /【团购套餐】衣服鞋任选 1 件，参考价¥10.9/)
  assert.equal(app.globalData.pickupDraft, null)
})

test('网络失败会留在页面并显示可重试错误', async () => {
  storage.clear()
  const app = {
    globalData: { bound: true, pickupDraft: { selected: [{ id: 1, quantity: 1, price: 10 }], deal: null } },
    request: async () => { throw new Error('网络连接失败，请检查后重试') }
  }
  const appointment = loadPage('pages/appointment/appointment.js', app)
  await appointment.load()
  assert.equal(appointment.data.loading, false)
  assert.equal(appointment.data.error, '网络连接失败，请检查后重试')
})

test('套餐数据代码唯一且精选套餐恰好三项', () => {
  const { deals, featuredDeals } = require('../data/deals')
  assert.equal(new Set(deals.map(item => item.code)).size, deals.length)
  assert.equal(featuredDeals.length, 3)
})

test('选衣与预约草稿可在页面重新创建后恢复', async () => {
  storage.clear()
  const app = { globalData: { bound: true, pickupDraft: null }, ensureReady: async () => {}, request: async url => {
    if (url === '/pickup-catalog') return [{ id: 1, categoryGroup: 'CLOTHES', price: 15, originalPrice: 20 }]
    if (url === '/deals') return require('../data/deals').deals
    if (url === '/addresses') return [{ id: 7, contactName: '测试', detailAddress: '测试地址', isDefault: true }]
    throw new Error(`unexpected ${url}`)
  } }
  const pickup = loadPage('pages/pickup-order/pickup-order.js', app)
  pickup.initialGroup = 'CLOTHES'; await pickup.load()
  pickup.data.catalog[0].quantity = 2; pickup.calculate()
  const appointment = loadPage('pages/appointment/appointment.js', app)
  await appointment.load()
  appointment.inputRemark({ detail: { value: '门口取衣' } })
  const originalId = appointment.data.requestId
  app.globalData.pickupDraft = null
  const restored = loadPage('pages/appointment/appointment.js', app)
  await restored.load()
  assert.equal(restored.data.remark, '门口取衣')
  assert.equal(restored.data.requestId, originalId)
  assert.equal(restored.data.count, 2)
})

test('401 后重新登录并继续原页面的 GET 请求', async () => {
  let definition, logins = 0, reads = 0
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: () => '', setStorageSync: () => {},
    login: ({ success }) => { logins++; success({ code: 'fresh-code' }) },
    request: ({ url, success }) => {
      if (url.endsWith('/auth/login')) return success({ statusCode: 200, data: { code: 200, data: { token: 'fresh-token', bound: true } } })
      reads++
      success(reads === 1 ? { statusCode: 401, data: {} } : { statusCode: 200, data: { code: 200, data: ['order'] } })
    }
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData, token: 'old-token' } }
  assert.deepEqual(await app.request('/orders'), ['order'])
  assert.equal(logins, 1)
  assert.equal(reads, 2)
  assert.equal(app.globalData.token, 'fresh-token')
})

test('网络失败只重试 GET，不自动重复提交预约', async () => {
  let definition, calls = 0
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: () => '', setStorageSync: () => {}, showToast: () => {},
    request: ({ fail }) => { calls++; fail() }
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData } }
  await assert.rejects(app.request('/orders'), /网络连接失败/)
  assert.equal(calls, 2)
  await assert.rejects(app.request('/pickup-orders', { method: 'POST' }), /网络连接失败/)
  assert.equal(calls, 3)
  assert.equal(app.globalData.offline, true)
})

test('地址编辑草稿在重新打开后恢复', () => {
  storage.clear()
  const app = { request: async () => [] }
  const first = loadPage('pages/addresses/addresses.js', app)
  first.add()
  first.input({ currentTarget: { dataset: { field: 'contactName' } }, detail: { value: '张先生' } })
  const restored = loadPage('pages/addresses/addresses.js', app)
  restored.onLoad()
  assert.equal(restored.data.editing, true)
  assert.equal(restored.data.contactName, '张先生')
})

test('注销仅在服务端确认后清除本机账户', async () => {
  storage.clear()
  let closed = 0, calls = 0
  const app = {
    globalData: { mockMode: false, accountClosed: false, pickupDraft: null },
    request: async () => ({ status: ++calls === 1 ? 'PENDING_SERVICE' : 'ACCOUNT_CLOSED', message: '处理结果' }),
    closeLocalAccount: () => { closed++ }
  }
  const page = loadPage('pages/privacy/privacy.js', app, {
    showModal: async () => ({ confirm: true }), switchTab() {}
  })
  await page.closeAccount()
  assert.equal(closed, 0)
  assert.equal(page.data.accountClosed, false)
  await page.closeAccount()
  assert.equal(closed, 1)
  assert.equal(page.data.accountClosed, true)
})

test('已注销账户不会在小程序启动时自动重建', async () => {
  let definition, logins = 0
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: key => key === 'accountClosed',
    removeStorageSync() {}, setStorageSync() {},
    login: ({ success }) => { logins++; success({ code: 'new-code' }) },
    request: ({ success }) => success({ statusCode: 200, data: { code: 200, data: { token: 'new-token', bound: false, phone: '' } } })
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData } }
  app.onLaunch()
  assert.equal(logins, 0)
  await assert.rejects(app.ensureReady(), /账户已注销/)
  await app.reopenAccount()
  assert.equal(logins, 1)
})
