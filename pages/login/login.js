// pages/login/login.js
const authService = require('../../services/authService');
const { ROLES, ROLE_INFO } = require('../../constants/index');

Page({
  data: {
    role: ROLES.PET_OWNER,
    loginMode: 'wechat',
    isCheck: false,
    logging: false,
    account: '',
    password: '',
    loginBtnText: '微信一键登录',
    // 宠主注册
    showRegister: false,
    registering: false,
    regAccount: '',
    regPassword: '',
    regNickname: '',
    // 角色列表
    roles: Object.keys(ROLE_INFO)
      .map((key) => ({
        value: key,
        label: ROLE_INFO[key].label,
        desc: ROLE_INFO[key].desc,
        icon: ROLE_INFO[key].icon,
      })),
  },

  onLoad() {},

  onShow() {
    this.setData({ logging: false });
  },

  /** 角色切换 */
  onRoleChange(e) {
    const role = e.detail;
    const loginMode = role === ROLES.PET_OWNER ? 'wechat' : 'account';
    this.setData({
      role,
      loginMode,
      account: '',
      password: '',
      showRegister: false,
      loginBtnText: this._getBtnText(role, loginMode),
    });
  },

  onRoleClick(e) {
    const role = e.currentTarget.dataset.name;
    if (!role) return;
    const loginMode = role === ROLES.PET_OWNER ? 'wechat' : 'account';
    this.setData({
      role,
      loginMode,
      account: '',
      password: '',
      showRegister: false,
      loginBtnText: this._getBtnText(role, loginMode),
    });
  },

  /** 宠主登录模式切换 */
  switchToWechat() {
    this.setData({
      loginMode: 'wechat',
      account: '',
      password: '',
      showRegister: false,
      loginBtnText: '微信一键登录',
    });
  },

  switchToAccount() {
    this.setData({
      loginMode: 'account',
      showRegister: false,
      loginBtnText: '账号密码登录',
    });
  },

  _getBtnText(role, mode) {
    if (role === ROLES.PET_OWNER && mode === 'wechat') return '微信一键登录';
    return '账号密码登录';
  },

  onAccountChange(e) { this.setData({ account: e.detail }); },
  onPasswordChange(e) { this.setData({ password: e.detail }); },

  /** 宠主注册 */
  toggleRegister() {
    this.setData({ showRegister: !this.data.showRegister });
  },

  onRegAccountChange(e) { this.setData({ regAccount: e.detail }); },
  onRegPasswordChange(e) { this.setData({ regPassword: e.detail }); },
  onRegNicknameChange(e) { this.setData({ regNickname: e.detail }); },

  async doRegister() {
    if (this.data.registering) return;
    this.setData({ registering: true });
    try {
      await authService.registerPetOwner({
        account: this.data.regAccount,
        password: this.data.regPassword,
        nickname: this.data.regNickname,
      });
      wx.showToast({ title: '注册成功，请登录', icon: 'success' });
      this.setData({
        showRegister: false,
        account: this.data.regAccount,
        password: this.data.regPassword,
        regAccount: '',
        regPassword: '',
        regNickname: '',
      });
    } catch (err) {
      const code = err.message;
      let msg = '注册失败';
      if (code === 'MISSING_REQUIRED_FIELDS') msg = '请输入账号和密码';
      if (code === 'ACCOUNT_TOO_SHORT') msg = '账号至少3个字符';
      if (code === 'PASSWORD_TOO_SHORT') msg = '密码至少6个字符';
      if (code === 'ACCOUNT_EXISTS') msg = '该账号已被注册';
      wx.showToast({ title: msg, icon: 'none' });
    } finally {
      this.setData({ registering: false });
    }
  },

  toAgencyRegister() {
    wx.navigateTo({ url: '/pages/agency-register/agency-register' });
  },

  onCheckChange(e) {
    this.setData({ isCheck: e.detail });
  },

  viewAgreement() {
    wx.showModal({
      title: '服务协议',
      content: '本平台致力于为宠物主人和寄养机构提供安全、可靠的宠物寄养匹配与健康管理服务。使用本平台即表示您同意遵守相关规定。',
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  /** 登录入口 */
  async login() {
    if (!this.data.isCheck) {
      return wx.showToast({ title: '请先勾选服务协议', icon: 'none' });
    }
    if (this.data.logging) return;
    this.setData({ logging: true });

    try {
      let userInfo = null;
      const { role, loginMode, account, password } = this.data;

      if (role === ROLES.PET_OWNER && loginMode === 'wechat') {
        userInfo = await authService.loginWithWechat(role);
      } else {
        userInfo = await authService.loginWithAccount(role, account, password);
      }

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        authService.navigateByRole(userInfo.role);
      }, 800);
    } catch (err) {
      console.error('[Login] 登录异常', err);
      const code = err.message;
      let content = '请检查网络连接或云环境配置';
      if (code === 'CLOUD_FETCH_FAILED') content = '云开发连接失败（Failed to fetch），请确认开发者工具已登录、云环境可用，并关闭代理后重试';
      if (code === 'EMPTY_ACCOUNT_OR_PASSWORD') content = '请输入账号和密码';
      if (code === 'ACCOUNT_OR_PASSWORD_INCORRECT') content = '账号或密码错误';
      if (code === 'AGENCY_AUDIT_PENDING') content = '机构账号审核中，暂不可登录';
      if (code === 'AGENCY_AUDIT_REJECTED') content = '机构审核未通过，请联系管理员';
      wx.showModal({ title: '登录失败', content, showCancel: false });
    } finally {
      this.setData({ logging: false });
    }
  },
});
