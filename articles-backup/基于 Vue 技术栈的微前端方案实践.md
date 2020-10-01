> 文章首发于我的博客 https://github.com/mcuking/blog/issues/81

项目地址：

[preload-routes](https://github.com/micro-frontends-vue/preload-routes)

[async-routes](https://github.com/micro-frontends-vue/async-routes)

## 背景

对于大型前端项目，比如公司内部管理系统（一般包括 OA、HR、CRM、会议预约等系统），如果将所有业务放在一个前端项目里，随着业务功能不断增加，就会导致如下这些问题：

- 代码规模庞大，导致编译时间过长，开发、打包速度越来越慢

- 项目文件越来越多，导致查找相关文件变得越来越困难

- 某一个业务的小改动，导致整个项目的打包和部署

## 技术方案

preload-routes 和 async-routes 是目前笔者所在团队使用的微前端方案，最终会将整个前端项目拆解成一个主项目和多个子项目，其中两者作用如下：

- 主项目：用于管理子项目的路由切换、注册子项目的路由和全局 Store 层、提供全局库和方法

- 子项目：用于开发子业务线业务代码，一个子项目对应一个子业务线，并且包含两端（PC + Mobile）代码和复用层代码（项目分层中的非视图层）

结合之前的分层架构实现复用非视图代码的方式，完整的方案如下：

<img src="https://i.loli.net/2020/02/29/Jyf3wAdbVkm5NGc.png" width=600>

如图所示，将整个前端项目按照业务线拆分出多个子项目，每个子项目都是独立的仓库，只包含了单个业务线的代码，可以进行独立开发和部署，降低了项目维护的复杂度。

采用这套方案，使得我们的前端项目不仅保有了横向上（多个子项目）的扩展性，又拥有了纵向上（单个子项目）的复用性。那么这套方案具体是怎么实现的呢？下面就详细说明方案的实现机制。

在讲解之前，首先明确下这套方案有两种实现方式，一种是预加载路由，另一种是懒加载路由，接下来就分别介绍这两种方式的实现机制。

### 预加载路由

[preload-routes](https://github.com/micro-frontends-vue/preload-routes)

1. 子项目 **按照 vue-cli 3 的 library 模式进行打包**，以便后续主项目引用

注：在 library 模式中，Vue 是外置的。这意味着包中不会有 Vue，即便你在代码中导入了 Vue。如果这个库会通过一个打包器使用，它将尝试通过打包器以依赖的方式加载 Vue；否则就会回退到一个全局的 Vue 变量。

2. 在编译主项目的时候，**通过 InsertScriptPlugin 插件将子项目的入口文件 main.js 以 script 标签形式插入到主项目的 html 中**

注：务必将子项目的入口文件 main.js 对应的 script 标签放在主项目入口文件 app.js 的 script 标签之上，这是为了确保子项目的入口文件先于主项目的入口文件代码执行，接下来的步骤就会明白为什么这么做。

再注：本地开发环境下项目的入口文件编译后的 main.js 是保存在内存中的，所以磁盘上看不见，但是可以访问。

InsertScriptPlugin 核心代码如下：

```js
compiler.hooks.compilation.tap('InsertScriptWebpackPlugin', (compilation) => {
  compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tap(
    'InsertScriptWebpackPlugin',
    (htmlPluginData) => {
      const {
        assets: {js}
      } = htmlPluginData;
      // 将传入的 js 以 script 标签形式插入到 html 中
      // 注意：需要将子项目的入口文件 main.js 放在主项目入口文件 app.js 之前，因为需要子项目提前将自己的 route list 注册到全局上
      js.unshift(...self.files);
    }
  );
});
```

3. 主项目的 html 要访问子项目里的编译后的 js / css 等资源，需要进行 **代理转发**

- 如果是本地开发时，可以通过 webpack 提供的 proxy，例如：

```js
const PROXY = {
  '/app-a/': {
    target: 'http://localhost:10241/'
  }
};
```

- 如果是线上部署时，可以通过 nginx 转发或者将打包后的主项目和子项目放在一个文件夹中按照相对路径引用。

4. 当浏览器解析 html 时，解析并执行到子项目的入口文件 main.js，**将子项目的 route list 注册到 Vue.\_\_share\_\_.routes 上**，以便后续主项目将其合并到总的路由中。

子项目 main.js 代码如下：（为了尽量减少首次主项目页面渲染时加载的资源，子项目的入口文件建议只做路由挂载）

```js
import Vue from 'vue';
import routes from './routes';

const share = (Vue.__share__ = Vue.__share__ || {});
const routesPool = (share.routes = share.routes || {});

// 将子项目的 route list 挂载到 Vue.__share__.routes 上，以便后续主项目将其合并到总的路由中
routesPool[process.env.VUE_APP_NAME] = routes;
```

5. 继续向下解析 html，解析并执行到主项目 main.js 时，**从 Vue.\_\_share\_\_.routes 获取所有子项目的 route list，合并到总的路由表中**，然后初始化一个 vue-router 实例，并传入到 new Vue 内

相关关键代码如下

```js
// 从 Vue.__share__.routes 获取所有子项目的 route list，合并到总的路由表中
const routes = Vue.__share__.routes;

export default new Router({
  routes: Object.values(routes).reduce((acc, prev) => acc.concat(prev), [
    {
      path: '/',
      redirect: '/app-a'
    }
  ])
});
```

到此就实现了单页面应用按照业务拆分成多个子项目，直白来说子项目的入口文件 main.js 就是将主项目和子项目联系起来的桥梁。

另外如果需要使用 vuex，则和 vue-router 的顺序恰好相反（先主项目后子项目）：

1. 首先在主项目的入口文件中初始化一个 store 实例 new Vuex.Store，然后挂在到 Vue.\_\_share\_\_.store 上

2. 然后在子项目的 App.vue 中获取到 Vue.\_\_share\_\_.store 并调用 store.registerModule(‘app-x', store)，将子项目的 store 作为子模块注册到 store 上

### 懒加载路由

[async-routes](https://github.com/micro-frontends-vue/async-routes)

懒加载路由，顾名思义，就是说等到用户点击要进入子项目模块，通过解析即将跳转的路由确定是哪一个子项目，然后再异步去加载该子项目的入口文件 main.js（可以通过 [systemjs](https://github.com/systemjs/systemjs) 或者自己写一个动态创建 script 标签并插入 body 的方法）。加载成功后就可以将子项目的路由动态添加到主项目总的路由里了。

1. 主项目 router.js 文件中定义了 **在 vue-router 的 beforeEach 钩子去拦截路由，并根据即将跳转的路由分析出需要哪个子项目，然后去异步加载对应子项目入口文件**，下面是核心代码：

```js
const cachedModules = new Set();

router.beforeEach(async (to, from, next) => {
  const [, module] = to.path.split('/');

  if (Reflect.has(modules, module)) {
    // 如果已经加载过对应子项目，则无需重复加载，直接跳转即可
    if (!cachedModules.has(module)) {
      const {default: application} = await window.System.import(modules[module])

      if (application && application.routes) {
        // 动态添加子项目的 route-list
        router.addRoutes(application.routes);
      }

      cachedModules.add(module);
      next(to.path);
    } else {
      next();
    }
    return;
  }
});
```

2. 子项目的入口文件 main.js 仅需要 **将子项目的 routes 暴露给主项目** 即可，代码如下：

```js
import routes from './routes';

export default {
  name: 'javascript',
  routes,
  beforeEach(from, to, next) {
    console.log('javascript:', from.path, to.path);
    next();
  },
}
```

注意：这里除了暴露 routes 方法外，另外又暴露了 beforeEach 方法，其实就是为了支持通过路由守卫对子项目进行页面权限限制，主项目拿到这个子项目的 beforeEach，可以在 vue-router 的 beforeEach 钩子执行，具体代码请参考 async-routes。

除了主项目和子项目的交互方式不同，代理转发子项目资源、vuex store 注册等和上面的预加载路由完全一致。

### 优缺点

下面谈下这套方案的优缺点：

**优点**

- 子项目可单独打包、单独部署上线，提升了开发和打包的速度

- 子项目之间开发互相独立，互不影响，可在不同仓库进行维护，减少的单个项目的规模

- 保持单页应用的体验，子项目之间切换不刷新

- 改造成本低，对现有项目侵入度较低，业务线迁移成本也较低

- 保证整体项目统一一个技术栈

**缺点**：

- 主项目和子项目需要共用一个 Vue 实例，所以无法做到某个子项目单独使用最新版 Vue（例如 Vue3）或者 React

## 部分问题解答

#### 1. 如果子项目代码更新后，除了打包部署子项目之外，还需要打包部署主项目吗？

不需要更新部署主项目。这里有个 trick 上文忘记提及，就是子项目打包后的入口文件并没有加上 chunkhash，直接就是 main.js（子项目其他的 js 都有 chunkhash）。也就是说主项目只需要记住子项目的名字，就可以通过 subapp-name/main.js 找到子项目的入口文件，所以子项目打包部署后，主项目并不需要更新任何东西。

#### 2. 针对第二个问题中子项目入口文件 main.js 不使用 chunkhash 的话，如何防止该文件始终被缓存呢？

可以在静态资源服务器端针对子项目入口文件设置强制缓存为不缓存，下面是服务器为 nginx 情况的相关配置：

```bash
location / {
    set $expires_time 7d;
    ...
    if ($request_uri ~* \/(contract|meeting|crm)-app\/main.js(\?.*)?$) {
        # 针对入口文件设置 expires_time -1，即 expire 是服务器时间的 -1s，始终过期
        set $expires_time -1;
    }
    expires $expires_time;
    ...
}
```

## 结束语

如果没有在一个大型前端项目中使用多个技术栈的需求，还是很推荐笔者目前团队实践的这个方案的。另外如果是 React 技术栈，也是可以按照这种思想去实现类似的方案的。
