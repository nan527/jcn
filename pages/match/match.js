// pages/match/match.js
const db = wx.cloud.database();

// 预定义匹配逻辑
const MATCH_LOGICS = {
  // 性格匹配 (如活泼的宠物匹配大场地机构)
  characterMatch: (pet, agency) => {
    if (pet.character && agency.tags) {
      if (pet.character.includes('活泼') && agency.tags.includes('户外运动')) {
        return 30;
      }
      if (pet.character.includes('胆小') && agency.tags.includes('独立空间')) {
        return 30;
      }
    }
    return 0;
  },
  // 品种匹配 (如布偶猫匹配恒温恒湿机构)
  speciesMatch: (pet, agency) => {
    if (pet.species === '布偶猫' && agency.tags.includes('恒温恒湿')) {
      return 20;
    }
    return 0;
  },
  // 评价分权重
  scoreWeight: (agency) => {
    return (agency.score || 5) * 10;
  }
};


Page({
  data: {
    petList: [],
    selectedPet: null,
    agencyList: [],
    loading: false
  },

  onShow() {
    this.loadPetService();
  },

  // 1. 加载宠物列表
  async loadPetService() {
    try {
      const res = await db.collection('pets').get();
      this.setData({ petList: res.data });
      if (res.data.length > 0) {
        this.selectPet(res.data[0]); 
      }
    } catch (err) {
      console.warn('初次加载宠物失败，请确认数据库已创建 pets 集合', err);
    }
  },

  // 2. 核心匹配逻辑接口
  async calculateMatch() {
    if (!this.data.selectedPet) return;
    
    this.setData({ loading: true });
    try {
      // 预留接口：同学B在此处填充算法逻辑
      const agencyRes = await db.collection('agencies').get();
      const agencies = agencyRes.data.map(agency => {
        return {
          ...agency,
          match_score: 95, 
          match_reason: '符合宠物特征'
        };
      });

      this.setData({
        agencyList: agencies.sort((a, b) => b.match_score - a.match_score),
        loading: false
      });
    } catch (err) {
      console.warn('匹配计算失败，请确认数据库已创建 agencies 集合', err);
      this.setData({ loading: false });
    }
  },

  onPetChange(e) {
    const pet = this.data.petList.find(p => p._id === e.detail);
    if (pet) this.selectPet(pet);
  },

  selectPet(pet) {
    this.setData({ selectedPet: pet });
    if (app.globalData.pet) {
      app.globalData.pet.currentPet = pet;
    }
    this.calculateMatch();
  }
});
