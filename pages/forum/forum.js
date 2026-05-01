// pages/forum/forum.js
const authService = require('../../services/authService');

Page({
  data: {
    tab: 'all',      // 'all' | 'mine'
    postList: [],
    loading: true,
  },

  onLoad(options) {
    if (options.tab === 'mine') {
      this.setData({ tab: 'mine' });
    }
  },

  onShow() {
    this.loadPosts();
  },

  /** 切换 tab */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    this.loadPosts();
  },

  /** 加载帖子列表 */
  async loadPosts() {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      let query = db.collection('posts').orderBy('createTime', 'desc').limit(50);

      if (this.data.tab === 'mine') {
        // 云开发自动按 _openid 过滤
        query = query.where({ _openid: '{openid}' });
      }

      const res = await query.get();
      this.setData({ postList: res.data, loading: false });
    } catch (err) {
      console.error('[Forum] 加载帖子失败', err);
      this.setData({ loading: false });
    }
  },

  /** 跳转到发帖页 */
  toCreatePost() {
    wx.navigateTo({ url: '/pages/post/post' });
  },

  /** 点击帖子跳转详情 */
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/post-detail/post-detail?id=${id}` });
  },

  /** 点赞 */
  async onLike(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.postList.findIndex(p => p._id === id);
    if (idx < 0) return;

    try {
      const db = wx.cloud.database();
      await db.collection('posts').doc(id).update({
        data: { likeCount: db.command.inc(1) },
      });
      const key = `postList[${idx}].likeCount`;
      this.setData({ [key]: (this.data.postList[idx].likeCount || 0) + 1 });
    } catch (err) {
      console.warn('[Forum] 点赞失败', err);
    }
  },

  /** 下拉刷新 */
  onPullDownRefresh() {
    this.loadPosts().then(() => wx.stopPullDownRefresh());
  },
});
