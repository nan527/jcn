/**
 * 全局常量定义
 * 统一管理角色、存储键名等枚举值，避免硬编码散落在各页面
 */

/** 角色枚举 */
const ROLES = {
  PET_OWNER: 'pet_owner',
  AGENCY: 'agency',
  ADMIN: 'admin',
};

/** 角色详细信息 */
const ROLE_INFO = {
  [ROLES.PET_OWNER]: {
    label: '宠物主人',
    desc: '智能寄养、健康管理、AI创作',
    icon: 'tosend',
    homePage: '/pages/index/index',
    isTab: true,
  },
  [ROLES.AGENCY]: {
    label: '寄养机构',
    desc: '订单处理、环境打卡、客户管理',
    icon: 'shop-o',
    homePage: '/pages/agency/agency',
    isTab: false,
  },
  [ROLES.ADMIN]: {
    label: '系统管理',
    desc: '资质审核、系统监控、全量看板',
    icon: 'manager-o',
    homePage: '/pages/admin/admin',
    isTab: false,
  },
};

/** 本地缓存键名 */
const STORAGE_KEYS = {
  USER_INFO: 'jcn_user_info',
  LOGIN_TIME: 'jcn_login_time',
};

/** 会话有效期：7 天 */
const SESSION_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = {
  ROLES,
  ROLE_INFO,
  STORAGE_KEYS,
  SESSION_EXPIRE_MS,
};
