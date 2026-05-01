// pages/agency-edit/agency-edit.js
const authService = require('../../services/authService');

const BUSINESS_TYPES = ['宠物寄养机构', '宠物医院', '宠物美容洗护', '宠物用品店', '综合服务'];

Page({
  data: {
    profileId: '',
    form: {},
    businessTypeOptions: BUSINESS_TYPES,
    businessTypeIndex: 0,
    licenseFileList: [],
    permitFileList: [],
    storefrontFileList: [],
    envFileList: [],
    envImages: [],
    saving: false,
  },

  async onLoad() {
    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const userInfo = await authService.checkLogin();
      if (!userInfo || !userInfo.agencyProfileId) {
        wx.hideLoading();
        wx.showToast({ title: '未找到机构资料', icon: 'none' });
        return;
      }
      const db = wx.cloud.database();
      const res = await db.collection('agency_profiles').doc(userInfo.agencyProfileId).get();
      const profile = res.data;
      const btIdx = BUSINESS_TYPES.indexOf(profile.businessType);

      this.setData({
        profileId: userInfo.agencyProfileId,
        form: {
          orgName: profile.orgName || '',
          creditCode: profile.creditCode || '',
          legalName: profile.legalName || '',
          legalPhone: profile.legalPhone || '',
          region: profile.region || '',
          detailAddress: profile.detailAddress || '',
          businessType: profile.businessType || '',
          serviceScope: profile.serviceScope || '',
          businessHours: profile.businessHours || '',
          appointmentMethod: profile.appointmentMethod || '',
          emergencyContact: profile.emergencyContact || '',
          backupPhone: profile.backupPhone || '',
          orgIntro: profile.orgIntro || '',
          signatureService: profile.signatureService || '',
          totalCages: profile.totalCages ? String(profile.totalCages) : '',
          cageDesc: profile.cageDesc || '',
          licenseImage: profile.licenseImage || '',
          permitImage: profile.permitImage || '',
          storefrontImage: profile.storefrontImage || '',
          envImages: profile.envImages || [],
        },
        businessTypeIndex: btIdx >= 0 ? btIdx : 0,
        licenseFileList: profile.licenseImage ? [{ url: profile.licenseImage }] : [],
        permitFileList: profile.permitImage ? [{ url: profile.permitImage }] : [],
        storefrontFileList: profile.storefrontImage ? [{ url: profile.storefrontImage }] : [],
        envImages: profile.envImages || [],
        envFileList: (profile.envImages || []).map(url => ({ url })),
      });
    } catch (err) {
      console.error('[AgencyEdit] 加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (field) this.setData({ [`form.${field}`]: e.detail });
  },

  onBusinessTypeChange(e) {
    const idx = Number(e.detail.value);
    this.setData({
      businessTypeIndex: idx,
      'form.businessType': BUSINESS_TYPES[idx],
    });
  },

  async uploadSingle(filePath, folder) {
    const res = await wx.cloud.uploadFile({
      cloudPath: `${folder}/${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`,
      filePath,
    });
    return res.fileID;
  },

  async handleUpload(file, targetField, listField, folder) {
    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const fileID = await this.uploadSingle(file.url, folder);
      this.setData({
        [listField]: [{ url: file.url }],
        [`form.${targetField}`]: fileID,
      });
    } catch (err) {
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  afterReadLicense(e) {
    this.handleUpload(e.detail.file, 'licenseImage', 'licenseFileList', 'agency/license');
  },
  afterReadPermit(e) {
    this.handleUpload(e.detail.file, 'permitImage', 'permitFileList', 'agency/permit');
  },
  afterReadStorefront(e) {
    this.handleUpload(e.detail.file, 'storefrontImage', 'storefrontFileList', 'agency/storefront');
  },

  onDeleteLicense() {
    this.setData({ licenseFileList: [], 'form.licenseImage': '' });
  },
  onDeletePermit() {
    this.setData({ permitFileList: [], 'form.permitImage': '' });
  },
  onDeleteStorefront() {
    this.setData({ storefrontFileList: [], 'form.storefrontImage': '' });
  },

  async afterReadEnv(e) {
    const file = e.detail.file;
    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const fileID = await this.uploadSingle(file.url, 'agency/env');
      const envImages = this.data.envImages.concat(fileID);
      const envFileList = this.data.envFileList.concat({ url: file.url, cloudUrl: fileID });
      this.setData({ envImages, envFileList, 'form.envImages': envImages });
    } catch (err) {
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onDeleteEnv(e) {
    const idx = e.detail.index;
    const envImages = this.data.envImages.slice();
    const envFileList = this.data.envFileList.slice();
    envImages.splice(idx, 1);
    envFileList.splice(idx, 1);
    this.setData({ envImages, envFileList, 'form.envImages': envImages });
  },

  validate() {
    const f = this.data.form;
    if (!f.orgName || !f.creditCode || !f.legalName || !f.legalPhone || !f.region || !f.detailAddress) {
      return '请完整填写基础信息';
    }
    if (!f.licenseImage || !f.storefrontImage) {
      return '营业执照和门头照片必须上传';
    }
    const total = parseInt(f.totalCages, 10);
    if (!f.totalCages || Number.isNaN(total) || total <= 0) {
      return '请填写有效的笼位总数';
    }
    return '';
  },

  async save() {
    const msg = this.validate();
    if (msg) {
      wx.showToast({ title: msg, icon: 'none' });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });

    try {
      const db = wx.cloud.database();
      const f = this.data.form;
      await db.collection('agency_profiles').doc(this.data.profileId).update({
        data: {
          orgName: f.orgName,
          creditCode: f.creditCode,
          legalName: f.legalName,
          legalPhone: f.legalPhone,
          region: f.region,
          detailAddress: f.detailAddress,
          businessType: f.businessType,
          serviceScope: f.serviceScope,
          businessHours: f.businessHours,
          appointmentMethod: f.appointmentMethod,
          emergencyContact: f.emergencyContact,
          backupPhone: f.backupPhone,
          orgIntro: f.orgIntro,
          signatureService: f.signatureService,
          totalCages: parseInt(f.totalCages, 10) || 0,
          cageDesc: f.cageDesc || '',
          licenseImage: f.licenseImage,
          permitImage: f.permitImage,
          storefrontImage: f.storefrontImage,
          envImages: f.envImages || [],
          updateTime: db.serverDate(),
        },
      });

      // 同步 nickname 到 users 集合
      const userInfo = await authService.checkLogin();
      if (userInfo && userInfo._id) {
        await db.collection('users').doc(userInfo._id).update({
          data: { nickname: f.orgName, phone: f.legalPhone },
        });
      }

      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (err) {
      console.error('[AgencyEdit] 保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
