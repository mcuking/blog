> 文章首发于我的博客 https://github.com/mcuking/blog/issues/110

## 背景

距离发布如何私有化部署 CodeSandbox 沙箱的文章[《搭建一个属于自己的在线 IDE》](https://github.com/mcuking/blog/issues/86) 已经过了一年多时间，期间笔者也对沙箱进行改造和优化，主要有以下两个方面：

- **开发特定平台的个性化需求**

  例如支持低代码平台对沙箱构建好的页面进行跨 iframe 的原生事件监听，以便进一步实现组件推拽等功能

- **提升沙箱构建速度**

  例如一个包含 `antd` 依赖的简单中后台应用构建速度从接近 2 分钟优化到 1 秒左右

本文主要介绍沙箱构建速度相关内容，希望能够帮助到遇到同样问题的朋友。在正式开始之前，先简要描述下沙箱构建的过程，以便后续内容的展开。

## 沙箱构建过程

**CodeSandbox 本质上就是在浏览器中运行的简化版 Webpack，构建过程分为三个阶段：依赖预加载阶段、编译阶段、执行阶段。**

### 依赖预加载阶段（Npm Preload）

#### 需要依赖预加载阶段的原因

由于在浏览器环境中很难安装前端应用的 `node_modules` 资源，所以编译阶段需要从服务端获取依赖的 npm 包的模块资源，通过 npm 包的入口文件字段（`package#main` 等）和 meta 信息计算 npm 包中指定模块在 CDN 上的路径，然后请求获取模块内容。举个例子：

如果前端应用的某视图模块 `demo.js` 引用了 `react` 依赖，如下图：

```js
import React from 'react';
const Demo = () => (<div>Demo</div>);
export default Demo;
```

在编译完 `demo.js` 模块后会继续编译该模块的依赖 `react`，首先会从 CDN 上获取 `react` 的 `package.json` 模块内容和 `react` 的 meta 信息：

https://unpkg.com/react@17.0.2/package.json

https://unpkg.com/react@17.0.2/?meta

然后计算得到 `react` 包入口文件的具体路径（整个过程也就是 file resolve 的过程），从 CDN 上请求该模块内容：

https://unpkg.com/react@17.0.2/index.js

接着继续编译该模块及其依赖，如此递归编译直到将应用中所有被引用到的依赖模块编译完成。

可见浏览器端实现的沙箱在整个编译应用过程中需要不断从 CDN 上获取 npm 包的模块内容，产生非常多的 HTTP 请求。再加上浏览器对同一域名下的并发 HTTP 请求数量有限制（仅针对 HTTP/1.x 版本的 HTTP 请求，其中Chrome 浏览器限制数量为 6 个），最终导致整个编译过程非常耗时。

#### 依赖预加载阶段的操作

为了解决这个问题，于是便有了**依赖预加载阶段 -- 即在开始编译应用之前，沙箱先从 npm 打包服务中请求应用依赖的 npm，而打包服务会将 npm 包的有用模块打包成一个 json 模块返回，该模块也被称为 Manifest。** 例如下面就是 react 包的 Manifest 模块的链接和截图：

https://prod-packager-packages.codesandbox.io/v2/packages/react/17.0.2.json

<img src="https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13388866719/4546/50e9/506b/559ff560a3edb5f7025560418da0d502.png" width="600"/>

这样获取每个 npm 包的内容只需要发送一个 HTTP 请求就可以了。

在依赖预加载阶段，沙箱会请求应用中所有依赖包的 Manifest，然后合并成一个大的 Manifest。目的是为了在接下来的编译阶段，沙箱只需要从 Manifest 中查找 npm 包的某个具体模块即可。当然作为 fallback，如果在 Manifest 中找不到，还是会从 CDN 上获取以确保编译过程顺利进行。

#### Packager 服务的原理

其中 npm 打包服务，也称为 Packager 服务的基本原理如下：

**先通过 yarn 将指定 npm 包安装到磁盘上，然后解析 npm 包入口文件的 AST 中的 require 语句，接着递归解析被 require 模块，最终将所有被引用的模块打包到 Manifest 模块中输出（目的是为了剔除 npm 包中多余模块，例如文档等）**。

总结来说**依赖预加载阶段就是为了避免在编译阶段产生大量请求导致编译时间过长**。和 Vite 的依赖预构建的部分目标是相同的 -- [依赖预构建](https://cn.vitejs.dev/guide/dep-pre-bundling.html#the-why)。

### 编译阶段（Transpilation） 

简单来说**编译阶段就是从应用的入口文件开始, 对源代码进行编译, 解析 AST，找出下级依赖模块，然后递归编译，最终形成一个依赖关系图。其中模块之间互相引用遵循的是 CommonJS 规范。**

> 注：关于模拟 CommonJS 的内容可以参考下面关于 Webpack 的文章，由于篇幅问题这里就不展开了：[webpack系列 —— 模块化原理-CommonJS](https://codeantenna.com/a/sm1r6b59AJ)

<img src="https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13389097802/ba88/1444/48ab/01fae62a0cdd8e9a77c5c68e0d3821bd.png" width="600"/>

### 执行阶段（Evaluation）

和编译阶段一样，也是**从入口文件开始，使用 eval 执行入口文件，如果执行过程中调用了 require，则递归 eval 被依赖的模块。**

到此沙箱的构建过程就阐述完了，更多详细内容可参考以下文章：

- [CodeSandbox 如何工作? 上篇](https://bobi.ink/2019/06/20/codesandbox/)

- [从 0 到 1 实现浏览器端沙盒运行环境](https://mp.weixin.qq.com/s/7CD_F0hEZtYRK0fvBWb_gQ)

## 提升沙箱构建速度

接下来就进入到本文的主题：如何提升沙箱的构建速度。整个过程会以文章开头提到的包含 `antd` 依赖的简单中后台应用的构建为例，阐述如何逐步将构建速度从 2 分钟优化到 1s 左右。主要有以下四个方面：

- **缓存 Packager 服务打包结果**

- **减少编译阶段单个 npm 包模块请求数量**

- **开启 Service-Worker + CacheStorage 缓存**

- **实现类 Webpack Externals 功能**

### 缓存 Packager 服务打包结果

通过对应用构建过程的分析，首先发现是在依赖预加载阶段从 Packager 服务请求 `antd` 包的 Manifest 耗时 1 分钟左右，有时甚至会有请求超时的情况。根据前面对 Packager 服务原理的阐述，可以知道耗时的原因主要是 `antd` 包（包括其依赖）体积较大，无论是下载 `antd` 包还是从 `antd` 包入口文件递归打包所有引用的模块都会非常耗时。

对此可以将 Packager 服务的打包结果缓存起来，沙箱再次请求时则直接从缓存中读取并返回，无需再走下载+打包的过程。其中缓存的具体方式读者可根据自身情况来决定。至于首次打包过慢问题，可以针对常用的 npm 包提前请求 Packager 服务来触发打包，以保证在构建应用过程中可以快速获取到 npm 包的 Manifest。

在缓存了 Packager 服务打包结果之后，应用的构建时间就从近 2 分钟优化到了 70s 左右。

### 减少编译阶段单个 npm 包模块请求数量

继续分析沙箱在编译阶段的网络请求时，会发现会有大量的 `antd` 包和 `@babel/runtime` 包相关的模块请求，如下图所示：

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13126402203/7d79/45aa/2a18/b0f77c569c2d4615d70b9fd453c4cf4f.png" width="600" />

根据上面沙箱原理部分的讲解可以知道，依赖预加载阶段就是为了避免在编译阶段产生大量 npm 单模块请求而设计的，那为什么还会有这么多的请求呢？原因总结来说有两个：

- **Packager 服务和沙箱构建时指定了不同的入口文件**

- **npm 包本身没有入口文件或入口文件不能关联所有编译时会用到的模块**

#### Packager 服务和沙箱构建时指定了不同的入口文件

以 `antd` 包的为例，该包本身的依赖大部分为内部组件 `rc-xxx`，其 `package.json` 同时包含两个字段 `main` 和 `module`，以 `rc-slider` 为例，下面是该包的 `package.json` 有关入口文件定义部分（注意其中入口文件名没有后缀）：

```json
{
  "main": "./lib/index",
  "module": "./es/index",
  "name": "rc-slider",
  "version": "10.0.0-alpha.4"
}
```

我们已经知道了 Packager 服务是从 npm 包的入口文件开始，递归将所有被引用的模块打包成 Manifest 返回的。其中 `module` 字段优先级高于 `main` 字段，所以 Packager 服务会以 `./es/index.js` 作为入口文件开始打包。但在完成 Manifest 打包后和正式返回给沙箱前，还会校验 `package.json` 中 `module` 字段定义的入口文件是否在 npm 包中真实存在，如果不存在则会将 `module` 字段从 `package.json` 中删除。

不幸的是检验入口文件是否真实存在的逻辑中没有考虑到文件名没有后缀的情况，所以在返回的 Manifest 中 `rc-slider` 的 `package.json` 的 `module` 字段被删除了。

接下来是浏览器侧的沙箱开始编译应用，编译到 `rc-slider` 依赖时，由于 `rc-slider` 的 `package.json` 的 `module` 字段被删除，所以是按照 `main` 字段指定的 `./lib/index.js` 模块作为入口文件开始编译，但是 Manifest 中只有 `es` 目录下的模块，所以只能在编译过程中从 CDN 动态请求 `lib` 下的模块，由此产生了大量 HTTP 请求阻塞编译。

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13129381222/e38d/833d/f66c/94ec5d312a65607be0d4d151d49dc882.png" width="600">

有关 Packager 服务没有兼容入口文件名无后缀的问题，笔者已经向 CodeSandbox 官方提交 PR 修复了，[点击查看](https://github.com/codesandbox/dependency-packager/pull/38)。

接下来再看下 `ramda` 包的 `package.json` 中有关入口文件部分：

```json
{
  "exports": {
    ".": {
      "require": "./src/index.js",
      "import": "./es/index.js",
      "default": "./src/index.js"
    },
    "./es/": "./es/",
    "./src/": "./src/",
    "./dist/": "./dist/"
  },
  "main": "./src/index.js",
  "module": "./es/index.js",
  "name": "ramda",
  "version": "0.28.0"
}
```

Packager 服务是 `module` 字段指定的 `./es/index.js` 作为入口开始打包的，但编译阶段中沙箱却最终选择 `export` 中 `.` 的 `default` 指定的 `./src/index.js` 作为入口开始编译，进而也产生了大量的单个模块的请求。

**问题的本质就是【Packager 服务打包 npm 包时】和【沙箱构建应用时】确定 npm 包入口文件的策略并不完全一致**，想要根治该问题就要对其两侧的确定入口文件的策略。其中沙箱侧确定入口文件的逻辑在 `packages/sandpack-core/src/resolver/utils/pkg-json.ts` 中，Packager 服务侧相关逻辑在 `functions/packager/packages/find-package-infos.ts` / `functions/packager/packages/resolve-required-files.ts` / `functions/packager/utils/resolver.ts` 中，读者可自己决定具体对齐方式。

#### npm 包本身没有入口文件或入口文件不能关联所有编译时会用到的模块

首先分析下 `@babel/runtime` 包，通过该包的 `package.json` 可以发现其并没有定义入口文件，一般使用该包都是直接引用包中的具体模块，例如 `var _classCallCheck = require("@babel/runtime/helpers/classCallCheck");`，所以按照 Packager 服务的打包原理是无法将该包中的**编译时会用到的模块**打包到 Manifest 中的，最终导致编译阶段产生大量单个模块的请求。

对此笔者也只是采用特殊情况特殊处理的方式：在打包没有定义入口文件或入口文件不能关联所有编译时会用到的模块的 npm 包时，手动将指定目录下或指定模块打包到 Manifest 中。例如对于 `@babel/runtime` 包来说，就是在打包过程中将其根目录下的所有文件都手动的打包到 Manifest 中。目前还没有更好的解法，如果读者有更好的解法欢迎留言。

当然如果是内部的 npm 包，也可以在 `package.json` 中增加类似 `sandpackEntries` 的自定义字段，即指定多个入口文件，便于 Packager 服务将编译阶段用到的模块尽可能都打包到 Manifest 中。例如针对低代码平台的组件可能会分为正常模式和设计模式，其中设计模式是为了在低代码平台更方便的拖动组件和配置组件参数等，会在 index.js 之外再定义 designer.js 作为设计模式下组件入口文件，这种情况就可以指定多个入口文件（多个入口概念仅针对 Packager 服务）。相关改造是在 `functions/packager/packages/resolve-required-files.ts` 中的 `resolveRequiredFiles` 函数，如下图所示：

<img src="https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13402508017/07af/9721/9b29/ede40ce68f0c4790962bc29fede7359f.png" width="500">

通过减少编译阶段单个 npm 包模块请求数量，应用的构建时间从 70s 左右降到了 35s 左右。

### 开启 Service-Worker + CacheStorage 缓存

笔者在分析大量 npm 包单个模块请求问题时，也在 CodeSandbox 官方站点的沙箱中构建完全相同的应用，并没有遇到这个问题，后来才发现官网只是将已经请求过的资源缓存起来。也就是说在第一次使用 CodeSandbox 或在浏览器隐身模式下构建应用，还是会遇到大量 HTTP 请求问题。

那么官网是如何缓存的呢？首先通过 Service-Worker 拦截应用构建过程中的请求，如果发现是需要被缓存的资源，则先从 CacheStorage 中查找是否已缓存过，没有则继续请求远端服务，并将请求返回的内容缓存一份到 CacheStorage 中；如果查找到对应缓存，则直接从 CacheStorage 读取并返回，从而减少请求时间。

如下图所示，CodeSandbox 缓存内容主要包括：

1. 沙箱页面的静态资源模块

2. 从 Packager 服务请求的 npm 包的 Manifest 

3. 从 CDN 请求的 npm 包单个模块内容

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13395055869/19d6/a503/2598/2e30656534e446e7bcca5c114e3e3da3.png" width="600" />

不过 CodeSandbox 在对外提供的沙箱版本中将缓存功能关闭了，我们需要开启该功能，相关代码在 `packages/app/src/sandbox/index.ts` 中，如下图所示：

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13395408070/618b/9fc5/c09a/7ee95d09d1c2ee933aa1b0bf1951f762.png" width="400" />

另外该缓存功能是通过 `SWPrecacheWebpackPlugin` 插件实现的 -- 在打包 CodeSandbox 沙箱代码时，启用 `SWPrecacheWebpackPlugin` 插件并向其传入具体的缓存策略配置，然后会在构建物中自动生成 `service-worker.js` 脚本，最后在沙箱运行时注册执行该脚本即可开启缓存功能。这里我们需要做的是将其中缓存策略的地址修改成我们私有化部署的地址，具体模块在 `packages/app/config/webpack.prod.js` 中：

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13395370394/436f/69b0/9770/0ef124d447e109cea6642cd5726bda33.png" width="500" />

> 注：SWPrecacheWebpackPlugin 插件主要是作用避免手动编写 Service Worker 脚本，开发者只需要提供具体的缓存策略即可，更多细节可点击下面链接：https://www.npmjs.com/package/sw-precache-webpack-plugin

开启浏览器侧的缓存之后，应用的构建时间基本稳定到了 12s 左右。

### 实现类 Webpack Externals 功能

以上三个方面的优化基本都是在网络请求方面 -- 或增加缓存或减少请求数量。那么编译和执行代码本身是否可以进一步优化呢？接下来就一起来分析下。

笔者在使用浏览器调试工具调试沙箱的编译过程时发现一个问题：即使应用中仅仅使用了 `antd` 包的部分组件，例如：

```js
import React from 'react';
import { Button } from 'antd';
const Btn = () => (<Button>Click Me</Button>);
export default Btn;
```

但仍会编译 `antd` 包内所有组件关联的模块，最终导致编译时间过长。经过排查发现主要原因是 `antd` 的入口文件中引用了全部组件。下面是 es 模式下的入口文件 `antd/es/index.js` 的部分代码：

```js
export { default as Affix } from './affix';
export { default as Anchor } from './anchor';
export { default as AutoComplete } from './auto-complete';
...
```

根据上面编译阶段和执行阶段的讲解我们可以知道，沙箱会从 `antd` 入口文件开始对所有被引用的模块进行递归编译和执行。

因为沙箱也使用 babel 编译 js 文件，所以笔者最开始想到的是在编译 js 文件时集成 `babel-plugin-import` 插件，该插件的作用就是实现组件的按需引入，[点击查看插件更多细节](https://www.npmjs.com/package/babel-plugin-import)。下面的代码编译效果会更直观一些：

```js
import { Button } from 'antd';
      ↓ ↓ ↓ ↓ ↓ ↓
var _button = require('antd/lib/button');
```

集成该插件后发现沙箱构建速度的确有所提升，但随着应用使用的组件增多，构建速度会越慢。那么是否有更好的方式来减少甚至不需编要译模块呢？有，实现类 Webpack Externals 功能，下面是整个功能的原理：

**1. 在编译阶段跳过 `antd` 包的编译，以减少编译时间。**

**2. 在执行阶段开始之前先通过 script 标签全局加载和执行 `antd` 的 umd 形式的构建物，如此以来 `antd` 包中导出的内容就被挂载到 window 对象上了。接下来在执行编译后的代码时，如果发现需要引用的`antd` 包中的组件，则从 window 对象获取返回即可。由于不再需要执行 `antd` 包所有组件关联的模块，所以执行阶段的时间也会减少。**

>注：这里涉及到 Webpack Externals 和 umd 模块规范的概念，由于篇幅问题就不在这里细说了，有兴趣可通过下面链接了解：
>- [外部扩展(Externals)](https://webpack.docschina.org/configuration/externals/)
>- [UMD：AMD 和 CommonJS 的糅合](https://www.cnblogs.com/snandy/archive/2012/03/19/2406596.html)

思路有了，接下来就开始对 CodeSandbox 源码进行改造：

**首先是编译阶段的改造，当编译完某个模块时，会添加该模块的依赖然后继续编译。在添加依赖时，判断如果依赖是被 external 的 npm 包则直接退出，以阻断进一步对该依赖的编译。**

具体代码在 `packages/sandpack-core/src/transpiled-module/transpiled-module.ts`，改动如下图所示：

<img src="https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13397619213/4563/6f5d/596b/caeb1d7e2836d9c9c774c1fe38568509.png" width="500" />

**然后是执行阶段的改造，因为 CodeSandbox 最终是将所有模块编译成 CommonJS 模块然后模拟 CommonJS 的环境来执行（上面的沙箱构建过程部分有提到）。所以只需要在模拟的 require 函数中判断如果是被 external 的 npm 包引用模块，直接从 window 对象获取返回即可。**

具体代码在 `packages/sandpack-core/src/transpiled-module/transpiled-module.ts`，改动如下图所示：

<img src="https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/13397805723/a322/5a77/0685/0212cb02a47c8631af551a0f24fdad2f.png" width="500" />

另外在沙箱开始执行编译后的代码之前，需要动态创建 script 标签来加载和执行 `antd` 包 umd 形式的构建物，幸运的是 CodeSandbox 已经提供了动态加载外部 js/css 资源的能力，不需要额外开发。只需要将需要加载的 js/css 链接通过 externalResources 参数传给沙箱即可。

最后就需要在 `sandbox.config.json` 文件中配置相关参数即可，如下图所示：

```json
{
  "externals": {
    "react": "React",
    "react-dom": "ReactDOM",
    "antd": "antd"
  },
  "externalResources": [
    "https://unpkg.com/react@17.0.2/umd/react.development.js",
    "https://unpkg.com/react-dom@17.0.2/umd/react-dom.development.js",
    "https://unpkg.com/antd@4.18.3/dist/antd.min.js",
    "https://unpkg.fn.netease.com/antd@4.18.3/dist/antd.css"
  ]
}
```

> 注：`sandbox.config.json` 文件中的内容会在沙箱构建获取到，该文件是放在被构建应用的根目录下。[点击查看 configuration 详情](https://codesandbox.io/docs/configuration)。

最终经过上面四个方面的优化，仅需 1s 左右即可完成对整个应用的构建，笔者将沙箱构建过程进行了录屏，可以点击下方链接查看：

https://www.bilibili.com/video/BV1nR4y1V7Lc

## 结束语

那么沙箱的构建性能优化方案是否就已经接近完美了呢？

答案当然是否定的，读者可以试想下，随着构建应用的规模变大，需要编译和执行的模块也会增多，CodeSandbox 沙箱这种**通过应用的入口文件递归编译所有引用模块，然后再从应用入口文件递归执行所有引用模块**的模式，必然还会导致整个构建时间不可避免地增加。

那么是否有更好的方式呢？最近很流行的 Vite 提供了一种思路：**在应用代码执行过程中，通过 ES Module 方式引用了其他模块，浏览器会发起一个请求获取该模块，服务器拦截请求匹配到对应模块后对其进行编译并返回。这种不需要对应用模块进行提前全量编译，按需动态编译的方式会极大缩应用构建时间，应用越复杂构建速度的优势越明显。**

笔者正在尝试改造 Vite 使其能够运行在浏览器中，后面会总结到沙箱系列第四篇文章里 -- [《搭建一个浏览器版 Vite 沙箱》](https://github.com/mcuking/blog/issues/111)

敬请期待！

## 参考资料

- [搭建一个属于自己的在线 IDE](https://github.com/mcuking/blog/issues/86)

- [CodeSandbox 如何工作? 上篇](https://bobi.ink/2019/06/20/codesandbox/)

- [从 0 到 1 实现浏览器端沙盒运行环境](https://mp.weixin.qq.com/s/7CD_F0hEZtYRK0fvBWb_gQ)
