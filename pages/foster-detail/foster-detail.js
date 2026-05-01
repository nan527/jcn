// pages/foster-detail/foster-detail.js
const authService = require('../../services/authService');

Page({
  data: {
    detail: null,
    isOwner: false,
    applying: false,
    // 编辑相关
    editing: false,
    saving: false,
    editDesc: '',
    editBudget: '',
    editReason: '',
    editRequirement: '',
    editContactName: '',
    editContactPhone: '',
    editLocation: '',
  },

  _id: '',
  _type: '',

  async onLoad(options) {
    const { id, type } = options;
    if (!id || !type) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this._id = id;
    this._type = type;
    await this._loadDetail();
  },

  async _loadDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const db = wx.cloud.database();
      const collection = this._type === 'foster' ? 'fosters' : 'adoptions';
      const res = await db.collection(collection).doc(this._id).get();
      const detail = { ...res.data, _type: this._type };

      const userInfo = await authService.checkLogin();
      const isOwner = userInfo && detail._openid === userInfo._openid;

      wx.setNavigationBarTitle({ title: this._type === 'foster' ? '寄养详情' : '送养详情' });
      this.setData({ detail, isOwner });
    } catch (e) {
      console.error('[FosterDetail] load', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  previewImg(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.detail.images || [src],
    });
  },

  // ===== 编辑相关 =====
  startEdit() {
    const d = this.data.detail;
    this.setData({
      editing: true,
      editDesc: d.description || '',
      editBudget: d.budget || '',
      editReason: d.reason || '',
      editRequirement: d.requirement || '',
      editContactName: d.contactName || '',
      editContactPhone: d.contactPhone || '',
      editLocation: d.location || '',
    });
    wx.pageScrollTo({ selector: '.edit-btn-row', duration: 300 });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onEditDescChange(e) { this.setData({ editDesc: e.detail }); },
  onEditBudgetChange(e) { this.setData({ editBudget: e.detail }); },
  onEditReasonChange(e) { this.setData({ editReason: e.detail }); },
  onEditRequirementChange(e) { this.setData({ editRequirement: e.detail }); },
  onEditContactNameChange(e) { this.setData({ editContactName: e.detail }); },
  onEditContactPhoneChange(e) { this.setData({ editContactPhone: e.detail }); },
  onEditLocationChange(e) { this.setData({ editLocation: e.detail }); },

  async saveEdit() {
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      const db = wx.cloud.database();
      const d = this.data.detail;
      const collection = d._type === 'foster' ? 'fosters' : 'adoptions';
      const updateData = {
        contactName: this.data.editContactName,
        contactPhone: this.data.editContactPhone,
        location: this.data.editLocation,
      };
      if (d._type === 'foster') {
        updateData.description = this.data.editDesc;
        updateData.budget = this.data.editBudget;
      } else {
        updateData.reason = this.data.editReason;
        updateData.requirement = this.data.editRequirement;
      }

      await db.collection(collection).doc(d._id).update({ data: updateData });
      wx.showToast({ title: '修改成功', icon: 'success' });
      this.setData({ editing: false });
      await this._loadDetail();
    } catch (e) {
      console.error('[FosterDetail] saveEdit', e);
      wx.showToast({ title: '修改失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  // ===== 关闭 / 重新开放 =====
  toggleStatus() {
    const d = this.data.detail;
    const newStatus = d.status === 'open' ? 'closed' : 'open';
    const label = newStatus === 'closed' ? '关闭' : '重新开放';

    wx.showModal({
      title: `确认${label}`,
      content: `${label}后，其他用户将${newStatus === 'closed' ? '无法' : '可以'}看到并申请该信息。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const db = wx.cloud.database();
          const collection = d._type === 'foster' ? 'fosters' : 'adoptions';
          await db.collection(collection).doc(d._id).update({ data: { status: newStatus } });

          // 同步宠物档案状态
          if (d.petId) {
            const petStatus = newStatus === 'closed' ? ''
              : (d._type === 'foster' ? 'pending_foster' : 'pending_adopt');
            try {
              await db.collection('pets').doc(d.petId).update({ data: { petStatus } });
            } catch (e) { /* ignore */ }
          }

          wx.showToast({ title: `已${label}`, icon: 'success' });
          await this._loadDetail();
        } catch (e) {
          console.error('[FosterDetail] toggleStatus', e);
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  // ===== 删除 =====
  deletePost() {
    const d = this.data.detail;
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${d.petName}」的${d._type === 'foster' ? '寄养' : '送养'}信息？删除后不可恢复。`,
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          const db = wx.cloud.database();
          const collection = d._type === 'foster' ? 'fosters' : 'adoptions';
          await db.collection(collection).doc(d._id).remove();

          // 重置宠物档案状态
          if (d.petId) {
            try {
              await db.collection('pets').doc(d.petId).update({ data: { petStatus: '' } });
            } catch (e) { /* ignore */ }
          }

          wx.hideLoading();
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 800);
        } catch (e) {
          wx.hideLoading();
          console.error('[FosterDetail] delete', e);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },

  // ===== 非发布者申请 =====
  async onApply() {
    const userInfo = await authService.checkLogin();
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    if (this.data.applying) return;

    wx.showModal({
      title: '确认申请',
      content: this.data.detail._type === 'adopt' ? '确定申请领养该宠物？' : '确定接受该寄养请求？',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ applying: true });
        try {
          const db = wx.cloud.database();
          const d = this.data.detail;

          // 创建申请记录
          await db.collection('foster_applications').add({
            data: {
              postId: d._id,
              postType: d._type,
              applyType: d._type,
              petName: d.petName,
              breed: d.breed || '',
              images: d.images || [],
              authorName: d.authorName || d.contactName || '',
              authorOpenid: d._openid,
              applyStatus: 'pending',
              applyTime: db.serverDate(),
            },
          });

          // 同时创建个人订单
          await db.collection('user_orders').add({
            data: {
              orderType: 'personal',
              sourceType: d._type,
              postId: d._id,
              petName: d.petName,
              breed: d.breed || '',
              images: d.images || [],
              counterpart: d.authorName || d.contactName || '匿名',
              orderStatus: 'pending',
              createTime: db.serverDate(),
            },
          });

          wx.showToast({ title: '申请已提交', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1000);
        } catch (e) {
          console.error('[FosterDetail] apply', e);
          wx.showToast({ title: '申请失败', icon: 'none' });
        } finally {
          this.setData({ applying: false });
        }
      },
    });
  },
});
