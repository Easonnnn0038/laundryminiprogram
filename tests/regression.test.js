const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const storage = new Map()

test('演示订单与会员卡展示同一门店联系方式', () => {
  const mock = require('../mock')
  const order = mock.request('/orders/9001')
  const card = mock.request('/member-card')
  assert.equal(order.storeAddress, '安徽省宿州市埇桥区三八街道金方世纪城34幢120号')
  assert.equal(order.storePhone, '18430880874')
  assert.equal(card.storePhone, order.storePhone)
})

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

test('手机号密码登录在输入有效时请求后端，失败时留在页面', async () => {
  const destinations = []
  const calls = []
  const app = {
    globalData: { bound: false, accountClosed: false, token: '', mockMode: true, serverTestMode: true },
    ensureReady: async () => {},
    passwordLogin: async (phone, password) => { calls.push({ phone, password }); if (password === 'wrong') throw new Error('手机号或密码不正确') }
  }
  const page = loadPage('pages/login/login.js', app, { switchTab: ({ url }) => destinations.push(url) })
  await page.prepare()
  assert.deepEqual(destinations, [])
  assert.equal(calls.length, 0)
  await page.submitPassword()
  assert.match(page.data.error, /手机号/)
  assert.equal(calls.length, 0)
  page.inputPhone({ detail: { value: '13900000000' } })
  page.inputPassword({ detail: { value: 'wrong' } })
  await page.submitPassword()
  assert.match(page.data.error, /不正确/)
  assert.equal(destinations.length, 0)
  page.inputPassword({ detail: { value: 'correct-test-password' } })
  await page.submitPassword()
  assert.deepEqual(calls[1], { phone: '13900000000', password: 'correct-test-password' })
  assert.equal(page.data.password, '')
  assert.deepEqual(destinations, ['/pages/home/home'])
})

test('已注销账户在登录页保持关闭，必须由顾客明确重新开通', async () => {
  let reopenCount = 0
  const app = {
    globalData: { accountClosed: true, bound: false },
    ensureReady: async () => { throw new Error('不应自动登录') },
    reopenAccount: async () => { reopenCount++; app.globalData.accountClosed = false }
  }
  const page = loadPage('pages/login/login.js', app)
  await page.prepare()
  assert.equal(page.data.closed, true)
  assert.equal(reopenCount, 0)
  await page.reopenAccount()
  assert.equal(reopenCount, 1)
  assert.equal(page.data.closed, false)
})

test('本地演示可预览登录页再进入首页', async () => {
  const destinations = []
  const app = { globalData: { bound: true, accountClosed: false, mockMode: true, serverTestMode: false }, ensureReady: async () => {} }
  const page = loadPage('pages/login/login.js', app, { switchTab: ({ url }) => destinations.push(url) })
  await page.prepare()
  assert.equal(page.data.demo, true)
  assert.deepEqual(destinations, [])
  page.enterDemo()
  assert.deepEqual(destinations, ['/pages/home/home'])
})

test('手机号密码登录使用公开接口，且只保存令牌不保存密码', async () => {
  storage.clear()
  let definition, request
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    request: options => { request = options; options.success({ statusCode: 200, data: { code: 200, data: { token: 'test-token', bound: true, phone: '139****0000' } } }) }
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData } }
  assert.equal(request, undefined)
  await app.passwordLogin('13900000000', 'test-password')
  assert.match(request.url, /\/auth\/password-login$/)
  assert.equal(request.header.Authorization, undefined)
  assert.equal(storage.get('token'), 'test-token')
  assert.equal(storage.get('authSource'), 'password')
  assert.equal([...storage.values()].includes('test-password'), false)
})

test('主动退出清除本机账号与草稿，重开小程序也不会自动登录', async () => {
  storage.clear()
  storage.set('token', 'old-token')
  storage.set('authSource', 'password')
  storage.set('pickupDraft', { selected: [1] })
  let definition, wechatLogins = 0
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: ({ success }) => { wechatLogins++; success({ code: 'fresh-code' }) },
    request: ({ success }) => success({ statusCode: 200, data: { code: 200, data: { token: 'new-token', bound: true, phone: '139****0000' } } })
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData } }
  app.logout()
  assert.equal(storage.get('token'), undefined)
  assert.equal(storage.get('pickupDraft'), undefined)
  assert.equal(storage.get('loggedOut'), true)
  app.onLaunch()
  await assert.rejects(app.ensureReady(), /请先登录/)
  assert.equal(wechatLogins, 0)
  await app.login()
  assert.equal(storage.get('loggedOut'), undefined)
  assert.equal(storage.get('token'), 'new-token')
})

test('个人中心取消退出时保留登录，确认后回登录页', async () => {
  let confirmed = false, logouts = 0
  const destinations = []
  const app = { globalData: { accountClosed: false }, logout: () => { logouts++ } }
  const page = loadPage('pages/profile/profile.js', app, {
    showModal: async () => ({ confirm: confirmed }),
    reLaunch: ({ url }) => destinations.push(url)
  })
  await page.logout()
  assert.equal(logouts, 0)
  confirmed = true
  await page.logout()
  assert.equal(logouts, 1)
  assert.deepEqual(destinations, ['/pages/login/login'])
})

test('退出前发出的登录请求不能在返回后恢复账号', async () => {
  storage.clear()
  let definition, completeLogin
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    login: ({ success }) => success({ code: 'old-code' }),
    request: ({ success }) => { completeLogin = success }
  }
  const filename = path.join(root, 'app.js')
  delete require.cache[require.resolve(filename)]
  require(filename)
  const app = { ...definition, globalData: { ...definition.globalData } }
  const pending = app.login()
  app.logout()
  completeLogin({ statusCode: 200, data: { code: 200, data: { token: 'stale-token', bound: true } } })
  await assert.rejects(pending, /请先登录/)
  assert.equal(storage.get('token'), undefined)
  assert.equal(storage.get('loggedOut'), true)
})

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
  appointment.data.deliveryContactName = '测试'
  appointment.data.deliveryPhone = '13800138000'
  appointment.data.deliveryRegion = ['安徽省', '宿州市', '埇桥区']
  appointment.data.deliveryAddress = '测试地址'
  await appointment.submit()
  const submitted = requests.find(item => item.url === '/pickup-orders').options.data
  assert.match(submitted.remark, /【团购套餐】衣服鞋任选 1 件，参考价¥10.9/)
  assert.equal(submitted.deliveryProvince, '安徽省')
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

test('正式微信模式 401 后重新登录并继续原页面的 GET 请求', async () => {
  let definition, logins = 0, reads = 0
  global.App = value => { definition = value }
  global.wx = {
    getAccountInfoSync: () => ({ miniProgram: { appId: 'real-appid' } }),
    getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => {},
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

test('模拟签收需确认，成功后刷新订单', async () => {
  let confirmed = false
  const calls = []
  const app = {
    ensureReady: async () => {},
    request: async (url, options = {}) => {
      calls.push({ url, options })
      if (url === '/orders/7/test-deliver') return { status: 'DELIVERED' }
      if (url === '/orders/7') return { simulatedDelivery: true, statusLabel: '模拟已签收' }
      throw new Error(`unexpected ${url}`)
    }
  }
  const page = loadPage('pages/order-detail/order-detail.js', app, {
    showModal: ({ success }) => success({ confirm: confirmed }),
    showToast() {}
  })
  page.id = 7
  await page.simulateDelivery()
  assert.equal(calls.length, 0)
  confirmed = true
  await page.simulateDelivery()
  assert.deepEqual(calls.map(call => call.url), ['/orders/7/test-deliver', '/orders/7'])
  assert.equal(calls[0].options.method, 'POST')
  assert.ok(calls[0].options.header['X-Miniapp-Test-Key'])
  assert.equal(page.data.order.statusLabel, '模拟已签收')
  assert.equal(page.data.simulating, false)
})
