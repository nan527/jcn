// pages/agency/agency.js (TradeService - 同学C负责)
const authService = require('../../services/authService');

Page({
  data: {
    agencyInfo: {},
    orderCount: 0,
    petCount: 0,
    serviceCount: 0,
    loading: false,
  },

  async onShow() {
    try {
      const userInfo = await authService.checkLogin();
      if (userInfo) {
        this.setData({ agencyInfo: userInfo });
        this.loadStats(userInfo);
      }
    } catch (err) {
      console.warn('[Agency] onShow 异常', err);
    }
  },

  async loadStats(userInfo) {
    const db = wx.cloud.database();
    const pid = userInfo && userInfo.agencyProfileId;
    if (!pid) return;
    try {
      const ordersRes = await db.collection('user_orders')
        .where({ orderType: 'agency', agencyProfileId: pid })
        .count();
      this.setData({ orderCount: ordersRes.total || 0 });
    } catch (e) { /* ignore */ }
    try {
      const svcRes = await db.collection('agency_services').where({ agencyProfileId: pid }).count();
      this.setData({ serviceCount: svcRes.total || 0 });
    } catch (e) { /* ignore */ }
  },

  // ====== 运营管理 ======
  toOpsOrders() {
    wx.navigateTo({ url: '/pages/agency-orders/agency-orders' });
  },

  toOpsReview() {
    wx.navigateTo({ url: '/pages/agency-reviews/agency-reviews' });
  },

  toOpsRevenue() {
    wx.navigateTo({ url: '/pages/agency-revenue/agency-revenue' });
  },

  toOpsExposure() {
    wx.showToast({ title: '曝光引流开发中', icon: 'none' });
  },

  toEditInfo() {
    wx.navigateTo({ url: '/pages/agency-edit/agency-edit' });
  },

  // ====== 快捷功能 ======
  toOrders() {
    wx.navigateTo({ url: '/pages/agency-orders/agency-orders' });
  },

  toPetManage() {
    wx.showToast({ title: '宠物管理开发中', icon: 'none' });
  },

  toServiceManage() {
    wx.navigateTo({ url: '/pages/agency-services/agency-services' });
  },

  toContact() {
    wx.showToast({ title: '客服中心开发中', icon: 'none' });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          authService.logout();
          wx.showToast({ title: '已退出', icon: 'success' });
          setTimeout(() => {
            wx.redirectTo({ url: '/pages/login/login' });
          }, 800);
        }
      },
    });
  },
});
