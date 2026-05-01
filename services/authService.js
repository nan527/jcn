/**
 * AuthService —— 认证服务
 * 负责登录、注册、会话缓存、角色路由等统一逻辑
 * 其他页面通过 const authService = require('../../services/authService') 引入
 */
const { ROLES, ROLE_INFO, STORAGE_KEYS, SESSION_EXPIRE_MS } = require('../constants/index');

/** 惰性获取 db 实例，避免在 wx.cloud.init() 之前调用 */
let _db = null;
function getDB() {
  if (!_db) _db = wx.cloud.database();
  return _db;
}

/** 带超时的 Promise 包装，避免云调用卡死 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function isTimeoutError(err) {
  const msg = (err && err.message) || '';
  return msg === 'timeout';
}

function isCloudFetchError(err) {
  const msg = ((err && err.message) || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('request:fail') || msg.includes('network error');
}

const authService = {
  // ======================== 公开方法 ========================

  /**
   * 检查登录状态（优先本地缓存 → 云端静默查询）
   * @returns {Object|null} userInfo 或 null
   */
  async checkLogin() {
    try {
      // 1. 本地缓存
      const cached = this._getCachedUser();
      if (cached) {
        this._syncToGlobal(cached);
        return cached;
      }

      // 2. 云端静默查询（5 秒超时，不阻塞体验）
      try {
        const res = await withTimeout(
          getDB().collection('users').where({ _openid: '{openid}' }).limit(1).get(),
          5000
        );
        if (res.data.length > 0) {
          const userInfo = res.data[0];
          this._cacheUser(userInfo);
          return userInfo;
        }
      } catch (err) {
        console.warn('[AuthService] 静默查询失败或超时', err.message || err);
      }

      return null;
    } catch (err) {
      console.warn('[AuthService] checkLogin异常，按未登录处理', err.message || err);
      return null;
    }
  },

  /**
   * 账号密码登录（宠主 / 机构 / 管理员）
   * @param {string} role - 角色：pet_owner / agency / admin
   * @param {string} account
   * @param {string} password
   */
  async loginWithAccount(role, account, password) {
    const acc = (account || '').trim();
    const pwd = (password || '').trim();
    if (!acc || !pwd) {
      throw new Error('EMPTY_ACCOUNT_OR_PASSWORD');
    }

    if (role === ROLES.ADMIN) {
      await this.ensureDefaultAdmin();
    }

    const res = await withTimeout(
      getDB().collection('users').where({ role, account: acc, password: pwd }).limit(1).get(),
      8000
    );

    if (!res.data.length) {
      throw new Error('ACCOUNT_OR_PASSWORD_INCORRECT');
    }

    const userInfo = res.data[0];

    if (role === ROLES.AGENCY && userInfo.auditStatus !== 'approved') {
      const status = userInfo.auditStatus || 'pending';
      throw new Error(`AGENCY_AUDIT_${status.toUpperCase()}`);
    }

    try {
      await withTimeout(
        getDB().collection('users').doc(userInfo._id).update({
          data: { lastLoginTime: getDB().serverDate() },
        }),
        5000
      );
    } catch (e) { /* 更新失败不阻塞登录 */ }

    const safeUser = this._sanitizeUser(userInfo);
    this._cacheUser(safeUser);
    return safeUser;
  },

  /**
   * 宠主账号注册
   * @param {Object} payload - { account, password, nickname }
   */
  async registerPetOwner(payload) {
    const account = (payload.account || '').trim();
    const password = (payload.password || '').trim();
    const nickname = (payload.nickname || '').trim() || '宠物主人';

    if (!account || !password) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }
    if (account.length < 3) {
      throw new Error('ACCOUNT_TOO_SHORT');
    }
    if (password.length < 6) {
      throw new Error('PASSWORD_TOO_SHORT');
    }

    const existing = await withTimeout(
      getDB().collection('users').where({ account }).limit(1).get(),
      8000
    );
    if (existing.data.length) {
      throw new Error('ACCOUNT_EXISTS');
    }

    await withTimeout(
      getDB().collection('users').add({
        data: {
          role: ROLES.PET_OWNER,
          nickname,
          avatar: '',
          phone: '',
          account,
          password,
          createTime: getDB().serverDate(),
          lastLoginTime: getDB().serverDate(),
        },
      }),
      8000
    );

    return { success: true };
  },

  /**
   * 机构注册（待管理员审核）
   * @param {Object} payload
   */
  async registerAgency(payload) {
    const data = payload || {};
    const account = (data.account || '').trim();
    const password = (data.password || '').trim();
    const orgName = (data.orgName || '').trim();
    const creditCode = (data.creditCode || '').trim();
    const legalName = (data.legalName || '').trim();
    const legalPhone = (data.legalPhone || '').trim();
    const region = (data.region || '').trim();
    const detailAddress = (data.detailAddress || '').trim();

    if (!account || !password || !orgName || !creditCode || !legalName || !legalPhone || !region || !detailAddress) {
      throw new Error('MISSING_REQUIRED_FIELDS');
    }

    // 账号唯一
    const accountRes = await withTimeout(
      getDB().collection('users').where({ account }).limit(1).get(),
      8000
    );
    if (accountRes.data.length) {
      throw new Error('ACCOUNT_EXISTS');
    }

    // 机构名称唯一
    const orgRes = await withTimeout(
      getDB().collection('agency_profiles').where({ orgName }).limit(1).get(),
      8000
    );
    if (orgRes.data.length) {
      throw new Error('ORG_NAME_EXISTS');
    }

    // 社会信用代码唯一
    const codeRes = await withTimeout(
      getDB().collection('agency_profiles').where({ creditCode }).limit(1).get(),
      8000
    );
    if (codeRes.data.length) {
      throw new Error('CREDIT_CODE_EXISTS');
    }

    // 写入机构资料
    const profileRes = await withTimeout(
      getDB().collection('agency_profiles').add({
        data: {
          orgName,
          creditCode,
          legalName,
          legalPhone,
          region,
          detailAddress,
          businessType: data.businessType || '',
          serviceScope: data.serviceScope || '',
          businessHours: data.businessHours || '',
          appointmentMethod: data.appointmentMethod || '',
          totalCages: Number(data.totalCages) || 0,
          cageDesc: data.cageDesc || '',
          emergencyContact: data.emergencyContact || '',
          backupPhone: data.backupPhone || '',
          orgIntro: data.orgIntro || '',
          signatureService: data.signatureService || '',
          licenseImage: data.licenseImage || '',
          permitImage: data.permitImage || '',
          storefrontImage: data.storefrontImage || '',
          auditStatus: 'pending',
          createTime: getDB().serverDate(),
          updateTime: getDB().serverDate(),
        },
      }),
      8000
    );

    // 写入账号（待审核）
    await withTimeout(
      getDB().collection('users').add({
        data: {
          role: ROLES.AGENCY,
          nickname: orgName,
          avatar: '',
          phone: legalPhone,
          account,
          password,
          agencyProfileId: profileRes._id,
          auditStatus: 'pending',
          createTime: getDB().serverDate(),
          lastLoginTime: getDB().serverDate(),
        },
      }),
      8000
    );

    return { success: true };
  },

  /** 保证默认管理员存在（便于演示） */
  async ensureDefaultAdmin() {
    const res = await withTimeout(
      getDB().collection('users').where({ role: ROLES.ADMIN, account: 'admin' }).limit(1).get(),
      5000
    );
    if (!res.data.length) {
      await withTimeout(
        getDB().collection('users').add({
          data: {
            role: ROLES.ADMIN,
            nickname: '系统管理员',
            account: 'admin',
            password: 'admin123',
            avatar: '',
            phone: '',
            auditStatus: 'approved',
            createTime: getDB().serverDate(),
            lastLoginTime: getDB().serverDate(),
          },
        }),
        5000
      );
    }
  },

  /**
   * 微信一键登录（仅宠主）
   * @param {string} role - 角色值，取自 ROLES
   * @returns {Object} userInfo
   */
  async loginWithWechat(role) {
    wx.showLoading({ title: '登录中…', mask: true });

    try {
      // 先检查当前 openid 是否已绑定宠主账号
      let existing = { data: [] };
      try {
        existing = await withTimeout(
          getDB().collection('users').where({ _openid: '{openid}', role: ROLES.PET_OWNER }).limit(1).get(),
          8000
        );
      } catch (queryErr) {
        if (isTimeoutError(queryErr)) {
          console.warn('[AuthService] 查询超时，按新用户注册', queryErr.message);
        } else {
          throw queryErr;
        }
      }

      if (existing.data.length > 0) {
        const userInfo = existing.data[0];
        try {
          await withTimeout(
            getDB().collection('users').doc(userInfo._id).update({
              data: { lastLoginTime: getDB().serverDate() },
            }),
            5000
          );
        } catch (e) { /* 更新失败不阻塞登录 */ }
        this._cacheUser(userInfo);
        wx.hideLoading();
        return userInfo;
      }

      // 新用户注册（宠主）
      const roleInfo = ROLE_INFO[ROLES.PET_OWNER];
      const addRes = await withTimeout(
        getDB().collection('users').add({
          data: {
            role: ROLES.PET_OWNER,
            nickname: roleInfo.label,
            avatar: '',
            phone: '',
            createTime: getDB().serverDate(),
            lastLoginTime: getDB().serverDate(),
          },
        }),
        8000
      );

      const userInfo = {
        _id: addRes._id,
        role: ROLES.PET_OWNER,
        nickname: roleInfo.label,
        avatar: '',
        phone: '',
      };

      this._cacheUser(userInfo);
      wx.hideLoading();
      return userInfo;
    } catch (err) {
      wx.hideLoading();
      console.error('[AuthService] 登录失败', err);
      if (isCloudFetchError(err)) {
        throw new Error('CLOUD_FETCH_FAILED');
      }
      throw err;
    }
  },

  /**
   * 退出登录，清除缓存与全局状态
   */
  logout() {
    try {
      wx.removeStorageSync(STORAGE_KEYS.USER_INFO);
      wx.removeStorageSync(STORAGE_KEYS.LOGIN_TIME);
    } catch (e) { /* ignore */ }
    this._syncToGlobal(null);
  },

  /**
   * 按角色跳转到对应首页
   * @param {string} role
   */
  navigateByRole(role) {
    const info = ROLE_INFO[role] || ROLE_INFO[ROLES.PET_OWNER];
    if (info.isTab) {
      wx.switchTab({ url: info.homePage });
    } else {
      wx.redirectTo({ url: info.homePage });
    }
  },

  /**
   * 鉴权守卫：未登录则跳转登录页
   * 适合在 onShow / onLoad 中调用
   * @returns {Object|null}
   */
  async requireAuth() {
    const userInfo = await this.checkLogin();
    if (!userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return null;
    }
    return userInfo;
  },

  /**
   * 获取角色展示信息
   * @param {string} role
   * @returns {Object} { label, desc, icon, homePage, isTab }
   */
  getRoleInfo(role) {
    return ROLE_INFO[role] || ROLE_INFO[ROLES.PET_OWNER];
  },

  // ======================== 私有方法 ========================

  /** 从本地缓存读取用户（带过期判断） */
  _getCachedUser() {
    try {
      const userInfo = wx.getStorageSync(STORAGE_KEYS.USER_INFO);
      const loginTime = wx.getStorageSync(STORAGE_KEYS.LOGIN_TIME);
      if (userInfo && loginTime && Date.now() - loginTime < SESSION_EXPIRE_MS) {
        return userInfo;
      }
      // 过期则清除
      if (userInfo) this.logout();
    } catch (e) { /* ignore */ }
    return null;
  },

  /** 写入本地缓存 + 同步到全局 */
  _cacheUser(userInfo) {
    const safeUser = this._sanitizeUser(userInfo);
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_INFO, safeUser);
      wx.setStorageSync(STORAGE_KEYS.LOGIN_TIME, Date.now());
    } catch (e) {
      console.warn('[AuthService] 缓存写入失败', e);
    }
    this._syncToGlobal(safeUser);
  },

  /** 去除敏感字段 */
  _sanitizeUser(userInfo) {
    if (!userInfo) return userInfo;
    const safe = { ...userInfo };
    delete safe.password;
    return safe;
  },

  /** 同步到 app.globalData */
  _syncToGlobal(userInfo) {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.auth = app.globalData.auth || {};
      app.globalData.auth.userInfo = userInfo;
    }
  },
};

module.exports = authService;
