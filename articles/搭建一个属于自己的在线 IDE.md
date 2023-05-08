> 文章首发于我的博客 https://github.com/mcuking/blog/issues/86

## 背景

这几个月在公司内做一个跨前端项目之间共享组件/区块的工程，主要思路就是在 [Bit](https://github.com/teambit/bit) 的基础上进行开发。Bit 主要目的是实现不同项目 **共享** 与 **同步** 组件/区块，大致思路如下：

在 A 项目中通过执行 Bit 提供的命令行工具将需要共享的组件/区块的源码推送到远端仓库，然后在 B 项目中就可以同样通过 Bit 提供的命令行工具拉取存储在 Bit 远程仓库的组件/区块。听起来比较像 Git，主要的区别是 Bit 除了推送源码之外，还会包括组件的依赖图谱分析、组件的版本管理等功能。下面这张图就描述了 Bit 的实现思路。更多细节可以参考 Bit 官方文档 [Bit-Docs](https://docs.bit.dev/docs/how-bit-works)

![Bit 原理图.png](https://i.loli.net/2020/09/12/t2snHPxMlB6UpvY.png)

虽然 Bit 开源了命令行工具，但并没有开源共享组件/区块的展示站点，类似 Bit 官方提供的网站 [bit.dev](https://bit.dev)。也就是说使用者无法通过浏览组件/区块的构建后的视图的方式，来查找保存在 Bit 远程仓库的组件/区块代码。Bit 网站效果如下图：

![Bit 网站效果图.png](https://i.loli.net/2020/09/23/RSmKrXlgpsON8tV.png)

接下来就需要自己实现一个类似的网站，进而就会发现其中最难的部分就是实现一个在线 IDE，用于展示组件/区块代码，并支持代码实时构建以及获取构建后的页面截图等功能。效果如下图：

![在线 IDE 效果图.png](https://i.loli.net/2020/09/23/iIT7bh8w1gEmnsF.png)

### 使用目前提供的在线 IDE 的问题

看到这里你可能会有个疑问，为什么不能直接使用现有免费的在线 IDE？例如 [CodeSandbox](https://codesandbox.io/)、[CodePen](https://codepen.io/)、[Stackblitz](https://stackblitz.com/) 等。主要有如下原因：

1. 对于稍具一定规模的公司，都会有自己的私有 npm 源，而在线 IDE 无法获取到这些 npm 包；

2. 前端项目构建中一些特定的配置，而现有的在线 IDE 无法支持；

    例如 CodeSandbox 只能设置构建模板的类型，例如 create-react-app，并没有提供外部修改具体的构建配置的 API。例如项目中用到了 less 文件，选择 create-react-app 模板是无法构建的该类型文件的。

3. 特殊的功能无法实现，例如点击页面的按钮，可以实现对在线 IDE 右侧构建出来的页面进行截图，并将图片数据传输出来；

4. 使用在线 IDE 提供的服务，一般意味着你的组件/区块是暴露在公网上的，然而可能有些代码涉密，是不能上传到公网上的。

5. 部分构建工具依赖 node_modules 等文件，无法在没有 node_modules 的浏览器中正常工作。例如 babel 插件等。这个在后面的定制 CodeSandbox 功能部分会举个例子细说。

所以我们需要搭建一个属于自己的在线 IDE ，以解决上面提的几个问题。那么接下来有两种方式：一种是完全从零开发一个在线 IDE，另一种是找到一个开源的项目，并在此基础上进行定制。

最开始笔者选择了自己开发，但是开发一段时间后，发现花费了大量精力实现出来 IDE 和已有的产品相比，不论是从功能丰富度还是易用性上，都完全落败。再加上笔者主要想实现的是一个跨前端项目区块复用的平台，在线 IDE 只是其中一个非必要的组成部分（注：其实也可以将共享的组件/区块的源代码直接在页面上展示，通过组件/区块命称来区分，虽然这种方式确实很 low）。所以最终还是选择在已经开源的在线 IDE 基础上二次开发。

## CodeSandbox 基本原理

笔者主要研究的是 [Codesandbox](https://github.com/codesandbox) 以及 [Stackblitz](https://github.com/stackblitz) 。这两个都是商业化的项目，其中 Stackblitz 的核心部分并没有开源出来，而 CodeSandbox 绝大部分的功能都已经开源出来了，所以最终选择了 CodeSandbox。

为了方便后续讲解如何定制和部署 CodeSandbox，这里大概说一下它的基本原理（**下面主要引用了[CodeSandbox 如何工作? 上篇](https://bobi.ink/2019/06/20/codesandbox/) 的部分内容**）：

CodeSandbox 最大的特点是采用在浏览器端做项目构建，也就是说打包和运行不依赖服务器。由于浏览器端并没有 Node 环境，所以 CodeSandbox **自己实现了一个可以跑在浏览器端的简化版 webpack**。

### CodeSandbox 组成部分

如下图所示，CodeSandbox 主要包含了三个部分：

![CodeSandbox 的组成.png](https://i.loli.net/2020/09/13/gn1qu4i3CXvTo5W.png)

- **Editor 编辑器**：主要用于编辑代码，代码变动后会通知 Sandbox 进行转译

- **Sandbox 代码运行沙盒**：在一个单独的 iframe 中运行，负责代码的编译 Transpiler 和运行 Evalation

- **Packager npm 在线打包器**：给 Sandbox 提供 npm 包中的文件内容

### CodeSandbox 构建项目过程

构建过程主要包括了三个步骤：

- **Packager--npm 包打包阶段**：下载 npm 包并递归查找所有引用到的文件，然后提供给下个阶段进行编译

- **Transpilation--编译阶段**：编译所有代码, 构建模块依赖图

- **Evaluation--执行阶段**：使用 eval 运行编译后的代码，实现项目预览

#### Packager--npm 包打包阶段

Packager 阶段的代码实现是在 CodeSandbox 托管在 GitHub 上的仓库 [dependency-packager](https://github.com/codesandbox/dependency-packager) 里，这是一个基于 [express](https://expressjs.com/) 框架提供的服务，并且部署采用了 Serverless(基于 AWS Lambda) 方式，让 Packager 服务更具伸缩性，可以灵活地应付高并发的场景。（注：在私有化部署中如果没有 Serverless 环境，可以将源码中有关 AWS Lambda 部分全部注释掉即可 ）

以 react 包为例，讲解下 Packager 服务的原理，首先 express 框架接收到请求中的包名以及包版本，例如 react@16.8.0。**然后通过 yarn 下载 react 以及 react 的依赖包到磁盘上，通过读取 npm 包的 package.json 文件中的 browser、module、main、unpkg 等字段找到 npm 包入口文件，然后解析 AST 中所有的 require 语句，将被 require 的文件内容添加到 manifest 文件中，并且递归执行刚才的步骤，最终形成依赖图。这样就实现将 npm 包文件内容转移到 manifest.json 上的目的，同时也实现了剔除 npm 模块中多余的文件的目的**。最后返回给 Sandbox 进行编译。下面是一个 manifest 文件的示例：

```js
{
    // 模块内容
    "contents": {
        "/node_modules/react/index.js": {
            "content": "'use strict';↵↵if ....", // 代码内容
            "requires": [ // 依赖的其他模块
                "./cjs/react.development.js",
            ],
        },
        //...
    },
    // 模块具体安装版本号
    "dependencies": [{
        name: "@babel/runtime",
        version: "7.3.1"
    }, /*…*/ ],
    // 模块别名, 比如将react作为preact-compat的别名
    "dependencyAliases": {},
    // 依赖的依赖, 即间接依赖信息. 这些信息可以从yarn.lock获取
    "dependencyDependencies": {
        "object-assign": {
            "entries": ["object-assign"], // 模块入口
            "parents": ["react", "prop-types", "scheduler", "react-dom"], // 父模块
        }
        //...
    }
}
```

值得一提的是为了提升 npm 在线打包的速度，CodeSandbox 作者使用了 AWS 提供的 S3 云存储服务。当某个版本的 npm 包已经打包过一次的话，会将打包的结果 -- `manifest.json` 文件存储到 S3 上。在下一次请求同样版本的包时，就可以直接返回储存的 `manifest.json` 文件，而不需要重复上面的流程了。在私有化部署中可以将 S3 替换成你自己的文件存储服务。

#### Transpilation--编译阶段

当 Sandbox 从 Editor 接收到前端项目的源代码、npm 依赖以及构建模板 Preset。**Sandbox 会初始化配置，然后从 Packager 服务下载 npm 依赖包对应的 manifest 文件，接着从前端项目的入口文件开始对项目进行编译，并解析 AST 递归编译被 require 的文件，形成依赖图**（注：和 webpack 原理基本一致）。

注意 CodeSandbox 支持外部预定义项目的构建模板 Preset。Preset 规定了针对某一类型的文件，采用哪些 Transpiler（相当于 Webpack 的 Loader）对文件进行编译。目前可供选择的 Preset 选项有： `vue-cli` 、 `create-react-app`、`create-react-app-typescript`、 `parcel`、`angular-cli`、`preact-cli`。但是不支持修改某个 Preset 中的具体配置，这些都是内置在 CodeSandbox 源码中的。Preset 具体配置示例如下：

```js
import babelTranspiler from "../../transpilers/babel";
...

const preset = new Preset(
  "create-react-app",
  ["web.js", "js", "json", "web.jsx", "jsx", "ts", "tsx"], {
    hasDotEnv: true,
    setup: manager => {
      const babelOptions = {...};
      preset.registerTranspiler(
        module =>
          /\.(t|j)sx?$/.test(module.path) && !module.path.endsWith(".d.ts"),
        [{
          transpiler: babelTranspiler,
          options: babelOptions
        }],
        true
      );
      ...
    }
  }
);
```

#### Evaluation--执行阶段

Evaluation 执行阶段是从项目入口文件对应的编译后的模块开始，递归调用 eval 执行所有被引用到的模块。

由于本文主要是阐述如何搭建自己的在线 IDE，所以 CodeSandbox 更多的实现细节可以参考如下文章：

- [CodeSandbox 如何工作? 上篇](https://bobi.ink/2019/06/20/codesandbox/)

- [CodeSandbox是如何让npm上的模块直接在浏览器端运行的](https://www.yuque.com/wangxiangzhong/aob8up/uf99c5)

## 私有化部署 CodeSandbox

了解完 CodeSandbox 基本原理后，接下来就到了本文的核心内容：如何私有化部署 CodeSandbox。

### 在线打包服务 Packager

首先是 npm 在线打包服务 [dependency-packager](https://github.com/codesandbox/dependency-packager)。笔者是通过镜像部署到自己的服务器上的。

接着是将 npm 源改成公司的私有 npm 源，可以通过两种方式，一种是在镜像中通过 npm config 命令全局修改，例如如下 Dockerfile:

```dockerfile
FROM node:12-alpine

COPY . /home/app

# 设置私有 npm 源
RUN cd /home/app && npm config set registry http://npm.xxx.com && npm install -f

WORKDIR /home/app

CMD ["npm", "run", "dev"]
```

第二种方式是在源码中通过 yarn 下载 npm 包的命令后面添加参数 `--registry=http://npm.xxx.com` ，相关代码在 [functions/packager/dependencies/install-dependencies.ts](https://github.com/codesandbox/dependency-packager/blob/master/functions/packager/dependencies/install-dependencies.ts) 文件中。

另外该服务依赖了 AWS 的 Lambda 提供的 Serverless，并采用 AWS 提供的 S3 存储服务缓存 npm 包的打包结果。如果读者没有这些服务的话，可以将源码中这部分内容注释掉或者换成对应的其他云计算厂商的服务即可。[dependency-packager](https://github.com/codesandbox/dependency-packager) 本质上就是一个基于 express 框架的 node 服务，可以简单地直接跑在服务器中。

### 编辑器 Editor

在 CodeSandbox-client 工程中的 [standalone-packages/react-sandpack](https://github.com/codesandbox/codesandbox-client/tree/master/standalone-packages/react-sandpack) 项目，就是 CodeSandbox 提供的基于 [react](https://reactjs.org/) 实现的的编辑器项目。区别于主项目实现的编辑器，这个编辑器主要是为了给使用者进行定制，所以实现的比较简陋，使用者可以根据自己的需求在这个编辑器的基础上加入自己需要的功能。当然如果没有自定义编辑器的需求，可以直接使用 react-sandpack 项目对应的 npm 包 [react-smooshpack](https://www.npmjs.com/package/react-smooshpack)，使用方式如下：

```ts
import React from 'react';
import { render } from 'react-dom';
import {
  FileExplorer,
  CodeMirror,
  BrowserPreview,
  SandpackProvider,
} from 'react-smooshpack';
import 'react-smooshpack/dist/styles.css';

const files = {
  '/index.js': {
    code: "document.body.innerHTML = `<div>${require('uuid')}</div>` ",
  },
};

const dependencies = {
  uuid: 'latest',
};

const App = () => (
  <SandpackProvider 
      files={files} 
      dependencies={dependencies} 
      entry="/index.js" 
      bundlerURL= `http://sandpack-${version}.codesandbox.io` >
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <FileExplorer style={{ width: 300 }} />
      <CodeMirror style={{ flex: 1 }} />
      <BrowserPreview style={{ flex: 1 }} />
    </div>
  </SandpackProvider>
);

render(<App />, document.getElementById('root'));
```

其中子组件 FileExplorer、CodeMirror、BrowserPreview 分别是左侧的文件目录树、中间的代码编辑区和右侧的项目构建后的页面预览区。

通过查看这个独立库的源码，可以知道除了这三个子组件之外，SandpackProvider 还会再插入一个 iframe 标签，主要用于显示项目构建后的页面，而右侧预览区组件 BrowserPreview 中的 Preview 组件会将这个 ifame 插入到自己的节点，这样就实现了将项目构建的页面实时显示出来的目的。

而 iframe 加载的 bundlerUrl 默认是官方提供的地址 `http://sandpack-${version}.codesandbox.io` ，其中这个域名对应的服务其实就是 CodeSandbox 的核心--在浏览器端构建前端项目的服务，大致原理刚刚已经阐述过了。下一小节会阐述如何将官方提供的构建服务替换成自己的。

至于代码编辑区的代码/依赖如何同步到 iframe 中加载的构建服务，其实它依赖了另一个独立库 sandpack（和 react-sandpack 同级目录），其中有一个 Manager 类就是在代码编辑区和右侧预览区的构建服务之间搭建桥梁，主要是用了 codesandbox-api 包提供的 dispatch 方法进行编辑器和构建服务之间的通信。

### 代码运行沙盒 SandBox 

怕大家误解先提前说明下，上一小节提到的构建服务并不是后端服务，这个服务其实就是 CodeSandbox 构建出来的前端页面。基本原理部分已经阐述了 CodeSandbox 实际上在浏览器里实现了一个 webpack，项目的构建全部是在浏览器中完成的。

而 CodeSandbox 前端构建的核心部分的目录在 CodeSandbox-client 工程中 [packages/app](https://github.com/codesandbox/codesandbox-client/tree/master/packages/app) 项目，其中的原理已经在上面阐述过了，这里只需要将该项目构建出来的 www 文件夹部署到服务器即可。由于该核心库又依赖了其他库，所以也需要先构建下依赖库。下面笔者写了一个 build.sh 文件，放置在整个项目的一级目录即可。

```bash
# 运行和构建需要 Node 10 环境
nvm use 10

# 安装依赖
yarn

# 如果是第一次构建，需要先将整个项目构建一次，后面需要使用其中的构建产物
# 如果已经整体项目构建过一次，则无需重新构建
yarn run build 

# 构建依赖库
yarn run build:deps

# 进入到核心库 packages/app 进行构建
cd packages/app

yarn run build:sandpack-sandbox

# 由于一些原因，一些需要的静态文件需要从整体项目的构建目录中获取
# 因此需要在执行该 shell 脚本之前，将整个项目构建一次，即执行 yarn run build 即可（这个构建的时间会比较久）
cp -rf ../../www/static/* ./www/static
```

当执行完上面的 shell 脚本之后，就可以将 packages/app 目录下构建的产物 www 部署到服务器上，笔者采用的是容器部署，下面是 dockerfile 文件内容。

```dockerfile
FROM node:10.14.2 as build

WORKDIR /

ADD . .

RUN /bin/sh build.sh

FROM nginx:1.16.1-alpine

COPY --from=build /packages/app/www /usr/share/nginx/html/
```

注意这里采用了分阶段构建镜像，即先构建 CodeSandbox 项目，再构建镜像。但在实践中发现 CodeSandbox 项目放在服务器上构建不是很顺利，所以最终还是选择在本地构建该项目，然后将构建产物一并上传到远程 git 仓库，这样在打包机上只需要构建镜像并运行即可。

整个部署的灵感来自 GitLab 的官方仓库的一个 issue: [GitLab hosted Codesandbox](https://gitlab.com/gitlab-org/gitlab/-/issues/27144)

## 定制 CodeSandbox 功能

上个小节读者可能会有个疑问，为什么直接使用 CodeSandbox 提供的默认构建服务？其实就是为了对 CodeSandbox 的构建流程进行定制，接下来举四个例子来说明下。

### 替换组件样式自动引入的 babel 插件功能

针对公司自建的组件库，一般都会开发类似 babel-plugin-import 这样的插件，以便在代码中使用组件时无需额外再引入组件的样式文件，babel-plugin-import 插件会在 js 编译阶段自动插入引入样式的代码。但这种插件可能会需要遍历组件的 package.json 中的依赖中是否有其他组件，如果有也要把其他组件的样式文件的引入写到编译后的 js 中，并递归执行刚才的过程。这里就需要读入 node_modules 中的相关文件。但是诸如 [CodeSandbox](https://codesandbox.io/)、[Stackblitz](https://stackblitz.com/) 等都是在浏览器中进行构建，并没有 node_modules。

针对这个问题，笔者最终放弃了利用 babel 插件在 js 编译阶段进行插入引入样式文件代码的方式，而是在代码运行阶段从 npm 在线打包服务中获取组件的样式文件，然后将样式文件内容通过 style 标签动态插入到 head 标签上面。下面是具体改动：

**在线 npm 打包服务侧**

在线 npm 打包服务一般只会返回 js 文件，所以需要在该服务基础上增加一个功能：当判断请求的 npm 包为内建组件，则还要额外返回样式文件。下面是 [dependence-packager](https://github.com/codesandbox/dependency-packager) 项目中添加的核心代码：

为了提供获取私有组件样式文件的方法，可以在 [functions/packager/utils](https://github.com/codesandbox/dependency-packager/tree/master/functions/packager/utils) 目录下新建一个文件 `fetch-builtin-component-style.ts` ，核心代码如下：

```ts
// 根据组件 npm 包名以及通过 yarn 下载到磁盘上的 npm 包路径，读入对应的样式文件内容，并写入到 manifest.json 的 contents 对象上
const insertStyle = (contents: any, packageName: string, packagePath: string) => {
  const stylePath = `/node_modules/${packageName}/dist/index.css`;
  const styleFilePath = join(
    packagePath,
    `/node_modules/${packageName}/dist/index.css` ,
  );

  if (fs.existsSync(styleFilePath)) {
    contents[stylePath] = {
      content: fs.readFileSync(styleFilePath, "utf-8"),
      isModule: false,
    };
  }
};

// 获取内建组件的样式文件，并写入到返回给 Sandbox 的 manifest.json 文件中
const fetchBuiltinComponentStyle = (
  contents: any,
  packageName: string,
  packagePath: string,
  dependencyDependencies: any,
) => {
  // 当 npm 包或者其依赖以及依赖的依赖中有内建组件，则将该内建组件对应的样式文件写入到 manifest.json 文件中
  if (isBuiltinComponent(packageName)) {
    insertStyle(contents, packageName, packagePath);
  }

  Object.keys(dependencyDependencies.dependencyDependencies).forEach(
    (pkgName) => {
      if (isBuiltinComponent(pkgName)) {
        insertStyle(contents, pkgName, packagePath);
      }
    },
  );
};
```

并在 [functions/packager/index.ts](https://github.com/codesandbox/dependency-packager/blob/master/functions/packager/index.ts) 文件中调用该方法。代码如下：

```ts
+  // 针对私有组件，将组件样式文件也写到返回给浏览器的 manifest.json 文件中
+  fetchBuiltinComponentStyle(
+    contents,
+    dependency.name,
+    packagePath,
+    dependencyDependencies,
+  );

// 作为结果返回
const response = {
  contents,
  dependency,
  ...dependencyDependencies,
};
```

**浏览器 CodeSandbox 侧**

浏览器 CodeSandbox 侧需要提供处理私有组件样式的方法，主要是在 Evaluation 执行阶段将样式文件内容通过 style 标签动态插入到 head 标签上面，可以在 [packages/app/src/sandbox/eval/utils](https://github.com/codesandbox/codesandbox-client/tree/master/packages/app/src/sandbox/eval/utils) 目录下新建一个文件 `insert-builtin-component-style.ts` ，下面是核心代码：

```ts
// 基于样式文件内容创建 style 标签，并插入到 head 标签上
const insertStyleNode = (content: string) => {
  const styleNode = document.createElement('style');
  styleNode.type = 'text/css';
  styleNode.innerHTML = content;
  document.head.appendChild(styleNode);
}

const insertBuiltinComponentStyle = (manifest: any) => {
  const { contents, dependencies, dependencyDependencies } = manifest;

  // 从依赖以及依赖的依赖中根据 npm 包名筛选出内建组件
  const builtinComponents = Object.keys(dependencyDependencies).filter(pkgName => isBuiltinComponent(pkgName));
  dependencies.map((d: any) => {
    if (isBuiltinComponent(d.name)) {
      builtinComponents.push(d.name);
    }
  });

  // 根据基于内建组件 npm 名称拼装成的 key 查找到具体的文件内容，并调用 insertStyleNode 方法插入到 head 标签上
  builtinComponents.forEach(name => {
    const styleContent = contents[`/node_modules/${name}/dist/index.css`];
    if (styleContent) {
      const { content } = styleContent;
      if (content) {
        insertStyleNode(content);
      }
    }
  });
}
```

并在 Evaluation 执行阶段调用该方法，相关文件在 [packages/sandpack-core/src/manager.ts](https://github.com/codesandbox/codesandbox-client/blob/master/packages/sandpack-core/src/manager.ts) ，具体修改如下：

```ts
...
setManifest(manifest?: Manifest) {
  this.manifest = manifest || {
    contents: {},
    dependencies: [],
    dependencyDependencies: {},
    dependencyAliases: {},
  };

+  insertBuiltinComponentStyle(this.manifest);
  ...
}
...
```

### 添加预览区域截图功能

在区块复用平台项目中，在点击保存按钮时，不仅要保存编辑好的代码，还需要对构建好的右侧预览区域进行截图并保存。如下图所示:

![ide 截图功能](https://user-images.githubusercontent.com/22924912/93729298-79ab0880-fbf6-11ea-88d5-d8657ae3a247.png)

右侧预览区域所展示的内容是 SandpackProvider 组件插入的 iframe，所以只需要找到这个 iframe，然后通过 postMessage 与 iframe 内页面进行通信。当 iframe 内部页面接收到截图指令后，对当前 dom 进行截图并传出即可，这里笔者用的是 html2canvas 进行截图的。下面是 CodeSandbox 侧的代码改造，文件在 [packages/app/src/sandbox/index.js](https://github.com/codesandbox/codesandbox-client/blob/master/packages/app/src/sandbox/index.js) 中，主要是在文件结尾处添加如下代码：

```js
const fetchScreenShot = async () => {
  const app = document.querySelector('#root');
  const c = await html2canvas(app);
  const imgData = c.toDataURL('image/png');
  window.parent.postMessage({
    type: 'SCREENSHOT_DATA',
    payload: {
      imgData
    }
  }, '*');
};

const receiveMessageFromIndex = (event) => {
  const {
    type
  } = event.data;
  switch (type) {
    case 'FETCH_SCREENSHOT':
      fetchScreenShot();
      break;
    default:
      break;
  }
};

window.addEventListener('message', receiveMessageFromIndex, false);
```

在 CodeSandbox 使用侧，则需要在需要截图的时候，向 iframe 发送截图指令。同时也需要监听 iframe 发来的消息，从中筛选出返回截图数据的指令，并获取到截图数据。由于实现比较简单，这里就不展示具体代码了。

### create-react-app 模板中添加对 less 文件编译的支持

主要是对 create-react-app 这个 preset 的配置做一些修改，文件地址 [packages/app/src/sandbox/eval/presets/create-react-app/v1.ts](https://github.com/codesandbox/codesandbox-client/blob/master/packages/app/src/sandbox/eval/presets/create-react-app/v1.ts)。修改代码如下：

```ts
...
+  import lessTranspiler from '../../transpilers/less';
+  import styleProcessor from '../../transpilers/postcss';

export default function initialize() {
  ...
  +  preset.registerTranspiler(module => /\.less$/.test(module.path), [
  +    { transpiler: lessTranspiler },
  +    { transpiler: styleProcessor },
  +    {
  +      transpiler: stylesTranspiler,
  +      options: { hmrEnabled: true },
  +    },
  +  ]);
  ...
}
```

### 修改 CodeSandbox 请求的 npm 打包服务地址

可以将打包 npm 的服务换成上面私有化部署的服务，以解决无法获取私有 npm 包等问题。相关文件在 [packages/sandpack-core/src/npm/preloaded/fetch-dependencies.ts](https://github.com/codesandbox/codesandbox-client/blob/master/packages/sandpack-core/src/npm/preloaded/fetch-dependencies.ts) 。修改代码如下：

```ts
 const PROD_URLS = {
   ...
//  替换成自己的在线 npm 打包服务即可
-  bucket: 'https://prod-packager-packages.codesandbox.io',
+  bucket: 'http://packager.igame.163.com'
 };
...
function dependencyToPackagePath(name: string, version: string) {

-  return `v${VERSION}/packages/${name}/${version}.json` ;
+  return `${name}@${version}` ;

}
```

这四个例子就讲完了，读者可以根据自己的需求进行更多的定制。当你明白了整个 CodeSandbox 的运行机制后，就会发现定制并没有那么难。

## 结束语

到此为止，私有化部署一个属于自己并且可以任意定制的在线 IDE 的目标就已经达成了。当然在线 IDE 的项目构建不仅仅局限在浏览器中，还可以将整个构建过程放在服务端，借助于云+容器化的能力，使得在线 IDE 有着跟本地IDE几乎完全一样的功能。其实这两者应用的场景不多，完全基于浏览器构建更适用于单一页面项目的实时预览，而基于服务端构建是完全可以适用于真实的项目开发的，并且不仅仅局限于前端项目。笔者也在尝试探索基于服务端构建 IDE 的可能性，期待后面能够有些产出分享给大家。

接下来如果读者感兴趣的话，可以继续阅读基于 Bit 和 CodeSandbox 实现的区块平台项目--[跨项目区块复用方案实践](https://github.com/mcuking/blog/issues/88)

## 参考资料

- [CodeSandbox 如何工作? 上篇](https://bobi.ink/2019/06/20/codesandbox/)
- [GitLab hosted Codesandbox](https://gitlab.com/gitlab-org/gitlab/-/issues/27144)
