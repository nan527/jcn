// pages/agency-services-add/agency-services-add.js
const authService = require('../../services/authService');

const UNIT_OPTIONS = ['/次', '/天', '/针', '/月', '/只'];

const CATEGORIES = [
  { key: 'foster',   title: '宠物寄养', icon: 'home-o' },
  { key: 'grooming', title: '美容洗护', icon: 'diamond-o' },
  { key: 'medical',  title: '医疗健康', icon: 'medal-o' },
  { key: 'door',     title: '上门服务', icon: 'logistics' },
  { key: 'extra',    title: '商品增值', icon: 'shop-o' },
];

const TEMPLATES = {
  foster: [
    { name: '日托寄养（白天临时看管）', unit: '/天', minPrice: 30, maxPrice: 500 },
    { name: '长期寄宿寄养（多天/长假托管）', unit: '/天', minPrice: 50, maxPrice: 800 },
    { name: '单独隔离寄养（病宠隔离）', unit: '/天', minPrice: 80, maxPrice: 1000 },
    { name: '日常喂养、定时遛宠', unit: '/次', minPrice: 20, maxPrice: 200 },
    { name: '每日健康打卡、视频反馈', unit: '/天', minPrice: 10, maxPrice: 100 },
    { name: '特殊宠物照料（幼宠/老年宠/病弱宠）', unit: '/天', minPrice: 80, maxPrice: 1500 },
  ],
  grooming: [
    { name: '全身洗澡、除菌除臭', unit: '/次', minPrice: 30, maxPrice: 500 },
    { name: '宠物剪毛、造型修剪', unit: '/次', minPrice: 50, maxPrice: 800 },
    { name: '指甲修剪、耳道清洁', unit: '/次', minPrice: 20, maxPrice: 200 },
    { name: '脚底毛修剪、肛门腺清理', unit: '/次', minPrice: 20, maxPrice: 200 },
    { name: '毛发护理、药浴皮肤护理', unit: '/次', minPrice: 50, maxPrice: 600 },
  ],
  medical: [
    { name: '日常体检、基础问诊', unit: '/次', minPrice: 30, maxPrice: 500 },
    { name: '疫苗接种', unit: '/针', minPrice: 30, maxPrice: 300 },
    { name: '驱虫服务（体内外）', unit: '/次', minPrice: 30, maxPrice: 300 },
    { name: '皮肤病、常见病诊疗', unit: '/次', minPrice: 50, maxPrice: 1000 },
    { name: '外伤处理、简单护理', unit: '/次', minPrice: 30, maxPrice: 500 },
    { name: '绝育手术', unit: '/次', minPrice: 200, maxPrice: 3000 },
    { name: '宠物健康档案建立、复诊跟踪', unit: '/次', minPrice: 0, maxPrice: 200 },
  ],
  door: [
    { name: '上门遛狗、上门喂食', unit: '/次', minPrice: 30, maxPrice: 300 },
    { name: '上门简单洗护', unit: '/次', minPrice: 50, maxPrice: 500 },
    { name: '上门寄养临时照料', unit: '/天', minPrice: 80, maxPrice: 800 },
  ],
  extra: [
    { name: '宠物食品、零食、用品售卖', unit: '/次', minPrice: 0, maxPrice: 99999 },
    { name: '宠物玩具、窝具、穿戴用品售卖', unit: '/次', minPrice: 0, maxPrice: 99999 },
    { name: '宠物殡葬/洗护增值项目', unit: '/次', minPrice: 50, maxPrice: 5000 },
    { name: '宠物行为指导、驯养咨询', unit: '/次', minPrice: 50, maxPrice: 1000 },
  ],
};

Page({
  data: {
    categories: CATEGORIES,
    unitOptions: UNIT_OPTIONS,
    selectedCat: '',
    selectedTpl: null,
    currentTemplates: [],
    form: { name: '', desc: '', price: '' },
    imageList: [],
    imageUrls: [],
    unitIdx: 0,
    minPrice: 0,
    maxPrice: 99999,
    priceHint: '',
    saving: false,
    profileId: '',
    isEdit: false,
    editId: '',
  },

  async onLoad(opts) {
    if (opts.profileId) {
      this.setData({ profileId: opts.profileId });
    }

    // 编辑模式
    if (opts.editId) {
      this.setData({ isEdit: true, editId: opts.editId });
      wx.setNavigationBarTitle({ title: '编辑服务' });
      await this.loadEditData(opts.editId);
    }
  },

  async loadEditData(id) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('agency_services').doc(id).get();
      const svc = res.data;
      const unitIdx = UNIT_OPTIONS.indexOf(svc.unit);
      const images = svc.images || [];
      this.setData({
        selectedCat: svc.category,
        selectedTpl: -1,
        currentTemplates: TEMPLATES[svc.category] || [],
        form: { name: svc.name, desc: svc.desc || '', price: String(svc.price) },
        unitIdx: unitIdx >= 0 ? unitIdx : 0,
        imageUrls: images,
        imageList: images.map(url => ({ url })),
      });
    } catch (err) {
      console.error('[AddService] 加载编辑数据失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  onSelectCat(e) {
    const key = e.currentTarget.dataset.key;
    const tpls = TEMPLATES[key] || [];
    this.setData({
      selectedCat: key,
      selectedTpl: null,
      currentTemplates: tpls,
      form: { name: '', desc: '', price: '' },
      unitIdx: 0,
      priceHint: '',
      imageList: [],
      imageUrls: [],
    });
  },

  onSelectTpl(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (idx === -1) {
      // 自定义
      this.setData({
        selectedTpl: -1,
        form: { name: '', desc: '', price: '' },
        unitIdx: 0,
        minPrice: 0,
        maxPrice: 99999,
        priceHint: '自定义服务，价格请合理设置',
      });
    } else {
      const tpl = this.data.currentTemplates[idx];
      const unitIdx = UNIT_OPTIONS.indexOf(tpl.unit);
      this.setData({
        selectedTpl: idx,
        form: { name: tpl.name, desc: '', price: '' },
        unitIdx: unitIdx >= 0 ? unitIdx : 0,
        minPrice: tpl.minPrice,
        maxPrice: tpl.maxPrice,
        priceHint: `建议价格范围：${tpl.minPrice} ~ ${tpl.maxPrice} 元`,
      });
    }
  },

  onNameInput(e) { this.setData({ 'form.name': e.detail }); },
  onDescInput(e) { this.setData({ 'form.desc': e.detail }); },
  onPriceInput(e) { this.setData({ 'form.price': e.detail }); },
  onUnitChange(e) { this.setData({ unitIdx: Number(e.detail.value) }); },

  async afterReadImage(e) {
    const file = e.detail.file;
    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const cloudPath = `agency/services/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: file.url });
      const imageUrls = this.data.imageUrls.concat(uploadRes.fileID);
      const imageList = this.data.imageList.concat({ url: file.url, cloudUrl: uploadRes.fileID });
      this.setData({ imageUrls, imageList });
    } catch (err) {
      console.error('[AddService] 图片上传失败', err);
      wx.showToast({ title: '图片上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onDeleteImage(e) {
    const idx = e.detail.index;
    const imageUrls = this.data.imageUrls.slice();
    const imageList = this.data.imageList.slice();
    imageUrls.splice(idx, 1);
    imageList.splice(idx, 1);
    this.setData({ imageUrls, imageList });
  },

  validate() {
    const f = this.data.form;
    if (!f.name.trim()) return '请输入服务名称';
    if (!f.price || isNaN(parseFloat(f.price))) return '请输入有效价格';
    const p = parseFloat(f.price);
    if (p < 0) return '价格不能为负数';
    if (p < this.data.minPrice || p > this.data.maxPrice) {
      return `价格需在 ${this.data.minPrice} ~ ${this.data.maxPrice} 元之间`;
    }
    return '';
  },

  async onSubmit() {
    const msg = this.validate();
    if (msg) {
      wx.showToast({ title: msg, icon: 'none', duration: 2000 });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      const db = wx.cloud.database();
      const f = this.data.form;
      const unit = UNIT_OPTIONS[this.data.unitIdx];
      const record = {
        category: this.data.selectedCat,
        name: f.name.trim(),
        desc: f.desc.trim(),
        price: parseFloat(f.price),
        unit,
        images: this.data.imageUrls,
        agencyProfileId: this.data.profileId,
        updateTime: db.serverDate(),
      };

      if (this.data.isEdit) {
        await db.collection('agency_services').doc(this.data.editId).update({ data: record });
      } else {
        record.createTime = db.serverDate();
        await db.collection('agency_services').add({ data: record });
      }

      wx.showToast({ title: this.data.isEdit ? '修改成功' : '添加成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch (err) {
      console.error('[AddService] 保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
