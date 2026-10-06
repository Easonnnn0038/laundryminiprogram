function date(value) { return value ? value.replace('T', ' ').slice(0, 16) : '' }
function money(value) { return Number(value || 0).toFixed(2) }
module.exports = { date, money }
