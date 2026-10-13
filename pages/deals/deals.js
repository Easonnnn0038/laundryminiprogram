const app=getApp(),{loadDeals}=require('../../utils/deals')

Page({
  data: { deals: [],loading:true,error:'' },
  onLoad(){this.load()},
  async load(){this.setData({loading:true,error:''});try{await app.ensureReady();this.setData({deals:await loadDeals(app)})}catch(e){this.setData({error:e.message})}finally{this.setData({loading:false})}},
  useDeal(e) { wx.navigateTo({ url: `/pages/pickup-order/pickup-order?group=${e.currentTarget.dataset.group}&deal=${e.currentTarget.dataset.code}` }) }
})
