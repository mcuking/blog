> 文章首发于我的博客 https://github.com/mcuking/blog/issues/58

> 译者：最近在研究前端架构分层，在 medium 看到了这篇关于 node.js 架构分层的文章，觉得很不错，特地翻译过来分享给大家，其中很多思想也可以应用到前端项目中。

> 原文链接 https://blog.codeminer42.com/nodejs-and-good-practices-354e7d763626

软件随时可能更改，而定义代码质量的一个方面就是更改代码的难易程度。但是是什么使它是这样的？

> _...如果您害怕改变某些东西，显然是设计得不好。 —马丁·福勒_

## 关注点和职责分离

<table><tr><td bgcolor=#fedfdb>“将由于相同原因而发生变化的事物聚集在一起。分开那些因不同原因而改变的事物。”</td></tr></table>

无论是功能，类还是模块，它们都可以应用于单一职责原则和关注点分离 [the single responsibility principle and the separation of concerns](https://8thlight.com/blog/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html)。基于这些原理进行设计软件架构。

## 架构

在软件开发中，职责是团结一致要实现的任务，例如：在应用程序中表示产品的概念，处理网络请求，将用户保存在数据库中等等。

您是否注意到这三个职责不在同一类别中？这是由于它们属于不同的层，因此又可以分为概念。根据上面的示例，“在数据库中保存用户”与“用户”概念有关，也与数据库进行通信的层有关。

通常，与上述概念相关的体系结构倾向于分为四层：`domain`, `application`, `infrastructure`, `input interfaces`。

## Domain 层

在这一层中，我们可以定义充当实体和业务规则的角色并与我们的 domain 有直接关系的单元。例如，在用户和团队的应用程序中，我们可能会有一个 User 实体，一个 Team 实体和一个 JoinTeamPolicy 来回答用户是否能够加入给定的团队。

这是我们软件中最孤立最重要的层，Application 层可以使用它来定义用例。

## Application 层

Application 层定义了我们应用程序的实际行为，因此负责执行 domain 层各单元之间的交互。例如，我们可以有一个 JoinTeam 用例，该用例接收 User 和 Team 的实例，并将它们传递给 JoinTeamPolicy。如果用户可以加入，它将持久化职责委托给 infrastructure 层。

Application 层也可以用作 infrastructure 层的适配器。假设我们的应用程序可以发送电子邮件；直接负责与电子邮件服务器通信的类（称为 MailChimpService）属于 infrastructure 层，但是实际发送电子邮件的电子邮件（EmailService）属于 application 层，并在内部使用 MailChimpService。因此，我们的应用程序的其余部分不知道有关特定实现的详细信息-它仅知道 EmailService 能够发送电子邮件。

## Infrastructure 层

这是所有层中的最低层，它是应用程序外部的边界：数据库，电子邮件服务，队列引擎等。

多层应用程序的一个共同特征是使用 [repository pattern](https://martinfowler.com/eaaCatalog/repository.html) 与数据库或其他一些外部持久化服务（例如 API）进行通信。Repository 对象本质上被视为集合，使用它们的层（domain 和 application）不需要知道底层的持久化技术（类似于我们的电子邮件服务示例）。

这里的想法是，repository 接口属于 domain 层，而实现又属于 infrastructure 层，即 domain 层仅知道 repository 接受的方法和参数。即使在测试方面，这也使两层都更加灵活！由于 JavaScript 并未实现接口的概念，因此我们可以想象自己的接口，并以此为基础在 infrastructure 层上创建具体的实现。

## Input interfaces 层

该层包含应用程序的所有入口点，例如控制器，CLI，websocket，图形用户界面（如果是桌面应用程序）等等。

它应该不具有有关业务规则、用例、持久化技术的知识，甚至不具备其他逻辑的知识！它应该只接收用户输入（如 URL 参数），将其传递给用例，最后将响应返回给用户。

## NodeJS 与关注点分离

好了，经过所有这些理论之后，它如何在 Node 应用程序上工作？说实话，多层体系结构中使用的某些模式非常适合 JavaScript 世界！

## NodeJS 和 domain 层

Node 上的 domain 层可以由简单的 [ES6 classes](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Classes) 组成。有许多 ES5 和 ES6 +模块可帮助创建实体，例如：[Structure](https://github.com/talyssonoc/structure/), [Ampersand State](https://github.com/AmpersandJS/ampersand-state), [tcomb](https://www.npmjs.com/package/tcomb) 和 [ObjectModel](https://github.com/sylvainpolletvillard/ObjectModel)。

让我们看一个使用 Structure 的简单示例：

```js
const { attributes } = require('structure');

const User = attributes({
  id: Number,
  name: {
    type: String,
    required: true
  },
  age: Number
})(
  class User {
    isLegal() {
      return this.age >= User.MIN_LEGAL_AGE;
    }
  }
);

User.MIN_LEGAL_AGE = 21;
```

请注意，我们的列表中不包含 `Backbone.Model` 或 `Sequelize` 和 `Mongoose` 之类的模块，因为它们打算在 infrastructure 层中用于与外部世界进行通信。因此，我们代码库的其余部分甚至不需要了解它们的存在。

## NodeJS 与 application 层

用例属于 application 层，与 promises 不同，用例可能会带来成功与失败之外的结果。对于这种情况，比较好的 Node 模式是 [event emitter](https://nodejs.org/api/events.html)。要使用它，我们必须扩展 EventEmitter 类并为每个可能的结果发出一个事件，从而隐藏了我们的 repository 在内部使用了 promise 的事实：

```js
const EventEmitter = require('events');

class CreateUser extends EventEmitter {
  constructor({ usersRepository }) {
    super();
    this.usersRepository = usersRepository;
  }

  execute(userData) {
    const user = new User(userData);

    this.usersRepository
      .add(user)
      .then(newUser => {
        this.emit('SUCCESS', newUser);
      })
      .catch(error => {
        if (error.message === 'ValidationError') {
          return this.emit('VALIDATION_ERROR', error);
        }

        this.emit('ERROR', error);
      });
  }
}
```

这样，我们的入口点就可以执行用例并为每个结果添加一个监听器，如下所示：

```js
const UsersController = {
  create(req, res) {
    const createUser = new CreateUser({ usersRepository });

    createUser
      .on('SUCCESS', user => {
        res.status(201).json(user);
      })
      .on('VALIDATION_ERROR', error => {
        res.status(400).json({
          type: 'ValidationError',
          details: error.details
        });
      })
      .on('ERROR', error => {
        res.sendStatus(500);
      });

    createUser.execute(req.body.user);
  }
};
```

## NodeJS 与 infrastructure 层

infrastructure 层的实现不应很困难，但要注意其逻辑不要泄漏到以上各层！例如我们可以使用 Sequelize 模型来实现与 SQL 数据库进行通信的存储库，并为其提供方法名称，而这些名称并不暗示其下存在 SQL 层-例如我们上一个示例的通用 add 方法。

我们可以实例化一个 SequelizeUsersRepository 并将其作为 usersRepository 变量传递给它的依赖项，这些依赖项可能只是与其接口交互。

```js
class SequelizeUsersRepository {
  add(user) {
    const { valid, errors } = user.validate();

    if (!valid) {
      const error = new Error('ValidationError');
      error.details = errors;

      return Promise.reject(error);
    }

    return UserModel.create(user.attributes).then(dbUser => dbUser.dataValues);
  }
}
```

对于 NoSQL 数据库，电子邮件服务，队列引擎，外部 API 等，也是如此。

## NodeJS 和 input interfaces 层

在 Node 应用程序上实现此层有很多种方式。对于 HTTP 请求，Express 模块是使用最多的模块，但您也可以使用 Hapi 或 Restify。最终选择取决于实现细节，尽管对此层所做的更改不应影响其他细节。如果从 Express 迁移到 Hapi 某种程度上意味着在要更改某些代码时，则表示已耦合，并且您应密切注意对其进行修复。

## 连接这些层

直接与另一层进行通信可能是一个错误的决定，并导致它们之间的耦合。在面向对象的编程中，解决此问题的常见方法是依赖注入 dependency injection（DI）。这种技术包括使类的依赖项在其构造函数中作为参数接收，而不是引入依赖项并将其实例化到类本身内部，从而创建了所谓的控制反转。

使用这种技术使我们能够以一种非常简洁的方式隔离一个类的依赖关系，使其更加灵活且易于测试，因为解决依赖关系成为一项琐碎的任务

对于 Node 应用程序，有一个很好的 DI 模块，称为 Awilix，它使我们能够在不将代码耦合到 DI 模块本身的情况下利用 DI，因此我们不希望使用 Angular 1 那种奇怪的依赖注入机制。Awilix 的作者有一系列的[文章](https://medium.com/@Jeffijoe/dependency-injection-in-node-js-2016-edition-f2a88efdd427)，它们解释了 Node 的依赖注入，值得一读，并且还介绍了如何使用 Awilix。顺便说一句，如果您打算使用 Express 或 Koa，还应该看看 Awilix-Express 或 Awilix-Koa。

## 一个实践的例子

即使有了所有这些有关层和概念的示例和说明，我相信没有什么比遵循多层架构的应用程序的实际示例更好的了，这足以使您确信使用起来很简单！

你可以查看可用在生产环境的 [boilerplate for web APIs with Node](https://github.com/talyssonoc/node-api-boilerplate)。它采用了多层架构，并已经为您设置了基础配置（包括文档），因此您可以练习甚至将其用作 Node 应用程序的开始模板。

## 额外信息

如果您想了解有关多层架构以及如何分离关注点的更多信息，请查看以下链接：

- [FourLayerArchitecture](http://wiki.c2.com/?FourLayerArchitecture)

- [Architecture — The Lost Years](https://www.youtube.com/watch?v=WpkDN78P884)

- [The Clean Architecture](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)

- [Hexagonal Architecture](http://wiki.c2.com/?HexagonalArchitecture)

- [Domain-driven design](http://dddcommunity.org/)
