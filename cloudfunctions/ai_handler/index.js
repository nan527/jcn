// cloudfunctions/ai_handler/index.js
const cloud = require('wx-server-sdk');
const axios = require('axios'); // 建议通过 npm 安装

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 开源大模型 API 配置 (以 DeepSeek/Qwen 为例)
const API_URL = 'https://api.deepseek.com/v1/chat/completions'; // 你的 API URL
const API_KEY = process.env.AI_API_KEY || 'YOUR_API_KEY'; // 在云开发控制台环境变量中配置

exports.main = async (event, context) => {
  const { action } = event;

  // 按 action 分发不同场景
  switch (action) {
    case 'analyze_health':
      return await analyzeHealth(event);
    default:
      return { success: false, msg: '未知操作: ' + action };
  }
};

/**
 * 健康数据智能分析
 * @param {Object} event - { action, pet_info, current_data }
 *                        或 { action, petId, healthData }
 */
async function analyzeHealth(event) {
  try {
    // 兼容两种调用方式
    let petInfo = event.pet_info;
    const healthData = event.current_data || event.healthData || {};

    // 如果传入的是 petId，从数据库查询
    if (!petInfo && event.petId) {
      const res = await cloud.database().collection('pets').doc(event.petId).get();
      petInfo = res.data;
    }

    if (!petInfo) {
      return { success: false, suggestion: '未找到宠物信息，请先录入宠物档案。' };
    }

    // 拼接 Prompt
    const prompt = `您是一位专业的宠物健康顾问。
宠物信息: 品种 ${petInfo.species || '未知'}, 年龄 ${petInfo.age || '未知'} 岁, 性格 ${petInfo.character || '未知'}。
当前数据: 体重 ${healthData.weight || '未知'}kg, 进食量 ${healthData.food || '正常'}。
请根据以上数据，给出一段简短的(50字以内)养护建议，如果发现体重异常请特别提示。`;

    const response = await axios.post(API_URL, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 15000,
    });

    const suggestion = response.data.choices[0].message.content;

    return {
      success: true,
      suggestion,
      suggestion_tags: extractTags(suggestion),
    };
  } catch (err) {
    console.error('[ai_handler] analyzeHealth 异常', err);
    return {
      success: false,
      suggestion: 'AI 暂时无法响应，建议咨询宠物医院。',
    };
  }
}

/** 简易标签提取（可后续优化） */
function extractTags(text) {
  const keywords = ['控制饮食', '多运动', '补充营养', '注意保暖', '定期体检', '减少零食'];
  return keywords.filter((kw) => text.includes(kw));
}
