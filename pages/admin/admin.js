// pages/admin/admin.js
const authService = require('../../services/authService');

Page({
  async onShow() {
    const userInfo = await authService.checkLogin();
    if (!userInfo || userInfo.role !== 'admin') {
      wx.showToast({ title: '请先以管理员身份登录', icon: 'none' });
      setTimeout(() => wx.navigateTo({ url: '/pages/login/login' }), 600);
    }
  },

  toAgencyAudit() {
    wx.navigateTo({ url: '/pages/admin/audit' });
  },

  toHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
