## 背景

在上一篇文章 [《云音乐低代码：基于 CodeSandbox 的沙箱性能优化》](https://github.com/mcuking/blog/issues/110) 中有提到过 CodeSandbox 方案在构建规模较大的前端应用比较耗时的问题，并在文章结尾提到会尝试采用 bundless 构建模式来解决这个问题。而本文就是来介绍笔者在这块的实践成果 —— 对 Vite 进行改造使其可以运行在浏览器中，并结合其他技术实现一套基于浏览器的 bundless 在线实时构建沙箱方案。

在正式开始介绍本方案之前，先阐述下目前主流的沙箱方案以及存在的问题。

### 云端沙箱方案

针对通用的应用进行实时构建可以采用云端沙箱（Cloud Sandbox）模式。该方案首先会在服务器中出初始化一个代码运行环境（Docker 或 microVM 等），然后将需要被构建的应用代码从指定位置（例如某个 git 代码仓库）拷贝到该运行环境中，安装依赖，最后执行构建命令对应用进行构建。该种模式对应用所采用的编程语言等没有特定要求，完全等同于本地环境。目前 CodeSandbox 的 Cloud templates 生成的应用就是采用这种模式来进行构建。

#### 该方案的缺点

1. 占用服务器资源较多：因为该模式下代码最终运行在服务器中，构建的应用代码越多，所占用服务器资源也就会越多

2. 首次构建时间较长：应用代码首次构建时需要在服务器中初始化代码运行环境，所以首次构建过程比较费时（后续可通过容器保活/文件缓存等方式优化二次构建时长）。

### 浏览器端沙箱之 CodeSandbox 方案

如果仅构建前端应用，则可以将应用的编译构建的过程迁移到浏览器中进行，最终的构建结果直接在浏览器中执行 —— 渲染出最终的页面，也就是浏览器端沙箱（Browser Sandbox）模式。目前 CodeSandbox 的 Browser templates 生成的应用就是采用这种模式来进行构建。

CodeSandbox 本质上是在浏览器中运行的简化版 Webpack，下面是该沙箱方案构建应用的步骤：

1. 从 npm 打包服务获取被构建应用的 npm 依赖内容。

2. 从应用的入口文件开始, 对源代码进行编译, 解析 AST，找出下级依赖模块，然后递归编译，最终形成一个依赖关系图。其中模块之间互相引用遵循的是 CommonJS 规范。

3. 和编译阶段一样，也是从入口文件开始，使用 eval 执行入口文件，如果执行过程中调用了 require，则递归 eval 被依赖的模块。

#### 该方案的缺点

1. 构建时间随着应用规模增大而变长：由于该方案是在浏览器中模拟了一个简化版的 Webpack，底层使用 CommonJS 模块化方式对前端资源进行打包。CodeSandbox 沙箱会通过应用的入口文件进行递归编译和执行所有被引用的模块，随着构建应用的规模变大，所包含的模块变多，这种方式必然会导致整个构建时间不可避免地增加。

## Vite 沙箱方案详细阐述

本方案主要对 Vite / esm.sh 等开源方案的改造，再结合 Web Worker / Service Worker / Broadcast Channel / Cache Storage / iframe 等浏览器技术，以实现在浏览器中对前端应用按照 bundless 模式进行实时构建的目的。

首先介绍下本方案中最核心的部分 —— 如何改造 Vite 使其可以行在浏览器中。

### 改造 Vite 使其运行在浏览器中

在介绍具体的改造细节之前，让我们先了解下 Vite 的基本原理，以便更好地理解具体的改造方案。下面摘取了 Vite 官网的部分介绍文案：

Vite 是一种新型前端构建工具，能够显著提升前端开发体验。作为一个基于浏览器原生 ESM 的构建工具，它省略了开发环境的打包过程，利用浏览器去解析 imports，在服务端按需编译返回。同时，在开发环境拥有速度快到惊人的模块热更新，且热更新的速度不会随着模块增多而变慢。

当冷启动开发服务器时，基于打包器的方式启动必须优先抓取并构建整个应用，然后才能提供服务，如下图所示。

![bundle 模式](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/24745925463/80a3/031f/e908/a78ba0574573fd43c9a81a525c3ce25c.png)

而 Vite 则通过在一开始将应用中的模块区分为 依赖 和 源码 两类，改进了开发服务器启动时间，如下图所示。

1. **依赖** 大多为在开发时不会变动的纯 JavaScript。一些较大的依赖（例如有上百个模块的组件库）处理的代价也很高。依赖也通常会存在多种模块化格式（例如 ESM 或者 CommonJS）。

Vite 将会使用 esbuild 预构建依赖。esbuild 使用 Go 编写，并且比以 JavaScript 编写的打包器预构建依赖快 10-100 倍。

2. **源码** 通常包含一些并非直接是 JavaScript 的文件，需要转换（例如 JSX，CSS 或者 Vue/Svelte 组件），时常会被编辑。同时，并不是所有的源码都需要同时被加载（例如基于路由拆分的代码模块）。

Vite 以原生 ESM 方式提供源码。这实际上是让浏览器接管了打包程序的部分工作：Vite 只需要在浏览器请求源码时进行转换并按需提供源码。根据情景动态导入代码，即只在当前屏幕上实际使用时才会被处理。

![bundless 模式](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/24745926003/c212/813f/e8bf/32b8c526d1768d6a453c559f4dabc10b.png)

为了使 Vite 运行在浏览器中，首先需要将其源码使用打包器进行打包，本方案打包器采用的是 Webpack，然后在浏览器中通过 Script 标签加载或者 Web Worker 动态 import 加载并执行，以达到在浏览器运行 Vite 的目的。

接下来就看下这个过程中，需要解决哪些问题。

#### Node 原生模块

首先 Vite 是一个 Node 应用，其中使用到了很多 Node 原生模块，例如 fs / path 等，而浏览器中并不存在这些模块。对此本方案在使用 Webpack 对 Vite 源码打包的过程中，将其中的 Node 原生模块使用对应在浏览器的 polyfill 包进行替换，例如使用 path-browserify 包来替换 Node 原生模块 path。

其中有部分 Node 原生模块和对应的浏览器 polyfill 包提供的 API 不完全一致，例如 Node 的原生模块 url 和对应的 polyfill 包 node-url，对此需要在 node-url 包基础上进行二次封装，以确保其提供的 API 和对应原生模块完全一致。相关代码如下：

```js
import { parse } from 'node-url';

const URL = globalThis.URL;
const URLSearchParams = globalThis.URLSearchParams;

function pathToFileURL(path) {
  return new URL(path, 'file://');
}

function fileURLToPath(url) {
  if (url.protocol === 'file:') {
    return url.pathname;
  }

  throw new Error(`fileURLToPath(${url})`);
}

export {
  URL,
  URLSearchParams,
  parse,
  pathToFileURL,
  fileURLToPath
};
```

将 Node 原生模块映射成 polyfill 包的配置如下所示：

```js
resolve: {
  alias: {
    fs: path.resolve(__dirname, 'src/utils/polyfill/fs.js'),
    module: path.resolve(__dirname, 'src/utils/polyfill/module.js'),
    url: path.resolve(__dirname, 'src/utils/polyfill/url.js'),
    'perf_hooks': path.resolve(__dirname, 'src/utils/polyfill/perfHooks.js'),
    esbuild: path.resolve(__dirname, 'src/utils/polyfill/esbuild.js'),
    ...
  },
  fallback: {
    assert: require.resolve('assert'),
    buffer: require.resolve('buffer'),
    'safe-buffer': require.resolve('buffer'),
    crypto: require.resolve('crypto-browserify'),
    os: require.resolve('os-browserify/browser'),
    path: require.resolve('path-browserify'),
    ...
  },
}
```

#### 文件系统

其次 Vite 在对应用进行构建时，需要使用文件系统进行文件的读写。但由于安全问题浏览器无法直接操作用户计算机的磁盘文件系统，对此本方案采用 memfs 实现的内存文件系统来进行替代。memfs 提供的 API 和 node 的原生 fs 模块基本一致，相关二次封装代码如下：

```js
import { fs } from 'memfs';

export const promises = fs.promises;

export default fs;
```

#### 依赖预构建

另外 Vite 在启动时会进行依赖预构建 —— 使用 esbuild 对 node_modules 中应用依赖模块进行按照 ESM 模块化格式转换和打包处理，并将处理结果保存在 node_modules 下的 .vite 目录中，以便在后面的应用构建过程中复用，提升二次构建速度。由此可见 Vite 的依赖预构建过程非常依赖 node_modules。

虽然上面有提到本方案采用了 memfs 实现的内存文件系统，但是由于应用的 node_modules 规模一般都会非常庞大，将完整的 node_modules 写入到内存中会非常占用内存。对此本方案采取的解决办法是剥离 Vite 的依赖预构建功能，并将对依赖的打包迁移到服务端中进行。

这里就要提到 esm.sh 服务，该服务是一种将 npm 包中所有模块按 ESM 模块化方式进行转化，然后进行内容分发的服务，其中最核心的依赖处理也是通过 esbuild 实现的。是采用 go 语言实现的开源项目，仓库地址 `https://github.com/ije/esm.sh`。

本方案的依赖处理就是通过该服务完成的，具体做法是自定义 Vite 的 optimize 过程，在解析模块中对 npm 包的裸模块导入时，例如当解析 `import React from 'react'` 时，该插件会将其替换成 `import React from 'https://esm.sh/react@17.0.2'`。浏览器在解析到 import 部分时，会发起 HTTP 请求 `https://esm.sh/react@17.0.2`。esm.sh 服务在接收到请求后，会对 react 包内的模块按照 ESM 模块化进行转换，然后返回给浏览器中的页面。由于 esm.sh 服务本身会有缓存策略，另外前端应用中的大部分依赖基本相同，因此可以很快地从缓存中获取上次的转换结果并直接返回，跳过了依赖处理的过程。所以在沙箱的实际运行中发现依赖处理阶段非常迅速，不会占用整个应用构建过程过多的时间。

其中自定义 Vite 的 optimize 过程的核心代码如下：

```js
async function optimizeDeps(config, tree, newDeps) {
  ...
  for (const depName of Object.keys(deps)) {
    data.optimized[depName] = {
      file: genNpmUrl(depName, deps, tree),
      needsInterop: false
    };
  }

  return data;
}

async function runOptimize(channel, server, { ref, tree }, addInitError) {
  ...

  try {
    server._isRunningOptimizer = true;
    server._optimizeDepsMetadata = await optimizeDeps(config, tree);
    server.moduleGraph.onFileChange(filePath);
  } finally {
    server._isRunningOptimizer = false;
  }
  ...
}
```

在具体落地时遇到一些问题，下面就详细阐述下问题和解决办法。

首先是对私有 npm 包的处理，很多公司都会有用来存放内部的 npm 包的私有 npm 源，而 esm.sh 服务是无法获取到这类 npm 包的。解决办法也比较简单，由于 esm.sh 服务内是通过 yarn 来下载 npm 包然后进行接下来的处理的，因此只需要将 esm.sh 服务部署到公司内网环境，使得其可以通过 yarn 下载到内部 npm 包即可。

其次是如果不对 esm.sh 服务的 npm 处理结果进行打包，则会触发请求瀑布流问题，导致整个沙箱构建过程发出成千上百个请求，严重阻塞构建过程。例如请求 `https://esm.sh/antd@5.2.0` 时，实际仅仅返回的是 ant 包的本身的内容，但 antd 又依赖很多其他 npm 包(例如 rc 组件包)，结果就会触发很多额外请求，反而使得整个构建过程非常缓慢。对此需要将 antd 包以及其依赖的 npm 包的内容统一打包好后再返回，可以在 esm.sh 请求地址后追加 bundle 参数，例如 `https://esm.sh/antd@5.2.0?bundle`。esm.sh 服务会将 `bundle` 参数透传给内部的 esbuild，后者在转换 npm 模块后还会再完成打包后才输出。

最后是多个 npm 包依赖相同的 npm 包，例如很多 UI 包都会依赖 react，如果每个 npm 包都将 react 依赖打包进去，会使得构建出来的页面执行多份 react 包代码导致报错。又例如很多 UI 包还会依赖比较大个组件库例如 antd，如果每个 UI 包都要将 antd 打包进去，则会导致打包过程非常耗时且打包产物较大最终影响依赖加载速度，导致沙箱构建应用的速度变慢；另外有些 npm 包会有一些副作用，例如在全局初始化一些变量，多次加载执行也会导致变量重复初始化，之前的赋值丢失的情况。

对此 Node 环境下运行的 Vite 在依赖预构建阶段会将共同依赖单独抽离出来进行打包。而本方案中采用的是先在 esm.sh 请求后追加 external 参数，例如 `https://esm.sh/react-tables-employes@1.0.0?bundle&external=antd`，esm.sh 服务会将 `external=antd` 参数透传给内部的 esbuild，后者在打包时会忽略掉 antd 依赖，仍保留原本的引用，例如 `import * as k from 'antd';`。

接下来再利用浏览器提供的 Import maps 技术，该技术允许开发者控制 js 的 import 语句或者 import() 表达式获取的库的 url，因此可以将对 antd 库的引用指向 esm.sh 服务，相关设置代码如下：

```js
<script type="importmap">
{
  "imports": {
    "antd": "https://esm.sh/antd@5.2.0?bundle"
  }
}
</script>
```

#### HTTP 服务器

最后 Vite 在构建应用时需要使用 HTTP 服务器来处理和响应来自浏览器页面中的请求。例如浏览器中的页面发起请求 `http://xxx/xxx/A.js` 后，Vite 会在服务器中接收该请求，然后定位到在源码中的对应模块编译该模块，最后将编译后的代码转换为 Response 对象返回给浏览器中的页面。但在浏览器中并不能运行 HTTP 服务器，于是本方案中采用浏览器的 Service Worker 技术来模拟一个 HTTP 服务器，Service Worker 技术可以拦截并修改页面访问和资源请求，本质上充当 Web 应用程序、浏览器与网络之间的代理服务器。

具体做法是先使用一个 Web Worker 线程来运行 Vite，然后注册 Service Worker 拦截页面请求，并将请求信息转发给运行在 Web Worker 的 Vite，Vite 根据请求信息确定对应模块并编译，然后将编译后的代码返回给 Service Worker，Service Worker 再将编译后的代码作为请求响应返回给页面。

Service Worker 的相关逻辑实现如下：

```js
import { registerRoute } from 'workbox-routing';
import Channel from '$utils/channel';

registerRoute(
  // 使用正则表达式匹配来自 iframe 页面的请求
  /^https?:\/\/[^]*\/([^/]{32})\/preview\/([^/]*)(\/.*)$/,
  async ({ request, url, params }) => {
    const [ busid, wcid, pathname ] = params;
    const { href } = url;
    
    let channel = ChannelMap.get(busid);
    if (!channel) {
      channel = new Channel(busid);
      ChannelMap.set(busid, channel);
    }
    // 将拦截到 iframe 页面内的请求信息通过 Broadcast Channel 发送给 Vite Worker 线程
    const res = await channel.request('serve-request', {
      wcid,
      pathname: pathname.replace(/#.*$/, ''),
      rawUrl: href,
      accept: request?.headers?.get('accept')
    });

    // 在收到运行在 Web Worker 的 Vite 对某个模块编译完成的消息后，会从 Cache Storage 中取出包含编译后的代码的 Response 对象
    if (res.cache) {
      const viteCache = await caches.open('vite');
      return viteCache.match(href).finally(() => viteCache.delete(href));
    }

    // 作为请求响应返回给 iframe 中的页面，从而使得编译后的代码在浏览器中执行
    return res.notfound ? new Response('Not found',{
      status: 404,
      statusText: 'NOT FOUND'
    }) : new Response(res.error || 'Error',{
      status: 500,
      statusText: 'SERVER ERROR'
    });
  }
);
```

### Vite 沙箱构建应用过程

在介绍如何改造 Vite 使其运行在浏览器后，接下来将详细阐述运行在浏览器的 Vite 是如何与 Web Worker / Service Worker / Broadcast Channel / Cache Storage / iframe / esm.sh 等技术一起配合，实现对前端应用按照 bundless 模式进行构建的。

![Vite 沙箱构建应用过程](https://p5.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/24843462756/df20/fca4/6b80/014b756599d6be443ecf36748a40a622.png)

整个沙箱构建过程如上图所示，主要分以下几个步骤：

1. 初始化运行 Vite 的 Web Worker 线程（后面简称 Vite Worker 线程），并将需要被构建的前端应用源码发送给 Vite Worker 线程。 

2. 初始化并注册用于拦截页面请求的 Service Worker 线程，来模拟 Node 环境下 Vite 所使用的 HTTP 服务器，该步骤和步骤 1 没有依赖关系，可同时进行。

3. Service Worker 线程注册成功后，创建 iframe 标签来加载被构建应用的页面。

    其中 iframe 的页面 URL 设置需要加上特殊的前置路径，例如 `<iframe src='/preview/index.html'/>`，目的是为了在 Service Worker 线程拦截页面请求时可以区分该请求是来自主页面还是 iframe 标签加载的页面。因被构建的前端应用页面是由 iframe 标签来加载，所以只需要对来自 iframe 页面的请求进行响应处理即可。

    前面三个步骤相当于沙箱启动时的准备阶段，接下来则正式进入到沙箱的构建阶段。

4. Service Worker 拦截来自 iframe 页面的请求，例如 `http://xxx/preview/index.html`。

5. Servie Worker 将拦截到 iframe 页面内的请求信息（例如请求 url、请求头 accept 字段等）通过 Broadcast Channel 发送给 Vite Worker 线程。

6. 运行在 Web Worker 线程的 Vite 根据页面的请求信息，从被构建应用的源码找到对应源代码进行编译，然后将编译后的代码转换成 Response 对象存储在 Cache Storage 中，并通知 Service Worker 线程。

7. Service Worker 在收到 Vite Worker 线程对某个模块编译完成的消息后，会从 Cache Storage 中取出包含编译后的代码的 Response 对象，作为请求响应返回给 iframe 中的页面，从而使得编译后的代码在浏览器中执行。

    例如在处理 `http://xxx/preview/A.js` 请求时，Vite 先从前端应用源码中确定到具体模块 A.js，然后使用 babel / esbuild 等工具对 A.js 进行编译并将编译后的代码返回给浏览器。在浏览器执行 A.js 编译后的代码时，如果其中有通过 ESM import 方式引用其他模块，例如 `import { foo } from 'B.js'`，则会发出一个对 B.js 模块的 HTTP 请求 `http://xxx/preview/B.js`，然后继续被 Service Worker 拦截，交给 Vite Worker 线程处理后再返回。最终应用中的所有模块都会被编译和执行，整个应用也就被构建完成了。

8. 针对 npm 包依赖的请求，esm.sh 服务会将 npm 包中所有模块按照 ESM 模块化方式转换并打包，然后返回给 iframe 中的页面中执行。该步骤和步骤 7 同时进行，例如 react 包的请求 `https://esm.sh/react@17.0.2?bundle`。

9. 随着前端应用中模块编译后的代码以及 npm 依赖代码的执行，最终该应用对应页面会在 iframe 中渲染。

## 结束语

Vite 沙箱方案就介绍完了，最后总结下本方案所解决的问题：

1. 相对于 Cloud Sandbox 模式（即云端沙箱），本方案整个构建过程完全在用户的浏览器中进行，无需占用任何服务器资源；并且由于没有在服务器中初始化代码运行环境的过程，所以也不存在首次构建应用时间较长的问题。

2. 相对于 Browser Sandbox 模式（即浏览器端沙箱）中的 CodeSandbox 方案，其本质上是模拟实现了一个运行在浏览器中的 Webpack，随着需要被构建的应用模块越来越多，整个构建时间会变长。本方案采用了基于 Vite 实现的 bundless 模式构建，可以实现对应用中模块的按需编译，只需编译当前页面所需模块，从而加快对前端应用的构建速度，使得用户更快地看到页面效果。

## 致谢

整个方案的主要思路来自 [Vite in the browser](https://divriots.com/blog/vite-in-the-browser)，笔者也正是在文章中提到的  [browser-vite](https://github.com/divriots/browser-vite) 基础上进行开发和落地，对此十分感谢。

同时整个方案的实现代码以及使用示例代码均已开源，希望可以帮助到有相同需求的人。

仓库地址如下：

Vite 沙箱实现代码 —— [vitesandbox-client](https://github.com/mcuking/vitesandbox-client)

Vite 沙箱使用示例代码 —— [vitesandbox-client-example](https://github.com/mcuking/vitesandbox-client-example)

至此浏览器沙箱系列的三篇文章已经完成，暂时没有继续更新的计划。笔者目前正在实践 WebAssembly 在云端的落地应用，如果有一定进展会第一时间更新到 GitHub 博客的 WebAssembly 系列文章中，欢迎关注 https://github.com/mcuking/blog
