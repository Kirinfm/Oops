var fs = require('hexo-fs');

hexo.on('generateBefore', function () {
  fs.copyDir('source/_posts/resources/', 'public/resources/')
});
