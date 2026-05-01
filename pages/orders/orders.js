// pages/orders/orders.js
const authService = require('../../services/authService');

Page({
  data: {
    activeTab: 0,
    loading: true,
    allOrders: [],
    personalOrders: [],
    agencyOrders: [],
    // 评价弹窗
    showReview: false,
    reviewOrderId: '',
    reviewRating: 5,
    reviewContent: '',
    submittingReview: false,
  },

  async onShow() {
    const userInfo = await authService.checkLogin();
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.loadOrders();
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  async loadOrders() {
    this.setData({ loading: true });
    const db = wx.cloud.database();
    let list = [];

    try {
      const res = await db.collection('user_orders')
        .where({ _openid: '{openid}' })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get();
      list = (res.data || []).map(item => ({
        ...item,
        createTimeStr: this._formatTime(item.createTime),
        leaveRemainText: this._buildLeaveRemainText(item.leaveTimeMs),
        isLeaveExpired: this._isLeaveExpired(item.leaveTimeMs),
        petInfoText: this._buildPetInfoText(item.petInfo),
        review: item.review ? {
          ...item.review,
          ratingArr: new Array(item.review.rating || 0).fill(1),
        } : null,
      }));
    } catch (e) { /* ignore */ }

    this.setData({
      allOrders: list,
      personalOrders: list.filter(o => o.orderType === 'personal'),
      agencyOrders: list.filter(o => o.orderType === 'agency'),
      loading: false,
    });
  },

  // ===== 确认完成 =====
  onConfirmComplete(e) {
    const id = e.currentTarget.dataset.id;
    const category = e.currentTarget.dataset.category || '';
    const isFoster = category === 'foster';
    wx.showModal({
      title: isFoster ? '确认取回' : '确认完成',
      content: isFoster ? '确认已取回宠物？确认后寄养订单将标记为已取回。' : '确认机构已完成该服务？确认后订单将标记为已完成。',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const db = wx.cloud.database();
          const targetOrder = this.data.allOrders.find(o => o._id === id);
          await db.collection('user_orders').doc(id).update({
            data: {
              orderStatus: 'completed',
              updateTime: db.serverDate(),
            },
          });

          if (targetOrder && targetOrder.orderType === 'agency' && targetOrder.category === 'foster' && targetOrder.petId) {
            try {
              await db.collection('pets').doc(targetOrder.petId).update({
                data: {
                  petStatus: '',
                  updateTime: db.serverDate(),
                },
              });
            } catch (petErr) {
              console.warn('[Orders] clear foster pet status failed', petErr);
            }
          }

          wx.hideLoading();
          wx.showToast({ title: '已确认完成', icon: 'success' });
          this.loadOrders();
        } catch (e) {
          wx.hideLoading();
          console.error('[Orders] confirmComplete', e);
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  // ===== 评价相关 =====
  openReview(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      showReview: true,
      reviewOrderId: id,
      reviewRating: 5,
      reviewContent: '',
    });
  },

  closeReview() {
    this.setData({ showReview: false, reviewOrderId: '' });
  },

  onRatingChange(e) {
    this.setData({ reviewRating: e.detail });
  },

  onReviewContentChange(e) {
    this.setData({ reviewContent: e.detail });
  },

  async submitReview() {
    const { reviewOrderId, reviewRating, reviewContent } = this.data;
    if (!reviewContent.trim()) {
      return wx.showToast({ title: '请输入评价内容', icon: 'none' });
    }
    if (this.data.submittingReview) return;
    this.setData({ submittingReview: true });

    try {
      const db = wx.cloud.database();
      await db.collection('user_orders').doc(reviewOrderId).update({
        data: {
          review: {
            rating: reviewRating,
            content: reviewContent.trim(),
            createTime: db.serverDate(),
          },
        },
      });
      wx.showToast({ title: '评价成功', icon: 'success' });
      this.setData({ showReview: false, reviewOrderId: '' });
      this.loadOrders();
    } catch (e) {
      console.error('[Orders] submitReview', e);
      wx.showToast({ title: '评价失败', icon: 'none' });
    } finally {
      this.setData({ submittingReview: false });
    }
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

  _buildPetInfoText(petInfo) {
    if (!petInfo) return '';
    const species = petInfo.species || '';
    const age = petInfo.age ? `${petInfo.age}岁` : '';
    if (species && age) return `${species} · ${age}`;
    return species || age || '';
  },

  _buildLeaveRemainText(leaveTimeMs) {
    const ms = Number(leaveTimeMs) || 0;
    if (!ms) return '';
    const diff = ms - Date.now();
    if (diff <= 0) return '已离开（待机构确认）';
    const totalHours = Math.ceil(diff / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) return `还有${days}天${hours}小时离开`;
    return `还有${hours}小时离开`;
  },

  _isLeaveExpired(leaveTimeMs) {
    const ms = Number(leaveTimeMs) || 0;
    if (!ms) return false;
    return ms <= Date.now();
  },
});
