var r = [
  "http://es6.ruanyifeng.com/docs/intro.md",
  "http://es6.ruanyifeng.com/docs/let.md",
  "http://es6.ruanyifeng.com/docs/destructuring.md",
  "http://es6.ruanyifeng.com/docs/string.md",
  "http://es6.ruanyifeng.com/docs/regex.md",
  "http://es6.ruanyifeng.com/docs/number.md",
  "http://es6.ruanyifeng.com/docs/function.md",
  "http://es6.ruanyifeng.com/docs/array.md",
  "http://es6.ruanyifeng.com/docs/object.md",
  "http://es6.ruanyifeng.com/docs/symbol.md",
  "http://es6.ruanyifeng.com/docs/set-map.md",
  "http://es6.ruanyifeng.com/docs/proxy.md",
  "http://es6.ruanyifeng.com/docs/reflect.md",
  "http://es6.ruanyifeng.com/docs/promise.md",
  "http://es6.ruanyifeng.com/docs/iterator.md",
  "http://es6.ruanyifeng.com/docs/generator.md",
  "http://es6.ruanyifeng.com/docs/generator-async.md",
  "http://es6.ruanyifeng.com/docs/async.md",
  "http://es6.ruanyifeng.com/docs/class.md",
  "http://es6.ruanyifeng.com/docs/class-extends.md",
  "http://es6.ruanyifeng.com/docs/decorator.md",
  "http://es6.ruanyifeng.com/docs/module.md",
  "http://es6.ruanyifeng.com/docs/module-loader.md",
  "http://es6.ruanyifeng.com/docs/style.md",
  "http://es6.ruanyifeng.com/docs/spec.md",
  "http://es6.ruanyifeng.com/docs/arraybuffer.md",
  "http://es6.ruanyifeng.com/docs/proposals.md",
  "http://es6.ruanyifeng.com/docs/reference.md"
]

var http = require('http')
var fs = require('fs')

r.forEach(p => {
  var f = p.substring(p.lastIndexOf('/')+1)
  var file = './docs/' + f
  http.get(p, res => {
    res.setEncoding('utf8')
    var rawData = ''
    res.on('data', c => {rawData += c})
    res.on('end', () => {
      console.log("文件[" + file + "]下载完毕")
      // fs.writeFile(file, rawData, 'utf8', () => console.log("文件[" + file + "]写入完毕"))
      fs.createWriteStream(file, 'utf8').write(rawData, 'utf8', () => console.log("文件[" + file + "]写入完毕"))
    })
  })
})