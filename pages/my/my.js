// pages/my/my.js
const authService = require('../../services/authService');

Page({
  data: {
    userInfo: null,
    roleName: '宠主',
    nickname: '未登录',
  },

  async onShow() {
    try {
      const userInfo = await authService.checkLogin();
      if (userInfo) {
        const roleInfo = authService.getRoleInfo(userInfo.role);
        this.setData({
          userInfo,
          roleName: roleInfo.label,
          nickname: userInfo.nickname || roleInfo.label,
        });
      } else {
        this.setData({ userInfo: null, roleName: '宠主', nickname: '未登录' });
      }
    } catch (err) {
      console.warn('[My] onShow checkLogin 异常', err);
      this.setData({
        userInfo: null,
        roleName: '宠主',
        nickname: '未登录',
      });
    }
  },

  handleLogin() {
    if (!this.data.userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
    }
  },

  handleHeaderTap() {
    if (this.data.userInfo) {
      this.toProfile();
    } else {
      this.handleLogin();
    }
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          authService.logout();
          this.setData({ userInfo: null, roleName: '宠主', nickname: '未登录' });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      },
    });
  },

  toProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  toPetArchive() {
    wx.navigateTo({ url: '/pages/pet/pet' });
  },

  toFosterCenter() {
    wx.navigateTo({ url: '/pages/foster-center/foster-center' });
  },

  toOrders() {
    wx.navigateTo({ url: '/pages/orders/orders' });
  },

  toHealthRemind() {
    wx.navigateTo({ url: '/pages/health/health' });
  },

  toForum() {
    wx.switchTab({ url: '/pages/forum/forum' });
  },

  toMyPosts() {
    wx.navigateTo({ url: '/pages/forum/forum?tab=mine' });
  },

  toAdminPanel() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },
});
