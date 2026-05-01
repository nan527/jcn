// pages/agency-orders/agency-orders.js
const authService = require('../../services/authService');

const STATUS_LABEL = {
  confirmed: '接单',
  in_progress: '开始服务',
  to_confirm: '完成服务',
  cancelled: '拒绝',
};

const FOSTER_STATUS_LABEL = {
  confirmed: '开始寄养',
  in_progress: '寄养服务',
  to_confirm: '完成寄养（待取回）',
  cancelled: '拒绝',
};

Page({
  data: {
    activeTab: 0,
    loading: true,
    allOrders: [],
    pendingList: [],
    activeList: [],
    toConfirmList: [],
    completedList: [],
    totalRevenue: '0.00',
    totalOrders: 0,
    completedOrders: 0,
    cageSummary: {
      totalCages: 0,
      occupiedCages: 0,
      availableCages: 0,
      cageDesc: '',
    },
    petFilter: 'all',
    leftPetCount: 0,
    occupiedPetsAll: [],
    occupiedPets: [],
  },

  _agencyProfileId: '',
  _leaveTickTimer: null,

  async onShow() {
    const userInfo = await authService.checkLogin();
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this._agencyProfileId = userInfo.agencyProfileId || '';
    if (!this._agencyProfileId) {
      wx.showToast({ title: '未找到机构信息', icon: 'none' });
      return;
    }
    this._startLeaveTick();
    this.loadOrders();
  },

  onHide() {
    this._stopLeaveTick();
  },

  onUnload() {
    this._stopLeaveTick();
  },

  onTabChange(e) {
    this.setData({ activeTab: e.detail.index });
  },

  onChangePetFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    if (!filter) return;
    this.setData({ petFilter: filter }, () => this._applyOccupiedFilter());
  },

  async loadOrders() {
    this.setData({ loading: true });
    const db = wx.cloud.database();
    let list = [];
    let profile = {};

    try {
      const [res, profileRes] = await Promise.all([
        db.collection('user_orders')
          .where({
            orderType: 'agency',
            agencyProfileId: this._agencyProfileId,
          })
          .orderBy('createTime', 'desc')
          .limit(100)
          .get(),
        db.collection('agency_profiles').doc(this._agencyProfileId).get(),
      ]);
      profile = profileRes.data || {};
      list = (res.data || []).map(item => ({
        ...item,
        createTimeStr: this._formatTime(item.createTime),
        leaveRemainText: this._buildLeaveRemainText(item.leaveTimeMs),
        isLeaveExpired: this._isLeaveExpired(item.leaveTimeMs),
      }));
    } catch (e) {
      console.warn('[AgencyOrders] load', e);
    }

    const occupiedFosterOrders = list.filter(o =>
      o.category === 'foster' && ['confirmed', 'in_progress', 'to_confirm'].includes(o.orderStatus)
    );
    const totalCages = Number(profile.totalCages) || 0;
    const occupiedCages = occupiedFosterOrders.filter(o => !o.isLeaveExpired).length;
    const availableCages = Math.max(0, totalCages - occupiedCages);
    const occupiedPets = occupiedFosterOrders.map(o => ({
      id: o._id,
      petName: o.petName || '未命名宠物',
      species: (o.petInfo && o.petInfo.species) || '',
      age: (o.petInfo && o.petInfo.age) || '',
      status: o.orderStatus,
      isLeft: !!o.isLeaveExpired,
      leaveRemainText: o.leaveRemainText || '未设置离开时间',
      image: (o.petInfo && o.petInfo.photo) || (o.images && o.images[0]) || '/static/pet/logo.png',
    }));
    const leftPetCount = occupiedPets.filter(p => p.isLeft).length;

    // 计算收入
    const completed = list.filter(o => o.orderStatus === 'completed');
    let totalRevenue = 0;
    completed.forEach(o => {
      totalRevenue += parseFloat(o.price) || 0;
    });

    this.setData({
      allOrders: list,
      pendingList: list.filter(o => o.orderStatus === 'pending'),
      activeList: list.filter(o => o.orderStatus === 'confirmed' || o.orderStatus === 'in_progress'),
      toConfirmList: list.filter(o => o.orderStatus === 'to_confirm'),
      completedList: completed,
      totalRevenue: totalRevenue.toFixed(2),
      totalOrders: list.length,
      completedOrders: completed.length,
      cageSummary: {
        totalCages,
        occupiedCages,
        availableCages,
        cageDesc: profile.cageDesc || '',
      },
      leftPetCount,
      occupiedPetsAll: occupiedPets,
      occupiedPets,
      loading: false,
    });
    this._applyOccupiedFilter();
  },

  onUpdateStatus(e) {
    const { id, status } = e.currentTarget.dataset;
    const targetOrderForLabel = this.data.allOrders.find(o => o._id === id);
    const isFoster = targetOrderForLabel && targetOrderForLabel.category === 'foster';
    const label = (isFoster ? FOSTER_STATUS_LABEL[status] : STATUS_LABEL[status]) || '更新';
    const isReject = status === 'cancelled';

    wx.showModal({
      title: isReject ? '确认拒绝' : `确认${label}`,
      content: isReject ? '拒绝后该订单将被取消，确定吗？' : `确认${label}该订单？`,
      confirmColor: isReject ? '#ee0a24' : '#FF9800',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const db = wx.cloud.database();
          const targetOrder = this.data.allOrders.find(o => o._id === id);

          if (status === 'confirmed') {
            if (targetOrder && targetOrder.category === 'foster') {
              const [profileRes, activeRes] = await Promise.all([
                db.collection('agency_profiles').doc(this._agencyProfileId).get(),
                db.collection('user_orders').where({
                  orderType: 'agency',
                  category: 'foster',
                  agencyProfileId: this._agencyProfileId,
                  orderStatus: db.command.in(['confirmed', 'in_progress', 'to_confirm']),
                }).get(),
              ]);
              const total = Number((profileRes.data || {}).totalCages) || 0;
              const occupied = (activeRes.data || []).filter(o => !this._isLeaveExpired(o.leaveTimeMs)).length;
              if (total <= 0) {
                throw new Error('CAGE_NOT_CONFIGURED');
              }
              if (occupied >= total) {
                throw new Error('CAGE_FULL');
              }
            }
          }

          await db.collection('user_orders').doc(id).update({
            data: {
              orderStatus: status,
              updateTime: db.serverDate(),
            },
          });

          if (targetOrder && targetOrder.category === 'foster' && targetOrder.petId) {
            const nextPetStatus = this._mapFosterPetStatusByOrderStatus(status);
            try {
              await db.collection('pets').doc(targetOrder.petId).update({
                data: {
                  petStatus: nextPetStatus,
                  updateTime: db.serverDate(),
                },
              });
            } catch (petErr) {
              console.warn('[AgencyOrders] sync foster pet status failed', petErr);
            }
          }

          wx.hideLoading();
          wx.showToast({ title: '操作成功', icon: 'success' });
          this.loadOrders();
        } catch (e) {
          wx.hideLoading();
          console.error('[AgencyOrders] updateStatus', e);
          let msg = '操作失败';
          if (e && e.message === 'CAGE_NOT_CONFIGURED') msg = '请先在机构资料中填写笼位总数';
          if (e && e.message === 'CAGE_FULL') msg = '当前笼位不足，无法接单';
          wx.showToast({ title: msg, icon: 'none' });
        }
      },
    });
  },

  _buildLeaveRemainText(leaveTimeMs) {
    const ms = Number(leaveTimeMs) || 0;
    if (!ms) return '';
    const diff = ms - Date.now();
    if (diff <= 0) return '已离开（待释放笼位）';
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

  _mapFosterPetStatusByOrderStatus(orderStatus) {
    if (orderStatus === 'confirmed' || orderStatus === 'in_progress') return 'agency_foster';
    if (orderStatus === 'to_confirm') return 'waiting_pickup';
    if (orderStatus === 'cancelled' || orderStatus === 'completed') return '';
    return '';
  },

  _applyOccupiedFilter() {
    const all = this.data.occupiedPetsAll || [];
    const filter = this.data.petFilter || 'all';
    let list = all;
    if (filter === 'staying') list = all.filter(i => !i.isLeft);
    if (filter === 'left') list = all.filter(i => i.isLeft);
    this.setData({ occupiedPets: list });
  },

  _startLeaveTick() {
    this._stopLeaveTick();
    this._leaveTickTimer = setInterval(() => {
      const allOrders = this.data.allOrders || [];
      if (!allOrders.length) return;
      const refreshed = allOrders.map(item => ({
        ...item,
        leaveRemainText: this._buildLeaveRemainText(item.leaveTimeMs),
        isLeaveExpired: this._isLeaveExpired(item.leaveTimeMs),
      }));
      const occupiedFosterOrders = refreshed.filter(o => o.category === 'foster' && ['confirmed', 'in_progress', 'to_confirm'].includes(o.orderStatus));
      const occupiedPetsAll = occupiedFosterOrders.map(o => ({
        id: o._id,
        petName: o.petName || '未命名宠物',
        species: (o.petInfo && o.petInfo.species) || '',
        age: (o.petInfo && o.petInfo.age) || '',
        status: o.orderStatus,
        isLeft: !!o.isLeaveExpired,
        leaveRemainText: o.leaveRemainText || '未设置离开时间',
        image: (o.petInfo && o.petInfo.photo) || (o.images && o.images[0]) || '/static/pet/logo.png',
      }));
      const totalCages = Number((this.data.cageSummary && this.data.cageSummary.totalCages) || 0);
      const occupiedCages = occupiedFosterOrders.filter(o => !o.isLeaveExpired).length;
      const availableCages = Math.max(0, totalCages - occupiedCages);
      this.setData({
        allOrders: refreshed,
        pendingList: refreshed.filter(o => o.orderStatus === 'pending'),
        activeList: refreshed.filter(o => o.orderStatus === 'confirmed' || o.orderStatus === 'in_progress'),
        toConfirmList: refreshed.filter(o => o.orderStatus === 'to_confirm'),
        completedList: refreshed.filter(o => o.orderStatus === 'completed'),
        leftPetCount: occupiedPetsAll.filter(p => p.isLeft).length,
        occupiedPetsAll,
        cageSummary: {
          ...this.data.cageSummary,
          occupiedCages,
          availableCages,
        },
      });
      this._applyOccupiedFilter();
    }, 60000);
  },

  _stopLeaveTick() {
    if (this._leaveTickTimer) {
      clearInterval(this._leaveTickTimer);
      this._leaveTickTimer = null;
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
});
