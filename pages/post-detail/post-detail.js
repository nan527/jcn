// pages/post-detail/post-detail.js
const authService = require('../../services/authService');

Page({
  data: {
    post: null,
    comments: [],
    loading: true,
    commentText: '',
    sending: false,
  },

  onLoad(options) {
    if (options.id) {
      this.postId = options.id;
      this.loadDetail();
      this.loadComments();
    }
  },

  /** 加载帖子详情 */
  async loadDetail() {
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const res = await db.collection('posts').doc(this.postId).get();
      this.setData({ post: res.data, loading: false });
    } catch (err) {
      console.error('[PostDetail] 加载失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '帖子不存在', icon: 'none' });
    }
  },

  /** 加载评论列表 */
  async loadComments() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('comments')
        .where({ postId: this.postId })
        .orderBy('createTime', 'asc')
        .limit(100)
        .get();
      this.setData({ comments: res.data });
    } catch (err) {
      // 集合不存在时静默处理
      console.warn('[PostDetail] 加载评论失败', err);
    }
  },

  /** 预览图片 */
  previewImage(e) {
    const current = e.currentTarget.dataset.src;
    wx.previewImage({
      current,
      urls: this.data.post.images || [],
    });
  },

  /** 点赞 */
  async onLike() {
    if (!this.data.post) return;
    try {
      const db = wx.cloud.database();
      await db.collection('posts').doc(this.postId).update({
        data: { likeCount: db.command.inc(1) },
      });
      this.setData({ 'post.likeCount': (this.data.post.likeCount || 0) + 1 });
    } catch (err) {
      console.warn('[PostDetail] 点赞失败', err);
    }
  },

  /** 评论输入 */
  onCommentInput(e) {
    this.setData({ commentText: e.detail });
  },

  /** 发送评论 */
  async sendComment() {
    if (!this.data.commentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    if (this.data.sending) return;
    this.setData({ sending: true });

    try {
      const db = wx.cloud.database();
      const userInfo = await authService.checkLogin();

      await db.collection('comments').add({
        data: {
          postId: this.postId,
          content: this.data.commentText.trim(),
          authorName: userInfo ? userInfo.nickname : '匿名',
          authorAvatar: userInfo ? userInfo.avatar : '',
          createTime: db.serverDate(),
        },
      });

      // 更新帖子评论数
      try {
        await db.collection('posts').doc(this.postId).update({
          data: { commentCount: db.command.inc(1) },
        });
        this.setData({ 'post.commentCount': (this.data.post.commentCount || 0) + 1 });
      } catch (e) { /* ignore */ }

      this.setData({ commentText: '', sending: false });
      wx.showToast({ title: '评论成功', icon: 'success' });
      this.loadComments();
    } catch (err) {
      console.error('[PostDetail] 评论失败', err);
      this.setData({ sending: false });
      if (err.errCode === -502005) {
        wx.showModal({
          title: '集合不存在',
          content: '请先在云开发控制台创建 comments 集合（权限：仅创建者可读写）',
          showCancel: false,
        });
      } else {
        wx.showToast({ title: '评论失败', icon: 'none' });
      }
    }
  },
});
