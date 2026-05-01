// pages/pet/pet.js
const PRESET_AVATARS = [
  { name: '金毛', src: '/static/Avatar/pet/金毛.png' },
  { name: '拉布拉多', src: '/static/Avatar/pet/拉布拉多.png' },
  { name: '柯基', src: '/static/Avatar/pet/柯基.png' },
  { name: '哈士奇', src: '/static/Avatar/pet/哈士奇.png' },
  { name: '柴犬', src: '/static/Avatar/pet/柴犬.png' },
  { name: '泰迪贵宾', src: '/static/Avatar/pet/泰迪贵宾.png' },
  { name: '萨摩耶', src: '/static/Avatar/pet/萨摩耶.png' },
  { name: '博美', src: '/static/Avatar/pet/博美.png' },
  { name: '比熊', src: '/static/Avatar/pet/比熊.png' },
  { name: '边牧', src: '/static/Avatar/pet/边牧.png' },
  { name: '法斗', src: '/static/Avatar/pet/法斗.png' },
  { name: '吉娃娃', src: '/static/Avatar/pet/吉娃娃.png' },
  { name: '雪纳瑞', src: '/static/Avatar/pet/雪纳瑞.png' },
  { name: '中华田园犬', src: '/static/Avatar/pet/中华田园犬.png' },
  { name: '布偶猫', src: '/static/Avatar/pet/布偶猫.png' },
  { name: '英国短毛猫', src: '/static/Avatar/pet/英国短毛猫.png' },
  { name: '美国短毛猫', src: '/static/Avatar/pet/美国短毛猫.png' },
  { name: '加菲猫', src: '/static/Avatar/pet/加菲猫.png' },
  { name: '暹罗猫', src: '/static/Avatar/pet/暹罗猫.png' },
  { name: '波斯猫', src: '/static/Avatar/pet/波斯猫.png' },
  { name: '金渐层', src: '/static/Avatar/pet/金渐层.png' },
  { name: '银渐层', src: '/static/Avatar/pet/银渐层.png' },
  { name: '曼基康矮脚猫', src: '/static/Avatar/pet/曼基康矮脚猫.png' },
  { name: '斯芬克斯无毛猫', src: '/static/Avatar/pet/斯芬克斯无毛猫.png' },
  { name: '中华田园猫', src: '/static/Avatar/pet/中华田园猫.png' },
];

Page({
  data: {
    petList: [],        // 我的宠物列表
    loading: true,      // 加载状态
    showForm: false,    // 是否展示添加表单
    // 表单字段
    name: '',
    species: '',
    age: '',
    character: '',
    special: '',
    fileList: [],
    photoUrl: '',
    saving: false,
    editingId: '',   // 正在编辑的宠物 _id，空则为新增模式
    // 预设头像
    showAvatarPicker: false,
    presetAvatars: PRESET_AVATARS,
    selectedPresetIdx: -1,
  },

  onShow() {
    this.loadPetList();
  },

  /** 加载当前用户的宠物列表（含领养入的宠物） */
  async loadPetList() {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const res = await db.collection('pets')
        .orderBy('createTime', 'desc')
        .get();
      const petList = (res.data || []).map(p => ({
        ...p,
        petStatus: p.petStatus || '',
      }));

      // 加载已通过的领养申请，将对应宠物也加入档案
      try {
        const applyRes = await db.collection('foster_applications')
          .where({ _openid: '{openid}', applyType: 'adopt', applyStatus: 'approved' })
          .get();
        const adoptedPets = (applyRes.data || []).map(a => ({
          _id: 'adopted_' + a._id,
          name: a.petName,
          species: a.breed || '',
          photo: (a.images && a.images[0]) || '',
          petStatus: 'adopted_in',
          character: '',
          age: '',
          _isAdopted: true,
        }));
        // 避免重复（已手动加入pets集合的不再重复显示）
        const existNames = new Set(petList.map(p => p.name));
        adoptedPets.forEach(ap => {
          if (!existNames.has(ap.name)) petList.push(ap);
        });
      } catch (e) { /* collection may not exist */ }

      this.setData({ petList, loading: false });
    } catch (err) {
      console.error('[Pet] 加载宠物列表失败', err);
      this.setData({ loading: false });
    }
  },

  /** 切换添加表单显示 */
  toggleForm() {
    const show = !this.data.showForm;
    this.setData({
      showForm: show,
      // 展开时重置表单（仅新增模式才清空）
      ...(show ? { editingId: '', name: '', species: '', age: '', character: '', special: '', fileList: [], photoUrl: '', selectedPresetIdx: -1 } : { editingId: '' }),
    });
  },

  /** 点击编辑宠物 */
  editPet(e) {
    const id = e.currentTarget.dataset.id;
    const pet = this.data.petList.find(p => p._id === id);
    if (!pet) return;
    this.setData({
      showForm: true,
      editingId: id,
      name: pet.name || '',
      species: pet.species || '',
      age: pet.age ? String(pet.age) : '',
      character: pet.character || '',
      special: pet.special_needs || '',
      photoUrl: pet.photo || '',
      fileList: pet.photo ? [{ url: pet.photo }] : [],
    });
    // 滚动到表单区域
    wx.pageScrollTo({ selector: '.form-section', duration: 300 });
  },

  /** 取消编辑，恢复为新增模式 */
  cancelEdit() {
    this.setData({
      editingId: '',
      showForm: false,
      name: '', species: '', age: '', character: '', special: '', fileList: [], photoUrl: '', selectedPresetIdx: -1,
    });
  },

  // ===== 表单事件 =====
  /** 预设头像弹层 */
  openAvatarPicker() {
    this.setData({ showAvatarPicker: true });
  },

  closeAvatarPicker() {
    this.setData({ showAvatarPicker: false });
  },

  onPickAvatar(e) {
    const idx = e.currentTarget.dataset.idx;
    const avatar = PRESET_AVATARS[idx];
    if (!avatar) return;
    this.setData({
      selectedPresetIdx: idx,
      photoUrl: avatar.src,
      fileList: [{ url: avatar.src }],
      showAvatarPicker: false,
    });
  },

  onNameChange(e) { this.setData({ name: e.detail }); },
  onSpeciesChange(e) { this.setData({ species: e.detail }); },
  onAgeChange(e) { this.setData({ age: e.detail }); },
  onCharacterChange(e) { this.setData({ character: e.detail }); },
  onSpecialChange(e) { this.setData({ special: e.detail }); },

  async afterRead(event) {
    const { file } = event.detail;
    wx.showLoading({ title: '照片上传中' });
    try {
      const res = await wx.cloud.uploadFile({
        cloudPath: `pets/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`,
        filePath: file.url,
      });
      this.setData({
        photoUrl: res.fileID,
        fileList: [{ url: file.url }],
      });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  /** 保存宠物（新增 / 编辑） */
  async savePet() {
    if (!this.data.name || !this.data.species) {
      wx.showToast({ title: '请填写昵称和品种', icon: 'none' });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      const db = wx.cloud.database();
      const petData = {
        name: this.data.name,
        species: this.data.species,
        age: this.data.age ? parseInt(this.data.age) : 0,
        character: this.data.character,
        special_needs: this.data.special,
        photo: this.data.photoUrl,
      };

      if (this.data.editingId) {
        // 编辑模式 —— 更新
        await db.collection('pets').doc(this.data.editingId).update({
          data: petData,
        });
        wx.showToast({ title: '修改成功' });
      } else {
        // 新增模式
        petData.createTime = db.serverDate();
        await db.collection('pets').add({ data: petData });
        wx.showToast({ title: '添加成功' });
      }

      this.setData({ showForm: false, saving: false, editingId: '' });
      this.loadPetList();
    } catch (err) {
      this.setData({ saving: false });
      wx.showModal({ title: '保存失败', content: '请检查数据库 pets 集合权限', showCancel: false });
    }
  },

  /** 删除宠物 */
  deletePet(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${name}」的档案吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          const db = wx.cloud.database();
          await db.collection('pets').doc(id).remove();
          wx.showToast({ title: '已删除' });
          this.loadPetList();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
    });
  },
});