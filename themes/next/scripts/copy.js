var fs = require('hexo-fs');

hexo.on('generateBefore', function () {
  fs.copyDir('source/_posts/resources/', 'public/resources/')
  fs.copyDir('source/_posts/推荐阅读/resources/', 'public/resources/')
});
