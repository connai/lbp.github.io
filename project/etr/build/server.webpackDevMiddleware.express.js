// webpakck-dev-middleware & webpack-hot-middleware
module.exports = (compiler, config) => {
  var child_process = require('child_process')
  var webpackDevMiddleware = require('webpack-dev-middleware')
  var webpackHotMiddleware = require("webpack-hot-middleware")
  var express = require('express')
  var app = express()
  /*此为配合热更新插件作用，利用webpack-dev-server时，须追加到（entry）入口的两个选项
  前者实现热更新消息publish， 后者实现热更新消息的接受处理receive and handle*/
  config.entry.unshift('webpack-hot-middleware/client', 'webpack/hot/dev-server')
  app.use(webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath
  }))
  app.use(webpackHotMiddleware(compiler))
  app.use('*', function (req, res, next) {
    console.log(req.url)
    res.sendFile('/index.html')
  })
  app.listen(config.devServer.port, () => {
    var url = "http://localhost:"+ config.devServer.port +"/"
    console.log("please access to "+ url +" in your browser started by express and webpack-dev-middleware!")
    var cmd = 'start '
    if (process.platform == 'wind32') {
      cmd = 'start ';
    } else if (process.platform == 'linux') {
      cmd = 'xdg-open ';
    } else if (process.platform == 'darwin') {
      cmd = 'open ';
    }
    if(config.devServer.open){
      child_process.exec(cmd + url)
    }
  }) 
}