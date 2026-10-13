const deals = [
  { code: 'MIX_1', name: '衣服鞋任选 1 件', scope: '不含绒面、皮衣及内胆', price: '10.9', originalPrice: '30', group: 'CLOTHES', position: 'd00', featured: true },
  { code: 'SHOES_3', name: '鞋子清洗 3 双', scope: '普通运动鞋，不含绒面', price: '19.9', originalPrice: '75', group: 'SHOES', position: 'd10' },
  { code: 'SHOES_1', name: '洗鞋任选 1 双', scope: '普通运动鞋，不含绒面', price: '10.9', originalPrice: '30', group: 'SHOES', position: 'd20' },
  { code: 'DUVET_1', name: '羽绒被清洗 1 件', scope: '到店后核对尺寸与材质', price: '28.9', originalPrice: '88', group: 'HOME', position: 'd30' },
  { code: 'MIX_3', name: '羽绒服、大衣、鞋任选 3 件', scope: '不含皮面及内胆', price: '43.9', originalPrice: '120', group: 'CLOTHES', position: 'd00' },
  { code: 'MIX_2', name: '羽绒服、大衣、鞋任选 2 件', scope: '不含皮面及内胆', price: '31.9', originalPrice: '80', group: 'CLOTHES', position: 'd00' },
  { code: 'MIX_5', name: '衣服鞋任选 5 件', scope: '不含绒面、皮衣及内胆', price: '68.9', originalPrice: '150', group: 'CLOTHES', position: 'd00', featured: true },
  { code: 'DOWN_4', name: '羽绒服专业清洗 4 件', scope: '不限长度，毛领与内胆不含', price: '42.9', originalPrice: '150', group: 'CLOTHES', position: 'd01' },
  { code: 'DOWN_SHOE_2', name: '羽绒服 1 件＋鞋 1 双', scope: '不含皮面、毛领及内胆', price: '16.9', originalPrice: '55', group: 'CLOTHES', position: 'd11', featured: true },
  { code: 'DOWN_SHOE_3', name: '羽绒服 2 件＋鞋 1 双', scope: '不含绒面、皮面及内胆', price: '28.9', originalPrice: '80', group: 'CLOTHES', position: 'd21' },
  { code: 'DOWN_2', name: '羽绒服专业清洗 2 件', scope: '毛领与内胆不含', price: '20.9', originalPrice: '60', group: 'CLOTHES', position: 'd31' },
  { code: 'LUXURY_1', name: '奢侈精洗 1 件', scope: '到店后核对品牌、面料与工艺', price: '58.9', originalPrice: '100', group: 'CLOTHES', position: 'd02' }
]

module.exports = { deals, featuredDeals: deals.filter(item => item.featured) }
