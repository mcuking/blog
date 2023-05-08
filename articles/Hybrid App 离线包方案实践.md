> 文章首发于我的博客 https://github.com/mcuking/blog/issues/63

## 背景

在 H5 + Native 的混合开发模式中，让人诟病最多的恐怕就是加载 H5 页面过程中的白屏问题了。下面这张图描述了从 WebView 初始化到 H5 页面最终渲染的整个过程。

![渲染过程](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/14766953297/eea3/10d4/7306/782b4b7d53c496e29b37f54502b433fd.png)

其中目前主流的优化方式主要包括：

1. 针对 WebView 初始化：该过程大致需耗费 70~700ms。当客户端刚启动时，可以先提前初始化一个全局的 WebView 待用并隐藏。当用户访问了 WebView 时，直接使用这个 WebView 加载对应网页并展示。

2. 针对向后端发送接口请求：在客户端初始化 WebView 的同时，直接由 Native 开始网络请求数据，当页面初始化完成后，向 Native 获取其代理请求的数据。

3. 针对加载的 js 动态拼接 html（单页面应用）：可采用多页面打包， 服务端渲染，以及构建时预渲染等方式。

4. 针对加载页面资源的大小：可采用懒加载等方式，将需要较大资源的部分分离出来，等整体页面渲染完成后再异步请求分离出来的资源，以提升整体页面加载速度。

当然还有很多其它方面的优化，这里就不再赘述了。本文重点讲的是，在与静态资源服务器建立连接，然后接收前端静态资源的过程。由于这个过程过于依赖用户当前所处的网络环境，因此也成了最不可控因素。当用户处于弱网时，页面加载速度可能会达到 4 到 5 s 甚至更久，严重影响用户体验。而离线包方案就是解决该问题的一个比较成熟的方案。

## 技术方案

首先阐述下大概思路：

我们可以先将页面需要的静态资源打包并预先加载到客户端的安装包中，当用户安装时，再将资源解压到本地存储中，当 WebView 加载某个 H5 页面时，拦截发出的所有 http 请求，查看请求的资源是否在本地存在，如果存在则直接返回资源。

下面是整体技术方案图，其中 CI/CD 我默认使用 Jenkins，当然也可以采用其它方式。

![原理图](https://p6.music.126.net/obj/wonDlsKUwrLClGjCm8Kx/14766952436/c4de/799f/98c0/8f1c8dadf7fe35a588df37aa11f3d70f.png)

### 前端部分

相关代码：

**离线包打包插件**：https://github.com/mcuking/offline-package-webpack-plugin

**应用插件的前端项目**：https://github.com/mcuking/mobile-web-best-practice

首先需要在前端打包的过程中同时生成离线包，我的思路是 webpack 插件在 emit 钩子时（生成资源并输出到目录之前），通过 compilation 对象（代表了一次单一的版本构建和生成资源）遍历读取 webpack 打包生成的资源，然后将每个资源（可通过文件类型限定遍历范围）的信息记录在一个资源映射的 json 里，具体内容如下：

资源映射 json 示例

```
{
  "packageId": "mwbp",
  "version": 1,
  "items": [
    {
      "packageId": "mwbp",
      "version": 1,
      "remoteUrl": "http://122.51.132.117/js/app.67073d65.js",
      "path": "js/app.67073d65.js",
      "mimeType": "application/javascript"
    },
    ...
  ]
}
```

其中 remoteUrl 是该资源在静态资源服务器的地址，path 则是在客户端本地的相对路径（通过拦截该资源对应的服务端请求，并根据相对路径从本地命中相关资源然后返回）。

最后将该资源映射的 json 文件和需要本地化的静态资源打包成 zip 包，以供后面的流程使用。

### 离线包管理平台

相关代码：

**离线包管理平台前后端**：https://github.com/mcuking/offline-package-admin

**文件差分工具**：https://github.com/Exoway/bsdiff-nodejs

从上面有关离线包的阐述中，有心者不难看出其中有个遗漏的问题，那就是当前端的静态资源更新后，客户端中的离线包资源如何更新？难不成要重新发一个安装包吗？那岂不是摒弃了 H5 动态化的特点了么？

而离线包平台就是为了解决这个问题。下面我以 [mobile-web-best-practice](https://github.com/mcuking/mobile-web-best-practice) 这个前端项目为例讲解整个过程：

[mobile-web-best-practice](https://github.com/mcuking/mobile-web-best-practice) 项目对应的离线包名为 main，第一个版本可以如上文所述先预置到客户端安装包里，同时将该离线包上传到离线包管理平台中，该平台除了保存离线包文件和相关信息之外，还会生成一个名为 packageIndex 的 json 文件，即记录所有相关离线包信息集合的文件，该文件主要是提供给客户端下载的。大致内容如下：

```
{
  "data": [
    {
      "module_name": "main",
      "version": 2,
      "status": 1,
      "origin_file_path": "/download/main/07eb239072934103ca64a9692fb20f83",
      "origin_file_md5": "ec624b2395a479020d02262eee36efe4",
      "patch_file_path": "/download/main/b4b8e0616e75c0cc6f34efde20fb6f36",
      "patch_file_md5": "6863cdacc8ed9550e8011d2b6fffdaba"
    }
  ],
  "errorCode": 0
}
```

其中 data 中就是所有相关离线包的信息集合，包括了离线包的版本、状态、以及文件的 url 地址和 md5 值等。

当 [mobile-web-best-practice](https://github.com/mcuking/mobile-web-best-practice) 更新后，会通过 [offline-package-webpack-plugin](https://github.com/mcuking/offline-package-webpack-plugin) 插件打包出一个新的离线包。这个时候我们就可以将这个离线包上传到管理平台，此时 packageIndex 中离线包 main 的版本就会更新成 2。

当客户端启动并请求最新的 packageIndex 文件时，发现离线包 main 的版本比本地对应离线包的版本大时，会从离线包平台下载最新的版本，并以此作为查询本地静态资源文件的资源池。

讲到这里读者可能还会有一个疑问，那就是如果前端仅仅是改动了某一处，客户端仍旧需要下载完整的新包，岂不是很浪费流量同时也延长了文件下载的时间？

针对这个问题我们可以使用一个文件差分工具 - [bsdiff-nodejs](https://github.com/Exoway/bsdiff-nodejs)，该 node 工具调用了 c 语言实现的 bsdiff 算法（基于二进制进行文件比对算出 diff/patch 包）。当上传版本为 2 的离线包到管理平台时，平台会与之前保存的版本为 1 的离线包进行 diff ，算出 1 到 2 的差分包。而客户端仅仅需要下载差分包，然后同样使用基于 bsdiff 算法的工具，和本地版本 1 的离线包进行 patch 生成版本 2 的离线包。

到此离线包管理平台大致原理就讲完了，但仍有待完善的地方，例如：

1. 增加日志功能

2. 增加离线包达到率的统计功能

...

### 客户端

相关项目：

**集成离线包库的安卓项目**：https://github.com/mcuking/mobile-web-best-practice-container

客户端的离线包库目前仅开发了 android 平台，该库是在
[webpackagekit](https://github.com/yangjianjun198/webpackagekit)（个人开发的安卓离线包库）基础上进行的二次开发，主要实现了一个多版本文件资源管理器，可以支持多个前端离线包预置到客户端中。其中拦截请求的源码如下：

```java
public class OfflineWebViewClient extends WebViewClient {
    @TargetApi(Build.VERSION_CODES.LOLLIPOP)
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        final String url = request.getUrl().toString();
        WebResourceResponse resourceResponse = getWebResourceResponse(url);
        if (resourceResponse == null) {
            return super.shouldInterceptRequest(view, request);
        }
        return resourceResponse;
    }

    /**
     * 从本地命中并返回资源
     * @param url 资源地址
     */
    private WebResourceResponse getWebResourceResponse(String url) {
        try {
            WebResourceResponse resourceResponse = PackageManager.getInstance().getResource(url);
            return resourceResponse;
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}
```

通过对 WebviewClient 类的 shouldInterceptRequest 方法的复写来拦截 http 请求，并从本地查找是否有相应的前端静态资源，如果有则直接返回。

## 部分问题解答

#### 1. 离线包是否可以自动更新？

当前端资源通过 CI 机自动打包后部署到静态资源服务器，那么又如何上传到离线包平台呢？我曾经考虑过当前端资源打包好时，通过接口自动上传到离线包平台。但后来发现可行性不高，因为我们的前端资源是需要经过测试阶段后，通过运维手动修改 docker 版本来更新前端资源。如果自动上传，则会出现离线包平台已经上传了了未经验证的前端资源，而静态资源服务器却没有更新的情况。因此仍需要手动上传离线包。当然读者可以根据实际情况选择合适的上传方式。

#### 2. 多 App 情况下如何区分离线包属于哪个 App？

在上传的离线包填写信息的时候，增加了 appName 字段。当请求离线包列表 json 文件时，在 query 中添加 appName 字段，离线包平台会只返回属于该 App 的离线包列表。

#### 3. 一定要在 App 启动的时候下载离线包吗？

当然可以做的更丰富些，比如可以选择在客户端连接到 Wi-Fi 的时候，或者从后台切换到前台并超过 10 分钟时候。该设置项可以放在离线包平台中进行配置，可以做成全局有效的设置或者针对不同的离线包进行个性化设置。

#### 4. 如果客户端离线包还没有下载完成，而静态资源服务器已经部署了最新的版本，那么是否会出现客户端展示的页面仍然是旧的版本呢？如果这次改动的是接口请求的变动，那岂不是还会引起接口报错？

这个大可不必担心，上面的代码中如果 http 请求没有命中任何前端资源，则会放过该请求，让它去请求远端的服务器。因此即使本地离线包资源没有及时更新，仍然可以保证页面的静态资源是最新的。也就是说有一个兜底的方案，出了问题大不了回到原来的请求服务器的加载模式。

#### 5. 如果客户端离线包版本为 1，而离线包平台的对应的离线包最新版本为 4，即版本相差大于 1 时，也是通过下载差分包然后本地进行 patch 合并吗？

笔者开发的离线包平台目前仅对相邻版本进行了差分，所以如果客户端本地离线包版本和离线包平台最新版本不相邻，会下载最新版本的全量包。当然，各位可以根据需要，可以将上传的离线包和过去 3 个版本或者更多版本进行差分，这样客户端可以选择下载对应版本的差分包即可，例如下载 1->3 的差分包。

#### 6. 如果离线包除了离线 js、css 等资源，还离线 html，会有什么问题么？

这里笔者举个例子方便阐述，假设客户端请求线上离线包版本的时机是在 app 启动时和定时每两个小时请求一次。当 app 刚刚请求线上离线包版本完没多久，线上的前端页面资源更新了，同时线上离线包也会更新。这个时候用户访问页面时，客户端并不知道线上资源已经更新，所以仍旧会拦截 html 资源请求，并从本地离线包中查找。由于 html 文件名中没有 hash，即使页面更新内容变化，文件名称仍然不变，所以还是可以从本地离线包中找到对应的 html 文件并返回，虽然这个 html 文件相对于线上已经是较旧的文件了。而旧的 html 中引用的 js/css 等资源也会是旧的资源，由此便导致用户看到的页面始终是旧的。只有等到 app 重新启动或者等待将近两个小时后，客户端重新请求线上离线包版本后，才能更新到最新的页面。

对此主要问题根源在于，客户端并不知道线上资源的更新时机，只能通过定时轮询。如果服务端主动通知客户端，例如通过推送方式，当线上离线包一更新，便通知客户端请求最新版本离线包，就可以保证尽量的及时更新。（当然下载离线包也会需要一些时间）

讲到这里读者可以思考一个问题，前端的页面更新是否及时真的是非常重要的事情么？这里涉及到用户打开页面的体验和页面及时更新两者的取舍问题，可以类比下原生 app，原生 app 一般只有用户同意更新之后才会下载更新，很多用户使用的版本可能并不是最新的。所以笔者认为，只要能够做好后端接口的兼容性，不至于出现页面不更新的话，请求的线上接口参数变更甚者被废除，导致页面报错这种情况，页面的无法及时更新还是可以容忍的。

况且一般用户使用 app 的时间不会太长，当下一次再打开的时候客户端就会下载最新的离线包了。笔者所在公司也有这样的问题，但并没有影响到用户的实际使用。所以还是建议离线 html 文件，以彻底提升页面的打开速度。

#### 7. iOS 端 wkWebview 没有 API 支持直接拦截网页的请求，该如何实现离线包方案呢？

笔者询问了下云音乐的 iOS 端离线包方案，是通过私有 API -- `registerSchemeForCustomProtocol` 注册了 http(s) scheme，进而可以获取到所有的 http(s) 请求，更多信息可参考下面这篇文章：

http://nanhuacoder.top/2019/04/11/iOS-WKWebView02/

文中提到因为WKWebView 在独立于主进程 NSURLProtocol 进程 Network Process 里执行网络请求，正常情况 NSURLProtocol 进程是无法拦截到 webview 中网页发起的请求的。（注：UIWebView 发出的 request，NSURLProtocol 是可以拦截到的）

如果通过 registerSchemeForCustomProtocol 注册了 http(s) scheme, 那么由 WKWebView 发起的所有 http(s)请求都会通过 IPC 从 网络进程 Network Process 传给主进程 NSURLProtocol 处理，就可以拦截所有的网络请求了。

但是进程之间的通信使用了 MessageQueue，网络进程 Network Process 会将请求 encode 成一个 Message，然后通过 IPC（进程间通信） 发送给 主进程 NSURLProtocol。出于性能的原因，encode 的时候 将 HTTPBody 和 HTTPBodyStream 这两个字段丢弃掉。

文中提到里一个解决办法，如下所示：

![image.png](https://i.loli.net/2020/09/23/GKY2lI4pmNX1fTM.png)

但是还是会遇到一个问题，那就是 http 的 header 本身的大小会有限制，导致例如上传图片等场景会失败。笔者这里提一个可以走通的方式：

在初始化 wkWebview 的时候，注入并执行一段 js，这段 js 主要逻辑是复写挂载在全局上的 XMLHttpRequest 原型上的 open 和 send 方法。

在 open 方法里基于时间戳生成一串字符串 identifier，挂载到 XMLHttpRequest 的实例对象上，同时添加到第二个参数 Url 上，然后再执行原有的 open 方法。

至于 send 方法，主要是拿到 http 请求的 body，以及 open 方法中挂载到实例对象的 identifier 属性，组合成一个对象并调用原生方法保存到客户端的存储中。

当在主进程 NSURLProtocol 中拦截到 XHR 请求时，先从请求的 Url 获取到 identifier，然后根据 identifier 从客户端的存储中找到之前保存的 body。这样就解决了 body 丢失的问题。

当然如果项目中用到了浏览器原生提供的 fetch 方法的话，记得也要将 fetch 方法复写下哦。

## 结束语

至此整个方案的大致原理已经阐述完了，更多细节问题读者可以参考文中提供的项目链接，所有端的代码都已经托管到了我的 github 上了。

这也算完成了我一个夙愿：实现一套离线包方案并且完全开源出来。最后希望对大家有所帮助～
