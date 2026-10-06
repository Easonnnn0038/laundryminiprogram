let development = {}
try { development = require('./dev.config') } catch (_) {}

module.exports = {
  apiBaseUrl: development.apiBaseUrl || 'http://localhost:8080/api/miniapp',
  testLoginKey: development.testLoginKey || ''
}
