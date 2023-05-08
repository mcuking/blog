> 文章首发于我的博客 https://github.com/mcuking/blog/issues/39

> 相关代码请查阅 https://github.com/mcuking/JSBridge

JSBridge 项目以 js 与 android 通信为例，讲解 JSBridge 实现原理，下面提到的方法在 iOS（UIWebview 或 WKWebview）均有对应方法。

## 1. native to js

两种 native 调用 js 方法，注意被调用的方法需要在 JS 全局上下文上

#### loadUrl

#### evaluateJavascript

### 1.1 loadUrl

```java
mWebview.loadUrl("javascript: func()");
```

### 1.2 evaluateJavascript

```java
mWebview.evaluateJavascript("javascript: func()", new ValueCallback<String>() {
    @Override
    public void onReceiveValue(String value) {
        return;
    }
});
```

#### 上述两种 native 调用 js 的方式对比如下表：

| 方式               | 优点                                  | 缺点                                      |
| ------------------ | ------------------------------------- | ----------------------------------------- |
| loadUrl            | 兼容性好                              | 1. 会刷新页面 2. 无法获取 js 方法执行结果 |
| evaluateJavascript | 1. 性能好 2. 可获取 js 执行后的返回值 | 仅在安卓 4.4 以上可用                     |

## 2. js to native

三种 js 调用 native 方法

#### 拦截 Url Schema（假请求）

#### 拦截 prompt alert confirm

#### 注入 JS 上下文

### 2.1 拦截 Url Schema

即由 h5 发出一条新的跳转请求，native 通过拦截 URL 获取 h5 传过来的数据。

跳转的目的地是一个非法不存在的 URL 地址，例如：

```js
"jsbridge://methodName?{"data": arg, "cbName": cbName}"
```

具体示例如下：

```js
"jsbridge://openScan?{"data": {"scanType": "qrCode"}, "cbName": "handleScanResult"}"
```

h5 和 native 约定一个通信协议，例如 jsbridge, 同时约定调用 native 的方法名 methodName 作为域名，以及后面带上调用该方法的参数 arg，和接收该方法执行结果的 js 方法名 cbName。

具体可以在 js 端封装相关方法，供业务端统一调用，代码如下：

```js
window.callbackId = 0;

function callNative(methodName, arg, cb) {
    const args = {
      data: arg === undefined ? null : JSON.stringify(arg),
    };

    if (typeof cb === 'function') {
      const cbName = 'CALLBACK' + window.callbackId++;
      window[cbName] = cb;
      args['cbName'] = cbName;
    }

    const url = 'jsbridge://' + methodName + '?' + JSON.stringify(args);

    ...
}
```

以上封装中较为巧妙的是将用于接收 native 执行结果的 js 回调方法 cb 挂载到 window 上，并为防止命名冲突，通过全局的 callbackId 来区分，然后将该回调函数在 window 上的名字放在参数中传给 native 端。native 拿到 cbName 后，执行完方法后，将执行结果通过 native 调用 js 的方式（上面提到的两种方法），调用 cb 传给 h5 端（例如将扫描结果传给 h5）。

至于如何在 h5 中发起请求，可以设置 window.location.href 或者创建一个新的 iframe 进行跳转。

```js
function callNative(methodName, arg, cb) {
    ...

    const url = 'jsbridge://' + method + '?' + JSON.stringify(args);

    // 通过 location.href 跳转
    window.location.href = url;

    // 通过创建新的 iframe 跳转
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = 0;
    iframe.style.height = 0;
    document.body.appendChild(iframe);

    window.setTimeout(function() {
        document.body.removeChild(iframe);
    }, 800);
}
```

native 会拦截 h5 发出的请求，当检测到协议为 jsbridge 而非普通的 http/https/file 等协议时，会拦截该请求，解析出 URL 中的 methodName、arg、 cbName，执行该方法并调用 js 回调函数。

下面以安卓为例，通过覆盖 WebViewClient 类的 shouldOverrideUrlLoading 方法进行拦截，android 端具体封装会在下面单独的板块进行说明。

```java
import android.util.Log;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class JSBridgeViewClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        JSBridge.call(view, url);
        return true;
    }
}
```

#### 拦截 URL Schema 的问题

- 连续发送时消息丢失

如下代码：

```js
window.location.href = "jsbridge://callNativeNslog?{"data": "111", "cbName": ""}";
window.location.href = "jsbridge://callNativeNslog?{"data": "222", "cbName": ""}";
```

js 此时的诉求是在同一个运行逻辑内，快速的连续发送出 2 个通信请求，用客户端本身 IDE 的 log，按顺序打印 111，222，那么实际结果是 222 的通信消息根本收不到，直接会被系统抛弃丢掉。

原因：因为 h5 的请求归根结底是一种模拟跳转，跳转这件事情上 webview 会有限制，当 h5 连续发送多条跳转的时候，webview 会直接过滤掉后发的跳转请求，因此第二个消息根本收不到，想要收到怎么办？js 里将第二条消息延时一下。

```js
//发第一条消息
location.href = "jsbridge://callNativeNslog?{"data": "111", "cbName": ""}";

//延时发送第二条消息
setTimeout(500,function(){
    location.href = "jsbridge://callNativeNslog?{"data": "222", "cbName": ""}";
});
```

但这并不能保证此时是否有其他地方通过这种方式进行请求，为系统解决此问题，js 端可以封装一层队列，所有 js 代码调用消息都先进入队列并不立刻发送，然后 h5 会周期性比如 500 毫秒，清空一次队列，保证在很快的时间内绝对不会连续发 2 次请求通信。

- URL 长度限制

如果需要传输的数据较长，例如方法参数很多时，由于 URL 长度限制，仍以丢失部分数据。

### 2.2 拦截 prompt alert confirm

即由 h5 发起 alert confirm prompt，native 通过拦截 prompt 等获取 h5 传过来的数据。

因为 alert confirm 比较常用，所以一般通过 prompt 进行通信。

约定的传输数据的组合方式以及 js 端封装方法的可以类似上面的 拦截 URL Schema 提到的方式。

```js
function callNative(methodName, arg, cb) {
    ...

    const url = 'jsbridge://' + method + '?' + JSON.stringify(args);

    prompt(url);
}
```

native 会拦截 h5 发出的 prompt，当检测到协议为 jsbridge 而非普通的 http/https/file 等协议时，会拦截该请求，解析出 URL 中的 methodName、arg、 cbName，执行该方法并调用 js 回调函数。

下面以安卓为例，通过覆盖 WebChromeClient 类的 onJsPrompt 方法进行拦截，android 端具体封装会在下面单独的板块进行说明。

```java
import android.webkit.JsPromptResult;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

public class JSBridgeChromeClient extends WebChromeClient {
    @Override
    public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result) {
        result.confirm(JSBridge.call(view, message));
        return true;
    }
}
```

这种方式没有太大缺点，也不存在连续发送时信息丢失。不过 iOS 的 UIWebView 不支持该方式（WKWebView 支持）。

### 2.3 注入 JS 上下文

即由 native 将实例对象通过 webview 提供的方法注入到 js 全局上下文，js 可以通过调用 native 的实例方法来进行通信。

具体有安卓 webview 的 addJavascriptInterface，iOS UIWebview 的 JSContext，iOS WKWebview 的 scriptMessageHandler。

下面以安卓 webview 的 addJavascriptInterface 为例进行讲解。

首先 native 端注入实例对象到 js 全局上下文，代码大致如下，具体封装会在下面的单独板块进行讲解：

```java
public class MainActivity extends AppCompatActivity {

    private WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mWebView = (WebView) findViewById(R.id.mWebView);

        ...

        // 将 NativeMethods 类下面的提供给 js 的方法转换成 hashMap
        JSBridge.register("JSBridge", NativeMethods.class);

        // 将 JSBridge 的实例对象注入到 js 全局上下文中，名字为 _jsbridge，该实例对象下有 call 方法
        mWebView.addJavascriptInterface(new JSBridge(mWebView), "_jsbridge");
    }
}

public class NativeMethods {
    // 用来供 js 调用的方法
    public static void methodName(WebView view, JSONObject arg, CallBack callBack) {
    }
}

public class JSBridge {
    private WebView mWebView;

    public JSBridge(WebView webView) {
        this.mWebView = webView;
    }


    private  static Map<String, HashMap<String, Method>> exposeMethods = new HashMap<>();

    // 静态方法，用于将传入的第二个参数的类下面用于提供给 javacript 的接口转成 Map，名字为第一个参数
    public static void register(String exposeName, Class<?> classz) {
        ...
    }

    // 实例方法，用于提供给 js 统一调用的方法
    @JavascriptInterface
    public String call(String methodName, String args) {
        ...
    }
}
```

然后 h5 端可以在 js 调用 window.\_jsbridge 实例下面的 call 方法，传入的数据组合方式可以类似上面两种方式。具体代码如下：

```js
window.callbackId = 0;

function callNative(method, arg, cb) {
  let args = {
    data: arg === undefined ? null : JSON.stringify(arg)
  };

  if (typeof cb === 'function') {
    const cbName = 'CALLBACK' + window.callbackId++;
    window[cbName] = cb;
    args['cbName'] = cbName;
  }

  if (window._jsbridge) {
    window._jsbridge.call(method, JSON.stringify(args));
  }
}
```

#### 注入 JS 上下文的问题

以安卓 webview 的 addJavascriptInterface 为例，在安卓 4.2 版本之前，js 可以利用 java 的反射 Reflection API，取得构造该实例对象的类的內部信息，并能直接操作该对象的内部属性及方法，这种方式会造成安全隐患，例如如果加载了外部网页，该网页的恶意 js 脚本可以获取手机的存储卡上的信息。

在安卓 4.2 版本后，可以通过在提供给 js 调用的 java 方法前加装饰器 @JavascriptInterface，来表明仅该方法可以被 js 调用。

#### 上述三种 js 调用 native 的方式对比如下表：

| 方式                      | 优点               | 缺点                                                    |
| ------------------------- | ------------------ | ------------------------------------------------------- |
| 拦截 Url Schema（假请求） | 无安全漏洞         | 1. 连续发送时消息丢失 2. Url 长度限制，传输数据大小受限 |
| 拦截 prompt alert confirm | 无安全漏洞         | iOS 的 UIWebView 不支持该方式                           |
| 注入 JS 上下文            | 官方提供，方便简捷 | 在安卓 4.2 以下有安全漏洞                               |

## 3. 安卓端 java 的封装

native 与 h5 交互部分的代码在上面已经提到了，这里主要是讲述 native 端如何封装暴露给 h5 的方法。

首先单独封装一个类 NativeMethods，将供 h5 调用的方法以公有且静态方法的形式写入。如下：

```java
public class NativeMethods {
    public static void showToast(WebView view, JSONObject arg, CallBack callBack) {
        ...
    }
}
```

接下来考虑如何在 NativeMethods 和 h5 之前建立一个桥梁，JSBridge 类因运而生。
JSBridge 类下主要有两个静态方法 register 和 call。其中 register 方法是用来将供 h5 调用的方法转化成 Map 形式，以便查询。而 call 方法主要是用接收 h5 端的调用，分解 h5 端传来的参数，查找并调用 Map 中的对应的 Native 方法。

#### JSBridge 类的静态方法 register

首先在 JSBridge 类下声明一个静态属性 exposeMethods，数据类型为 HashMap 。然后声明静态方法 register，参数有字符串 exposeName 和类 classz，将 exposeName 和 classz 的所有静态方法 组合成一个 map，例如：

```java
{
    jsbridge: {
        showToast: ...
        openScan: ...
    }
}
```

代码如下：

```java
private  static Map<String, HashMap<String, Method>> exposeMethods = new HashMap<>();

public static void register(String exposeName, Class<?> classz) {
    if (!exposeMethods.containsKey(exposeName)) {
        exposeMethods.put(exposeName, getAllMethod(classz));
    }
}
```

由上可知我们需要定义一个 getAllMethod 方法用来将类里的方法转化为 HashMap 数据格式。在该方法里同样声明一个 HashMap，并将满足条件的方法转化成 Map，key 为方法名，value 为方法。

其中条件为 公有 public 静态 static 方法且第一个参数为 Webview 类的实例，第二个参数为 JSONObject 类的实例，第三个参数为 CallBack 类的实例。 (CallBack 是自定义的类，后面会讲到)
代码如下：

```java
private static HashMap<String, Method> getAllMethod(Class injectedCls) {
    HashMap<String, Method> methodHashMap = new HashMap<>();

    Method[] methods = injectedCls.getDeclaredMethods();

    for (Method method: methods) {
        if(method.getModifiers()!=(Modifier.PUBLIC | Modifier.STATIC) || method.getName()==null) {
            continue;
        }
        Class[] parameters = method.getParameterTypes();
        if (parameters!=null && parameters.length==3) {
            if (parameters[0] == WebView.class && parameters[1] == JSONObject.class && parameters[2] == CallBack.class) {
                methodHashMap.put(method.getName(), method);
            }
        }
    }

    return methodHashMap;
}
```

#### JSBridge 类的静态方法 call

由于注入 JS 上下文和两外两种，h5 端传过来的参数形式不同，所以处理参数的方式略有不同。
下面以拦截 Prompt 的方式为例进行讲解，在该方式中 call 接收的第一个参数为 webView，第二个参数是 arg，即 h5 端传过来的参数。还记得拦截 Prompt 方式时 native 端和 h5 端约定的传输数据的方式么？

```js
"jsbridge://openScan?{"data": {"scanType": "qrCode"}, "cbName":"handleScanResult"}"
```

call 方法首先会判断字符串是否以 jsbridge 开头（native 端和 h5 端之间约定的传输数据的协议名），然后该字符串转成 Uri 格式，然后获取其中的 host 名，即方法名，获取 query，即方法参数和 js 回调函数名组合的对象。最后查找 exposeMethods 的映射，找到对应的方法并执行该方法。

```java
public static String call(WebView webView, String urlString) {

    if (!urlString.equals("") && urlString!=null && urlString.startsWith("jsbridge")) {
        Uri uri = Uri.parse(urlString);

        String methodName = uri.getHost();

        try {
            JSONObject args = new JSONObject(uri.getQuery());
            JSONObject arg = new JSONObject(args.getString("data"));
            String cbName = args.getString("cbName");


            if (exposeMethods.containsKey("JSBridge")) {
                HashMap<String, Method> methodHashMap = exposeMethods.get("JSBridge");

                if (methodHashMap!=null && methodHashMap.size()!=0 && methodHashMap.containsKey(methodName)) {
                    Method method = methodHashMap.get(methodName);

                    if (method!=null) {
                        method.invoke(null, webView, arg, new CallBack(webView, cbName));
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

    }
    return null;
}
```

#### CallBack 类

js 调用 native 方法成功后，native 有必要返回给 js 一些反馈，例如接口是否调用成功，或者 native 执行后的得到的数据（例如扫码）。所以 native 需要执行 js 回调函数。

执行 js 回调函数方式本质是 native 调用 h5 的 js 方法，方式仍旧是上面提到的两种方式 evaluateJavascript 和 loadUrl。简单来说可以直接将 js 的回调函数名传给对应的 native 方法，native 执行通过 evaluateJavascript 调用。

但为了统一封装调用回调的方式，我们可以定义一个 CallBack 类，在其中定义一个名为 apply 的静态方法，该方法直接调用 js 回调。

注意：native 执行 js 方法需要在主线程上。

```java
public class CallBack {
    private  String cbName;
    private WebView mWebView;

    public CallBack(WebView webView, String cbName) {
        this.cbName = cbName;
        this.mWebView = webView;
    }

    public void apply(JSONObject jsonObject) {
        if (mWebView!=null) {
            mWebView.post(() -> {
                mWebView.evaluateJavascript("javascript:" + cbName + "(" + jsonObject.toString() + ")", new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        return;
                    }
                });
            });
        }
    }
}
```

到此为止 JSBridge 的大致原理都讲完了。但功能仍可再加完善，例如：

native 执行 js 方法时，可接受 js 方法中异步返回的数据，比如在 js 方法中请求某个接口在返回数据。直接调用 webview 提供的 evaluateJavascript，在第二个参数的类 ValueCallback 的实例方法 onReceiveValue 并不能接收到 js 异步返回的数据。

后面有空 native 调用 js 方式会继续完善的，最后以一句古语互勉：

路漫漫其修远兮 吾将上下而求索
