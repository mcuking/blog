> 文章首发于我的博客 https://github.com/mcuking/blog/issues/67

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/http-concept-demo

本文主要是通过代码演示 Http 的相关的概念 connection, cookie, http2, cors 等。

### 如何运行 demo

环境要求：全局安装 node，版本需要 8 以上，例如运行 cors

```javascript
// 下载本项目到本地
cd http-concept-demo/cors
node server.js
node server2.js
```

建议安装 nodemon 用来运行 js 文件，因为支持热更新

## HTTP Concept

### HTTP/2

[`代码演示`](https://github.com/mcuking/blog/blob/master/http-concept-demo/http2/index.html)

**优势：**

- 头部压缩

通过规定头部字段的静态表格和实际传输过程中动态创建的表格，减少多个相似请求里面大量冗余的 HTTP 头部字段，并且引入了霍夫曼编码减少字符串常量的长度。

- 多路复用

HTTP/1.1 为了提高并发性，得通过提高连接数，即同时多发几个请求，因为一个连接只能发一个请求，所以需要多建立几个 TCP 连接；
HTTP/2 里，一个域只需要建立一次 TCP 连接就可以传输多个资源。多个数据流/信号通过一条信道进行传输，充分地利用高速信道。

- 分帧传输

HTTP/2 把每一个资源的传输叫做流 Stream，每个流都有它的唯一编号 stream id，一个流又可能被拆成多个帧 Frame，每个帧按照顺序发送，TCP 报文的编号可以保证后发送的帧的顺序比先发送的大。在 HTTP/1.1 里面同一个资源顺序是依次连续增大的，因为只有一个资源，而在 HTTP/2 里面它很可能是离散变大的，中间会插着发送其它流的帧，但只要保证每个流按顺序拼接就好了。

- Server Push

解决传统 HTTP 传输中资源加载触发延迟的问题，浏览器在创建第一个流的时候，服务告诉浏览器哪些资源可以先加载了，浏览器提前进行加载而不用等到解析到的时候再加载。

### Connection

[`Connection`](https://github.com/mcuking/blog/blob/master/http-concept-demo/connection/index.html)

Chrome 允许同时最多创建 6 个 tcp 连接
当 Connection 设置 keep-alive 时，同时发起的 http 请求数大于 6 时，多出来的 http 请求会复用之前创建的 tcp 连接
可查看 Network 的 Connection ID 来验证是否复用

当 Connection 设置 close 时，每次 http 请求会创建一个 tcp 连接，当 http 请求完成时，tcp 连接会关闭。
下次 http 请求需重新创建 tcp 连接，不会复用之前的 tcp 连接，导致一定性能开销（例如 tcp 的三次握手等）

**注：**
在 http/2 里，一个 tcp 连接可以同时发送多个 http 请求。在 http/1.1 以及之前的版本，一个 tcp 连接只能同时发送 一个 http 请求。

### Cookie

[`Cookie`](https://github.com/mcuking/blog/blob/master/http-concept-demo/cookie/index.html)

Cookie 属性：

- max-age 过期时间段
- expires 过期时间点
- Secure 只有在 https 时发送
- HttpOnly 禁止 javascript 访问，无法通过 document.cookie 获取 cookie

在同一个主域名下，所有的二级域名均可共享主域名的 cookie

注意：
Session 是在服务端保存的一个数据结构，用来跟踪用户的状态，这个数据可以保存在集群、数据库、文件中；
Cookie 是客户端保存用户信息的一种机制，用来记录用户的一些信息，也是实现 Session 的一种方式。

### CSP

[`CSP`](https://github.com/mcuking/blog/blob/master/http-concept-demo/csp/index.html)

内容安全策略 Content-Security-Policy

#### 限制的方面

default-src 限制所有引用文件路径（包括饮用的 img script style 等）
connect-src 发送请求的路径
img-src
script-src
style-src
font-src
frame-src
media-src
manifest-src

form-action 表单提交的路径

#### 限制的选项

http http 的路径
https https 的路径
self 同域的路径
某个域 该域的路径

**注：**
Content-Security-Policy 和 Content-Security-Policy-Report-Only 区别：
Content-Security-Policy-Report-Only 只会向后抬发送报告，并不会强制执行限制。

更多内容请看
[CSP](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CSP)
...

### Redirect

[`Redirect`](./redirect/index.html)

对应 http 状态码
301 永久重定向 指定浏览器下次再次访问时，直接在浏览器端重定向，不需要向服务器请求
302 临时重定向 浏览器下次再次访问时，仍需向服务器请求

### Cors

[`Cors`](https://github.com/mcuking/blog/blob/master/http-concept-demo/cors/index.html)

跨域资源共享 Cross-origin resource sharing

1.  请求方法是以下三种方法之一：

- HEAD
- GET
- POST

2.  HTTP 的头信息不超出以下几种字段：

- Accept
- Accept-Language
- Content-Language
- Last-Event-ID
- Content-Type：只限于三个值 application/x-www-form-urlencoded、multipart/form-data、text/plain

满足以上条件为简单请求，否则为非简单请求。
非简单请求发送前，需要发送预检（Option）请求

相关返回头部字段：

- Access-Control-Allow-Origin 允许的请求来自的域
- Access-Control-Allow-Methods 允许的请求方法
- Access-Control-Allow-Headers 允许的头部字段
- Access-Control-Max-Age 预检请求成功后多长时间内再次发送非简单请求不用进行预检

### Expires

[`Expires`](https://github.com/mcuking/blog/blob/master/http-concept-demo/expires/index.html)

强制缓存中的 Expires

设定某个时间/日期，在这个时间/日期之前，HTTP 缓存被认为是有效的。
如果同时设置了 Cache-Control 响应首部字段的 max-age，则 Expires 会被忽略。

HTTP/1.1 之前版本遗留的通用首部字段，仅作为于 HTTP/1.0 的向后兼容而使用。

### Cache-Control

[`Cache-Control`](https://github.com/mcuking/blog/blob/master/http-concept-demo/cache-control/index.html)

强制缓存中的 Cache-Control

HTTP/1.1 控制浏览器缓存的主流的通用首部字段。

设定一个时间段，在这个时间段内 HTTP 缓存被认为是有效的。以下是设置的属性。

1. 可缓存性

- public 浏览器/proxy 服务器等均可缓存
- private 只有发起请求的浏览器才可以进行缓存
- no-cache 可以缓存，但在使用缓存时需向服务器确认是否可以使用缓存
- no-store 浏览器/proxy 服务器均不可以进行缓存

2. 到期

- max-age=<seconds> 浏览器缓存有效期
- s-maxage=<seconds> 代理服务器缓存有效期

3. 重新认证

- must-revalidate 浏览器使用缓存时需向服务器确认是否可以使用缓存
- proxy-revalidate proxy 服务器使用缓存时需向服务器确认是否可以使用缓存

4. 其他

- no-transform proxy 服务器不能改动数据

### Last-Modified

[`Last-Modified`](https://github.com/mcuking/blog/blob/master/http-concept-demo/last-modified/index.html)

协商缓存中的 Last-Modified

If-Modified-Since 是一个请求首部字段，并且只能用在 GET 或者 HEAD 请求中。Last-Modified 是一个响应首部字段，包含服务器认定的资源作出修改的日期及时间。当带着 If-Modified-Since 头访问服务器请求资源时，服务器会检查 Last-Modified，如果 Last-Modified 的时间早于或等于 If-Modified-Since 则会返回一个不带主体的 304 响应，否则将重新返回资源。

### Etag

[`Etag`](https://github.com/mcuking/blog/blob/master/http-concept-demo/etag/index.html)

协商缓存中的 Etag

ETag 是一个响应首部字段，它是根据实体内容生成的一段 hash 字符串，标识资源的状态，由服务端产生。If-None-Match 是一个条件式的请求首部。如果请求资源时在请求首部加上这个字段，值为之前服务器端返回的资源上的 ETag，则当且仅当服务器上没有任何资源的 ETag 属性值与这个首部中列出的时候，服务器才会返回带有所请求资源实体的 200 响应，否则服务器会返回不带实体的 304 响应。ETag 优先级比 Last-Modified 高，同时存在时会以 ETag 为准。

### nginx-cache

[`nginx-cache`](https://github.com/mcuking/blog/blob/master/http-concept-demo/nginx-cache/index.html)

代理服务器缓存 nginx-cache

**代理服务器设置：**

```
proxy_cache_path  /home/nginx/proxy_cache/cache levels=1:2 keys_zone=proxycache:60m max_size=120m inactive=2h use_temp_path=on;
proxy_temp_path    /home/nginx/proxy_cache/temp;
proxy_cache_key    $host$request_uri;
```

/home/nginx/proxy_cache/cache：定义 proxy_cache 生成文件的根路径

- levels：默认所有缓存文件都放在上面指定的根路径中，从而可能影响缓存的性能。推荐指定为 2 级目录来存储缓存文件
- key_zone：这个的值是字符串，可以随意写。用于在共享内存中定义一块存储区域来存放缓存的 key 和 metadata（类似于使用次数），这样 nginx 可以快速判断一个 request 是否命中缓存。1m 可以存储 8000 个 key
- max_size：最大 cache 空间。如果不指定，会使用掉所有 disk space。当达到 disk 上限后，会删除最少使用的 cache
- inactive：内存中缓存的过期检查周期。示例配置中如果 2h 内都没有被访问，则不论状态是否为 expired，都会清除缓存。需要注意的是，inactive 和 expired 配置项的含义是不同的，expired 只是判断过期时间，不会删除缓存；而 inactive 是直接删除过期缓存
- use_temp_path：如果为 off，则 nginx 会将缓存文件直接写入指定的 cache 文件中，而不使用 temp_path 指定的临时存储路径

proxy_temp_path

- /home/nginx/proxy_cache/temp：定义 proxy_cache 生成临时文件的根路径。此项在 use_temp_path=off 时不需填写

proxy_cache_key

- $host$request_uri：定义 proxy_cache 生成文件的名称。值可以为 Nginx 支持的变量和字符串

**response 头部字段设置：**

Cache_Control: s-maxage=[seconds]
其中参数含义：
s-maxage 代理服务器缓存有效期
private 只有浏览器才能缓存
public 浏览器和代理服务器均可缓存

| 缓存机制      | 优点                                                                                                                     | 缺点                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expires       | 1.HTTP 1.0 产物，可以在 HTTP 1.0 和 1.1 中使用，简单易用。 2. 以时刻标识失效时间。                                       | 1.时间是由服务器发送的(UTC)，如果服务器时间和客户端时间存在不一致，可能会出现问题。 2. 存在版本问题，到期之前的修改客户端是不可知的。                                                                                              |
| Cache-Control | 1. HTTP 1.1 产物，以时间间隔标识失效时间，解决了 Expires 服务器和客户端相对时间的问题。 2. 比 Expires 多了很多选项设置。 | 1. HTTP 1.1 才有的内容，不适用于 HTTP 1.0 。 2. 存在版本问题，到期之前的修改客户端是不可知的。                                                                                                                                     |
| Last-Modified | 1. 不存在版本问题，每次请求都会去服务器进行校验。服务器对比最后修改时间如果相同则返回 304，不同返回 200 以及资源内容。   | 1.只要资源修改，无论内容是否发生实质性的变化，都会将该资源返回客户端。例如周期性重写，这种情况下该资源包含的数据实际上一样的。2. 以时刻作为标识，无法识别一秒内进行多次修改的情况。3. 某些服务器不能精确的得到文件的最后修改时间。 |
| Etag          | 1. 可以更加精确的判断资源是否被修改，可以识别一秒内多次修改的情况。2. 不存在版本问题，每次请求都回去服务器进行校验。     | 1. 计算 ETag 值需要性能损耗。2. 分布式服务器存储的情况下，计算 ETag 的算法如果不一样，会导致浏览器从一台服务器上获得页面内容后到另外一台服务器上进行验证时发现 ETag 不匹配的情况。                                                 |
