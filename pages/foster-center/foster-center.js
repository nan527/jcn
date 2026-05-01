// pages/foster-center/foster-center.js
const authService = require('../../services/authService');

Page({
  data: {
    activeTab: 0,
    userId: '',
    // 我的发布
    publishList: [],
    publishLoading: true,
    // 我参与的
    joinList: [],
    joinLoading: true,
    // 机构订单
    orderList: [],
    orderLoading: true,
  },

  async onShow() {
    try {
      const userInfo = await authService.checkLogin();
      if (!userInfo) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 800);
        return;
      }
      this.setData({ userId: userInfo._id || '' });
      this.loadPublish();
      this.loadJoined();
      this.loadOrders();
    } catch (e) {
      console.warn('[FosterCenter] onShow', e);
    }
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  // ====== Tab 1: 我的发布 ======
  async loadPublish() {
    this.setData({ publishLoading: true });
    const db = wx.cloud.database();
    let list = [];

    try {
      const fRes = await db.collection('fosters').where({ _openid: '{openid}' }).orderBy('createTime', 'desc').limit(20).get();
      list = list.concat((fRes.data || []).map(d => ({ ...d, type: 'foster' })));
    } catch (e) { /* ignore */ }

    try {
      const aRes = await db.collection('adoptions').where({ _openid: '{openid}' }).orderBy('createTime', 'desc').limit(20).get();
      list = list.concat((aRes.data || []).map(d => ({ ...d, type: 'adopt' })));
    } catch (e) { /* ignore */ }

    // 按时间排序
    list.sort((a, b) => {
      const ta = a.createTime ? new Date(a.createTime).getTime() : 0;
      const tb = b.createTime ? new Date(b.createTime).getTime() : 0;
      return tb - ta;
    });

    list = list.map(item => ({
      ...item,
      createTimeStr: this._formatTime(item.createTime),
    }));

    this.setData({ publishList: list, publishLoading: false });
  },

  // ====== Tab 2: 我参与的(领养/寄养) ======
  async loadJoined() {
    this.setData({ joinLoading: true });
    const db = wx.cloud.database();
    let list = [];

    try {
      const res = await db.collection('foster_applications').where({ _openid: '{openid}' }).orderBy('applyTime', 'desc').limit(20).get();
      list = (res.data || []).map(item => ({
        ...item,
        applyTimeStr: this._formatTime(item.applyTime),
      }));
    } catch (e) { /* collection may not exist yet */ }

    this.setData({ joinList: list, joinLoading: false });
  },

  // ====== Tab 3: 机构订单 ======
  async loadOrders() {
    this.setData({ orderLoading: true });
    const db = wx.cloud.database();
    let list = [];

    try {
      const res = await db.collection('agency_orders').where({ _openid: '{openid}' }).orderBy('createTime', 'desc').limit(20).get();
      list = (res.data || []).map(item => ({
        ...item,
        dateRange: item.startDate && item.endDate ? `${item.startDate} ~ ${item.endDate}` : '',
      }));
    } catch (e) { /* collection may not exist yet */ }

    this.setData({ orderList: list, orderLoading: false });
  },

  onPublishTap(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/foster-detail/foster-detail?id=${id}&type=${type}` });
  },

  toPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  },

  _formatTime(t) {
    if (!t) return '';
    const d = typeof t === 'string' ? new Date(t) : (t instanceof Date ? t : new Date(t));
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
});
