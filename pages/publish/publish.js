// pages/publish/publish.js
Page({
  toCreatePost() {
    wx.navigateTo({ url: '/pages/post/post' });
  },

  toAdopt() {
    wx.navigateTo({ url: '/pages/adopt/adopt' });
  },

  toFoster() {
    wx.navigateTo({ url: '/pages/foster/foster' });
  },

  toForum() {
    wx.navigateTo({ url: '/pages/forum/forum' });
  },

  toPetArchive() {
    wx.navigateTo({ url: '/pages/pet/pet' });
  },

  toMyPosts() {
    wx.navigateTo({ url: '/pages/forum/forum?tab=mine' });
  },
});
