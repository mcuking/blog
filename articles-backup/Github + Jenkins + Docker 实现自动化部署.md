> 文章首发于我的博客 https://github.com/mcuking/blog/issues/61

[Jenkins](https://jenkins.io/zh/)

[Docker](https://www.docker.com/)

Jenkins 和 Docker 相关官网如上，具体用途就不再这里赘述了，如果想了解相关知识，也可以阅读本文结尾处推荐的几篇文章。

笔者以 CentOS 7.6 系统为基础，介绍如何使用 Github + Jenkins + Docker 实现项目的自动化打包部署。

### Docker 安装

**1.安装 Docker 并启动 Docker**

```
// 更新软件库
yum update -y

// 安装 docker
yum install docker -y

// 启动 docker 服务
service docker start

// 重启docker 服务
service docker restart

// 停止 docker 服务
service docker stop
```

**2.安装 Docker-Compose 插件用于编排镜像**

```
// 下载并安装 docker-compose (当前最新版本为 1.24.1，读者可以根据实际情况修改最新版本)
curl -L https://github.com/docker/compose/releases/download/1.24.1/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose

// 设置权限
chmod +x /usr/local/bin/docker-compose

// 安装完查看版本
docker-compose -version
```

### Jenkins 安装和配置

**1.搜索 Jenkins**

```
docker search jenkins
```

![image](https://user-images.githubusercontent.com/22924912/68565589-f6c20900-048e-11ea-97b8-968542236015.png)

**注意**：虽然上图中第一个是 Docker 官方维护的版本，但它很长时间没有更新了，是一个过时的版本。所以这里我们要安装第二个，这个是 Jenkins 官方维护的。

**2.安装 Jenkins**

```
sudo docker run -d -u 0 --privileged --name jenkins -p 49003:8080 -v /root/jenkins_home:/var/jenkins_home jenkins/jenkins:latest
```

其中:
-d 指的是在后台运行；
-u 0 指的是传入 root 账号 ID，覆盖容器中内置的账号；
-v /root/jenkins_home:/var/jenkins_home 指的是将 docker 容器内的目录 /var/jenkins_home 映射到宿主机 /root/jenkins_home 目录上；
--name jenkins 指的是将 docker 容器内的目录 /var/jenkins_home 映射到宿主机 /root/jenkins_home 目录上；
-p 49003:8080 指的是将容器的 8080 端口映射到宿主机的 49003 端口；
--privileged 指的是赋予最高权限。

整条命令的意思就是：
运行一个镜像为 jenkins/jenkins:latest 的容器，命名为 jenkins_home，使用 root 账号覆盖容器中的账号，赋予最高权限，将容器的 /var/jenkins_home 映射到宿主机的 /root/jenkins_home 目录下，映射容器中 8080 端口到宿主机 49003 端口

执行完成后，等待几十秒，等待 Jenkins 容器启动初始化。到浏览器中输入 `http://your ip:49003` 查看 Jenkins 是否启动成功

看到如下界面说明启动成功：

![image](https://user-images.githubusercontent.com/22924912/68573362-8a510500-04a2-11ea-9f42-1f8a85812788.png)

通过如下命令获取密码，复制到上图输入框中

```
cat /root/jenkins_home/secrets/initialAdminPassword
```

进入到下个页面，选择【安装推荐的插件】。

由于墙的问题，需要修改 Jenkins 的默认下载地址。可以在浏览器另起一个 tab 页面，进入 `http://your ip:49003/pluginManager/advanced`，修改最下面的升级站点 URL 为 `http://mirror.esuni.jp/jenkins/updates/update-center.json`

![image](https://user-images.githubusercontent.com/22924912/68567715-aa79c780-0494-11ea-9b03-4311bd083470.png)

然后重启容器，再次进入初始化页面，通常下载速度会加快。

```
docker restart [docker container id]
```

然后就是创建管理员账号。

进入首页后，因为自动化部署中需要通过 ssh 登陆服务器执行命令以及 node 环境，所以需要下载 Publish Over SSH 和 NodeJS 插件，可通过系统管理 -> 管理插件 -> 可选插件进入，搜索选中并直接安装。如下图所示：

![image](https://user-images.githubusercontent.com/22924912/68568520-c41c0e80-0496-11ea-9f18-6e3d62687ee1.png)

需要注意的是，Publish Over SSH 需要配置相关 ssh 服务器，通过系统管理 -> 系统设置 进入并拉到最下面，输入 Name、Hostname、Username、Passphrase / Password 等参数。如下图所示：

![image](https://user-images.githubusercontent.com/22924912/68636791-af438780-0537-11ea-9ab8-2130d6affd8a.png)

然后点击 Test Configuration 校验能否登陆。

至此 Jenkins 已经完成了全局配置。

### 关联 Jenkins 和 Github

在 GitHub 创建一个项目，以本项目为例，在项目根目录下创建 nginx.conf 和 docker-compose.yml 文件

nginx.conf

```nginx
#user nobody;
worker_processes 1;
events {
  worker_connections 1024;
}
http {
  include    mime.types;
  default_type application/octet-stream;
  sendfile    on;
  #tcp_nopush   on;
  #keepalive_timeout 0;
  keepalive_timeout 65;
  #用于对前端资源进行 gzip 压缩
  #gzip on;
  gzip on;
  gzip_min_length 5k;
  gzip_buffers   4 16k;
  #gzip_http_version 1.0;
  gzip_comp_level 3;
  gzip_types text/plain application/javascript application/x-javascript text/css application/xml text/javascript application/x-httpd-php image/jpeg image/gif image/png;
  gzip_vary on;
  server {
    listen 80;
    server_name localhost;
    #前端项目
    location / {
      index index.html index.htm;  #添加属性。
      root /usr/share/nginx/html;  #站点目录
      # 所有静态资源均指向 /index.html
      try_files $uri $uri/ /index.html;
    }

    error_page  500 502 503 504 /50x.html;
    location = /50x.html {
      root  /usr/share/nginx/html;
    }
  }
}
```

docker-compose.yml

```yml
version: '3'
services:
  mobile-web-best-practice: #项目的service name
    container_name: 'mobile-web-best-practice-container' #容器名称
    image: nginx #指定镜像
    restart: always
    ports:
      - 80:80
    volumes:
      #~ ./nginx.conf为宿主机目录, /etc/nginx为容器目录
      - ./nginx.conf:/etc/nginx/nginx.conf #挂载nginx配置
      #~ ./dist 为宿主机 build 后的dist目录, /usr/src/app为容器目录,
      - ./dist:/usr/share/nginx/html/ #挂载项目
    privileged: true
```

这里需要解释下 volumes 参数，在打包 Docker 镜像时，如果将 nginx.conf 和 dist 直接拷贝到镜像中，那么每次修改相关文件时，都需要重新打包新的镜像。通过 volumes 可以将宿主机的某个文件映射到容器的某个文件，那么改动相关文件，就不要重新打包镜像了，只需修改宿主机上的文件即可。

然后在 Jenkins 创建一个新的任务，选择【构建一个自由风格的软件项目】，并设置相关配置，如下图所示。

![image](https://user-images.githubusercontent.com/22924912/68570157-edd73480-049a-11ea-9c82-c1c98c493208.png)

![image](https://user-images.githubusercontent.com/22924912/68570189-00516e00-049b-11ea-99db-3e67e2dd000f.png)

![image](https://user-images.githubusercontent.com/22924912/68573211-3a723e00-04a2-11ea-85ec-4aa3a17100f1.png)

其中第三张图两部分命令含义如下：

第一部分 shell 命令是 build 前端项目，会在项目根目录下生成 dist 目录

```
echo $PATH
node -v
npm -v
npm install
npm run build
```

第二部分 shell 命令就是通过 ssh 登陆服务器，通过 docker-compose 进行构建 docker 镜像并运行容器。相较于直接使用 docker ，当更新代码时无需执行停止删除容器，重新构建新的镜像等操作。

```
cd /root/jenkins_home/workspace/mobile-web-best-practice \
&& docker-compose up -d
```

最后可以回到该任务页，点击【立即构建】来构建我们的项目了。

### 实现自动触发打包

不过仍有个问题，那就是当向 GitHub 远程仓库 push 代码时，需要能够自动触发构建，相关操作如下。

**1.修改 Jenkins 安全策略**

通过系统管理 -> 全局安全配置 进入，并如下图操作

![image](https://user-images.githubusercontent.com/22924912/68571182-65a65e80-049d-11ea-80e8-fc63733941f8.png)

**2.生成 Jenkins API Token**

通过用户列表 -> 点击管理员用户 -> 设置，点击添加新 token，然后复制身份验证令牌 token

![image](https://user-images.githubusercontent.com/22924912/68571430-f11fef80-049d-11ea-8b42-2d51528981ea.png)

**3.在 Jenkins 项目对应任务的设置中配置【构建触发器】，将刚复制的 token 粘贴进去，如下图所示：**

![image](https://user-images.githubusercontent.com/22924912/68571656-760b0900-049e-11ea-8d42-94ed69d0a629.png)

**4.在 Github 相关项目中打开 Setting -> Webhooks -> Add webhooks，输入格式如下的 URL :**

```
// 前面是 Jenkins 服务地址，mobile-web-best-practice 指在 Jenkins 的任务名称，Token指上面获取的令牌
http://12x.xxx.xxx.xxx:xxxx/job/mobile-web-best-practice/build?token=Token
```

![image](https://user-images.githubusercontent.com/22924912/68571806-d69a4600-049e-11ea-8681-143e5282f81c.png)

这样，我们就实现了在 push 新的代码后，自动触发 Jenkins 打包项目代码，并打包 docker 镜像然后运行。

最后推荐几篇相关文章：

[写给前端的 Docker 实战教程](https://juejin.im/post/5d8440ebe51d4561eb0b2751)

[[手把手系列之]Docker 部署 vue 项目](https://juejin.im/post/5cce4b1cf265da0373719819)

[[手把手系列之] Jenkins+Docker 自动化部署 vue 项目](https://juejin.im/post/5db9474bf265da4d1206777e)

[从零搭建 docker+jenkins+node.js 自动化部署环境](https://juejin.im/post/5b8ddb70e51d45389153f288)
