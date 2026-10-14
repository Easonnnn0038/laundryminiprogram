# 小木棒洗衣顾客小程序

面向洗衣顾客的微信原生小程序。顾客可查看本人订单、衣物进度和回店后的取衣码，也可预约上门取衣。小程序只展示预估价格；门店实际验衣、收款、会员卡扣款和正式订单创建均在门店端完成。

## 当前功能

- 微信登录与手机号授权绑定；订单接口仅返回已绑定手机号本人的数据。
- 首页展示进行中订单和可取衣订单的四位取衣码。
- 当前订单、历史订单与订单详情；详情支持拨打门店电话、复制订单号。
- 上门取衣预约：按门店价目选择衣物、填写联系人、地址和预约时段，展示会员优惠后的预估金额。
- 本地演示模式：使用 `touristappid` 时自动加载虚拟顾客与订单，无需后端或微信凭证。

## 业务边界

- 上门预约不收款、不扣会员卡余额，也不计入门店营收。
- 门店取回预约单后，导入既有收衣流程验衣和结算；正式订单与预约单关联，避免重复导入。
- 尚未接入微信支付、退款、会员充值、优惠券、客服聊天、瑕疵照片和正式订阅消息。

## 目录

```text
pages/
  home/          首页与手机号绑定
  pickup-order/  上门取衣预约
  orders/        当前与历史订单
  order-detail/  订单详情与取衣码
  profile/       我的与隐私说明
utils/           日期、金额格式化
mock.js          touristappid 的本地演示数据
config.js        API 地址与本地开发配置加载
```

## 本地运行

1. 使用微信开发者工具导入此目录。
2. 保持 `project.config.json` 中的 `appid` 为 `touristappid`，即可直接体验离线演示模式。
3. 如需联调测试服务器，复制 `dev.config.example.js` 为 `dev.config.js`，填写测试 API 地址和临时测试登录密钥。`dev.config.js` 已被 Git 忽略，禁止提交。

```js
module.exports = {
  apiBaseUrl: 'http://127.0.0.1:8080/api/miniapp',
  testLoginKey: 'replace-with-server-test-key'
}
```

配置 `testLoginKey` 后，`touristappid` 会调用后端的受保护测试登录接口；后端必须显式启用该能力。正式上线前必须关闭 `MINIAPP_TEST_LOGIN_ENABLED` 并移除对应密钥。

## 正式微信环境

正式发布前需完成以下配置：

1. 在微信公众平台创建或使用客户主体的小程序，更新 `project.config.json` 中的 `appid`。
2. 在门店后端环境变量中配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`，两者都不能写进小程序代码或 Git。
3. 配置已备案的 HTTPS 域名，并在微信公众平台添加合法 request 域名；`http://` 公网地址不能用于正式小程序。
4. 确认后端已执行上门预约和订单来源相关 Flyway 迁移，并关闭测试登录。
5. 在真机完成微信登录、手机号授权、本人订单隔离、预约创建及门店导入正式收衣的回归测试。
6. 由客户确认运营主体、正式隐私政策、交易资料的具体保留依据与期限、门店核验及申请处理方式。当前“个人信息说明”是功能说明：可在线登记删除申请；没有未完成关联订单时可注销小程序账户，交易资料仍待门店核验处理，不等于已全部删除。`project.config.json` 已关闭上传 Source Map，发布前还应检查微信开发者工具最终上传设置。

## 后端依赖

小程序 API 由 `C:\Users\33531\IdeaProjects\laundry-backend` 提供，基础路径为 `/api/miniapp`。主要接口包括：

- `POST /auth/login`、`POST /auth/bind-phone`
- `POST /account/unbind-phone`、`POST /account/deletion-request`、`DELETE /account`
- `GET /profile`、`GET /orders`、`GET /orders/{id}`
- `GET /pickup-catalog`、`GET /pickup-defaults`
- `GET /pickup-orders`、`POST /pickup-orders`、`GET /pickup-orders/{id}`

除登录与手机号绑定外，请求使用 `Authorization: Bearer <token>`。后端按令牌中的手机号强制过滤订单，不能以小程序令牌访问门店员工接口。

## 安全与提交约定

- 不提交 `dev.config.js`、`project.private.config.json`、AppSecret、测试登录密钥、设备令牌或真实客户数据。
- 不在前端实现或伪造支付成功；真实微信支付需另行接入支付下单、回调验签、退款和对账。
- 修改接口或订单状态时，同时更新门店端与后端的端到端回归场景。
