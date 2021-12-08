var fs = require('hexo-fs');

/*
const fileArr = fs.readdirSync('source/_posts/推荐阅读')
for (let index in fileArr) {
    if (fileArr[index] === 'resources') return;
    const data = '\n---\n' +
        `title: ${fileArr[index].replace('.md', '')}\n` +
        'date: 2020-04-30 11:23:00\n' +
        'categories: 推荐阅读\n' +
        '---\n';
    fs.appendFile('source/_posts/推荐阅读/' + fileArr[index], data, 'utf8', function (err) {
        if(err){
            console.log('文件打开失败');
        }
    })
}
*/

const fileArr = fs.readdirSync('source/_posts/推荐阅读')
for (let index in fileArr) {
    if (fileArr[index] === 'resources') continue;
    fs.readFile('source/_posts/推荐阅读/' + fileArr[index], function(err, data){
        if (err){
            console.log(err);
        }
        fs.open('source/_posts/推荐阅读/' + fileArr[index], 'w+', function (err, fd) {
            if(err){
                console.log('文件打开失败');
            }else{
                const data2 = '---\n' +
                    `title: ${fileArr[index].replace('.md', '')}\n` +
                    'date: 2020-04-30 11:23:00\n' +
                    'categories: 推荐阅读\n' +
                    '---\n'
                + data;
                var buffer = Buffer.from(data2, 'utf8');
                fs.writeSync(fd,buffer,null)
            }
        })
    });
}
