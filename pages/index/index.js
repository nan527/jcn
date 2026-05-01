// pages/index/index.js
const CAT_TITLE_MAP = {
  foster: '宠物寄养',
  grooming: '美容洗护',
  medical: '医疗健康',
  door: '上门服务',
  extra: '商品增值',
};

Page({
  data: {
    searchVal: '',
    fosterList: [],
    fosterLoading: true,
    svcList: [],
    svcLoading: true,
  },

  onShow() {
    this.loadFosters();
    this.loadServices();
  },

  async loadFosters() {
    this.setData({ fosterLoading: true });
    const db = wx.cloud.database();
    const _ = db.command;
    let list = [];
    try {
      const fRes = await db.collection('fosters').where({ status: 'open' }).orderBy('createTime', 'desc').limit(4).get();
      list = list.concat((fRes.data || []).map(d => ({ ...d, type: 'foster' })));
    } catch (e) { /* ignore */ }
    try {
      const aRes = await db.collection('adoptions').where({ status: 'open' }).orderBy('createTime', 'desc').limit(4).get();
      list = list.concat((aRes.data || []).map(d => ({ ...d, type: 'adopt' })));
    } catch (e) { /* ignore */ }
    // 混合后按时间排序，取前4
    list.sort((a, b) => {
      const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
      const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
      return tb - ta;
    });
    this.setData({ fosterList: list.slice(0, 4), fosterLoading: false });
  },

  async loadServices() {
    this.setData({ svcLoading: true });
    const db = wx.cloud.database();
    try {
      const res = await db.collection('agency_services').orderBy('createTime', 'desc').limit(4).get();
      const svcList = (res.data || []).map(s => ({
        ...s,
        catTitle: CAT_TITLE_MAP[s.category] || '服务',
      }));
      this.setData({ svcList, svcLoading: false });
    } catch (e) {
      this.setData({ svcList: [], svcLoading: false });
    }
  },

  onSearchChange(e) {
    this.setData({ searchVal: e.detail });
  },

  // 功能入口
  toMatch() { wx.navigateTo({ url: '/pages/match/match' }); },
  toHealth() { wx.navigateTo({ url: '/pages/health/health' }); },
  toAI() { wx.navigateTo({ url: '/pages/ai/ai' }); },

  // 查看更多
  toFosterList() {
    wx.showToast({ title: '寄养送养列表开发中', icon: 'none' });
  },

  toAgencyServiceList() {
    wx.showToast({ title: '机构服务列表开发中', icon: 'none' });
  },

  onFosterTap(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/foster-detail/foster-detail?id=${id}&type=${type}` });
  },

  onSvcTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/service-detail/service-detail?id=${id}` });
  },

  onPullDownRefresh() {
    this.loadFosters();
    this.loadServices();
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {},
});