new Vuex.Store({
	modules: {
		a
	},
	state: {
		a
	},
	getters: {},
	mutations: {},
	actions: {}
})

1. 检测局部的Vue是否赋值，在浏览器环境下执行install(window.Vue)

	a.Vue = window.Vue

	b.applyMixin(Vue)

	c.判断Vue的版本号决定何时挂载store到各个组件实例上

	  当为2以上版本时执行Vue.mixin({ beforeCreate: vuexInit })

	  否则修改Vue.prototype.init方法，在初始化钩子函数中执行vueInit

	  const _init = Vue.prototype._init
	  Vue.prototype._init = function (options = {}) {
	    options.init = options.init ? [vuexInit].concat(options.init) : vuexInit
	    _init.call(this, options)
	  }

	d.在每次实例化Vue的时候执行注入store对象到当前的实例上，这样就保证了所有Vue的实例即组件共享里store数据仓库
	  function vuexInit () {
	    const options = this.$options
	    if (options.store) {
	      this.$store = typeof options.store === 'function'
	        ? options.store()
	        : options.store
	    } else if (options.parent && options.parent.$store) {
	      this.$store = options.parent.$store
	    }
	  }


2. 解构和默认赋值操作获取插件plugins和模式strict
	const {
      plugins = [],
      strict = false
    } = options


3. 初始化store实例基本属性
	store._committing = false
    store._actions = Object.create(null)
    store._actionSubscribers = []
    store._mutations = Object.create(null)
    store._wrappedGetters = Object.create(null)
    store._modules = new ModuleCollection(options)
    				
    	a.store._modules.register(path = [], options, false)

    	b.非生产环境检测传入的getters/mutations/actions是否符合规范

    	  getters = {key: value}对象每一项的value类型只能为function

    	  mutations = {key: value}对象每一项的value类型只能为function

    	  actions = {key: fn|{handler:fn}}对象每一项的value类型为function|object，为object时必须提供对应的handler方法

    	c.实例化模块：const newModule = new Module(options, false)

        	a.newModule.runtime = false;
        			  _children = Object.create(null) ~ {}
        			  _rawModule = options
        			  state = options.state

    	d.检测path长度

    	  path.length == 0 则 store._modules.root = newModule 表示本次模块为顶层模块

    	  否则获取newModule的父集模块parent，然后将newModule添加的parent的children中去：

    	  parent = store._modules.get(path.slice(0, -1))

    		 path.reduce((module, key) => {
		       return (module.getChild(key) = module._children[key])
		     }, store._modules.root)

          parent.addChild(path[path.length - 1], newModule)

        e.如果提供了子模块项则递归调用store._modules.register(path.concat(key), options.modules[key], false)

    store._modulesNamespaceMap = Object.create(null)
    store._subscribers = []
    store._watcherVM = new Vue()


4. 缓存一份副本：store = this

  解构操作缓存一份原型上的commit和dispatch方法：const { dispatch, commit } = this

  给每个store实例赋值两个新的dispatch和commit方法，分别调用原型上对应同名方法
  this.dispatch = function(type, payload) {
      return dispatch.call(store, type, payload)
  }
  this.commit = function(type, payload, options) {
      return commit.call(store, type, payload, options)
  }

  设置store的模式为指定模式：store.strict = strict（默认为false）

  缓存一份顶层状态的副本 state = store._modules.root.state = options.state


5. 安装模块：installModule(store, state, path = [], module = store._modules.root)

	isRoot = !path.length = true

	namespace = store._modules.getNamespace(path) = '' || 'moduleName1/moduleName2/moduleName3...'

	if(module.namespaced)store._modulesNamespaceMap[namespace] = store._modules.root

	local = module.context = makeLocalContext(store, namespace = '', path = [])

		{
			dispatch = store.dispatch, 
			commit = store.commit, 
			getters = store.getters = () => store.getters, 
			state = () => getNestedState(store.state, path) = store.state[moduleKey...].state
		}

	store._mutations = {
		[namespace + key] : [
			function(payload) {
				mutation.call(store, local.state, payload)
			},
			...
		],
		...
	}

	store._actions = {
		[namespace + key] : [
			function(payload, cb) {
				let res = (action.handler||action).call(store, {
			      dispatch: local.dispatch,
			      commit: local.commit,
			      getters: local.getters,
			      state: local.state,
			      rootGetters: store.getters,
			      rootState: store.state
			    }, payload, cb)
			    if (!isPromise(res)) {
			      res = Promise.resolve(res)
			    }
			    if (store._devtoolHook) {
			      return res.catch(err => {
			        store._devtoolHook.emit('vuex:error', err)
			        throw err
			      })
			    } else {
			      return res
			    }
			},
			...
		],
		...
	}

	store._wrappedGetters = {
		[namespace + key] : function wrappedGetter (store) {
		    return getter(local.state, local.getters, store.state, store.getters)
		}
	}

	递归module的_children属性，安装子模块
	installModule(store, rootState, path.concat(moduleName), childModule, hot)


6. 初始化store上的Vue实例：resetStoreVM(store, state)
	
	store.getters = {
		getterKey: () => store._vm[getterKey],
		...
	}

	store._vm = new Vue({
	    data: {
	      $$state: state
	    },
	    computed: {
	    	getterKey: () => wrappedGetter(store) 
	    }
	})

	激活严格模式，深层次监听是否在mutation外修改状态并抛错：if (store.strict)enableStrictMode(store)

	如果在旧vue实例存在时并支持热更新，oldVm._data.$$state = null，oldVm.$destroy()



7. 安装插件：plugins.forEach(plugin => plugin(this))


8. 检测是否开启了调试工具
  if (Vue.config.devtools) {
      devtoolPlugin(store)
  }

