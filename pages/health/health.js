// pages/health/health.js
const db = wx.cloud.database();
const app = getApp();

Page({
  data: {
    pet: null,
    healthRecords: [],
    weight: '',
    food: '',
    aiSuggestion: '录入数据后，AI 将为您提供专业养护建议...',
    loading: false,
    healthHistory: [],
    aiReport: ''
  },

  onLoad() {
    this.fetchPetInfo();
  },

  // 1. 获取当前宠物健康概览
  async fetchPetInfo() {
    const res = await db.collection('pets').limit(1).get();
    if (res.data.length > 0) {
      this.setData({ pet: res.data[0] });
      this.fetchHealthHistory(res.data[0]._id);
    }
  },

  // 2. 获取历史健康趋势
  async fetchHealthHistory(petId) {
    const res = await db.collection('health_records')
      .where({ pet_id: petId })
      .orderBy('record_date', 'desc')
      .limit(10)
      .get();
    this.setData({ healthRecords: res.data });
  },

  onShow() {
    this.fetchHealthData();
  },

  // 【同学D实现细节 1】：从 records 集合获取该宠物的健康趋势
  async fetchHealthData() {
    const petId = app.globalData.pet.currentPet?._id;
    if (!petId) return;
    // 逻辑建议：查询 records 集合，按时间排序 -> 渲染图表
    const res = await db.collection('health_records')
      .where({ pet_id: petId })
      .orderBy('record_date', 'desc')
      .get();
    this.setData({ healthHistory: res.data });
  },

  // 3. 录入新健康数据并触发 AI 分析
  async saveHealthData() {
    if (!this.data.weight) {
      wx.showToast({ title: '请输入体重', icon: 'none' });
      return;
    }

    try {
      this.setData({ loading: true });
      
      // 保存到数据库
      await db.collection('health_records').add({
        data: {
          pet_id: this.data.pet._id,
          type: 'weight',
          value: this.data.weight,
          food_intake: this.data.food,
          record_date: db.serverDate(),
          recorder_role: 'owner'
        }
      });

      // 4. 调用 AI 云函数进行智能解读 (对应文档 116, 125, 188 行)
      const aiRes = await wx.cloud.callFunction({
        name: 'ai_handler',
        data: {
          action: 'analyze_health',
          pet_info: this.data.pet,
          current_data: { weight: this.data.weight, food: this.data.food }
        }
      });

      this.setData({
        aiSuggestion: aiRes.result.suggestion || '数据正常，继续保持良好养护习惯！',
        loading: false
      });

      wx.showToast({ title: '记录成功' });
      this.fetchHealthHistory(this.data.pet._id);

    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
  }
});
