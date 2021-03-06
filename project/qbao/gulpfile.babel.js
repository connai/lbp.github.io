'use strict';

import gulp                  from 'gulp';
import gulpLoadPlugins       from 'gulp-load-plugins';
import browserSync, {reload} from 'browser-sync';

import config  from './qhb_gulp_default.config';
import setting from './setting.json';
import del     from 'del';
import http    from 'http';
import fs      from 'fs';
import path    from 'path';
import child   from 'child_process';

const $          = gulpLoadPlugins();
const httpServer = http.createServer();
const exec       = child.exec;

var debug        = setting.debug;

//Config file
var merge = (function inner(src, tar) {

  for (let temp in tar) {

    if (tar[temp].constructor === Object) {
      inner(src[temp], tar[temp]);
      continue;
    }
    src[temp] = tar[temp];
  }
  return src;
})(config, setting);

if(debug)console.log("工程全局配置信息 ",merge,'\n');

var domains = merge.domains;
var serve   = merge.serve;
var dirs    = merge.dirs;
var exts    = merge.exts;
var rExts   = new RegExp('\\.(' + exts.join('|').replace(/\./g, '') + ')$');

//Project information.
var proInfo = (function() {
  let svnPath = '.svns';

  return {
    init: function(srcPath, target, command, time) {
      let files = fs.readdirSync(srcPath);

      if (!(files && files.length)) {
        return false;
      }

      this.path    = srcPath + path.sep + merge.base;
      this.dest    = srcPath + path.sep + target;
      this.svns    = srcPath + path.sep + svnPath;
      this.absSvns = path.join(process.cwd(), this.svns);
      this.root    = process.cwd();
      this.stamp   = time;
      this.command = command;

      this.srcPath = srcPath;
      this.target  = target;
      this.svnPath = svnPath;
      this.name    = srcPath.replace(rExts, '');

      return this;
    }
  };
})();

//Release file information.
var release = (function() {
  
  return {
    init: function(key, type) {
      //增加对二级目录匹配
      let name = proInfo.name.substring(proInfo.name.lastIndexOf("/")+1);
      let rName = new RegExp('^.*/' + name + '$');

      let confDir = './' + proInfo.srcPath + '/svnconf.json';
      let existSvnconf = fs.existsSync(confDir);
      if(debug)console.log("校验目录’ "+confDir+" '中svnconf.json文件是否存在：",!!existSvnconf,"\n")
      if (!existSvnconf) {
        return 2;
      }

      let svnconf = require(confDir);
      let isValidCdn = /^\/\/.+\.qbcdn\.com$/.test(svnconf.cdn);
      if(debug)console.log("校验svnconf.json文件中cdn选项是否为qbcdn.com的子域：",isValidCdn,"\n")
      if (!isValidCdn) {
        return 4;
      }

      if (key && type) {
        let rNotes           = /^.+$/;
        let isValidNotes     = false;
        let isValidUrl_Notes = false;
        let isValidName      = false;

        for (let temp in svnconf) {

          if (temp !== 'svns') {
            continue;
          }

          if ('svns' === key) {
            isValidNotes = rNotes.test(svnconf.svns[type].notes);
            if(debug)console.log("校验svnconf.json文件中svns->notes是否设置：",isValidNotes,"\n")
            if (!isValidNotes) {
              return 1;
            }
            isValidUrl_Notes = svnconf.svns[type].repo || svnconf.svns[type].notes;
            if(debug)console.log("校验svnconf.json文件中svns->notes和svns->repo是否都设置：",!!isValidUrl_Notes,"\n")
            if (!isValidUrl_Notes) {
              return 3;
            }

            //增加对二级目录匹配
            isValidName = rName.test(svnconf.svns[type].repo);
            if(debug)console.log("校验svnconf.json中构建的"+svnconf.svns[type].repo+"与"+name+"是否匹配：",isValidName,"\n")
            if (!isValidName) {
              return 5;
            }
          }
        }

        this.user = merge.svns[type].user;
        this.pass = merge.svns[type].pass;

        this.repo  = svnconf.svns[type].repo;
        this.notes = svnconf.svns[type].notes;
      }

      this.cdn = domains.sld = svnconf.cdn;
      //匹配二级目录
      domains.cdn = this.cdn + '/' + proInfo.name;//.substring(proInfo.name.lastIndexOf("/")+1);
      //domains.rootCDN = this.cdn;

      if (proInfo.command === '--local') {
        domains.cdn = this.cdn + ':' + serve.port + '/' + proInfo.name;
      }

      if (proInfo.command === '--t' || proInfo.command === '--temp') {
        domains.cdn = '';
      }

      this.dir = svnconf.cdn.match(/^\/\/(.+)\.qbcdn\.com$/)[1];
      this.webpack = svnconf.webpack;
      svnconf = null;
      if(debug){
        console.log("构建发布信息：",this,'\n');
        console.log("domains：",domains,"\n");
      }

      return this;
    }
  };
})();

//Common tool object.
var util = {

  isFtp: function(ftp) {
    if (ftp && ftp.host &&
      ftp.user && ftp.pass) {

      return true;
    } else {
      return false;
    }
  },

  isSvn: function(svn) {
    if (svn && svn.user && svn.pass) {

      return true;
    } else {
      return false;
    }
  },

  isLocal: function(local) {
    if (local) {

      return true;
    } else {
      return false;
    }
  },

  //Clean dir content
  clean: function(dir) {
    let name = 'clean:' + proInfo.stamp;

    gulp.task(name, () => {
      return del([dir]);
    });

    return [name];
  },

  //Replace static resources URL.
  urlRepl: function(task) {

    for (let temp in domains) {
      task = task.pipe($.replace('{{domains.' + temp + '}}', domains[temp]));
    }
    return task;
  },

  //Replace resource library and annotation version number
  htmlVersion: function(task, baseDir) {
    task = util.urlRepl(task);

    for (let temp in domains) {

      task = task.pipe($.if('!' + domains[temp] + '*.*', $.revMtime({
          'cwd': baseDir,
          'suffix': 'v',
          'fileTypes': ['css', 'js']
        })))
        .pipe($.replace(/<img((?!\/\/).)*[^<]/g, ($1) => {
          if (!$1.match(/\?v=/g)) {
            return $1.replace(/\.(png|jpg|jpeg|gif)[^\"\'>]*/g, ($1) => {
              var index = $1.indexOf("&");
              var ext = index > -1 ? $1.substring(0,index) : $1;
              var subfix =  index > -1 ? $1.substring(index) : '';
              return ext + '?v=' + proInfo.stamp +'   '+subfix;
            });
          } else {

            return $1.replace(/\?v=\d+[^\?"'>]/g, () => {
              return '?v=' + proInfo.stamp;
            });
          }
        }));
    }

    return task;
  },

  //Copy all files in a specific directory.
  fileCopyMove: function() {

    let task = null;

    for (let temp in dirs) {
      let tempDir = proInfo.path + path.sep + dirs[temp];

      if (dirs[temp] === dirs.css ||
        dirs[temp] === dirs.js ||
        dirs[temp] === dirs.inc ||
        dirs[temp] === dirs.inf) {
        continue;
      }

      if (dirs[temp] === dirs.md) {

        console.log('concat to: ' + proInfo.dest + path.sep + dirs[temp]);

        task = gulp.src([
            tempDir + '/md_*/**/md_*.png',
            tempDir + '/md_*/**/md_*.jpg',
            tempDir + '/md_*/**/md_*.gif',
            tempDir + '/md_*/**/md_*.jpeg'
          ])
          .pipe($.rename({
            dirname: path.sep + dirs.img
          }))
          .pipe(gulp.dest(proInfo.dest));
      } else {

        console.log('concat to: ' + proInfo.dest + path.sep + dirs[temp]);
        task = gulp.src(tempDir + '/**')
          .pipe(gulp.dest(proInfo.dest + path.sep + dirs[temp]));
      }
    }
    return task;
  },

  //Replace the static resource library reference URL
  domainsRepl: function(rely, bol) {
    let cssName = 'cssRepl:' + proInfo.stamp;
    let jsName = 'jsRepl:' + proInfo.stamp;
    let mdName = 'mdRepl:' + proInfo.stamp;

    let relyTaskArr = rely();
    //css文件内引用图片地址打标签
    gulp.task(cssName, relyTaskArr, () => {

      return util.urlRepl(gulp.src(proInfo.dest + path.sep + dirs.css + '/**/*.css'))
        .pipe($.replace(/url *\( *["']? *((?!http[s]?:\/\/).)+[\)]/g, ($1) => {

          if (!$1.match(/\?v=/g)) {
            return $1.replace(/(\.png|\.jpg|\.jpeg|\.gif|\.bmp)[^\"\'\)]*/g, ($1) => {
              return $1 + '?v=' + proInfo.stamp;
            });
          } else {
            return $1.replace(/\?v=\d+[^\?"'\)]/g, () => {
              return '?v=' + proInfo.stamp;
            });
          }
        }))
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.css));
    });

    gulp.task(jsName, [cssName], () => {

      return util.urlRepl(gulp.src(proInfo.dest + path.sep + dirs.js + '/**/*.js'))
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.js));
    });

    //Whether the MD directory operation.
    if (bol && bol !== false) {

      gulp.task(mdName, [jsName], () => {

        return util.urlRepl(gulp.src([
            proInfo.dest + path.sep + dirs.md + '/md_*/md_*.css',
            proInfo.dest + path.sep + dirs.md + '/md_*/md_*.js',
            proInfo.dest + path.sep + dirs.md + '/md_*/md_*.html'
          ]))
          .pipe(gulp.dest(proInfo.dest + path.sep + dirs.md));
      });

      return [mdName];
    }

    return [jsName];
  },

  cdnRepl: function(task) {
    var cdnUrl = '';
    var sldUrl = '';
    if (merge.isCdnRule) {
      cdnUrl = domains.cdn;
      sldUrl = domains.sld;
    } else {
      cdnUrl = '';
    }

    for (let temp in merge.cdnRule) {
      task.pipe($.replace(new RegExp(merge.cdnRule[temp][0], 'g'), merge.cdnRule[temp][1]))
        //.pipe($.replace('{{domains.cdn}}', cdnUrl))
        .pipe($.replace(/\{\{domains\.cdn\}\}/g, cdnUrl))
        .pipe($.replace(/\{\{domains\.sld\}\}/, sldUrl));
    }

    task.pipe($.replace(/\.(css|js|jsx)\?(v=\d+)/g, ($1, $2) => {

      return '.' + $2 + '?v=' + proInfo.stamp;
    }));

    return task;
  },

  //FTP upload files.
  ftpUpLoad: function(ftp, taskName, bol) {
    let name = 'sftp:' + proInfo.stamp;
    let delName = 'sftpDel:' + proInfo.stamp;
    
    gulp.task(name, taskName, () => {
      return gulp.src(proInfo.dest + '/**')
        .pipe($.sftp({
          host: ftp.host,
          user: ftp.user === 'ftpuser' ? 'root' : ftp.user,
          pass: ftp.pass === 'ftpuser' ? 'Qianwang2016' : ftp.pass,
          port: ftp.port === '21' ? '22' : ftp.pass,
          remotePath: (ftp.base === '/' ? '/Data/CDN' : ftp.base) +
            path.sep + release.dir + path.sep + proInfo.name
        }));
    });

    gulp.task(delName, [name], () => {
      let files = fs.readdirSync(proInfo.dest);

      let dirAry = [];
      let fileAry = [];

      if (!(files && files.length)) {
        return null;
      }

      for (let temp in files) {

        let fileName = proInfo.dest + path.sep + files[temp];

        //Directories and files are separated.
        if (fs.lstatSync(fileName).isDirectory()) {

          dirAry.push(files[temp]);
        } else {
          fileAry.push(files[temp]);
        }
      }
      console.log('The preview address is: ');
      console.log('Server address is: ' + ftp.host);
      console.log('==========================================');

      for (let temp in fileAry) {
        console.log(release.cdn + '/' + proInfo.name + '/' + fileAry[temp]);
        console.log('');
      }
      
      return bol ? gulp.src(proInfo.dest + '/**') : del([proInfo.dest]);
    });

    return [delName];
  }
};

//webpack
var webpackConfig = (function() {

  return {

    //Webpack config file.
    init: function(type) {
      let jsDir = proInfo.path + '/js';
      let files = fs.readdirSync('./' + jsDir);
      let fileAry = [];
      let fileName = '';
      let entry = {};
      let externals = {};
      let provide = {};
      let alias = {};
      let plugins = [
        new $.webpack.webpack.NoErrorsPlugin(),
        new $.webpack.webpack.ProvidePlugin(provide)
      ];

      let tempExternals = {
        jQuery: 'jQuery',
        React: 'React',
        Redux: 'Redux',
        Reflux: 'Reflux',
        angular: 'angular',
        Vue: 'Vue'
      };
      let module = {
        preLoaders: [],

        loaders: [{
          test: /.css$/,
          loader: 'style!css'
        }, {
          test: /.less$/,
          loader: 'style!css!less'
        }, {
          test: /\.(png|jpg|jpeg|gif)$/,
          loader: 'file-loader?limit=1&name=/' + dirs.img + '/[name].[ext]?v=' + new Date().getTime()
        }, {
          test: /(woff|svg|eot|ttf)\??.*$/,
          loader: 'file-loader?limit=1&name=/' + dirs.fonts + '/[name].[ext]?v=' + new Date().getTime()
        }]
      };
      let tempRel = release.init();
      let cdn = '';
      let cdnUrl = '';

      if (type === 'build') {
        plugins.push(new $.webpack.webpack.optimize.UglifyJsPlugin({
          mangle: {
            except: ['$super', '$', 'exports', 'require']
          },

          compress: {
            warnings: false
          }
        }));
      }

      if (2 === tempRel) {

        return 1;
      }

      if (merge.isCdnRule && 4 !== tempRel) {
        cdn = release.cdn;
        cdnUrl = cdn + '/' + proInfo.name;

        if (proInfo.command === '--local') {
          cdnUrl = cdn + ':' + serve.port + '/' + proInfo.name;
        }

        if (proInfo.command === '--t' ||
          proInfo.command === '--temp') {
          cdnUrl = '';
        }
      } else {
        cdnUrl = '';
      }

      if (!(release.webpack && release.webpack.switch)) {

        return 2;
      }

      for (let temp in files) {
        fileName = process.cwd() + path.sep + jsDir + path.sep + files[temp];

        if (!fs.lstatSync(fileName).isDirectory()) {
          fileAry.push(files[temp].replace(/\.js?$/, ''));

          entry[files[temp].replace(/\.(js|jsx|vue)$/, '') + '.min'] = './' + jsDir + path.sep + files[temp];
        }
      }

      if (release.webpack.externals) {

        let extAry = release.webpack.externals;

        for (let temp in extAry) {
          let extItem = tempExternals[extAry[temp].target];

          if (extAry[temp].role === 'global') {

            provide[extAry[temp].target] = extItem;

            if (extAry[temp].target === 'jQuery') {
              provide['$'] = extItem;
            }
          }

          externals[extAry[temp].target] = extItem;

          if (extAry[temp].target === 'jQuery') {
            externals['$'] = extItem;
          }

          if (extAry[temp].target === 'React') {

            module.preLoaders.push({
              test: /\.(js|jsx)$/,
              exclude: /node_modules/,
              loader: 'jsxhint'
            });

            module.loaders.push({
              test: /\.(js|jsx)$/,
              loader: 'react-hot!babel'
            });
          } else if (extAry[temp].target === 'Vue') {
            module.loaders.push({
              test: /\.(js|vue)$/,
              loader: 'vue!babel'
            });

            module.vue = {
              loaders: {
                js: 'babel'
              }
            };
          } else {
            module.loaders.push({
              test: /\.js$/,
              loader: 'babel'
            });
          }
        }
      }

      if (release.webpack.reverse) {

        let revAry = release.webpack.reverse;

        entry[proInfo.stamp] = [];

        for (let temp in revAry) {

          alias[revAry[temp].target] = revAry[temp].path;

          if (revAry[temp].role === 'global') {
            provide[revAry[temp].target] = revAry[temp].target;

            if (revAry[temp].target === 'jquery') {
              provide['$'] = revAry[temp].target;
            }
          }

          if (new RegExp('\/' + dirs.plugins + '\/*').test(revAry[temp].path)) {

            externals[revAry[temp].target] = true;
          } else if (new RegExp('\/' + dirs.md + '\/').test(revAry[temp].path)) {

            if (revAry[temp].mode === 'common') {

              entry[proInfo.stamp].push(revAry[temp].target);
            }

          } else {
            return 3;
          }
        }

        if (!entry[proInfo.stamp].length) {
          delete entry[proInfo.stamp];
        }
      }

      if (entry[proInfo.stamp]) {
        plugins.push(
          new $.webpack.webpack.optimize.CommonsChunkPlugin(
            '"' + proInfo.stamp + '"', proInfo.name + '.common.min.js', Infinity)
        );
      }

      return {
        // watch: true,
        entry: entry,
        output: {
          path: '/',
          publicPath: cdnUrl,
          filename: '/' + dirs.js + '/' + '[name].js'
        },

        externals: externals,
        module: module,
        resolve: {
          extensions: ['', '.js', '.jsx'],
          alias: alias
        },

        plugins: plugins
      };
    }
  };
})();

var tempEnter = (function() {

  //File include for inc
  function htmlFileInc() {
    let name = 'include:' + proInfo.stamp;

    gulp.task(name, () => {
      let isPublicDir =  proInfo.name == "publicFront" ? true : false;
      let sldUrl = domains.sld;
      return gulp.src(proInfo.path + '/*.html')
        .pipe($.fileInclude({
          'prefix': '@@',
          'basepath': proInfo.root
        }))
        .pipe($.replace(/((?:\bsrc\b|\bhref\b)=")([^{}\?"]+)\?([^v=]+)(")/g, (s,s1,s2,s3,s4) => {
            if(isPublicDir){
              return s1+s2+s4
            }else{
              return s1+s3+s2+s4
            }
        }))
        .pipe($.if('*.html', $.rename({
          extname: merge.make
        })))
        .pipe(gulp.dest(proInfo.dest));
    });

    return [name];
  }

  //Copy the file in the project directory
  function dirsCopyMove() {
    let name = 'move:' + proInfo.stamp;
    let delIncName = 'delInc:' + proInfo.stamp;
    let htmlFileIncTaskArr = htmlFileInc();

    gulp.task(name, htmlFileIncTaskArr, () => {

      if (merge.make.toLowerCase() === '.html') {

        return gulp.src(proInfo.path + path.sep + '/**')
          .pipe($.changed(proInfo.dest))
          .pipe(gulp.dest(proInfo.dest));
      } else {
        
        return gulp.src(proInfo.path + path.sep + '/**')
          .pipe($.changed(proInfo.dest))
          .pipe(gulp.dest(proInfo.dest))
      }
    });

    //To delete unneccessary file or directory.
    gulp.task(delIncName, [name], () => {
      return del([proInfo.dest + path.sep + dirs.inc,proInfo.dest + path.sep +'*.html']);
    });

    return [delIncName];
  }

  function webpackCore(config) {
    let name = 'wp:' + proInfo.stamp;
    let jsDelName = 'jsDel:' + proInfo.stamp;

    gulp.task(jsDelName, dirsCopyMove(), () => {
      return del([proInfo.dest + path.sep + dirs.js]);
    });

    gulp.task(name, dirsCopyMove(), () => {

      return gulp.src(proInfo.path + '/js/**')
        .pipe($.webpack(config))
        .pipe(gulp.dest(proInfo.dest));
    });

    return [name];
  }

  function version() {
    let name   = 'ver:' + proInfo.stamp;
    let config = webpackConfig.init('temp');

    if (1 === config || 2 === config) {
      let dirsCopyMoveTaskArr = dirsCopyMove();
      gulp.task(name, dirsCopyMoveTaskArr, () => {
        return util.cdnRepl(
            util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest)
            .pipe($.replace(/\.(css|js|jsx)\?(v=\d+)/g, ($1, $2) => {
              return '.' + $2 + '?v=' + proInfo.stamp;
            }))
          )
          .pipe(gulp.dest(proInfo.dest));
      });
    } else {

      if (3 === config) {
        console.log('The directory of the plug-in or module does not correspond to the pattern.');
        return false;
      }
      gulp.task(name, webpackCore(config), () => {
        return util.cdnRepl(
            util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest)
            .pipe($.replace(/\.(css|js|jsx)\?(v=\d+)/g, ($1, $2) => {
              return '.' + $2 + '?v=' + proInfo.stamp;
            }))
          )
          .pipe(gulp.dest(proInfo.dest));
      });
    }

    return [name];
  }

  return {

    //Construction of 'temp' temporary preview and debug project.
    task: function() {
      let name = 'server:' + proInfo.stamp;
      let domainsReplTaskArr = util.domainsRepl(version, true);
      gulp.task(name, domainsReplTaskArr, () => {

        httpServer.listen(serve.port)
          .on('listening', function() {
            let bsync = browserSync.create();

            if (this) {
              this.close();
            }

            bsync.init({
              notify: false,
              open: false,
              port: serve.port,
              server: {
                baseDir: [proInfo.dest, './'],
                directory: true
              },
              reloadOnRestart: false
            });

            if (serve.reload) {
              gulp.watch([
                  proInfo.path + '/**/*.*'
                ], util.domainsRepl(version, true))
                .on('change', () => {

                  bsync.reload;
                  util.domainsRepl(version, true);
                });
            } else {
              gulp.watch([
                  proInfo.path + '/**/*.*'
                ], util.domainsRepl(version, true))
                .on('change', () => {

                  util.domainsRepl(version, true);
                });
            }
          })
          .on('error', function() {

            try {
              //TODO
            } catch (err) {
              console.log(err);
            }
          });
      });
      return [name];
    },

    online: function() {
      let name = 'server:' + proInfo.stamp;

      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }

      gulp.task(name, util.ftpUpLoad(merge.sftp.devel, develEnter.task(), true), () => {

        httpServer.listen(serve.port)
          .on('listening', function() {
            let bsync = browserSync.create();

            if (this) {
              this.close();
            }

            bsync.init({
              notify: false,
              open: false,
              port: serve.port,
              server: {
                baseDir: [proInfo.dest, './'],
                directory: true
              },
              reloadOnRestart: false
            });

            if (serve.reload) {
              gulp.watch([
                  proInfo.path + '/**/*.*'
                ], util.ftpUpLoad(merge.sftp.devel, develEnter.task(), true))
                .on('change', () => {

                  bsync.reload;
                  util.ftpUpLoad(merge.sftp.devel, develEnter.task(), true);
                });
            } else {
              gulp.watch([
                  proInfo.path + '/**/*.*'
                ], util.ftpUpLoad(merge.sftp.devel, develEnter.task(), true))
                .on('change', () => {

                  util.ftpUpLoad(merge.sftp.devel, develEnter.task(), true);
                });
            }
          })
          .on('error', function() {

            try {
              //TODO
            } catch (err) {
              console.log(err);
            }
          });
      });

      return [name];
    },

    local: function() {
      let name = 'server:' + proInfo.stamp;

      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }

      gulp.task(name, develEnter.task(), () => {

        httpServer.listen(serve.port)
          .on('listening', function() {
            let bsync = browserSync.create();

            if (this) {
              this.close();
            }

            bsync.init({
              notify: false,
              open: false,
              port: serve.port,
              server: {
                baseDir: [proInfo.srcPath, './'],
                directory: true
              },
              reloadOnRestart: false
            });

            if (serve.reload) {
              gulp.watch([proInfo.path + '/**/*.*'], develEnter.task())
              .on('change', () => {
                  bsync.reload;
                  develEnter.task();
              });
            } else {
              gulp.watch([
                  proInfo.path + '/**/*.*'
                ], develEnter.task())
                .on('change', () => {

                  develEnter.task();
                });
            }
          })
          .on('error', function() {

            try {
              //TODO
            } catch (err) {
              console.log(err);
            }
          });
      });

      return [name];
    }
  };
})();

//Construction of 'devel' temporary preview and debug project
var develEnter = (function() {

  //Include file and combined with CSS and JS.
  function fileIncUse() {
    let name = 'useref:' + proInfo.stamp;
    let cleanTaskArr = util.clean(proInfo.dest);
    gulp.task(name, cleanTaskArr, () => {
      let isPublicDir =  proInfo.name == "publicFront" ? true : false;

      return gulp.src(proInfo.path + '/*.html')
        .pipe($.fileInclude({
          'prefix': '@@',
          'basepath': proInfo.root
        }))
        .pipe($.replace(/((?:\bsrc\b|\bhref\b)=")([^{}\/:\?"]+)\?((?!\btargetpage\b)[^\s]+)(")/g, (s,s1,s2,s3,s4) => {
            
            if(isPublicDir){
              return s1+s2+s4
            }else{
              return s1+s3+s2+s4
            }
        }))
        .pipe($.if('*.html', $.rename({
          extname: merge.make
        })))
        //解析build注释
        .pipe($.useref())
        .pipe(gulp.dest(proInfo.dest));
    });

    return [name];
  }

  //Copy the file in the project directory
  function dirsCopyMove() {
    let cssName,jsName;
    let fontsName = 'moveFonts:' + proInfo.stamp;
    let imgName = 'moveImg:' + proInfo.stamp;
    let plugName = 'movePlug:' + proInfo.stamp;
    let mdName = 'moveMd:' + proInfo.stamp;
    let tname = 'temp:' + proInfo.stamp;
    let base = proInfo.path + path.sep;
    let isPublicDir =  proInfo.name == "publicFront" ? true : false;

    let fileIncUseTask = fileIncUse();
    
    gulp.task(fontsName, fileIncUseTask, () => {
      return gulp.src(base + dirs.fonts + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.fonts));;
    });

    gulp.task(imgName, [fontsName], () => {
      return gulp.src(base + dirs.img + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.img));;
    });

    if(isPublicDir){
      //公共资源默认移动src下的css、js目录下的所有文件到制定目录
      cssName = 'moveCss:' + proInfo.stamp;
      gulp.task(cssName, [imgName], () => {
        return gulp.src(base + dirs.css + '/**')
          .pipe(gulp.dest(proInfo.dest + path.sep + dirs.css));;
      });
      jsName = 'moveJs:' + proInfo.stamp;
      gulp.task(jsName, [cssName], () => {
        return gulp.src(base + dirs.js + '/**')
          .pipe(gulp.dest(proInfo.dest + path.sep + dirs.js));;
      }); 
      imgName = jsName;
    }

    gulp.task(plugName, [imgName], () => {
      return gulp.src(base + dirs.plugins + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.plugins));;
    });

    

    gulp.task(mdName, [plugName], () => {
      return gulp.src([
          base + dirs.md + '/md_*/**/md_*.png',
          base + dirs.md + '/md_*/**/md_*.jpg',
          base + dirs.md + '/md_*/**/md_*.gif',
          base + dirs.md + '/md_*/**/md_*.jpeg'
        ])
        .pipe($.rename({
          dirname: path.sep + dirs.img
        }))
        .pipe(gulp.dest(proInfo.dest));
    });

    //To obtain target resource file.
    gulp.task(tname, [mdName], () => {
      return gulp.src(proInfo.dest + '/**');
    });

    return [tname];
  }

  //The public interface of the DEVEL object.
  return {

    //TODO 
    //Start the construction of DEVEL services and directory.
    task: function() {
      
      let name = 'devel:' + proInfo.stamp;
      let wpName = 'webpack:' + proInfo.stamp;
      let config = webpackConfig.init();

      if (1 === config || 2 === config) {
        let domainsReplTaskArr = util.domainsRepl(dirsCopyMove);

        gulp.task(name, domainsReplTaskArr, () => {
          var task = util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest);

          return util.cdnRepl(task)
            .pipe(gulp.dest(proInfo.dest));
        });

      } else {

        if (3 === config) {
          console.log('The directory of the plug-in or module does not correspond to the pattern.');
          return false;
        }
        //webpack打包方式
        gulp.task(wpName, util.domainsRepl(dirsCopyMove), () => {

          return gulp.src(proInfo.path + '/js/**')
            .pipe($.webpack(config))
            .pipe(gulp.dest(proInfo.dest));
        });

        gulp.task(name, [wpName], () => {
          var task = util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest);

          return util.cdnRepl(task)
            .pipe(gulp.dest(proInfo.dest));
        });
      }

      return [name];
    }
  };
})();

//Construction of 'build' temporary preview and debug project
var buildEnter = (function() {

  //Include file and combined with CSS and JS.
  function fileIncUse() {
    let name = 'userefAndMin:' + proInfo.stamp;

    gulp.task(name, util.clean(proInfo.dest), () => {

      return gulp.src(proInfo.path + '/*.html')
        .pipe($.fileInclude({
          'prefix': '@@',
          'basepath': proInfo.path
        }))
        .pipe($.if('*.html', $.rename({
          extname: merge.make
        })))
        .pipe($.useref())
        .pipe($.if('*.js', $.uglify()))
        .pipe($.if('*.css', $.minifyCss()))
        .pipe(gulp.dest(proInfo.dest));
    });

    return [name];
  }

  //Copy the file in the project directory
  function dirsCopyMove() {
    let fontsName = 'moveFonts:' + proInfo.stamp;
    let imgName = 'moveImg:' + proInfo.stamp;
    let plugName = 'movePlug:' + proInfo.stamp;
    let mdName = 'moveMd:' + proInfo.stamp;
    let tname = 'temp:' + proInfo.stamp;
    let base = proInfo.path + path.sep;

    gulp.task(fontsName, fileIncUse(), () => {
      return gulp.src(base + dirs.fonts + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.fonts));;
    });

    gulp.task(imgName, [fontsName], () => {
      return gulp.src(base + dirs.img + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.img));;
    });

    gulp.task(plugName, [imgName], () => {
      return gulp.src(base + dirs.plugins + '/**')
        .pipe(gulp.dest(proInfo.dest + path.sep + dirs.plugins));;
    });

    gulp.task(mdName, [plugName], () => {
      return gulp.src([
          base + dirs.md + '/md_*/**/md_*.png',
          base + dirs.md + '/md_*/**/md_*.jpg',
          base + dirs.md + '/md_*/**/md_*.gif',
          base + dirs.md + '/md_*/**/md_*.jpeg'
        ])
        .pipe($.rename({
          dirname: path.sep + dirs.img
        }))
        .pipe(gulp.dest(proInfo.dest));
    });

    //To obtain target resource file.
    gulp.task(tname, [mdName], () => {
      return gulp.src(proInfo.dest + '/**');
    });

    return [tname];
  }

  //The public interface of the BUILD object.
  return {

    //TODO 
    //Start the construction of BUILD services and directory.
    task: function() {
      let name = 'devel:' + proInfo.stamp;
      let wpName = 'webpack:' + proInfo.stamp;
      let config = webpackConfig.init('build');

      if (1 === config || 2 === config) {

        gulp.task(name, util.domainsRepl(dirsCopyMove), () => {
          var task = util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest);

          return util.cdnRepl(task)
            .pipe(gulp.dest(proInfo.dest));
        });

      } else {

        if (3 === config) {
          console.log('The directory of the plug-in or module does not correspond to the pattern.');
          return false;
        }

        gulp.task(wpName, util.domainsRepl(dirsCopyMove), () => {

          return gulp.src(proInfo.path + '/js/**')
            .pipe($.webpack(config))
            .pipe(gulp.dest(proInfo.dest));
        });

        gulp.task(name, [wpName], () => {
          var task = util.htmlVersion(gulp.src(proInfo.dest + '/*' + merge.make), proInfo.dest);

          return util.cdnRepl(task)
            .pipe(gulp.dest(proInfo.dest));
        });
      }

      return [name];
    }
  };
})();

//SVN publish fn.
var svnEnter = (function() {

  function checkout(rely) {
    let name = 'checkout:' + proInfo.stamp;
    let dname = 'del:' + proInfo.stamp;

    gulp.task(dname, rely, () => {
      return del([proInfo.svns]);
    });

    gulp.task(name, [dname], () => {
      var cmd = 'svn checkout ' + release.repo + ' ' + proInfo.svns +
        ' --username ' + release.user + ' --password ' + release.pass;

      console.log('Is publishing, please be patient…………');
      return exec(cmd, () => {
          try {
            svnDel();
          } catch (err) {
            console.log('Checkout fail');
          }
        })
        .on('exit', () => {
          console.log('Checkout SVN library synchronization is completed, Being added……');
        });
    });

    return [name];
  }

  //Delete svn lib file.
  function svnDel() {
    let files = fs.readdirSync(proInfo.svns);
    let count = 0;

    if (files && files.length) {

      for (let i = 0; i < files.length; i++) {

        if ('.svn' === files[i]) {
          files.splice(i, 1);
        }
      }

      if (!files.length) {
        moveFile();
        return false;
      }

      (function inner(file) {
        let cmd = 'svn delete ' + file;

        if (count >= files.length) {
          return false;
        }
        exec(cmd, {
            cwd: proInfo.absSvns
          }, () => {
            try {
              //TODO
            } catch (err) {
              console.log(err);
            }
          })
          .on('exit', () => {
            let tempFiles = fs.readdirSync(proInfo.svns);

            count++;
            inner(files[count]);
            if (tempFiles.length === 1 && tempFiles[0] === '.svn') {
              moveFile();
            }
          });
      })(files[count]);
    }
  }

  function moveFile() {
    let cmd = '';

    if (proInfo.command === '--dc') {
      cmd = 'gulp --dcm ' + proInfo.srcPath;
    } else if (proInfo.command === '--bc') {
      cmd = 'gulp --bcm ' + proInfo.srcPath;
    }
    exec(cmd, () => {
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }
      })
      .on('exit', () => {
        console.log('Update file synchronization is completed. Is submitting……');
        addSvn();
      });
  }

  //Add svn file.
  function addSvn() {
    let cmd = 'svn add * --force';

    exec(cmd, {
        cwd: proInfo.absSvns
      }, () => {
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }
      })
      .on('exit', () => {
        console.log('Commit File synchronization is completed. Being released……');
        commitSvn();
      });
  }

  //Commit svn
  function commitSvn() {
    let notes = release.notes || proInfo.stamp + proInfo.target;
    let cmd = 'svn commit -m "' + notes + '"';

    exec(cmd, {
        cwd: proInfo.absSvns
      }, () => {
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }
      })
      .on('exit', () => {
        del([proInfo.svns]);
        del([proInfo.dest]);
        console.log('Release edition complete: ' + release.notes);
        console.log('Synchronous development environment: ' + merge.sftp.devel.host);
        develFtp();
      });
  }

  function develFtp() {
    let cmd = 'gulp --df ' + proInfo.srcPath;
    
    exec(cmd, {
        cwd: proInfo.path
      }, (ex,stdout,stderr) => {
        if(ex.code!=0){
          del([proInfo.dest]);
          console.log(ex);
        }
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }

      })
      .on('exit', () => {
        console.log('Synchronous development finish.');
        console.log('Synchronous testing environment: ' + merge.sftp.build.host);
        buildFtp();
      });
  }

  function buildFtp() {
    let cmd = 'gulp --bf ' + proInfo.srcPath;

    exec(cmd, {
        cwd: proInfo.path
      }, () => {
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }
      })
      .on('exit', () => {
        console.log('Synchronous testing finish.');
      });
  }

  return {
    devel: function() {
      let relStateNum = release.init('svns', 'devel');

      if (1 === relStateNum) {
        console.log('The submitted version has no comment.');
        return false;
      }

      if (2 === relStateNum) {
        console.log('Need svnconf.json configuration file.');
        return false;
      }

      if (3 === relStateNum) {
        console.log('SVN information configuration rules are not correct.');
        return false;
      }

      if (4 === relStateNum) {
        console.log('You must configure the CDN domain name property value in svnconf.json.');
        return false;
      }

      if (5 === relStateNum) {
        console.log('Svn module name and project name is different.');
        return false;
      }

      return checkout(develEnter.task());
    },

    build: function() {
      let relStateNum = release.init('svns', 'build');

      if (1 === relStateNum) {
        console.log('The submitted version has no comment.');
        return false;
      }

      if (2 === relStateNum) {
        console.log('Need svnconf.json configuration file');
        return false;
      }

      if (3 === relStateNum) {
        console.log('SVN information configuration rules are not correct.');
        return false;
      }

      if (4 === relStateNum) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }

      if (5 === relStateNum) {
        console.log('Svn module name and project name is different.');
        return false;
      }

      return checkout(buildEnter.task());
    }
  };
})();

//FTP bulid task
var ftpEnter = (function() {
  return {
    devel: function() {
      
      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }
      var develEnterTask = develEnter.task()
      return util.ftpUpLoad(merge.sftp.devel, develEnterTask);
    },

    build: function() {
      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }
      var buildEnterTask = buildEnter.task();
      return util.ftpUpLoad(merge.sftp.build, buildEnterTask);
    }
  };
})();

//Local build task.
var localEnter = (function() {

  function localPack(dir, rely) {
    let name = 'local:' + proInfo.stamp;
    let delName = 'del:' + proInfo.stamp;

    gulp.task(name, rely, () => {

      return gulp.src(proInfo.dest + '/**')
        .pipe(gulp.dest(dir + path.sep + proInfo.name));
    });

    gulp.task(delName, [name], () => {
      return del([proInfo.dest]);
    });

    return [delName];
  }

  return {
    devel: function() {
      if (!util.isLocal(merge.local.devel)) {

        console.log('Development of local url is not configured.');
        return false;
      }

      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }

      return localPack(
        merge.local.devel,
        develEnter.task()
      );
    },

    build: function() {
      if (!util.isLocal(merge.local.build)) {

        console.log('None Publish local url not configured.');
        return false;
      }

      if (release.init() === 4) {
        console.log('You must configure the CDN domain name property value from svnconf.json.');
        return false;
      }

      return localPack(
        merge.local.build,
        buildEnter.task()
      );
    }
  };
})();

//Child prossce.
function moveSvnFile() {
  let name = 'moveSvn:' + proInfo.stamp;

  gulp.task(name, () => {
    return gulp.src(proInfo.dest + '/**')
      .pipe(gulp.dest(proInfo.svns));
  });

  if (fs.existsSync(proInfo.svns)) {
    return [name];
  } else {
    return null;
  }
}

//Full release
function fullRelease(type) {
  let files = fs.readdirSync('./');
  let dirAry = [];
  let count = 0;
  let rxg = new RegExp(config.ignores
    .join('|')
    .replace(' ', '')
  );

  if (merge.all && merge.all.length) {
    dirAry = merge.all;
  } else {

    for (let temp in files) {
      let fileName = process.cwd() + path.sep + files[temp];

      if (fs.lstatSync(fileName).isDirectory()) {

        if (!rxg.test(files[temp])) {
          dirAry.push(files[temp]);
        }
      }
    }
  }

  if (!dirAry.length) {
    return 0;
  }

  (function inner(dir) {
    let cmd = 'gulp ' + type + ' ' + dir;

    if (count >= dirAry.length) {
      console.log('Complete release, can do other.');
      return false;
    }

    exec(cmd, () => {
        try {
          //TODO
        } catch (err) {
          console.log(err);
        }
      })
      .on('exit', () => {
        console.log('Start publishing: ' + dir);
        count++;
        inner(dirAry[count]);
      });
  })(dirAry[count]);
}

//Project directory under construction parameters.
function main(command) {

  switch (command || proInfo.command) {

    //Development preview command
    case '--t' || '--temp':
      return tempEnter.task();

    case '--online':
      return tempEnter.online();

    case '--local':
      return tempEnter.local();

      //The default package for non compressed version of the SVN command
    case '--dc':
      return svnEnter.devel();

      //The default package compressed version to upload FTP commands
    case '--bc':
      return svnEnter.build();

      //The default package for non compressed version of the FTP command
    case '--df':
      return ftpEnter.devel();

      //The default package compressed version to upload SVN commands
    case '--bf':
      return ftpEnter.build();

      //Default non compressed version of the specified directory package
    case '--dl':
      return localEnter.devel();

      //The default compressed version of the specified directory package
    case '--bl':
      return localEnter.build();
    default:
      return;
  }
}

//Default task.
gulp.task('default', (() => {
  //获取命令行参数
  let args    = process.argv;
  
  if(debug)console.log("全部参数：",args,'\n');

  //获取打包命令的参数(gulp [--dc xxx])
  let params   = args.splice(2);
  let paramCmd = params[0]; 
  if(debug)console.log("使用参数：",params,'\n');

  //增加二级目录匹配，支持带数字的目录匹配
  let dirRxp  = new RegExp('^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\\.(' + exts.join('|').replace(/\./g, '') + ')$');
  //let dirRxp  = new RegExp('^[a-zA-Z]+\.(' + exts.join('|').replace(/\./g, '') + ')$');

  //打包时间戳
  let time    = new Date().getTime();
  if(debug)console.log("gulp时间戳：",time,'\n');

  //打包项目名
  let srcPath = params[1] || merge.default || '';
  
  let target, defName;

  if (!paramCmd || paramCmd === '--t' || paramCmd === '--temp') {

    paramCmd = '--t';
    target = '.temp';
  } else if (paramCmd === '--online') {

    target = '.temp';
  } else if (paramCmd === '--local') {

    target = srcPath.replace(new RegExp('\\.(' + exts.join('|').replace(/\./g, '') + ')$'), '');
    //target = srcPath.replace(new RegExp('\.(' + exts.join('|').replace(/\./g, '') + ')$'), '');
  } else if (paramCmd === '--dc' || paramCmd === '--dcm') {

    if (!merge.isCdnRule) {
      console.log('Can only play to build the local environment to perform  --bl  or --dl');
      return false;
    }

    if (!util.isSvn(merge.svns.devel)) {
      console.log('Development of SVN server is not configured.');
      return false;
    }

    target = '.dev';
  } else if (paramCmd === '--bc' || paramCmd === '--bcm') {

    if (!merge.isCdnRule) {
      console.log('Can only play to build the local environment to perform  --bl  or --dl');
      return false;
    }

    if (!util.isSvn(merge.svns.build)) {
      console.log('None Publish SVN server not configured.');
      return false;
    }

    target = '.min';
  } else if (paramCmd === '--df') {

    if (!merge.isCdnRule) {
      console.log('Can only play to build the local environment to perform  --bl  or --dl');
      return false;
    }

    if (!util.isFtp(merge.sftp.devel)) {
      console.log('Development of FTP server is not configured.');
      return false;
    }

    target = '.dev';
  } else if (paramCmd === '--bf') {

    if (!merge.isCdnRule) {

      console.log('Can only play to build the local environment to perform  --bl  or --dl');
      return false;
    }

    if (!util.isFtp(merge.sftp.build)) {

      console.log('None Publish FTP server not configured.');
      return false;
    }
    target = '.min';
  } else if (paramCmd === '--dl') {

    if (merge.isCdnRule) {
      console.log('Can only execute --bc --df --bf --dc');
      return false;
    }

    target = '.dev';
  } else if (paramCmd === '--bl') {

    if (merge.isCdnRule) {
      console.log('Can only execute --bc --df --bf --dc');
      return false;
    }
    target = '.min';
  } else {
    console.log('No build type specified');
    return false;
  }

  if (params[1] === 'all') {

    if (!paramCmd || paramCmd === '--t' || paramCmd === '--temp') {

      console.log('Preview can not be fully released.');
      return false;
    } else {

      if (fullRelease(paramCmd) === 0) {
        console.log('No project release.');
      } else {
        console.log('Start the whole engineering, Please wait a moment……');
      }
    }
  } else {

    if(debug)console.log("校验目录’ "+srcPath+" ‘是否为空：",!srcPath,'\n')
    if (!srcPath) {
      console.log('Did not specify the package project directory.');
      return false;
    }

    let existDir = fs.existsSync('./' + srcPath);
    if(debug)console.log("校验目录’ "+srcPath+" ‘是否存在：",existDir,'\n')
    if (!existDir) {
      console.log('Project directory does not exist.');
      return false;
    }

    let isValidDir = dirRxp.test(srcPath);
    if(debug)console.log("校验目录’ "+srcPath+" ‘是否符合（数字 或 字母 或 - 或 _ ）规则：",isValidDir,'\n')
    if (!isValidDir) {
      console.log('Project directory naming is not standardized');
      return false;
    }

    let proInfoInited = proInfo.init(srcPath, target, paramCmd, time);
    if(debug)console.log("初始化工程构建信息：",proInfoInited,'\n')
    if (!proInfoInited) {
      console.log('Project initialization failed.');
      return false;
    }

    if (paramCmd === '--dcm' || paramCmd === '--bcm') {

      if (defName = moveSvnFile()) {
        return defName;
      } else {
        console.log('The project has not been build can not be released.');
        return false;
      }
    }

    if(debug)console.log("开始指令 gulp "+paramCmd+" 的构建...","\n")
    return main(paramCmd);
  }
})());