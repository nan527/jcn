// pages/admin/audit.js
const authService = require('../../services/authService');

Page({
  data: {
    loading: true,
    list: [],
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.onShowImpl();
  },

  async onShowImpl() {
    const userInfo = await authService.checkLogin();
    if (!userInfo || userInfo.role !== 'admin') {
      wx.showToast({ title: '仅管理员可访问', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    this.loadPendingList();
  },

  /**
   * 加载待审核列表
   */
  async loadPendingList() {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      const userRes = await db.collection('users')
        .where({ role: 'agency', auditStatus: _.in(['pending', 'rejected']) })
        .orderBy('createTime', 'desc')
        .limit(100)
        .get();

      const users = userRes.data || [];
      if (!users.length) {
        this.setData({ list: [], loading: false });
        return;
      }

      const profileIds = users.map((u) => u.agencyProfileId).filter(Boolean);
      let profileMap = {};
      if (profileIds.length) {
        const profileRes = await db.collection('agency_profiles').where({ _id: _.in(profileIds) }).get();
        profileMap = (profileRes.data || []).reduce((m, p) => {
          m[p._id] = p;
          return m;
        }, {});
      }

      const list = users.map((u) => ({
        userId: u._id,
        account: u.account || '',
        auditStatus: u.auditStatus || 'pending',
        profile: profileMap[u.agencyProfileId] || {},
      }));

      this.setData({ list, loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 通过审核
   */
  async approve(e) {
    const { userId, profileId } = e.currentTarget.dataset;
    await this.updateAudit(userId, profileId, 'approved');
  },

  /**
   * 驳回审核
   */
  async reject(e) {
    const { userId, profileId } = e.currentTarget.dataset;
    await this.updateAudit(userId, profileId, 'rejected');
  },

  /**
   * 更新审核状态
   */
  async updateAudit(userId, profileId, status) {
    try {
      const db = wx.cloud.database();
      await db.collection('users').doc(userId).update({ data: { auditStatus: status } });
      if (profileId) {
        await db.collection('agency_profiles').doc(profileId).update({
          data: { auditStatus: status, updateTime: db.serverDate() },
        });
      }
      wx.showToast({ title: status === 'approved' ? '已通过' : '已驳回', icon: 'success' });
      this.loadPendingList();
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
});