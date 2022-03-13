> 文章首发于我的博客 https://github.com/mcuking/blog/issues/106

> 原文链接 https://hacks.mozilla.org/2019/08/webassembly-interface-types/

> 文章名词解释
> MVP: 即 Minimum Viable Product，也就是最小可用版本。文章主要指的是 2017 年提出的 WebAssembly 的 MVP。
> 
> interface types: 即接口类型
> 
> IR: 即 Intermediate Representation，也就是中间表示。我们通常将编译器分为前端和后端。其中，前端会对所输入的程序进行词法分析、语法分析、语义分析，然后生成中间表达形式，也就是 IR（Intermediate Representation ）。后端会对 IR 进行优化，然后生成目标代码。

人们对于在浏览器外运行 WebAssembly 感到兴奋。

这种兴奋不仅仅是关于 WebAssembly 运行在它自己的独立运行时，人们也对使用 Python、Ruby 和 Rust 等语言运行 WebAssembly 感到兴奋。

你为什么要那么做？有几个原因：

- 使“本地”模块不那么复杂

像 Node 或 Python 的 CPython 这样的运行时通常也允许你用低级语言（如C++）编写模块。这是因为这些低级语言往往要快得多。因此，你可以在 Node 中使用本地模块，或在 Python 中使用扩展模块。但是这些模块通常很难使用，因为它们需要在用户的设备上进行编译。使用 WebAssembly 的“本地”模块，你可以获得大部分速度，而无需复杂化。

- 使沙盒化本地代码更容易

另一方面，像 Rust 这样的低级语言不会为了速度而使用 WebAssembly。但是他们可以用它来保证安全。正如我们在 [WASI 文章](https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/) 中谈到的，WebAssembly 默认情况下为你提供轻量级沙盒。因此，像 Rust 这样的语言可以使用 WebAssembly 来沙盒化本地代码模块。

- 跨平台共享本地代码

如果开发人员能够跨不同的平台（例如 Web 和桌面应用之间）共享相同的代码库，则可以节省时间并降低维护成本。脚本和低级语言都适用。WebAssembly 为你提供了一种方法达到这个目的，且无需降低其在这些平台上的运行速度。

<img src="https://hacks.mozilla.org/files/2019/08/01-01-why-768x313.png" width=500/>

因此，WebAssembly 可以真正帮助其他语言解决重要问题。

但是对于今天的 WebAssembly，你不会想以这种方式使用它。你可以在所有这些地方运行 WebAssembly，但这还不够。

现在，WebAssembly 只通过数字进行通信。这意味着两种语言可以调用彼此的函数。

但是如果一个函数接受或返回数字以外的任何东西，事情就会变得复杂。你可以：

- 发布一个具有真正难以使用的 API 的模块，该 API 只能用通过数字通信……让模块的使用者变得艰难。

- 为每个该模块希望运行的目标环境添加胶水代码……让模块的开发者变得艰难。

但这不一定是事实。

应该可以发布单个 WebAssembly 模块并让它在任何地方运行……而不会给模块的使用者或开发人员带来麻烦。

<img src="https://hacks.mozilla.org/files/2019/08/01-02-user-and-dev-768x737.png" width=500/>

因此，同一个 WebAssembly 模块可以使用丰富的 API，使用复杂类型来与：

- 在自己的本地运行时中运行的模块（例如，在 Python 运行时中运行的 Python 模块）

- 其他用不同语言编写的 WebAssembly 模块（例如，在浏览器中一起运行的 Rust 模块和 Go 模块）

- 宿主系统本身（例如，为操作系统或浏览器 API 提供系统接口的 WASI 模块）

<img src="https://hacks.mozilla.org/files/2019/08/01-03-star-diagram-768x606.png" width=500/>

通过一个新的早期提案，我们正在了解如何制作 Just Work™，正如你在下面演示中所见。

视频链接 https://www.youtube.com/embed/Qn_4F3foB3Q

那么让我们来看看它是如何工作的。但首先，让我们看看我们今天所处的位置以及我们正在努力解决的问题。

## WebAssembly 与 JS 通信

WebAssembly 不仅限于 Web。但到目前为止，WebAssembly 的大部分开发都集中在 Web 上。

那是因为当你专注于解决具体场景时，你可以做出更好的设计。该语言肯定必须在 Web 上运行，所以这是一个很好的场景。

这给了 MVP 一个很好的范围。 WebAssembly 只需要能够与一种语言通信 —— JavaScript。

而这相对容易做到。在浏览器中，WebAssembly 和 JS 都运行在同一个引擎中，这样引擎可以帮助它们[进行高效地相互通信](https://hacks.mozilla.org/2018/10/calls-between-javascript-and-webassembly-are-finally-fast-%F0%9F%8E%89/)。

<img src="https://hacks.mozilla.org/files/2019/08/02-01-js-interop-02-768x575.png" width=500/>

但是当 JS 和 WebAssembly 尝试相互通信时会出现一个问题……它们使用不同的类型。

目前，WebAssembly 只能通过数字通信。 JavaScript 有数字，但还有更多类型。

甚至数字也不相同。 WebAssembly 有 4 种不同类型的数字：int32、int64、float32 和 float64。 JavaScript 目前只有数字（尽管它很快会有另一种数字类型，[BigInt](https://github.com/tc39/proposal-bigint)）。

区别不仅在于这些类型的名称。这些值在内存中的存储方式也不同。

首先，在 JavaScript 中，任何值，无论类型如何，都放在一个叫做 `box` 的东西中（我在另一篇文章中更详细地解释了 [boxing](https://hacks.mozilla.org/2018/10/calls-between-javascript-and-webassembly-are-finally-fast-%f0%9f%8e%89/#js-to-wasm)）。

相比之下，WebAssembly 的数字具有静态类型。因此，它不需要（或理解）JS boxes。

这种差异使得彼此难以通信。

<img src="https://hacks.mozilla.org/files/2019/08/02-03-number-mismatch-768x619.png" width=500/>

但是，如果你想将值从一种数字类型转换为另一种数字类型，则有非常简单的规则。

因为它很简单，所以很容易写下来。你可以在 [WebAssembly 的 JS API 规范](https://www.w3.org/TR/wasm-js-api/#tojsvalue) 中找到这一点。

<img src="https://hacks.mozilla.org/files/2019/08/02-04-mapping-book-768x376.png" width=500/>

这个映射关系是硬编码在引擎中。

这有点像引擎有一本参考书。每当引擎必须在 JS 和 WebAssembly 之间传递参数或返回值时，它都会从货架上拿出这本参考书，看看如何转换这些值。

<img src="https://hacks.mozilla.org/files/2019/08/02-05-number-conversion-768x619.png" width=500/>

拥有如此有限的一组类型（只是数字）使这个映射变得非常容易。这对 MVP 来说太棒了。它使得很多艰难的设计决定变得很少。

但它使得 WebAssembly 的开发人员的事情变得更加复杂。要在 JS 和 WebAssembly 之间传递字符串，你必须找到一种方法将字符串转换为数字数组，然后将数字数组转换回字符串。我在[之前的文章](https://hacks.mozilla.org/2018/03/making-webassembly-better-for-rust-for-all-languages/)中解释了这一点。

<img src="https://hacks.mozilla.org/files/2018/03/04_wasm_bindgen_02-768x453.png" width=500/>

这并不难，但很乏味。因此，构建工具来将其抽象化。

例如，像 [Rust 的 wasm-bindgen](https://rustwasm.github.io/docs/wasm-bindgen/) 和 [Emscripten 的 Embind](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#embind) 这样的工具会自动用 JS 胶水代码包装 WebAssembly 模块，这些代码会执行从字符串到数字的转换。

<img src="https://hacks.mozilla.org/files/2019/08/02-07-js-glue-768x735.png" width=500/>

这些工具也可以为其他高级类型执行此类转换，例如具有属性的复杂对象。

这有效，但有一些非常明显的场景，它不能很好地工作。

例如，有时你只想通过 WebAssembly 传递一个字符串。你希望 JavaScript 函数将字符串传递给 WebAssembly 函数，然后让 WebAssembly 将其传递给另一个 JavaScript 函数。

以下是要使其工作所需的条件：

1. 第一个 JavaScript 函数将字符串传递给 JS 胶水代码
2. JS 胶水代码将该字符串对象转换为数字，然后将这些数字放入线性内存中
3. 然后将一个数字（指向字符串开头的指针）传递给 WebAssembly
4. WebAssembly 函数将该数字传递给另一侧的 JS 胶水代码
5. 第二个 JavaScript 函数从线性内存中提取所有这些数字，然后将它们解码回字符串对象
6. 该对象就是提供给第二个 JS 函数


<img src="https://hacks.mozilla.org/files/2019/08/02-08-encode-decode-01-768x189.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/02-08-encode-decode-02-768x328.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/02-08-encode-decode-03-768x509.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/02-08-encode-decode-04-768x509.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/02-08-encode-decode-05-768x328.png" width=500/>

因此，一侧的 JS 胶水代码只是颠倒了它在另一侧所做的工作。重新创建基本上相同的对象需要做很多工作。

如果字符串可以直接通过 WebAssembly 而不进行任何转换，那会容易得多。

WebAssembly 不能对这个字符串做任何事情 —— 它不理解那种类型。我们不会解决这个问题。

但是它可以在两个 JS 函数之间来回传递字符串对象，因为它们确实理解类型。

所以这是 [WebAssembly reference types 提案](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md#language-extensions)的原因之一。该提案添加了一个新的基本 WebAssembly 类型 —— `anyref`。

有了 `anyref`，JavaScript 只需要给 WebAssembly 一个引用对象（基本上是一个不公开内存地址的指针）。这个引用指向 JS 堆上的对象。然后 WebAssembly 可以将它传递给其他 JS 函数，这些函数确切地知道如何使用它。

<img src="https://hacks.mozilla.org/files/2019/08/02-09-anyref-01-768x627.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/02-09-anyref-02-768x668.png" width=500/>

这样就解决了 JavaScript 中最烦人的互操作类的问题之一。但这并不是浏览器中唯一需要解决的互操作类的问题。

浏览器中还有另一组更大的类型。如果我们要获得良好的性能，WebAssembly 需要能够与这些类型进行互操作。

## WebAssembly 直接与浏览器通信

JS 只是浏览器的一部分。浏览器还有许多其他功能，称为 Web API，你可以使用。

在幕后，这些 Web API 函数通常是用 C++ 或 Rust 编写的。他们有自己的方式在内存中存储对象。

Web API 的参数和返回值可以有很多不同的类型。很难为每种类型手动创建映射。所以为了简化事情，有一种标准的方式来讨论这些类型的结构——[Web IDL](https://developer.mozilla.org/en-US/docs/Mozilla/WebIDL_bindings)。

当你使用这些函数时，你通常是在 JavaScript 中使用它们。这意味着 你正在传递使用 JS 类型的值。JS 类型如何转换为 Web IDL 类型？

正如有从 WebAssembly 类型到 JavaScript 类型的映射一样，也有从 JavaScript 类型到 Web IDL 类型的映射。

所以这就像引擎有另一本参考书，展示了如何从 JS 到 Web IDL。而且这个映射也是在引擎中硬编码的。

<img src="https://hacks.mozilla.org/files/2019/08/03-02-mapping-book-768x376.png" width=500/>

对于许多类型，JavaScript 和 Web IDL 之间的这种映射非常简单。例如，像 DOMString 和 JS 的 String 这样的类型是兼容的，可以直接相互映射。

现在，当 你尝试从 WebAssembly 调用 Web API 时会发生什么？这就是我们解决问题的地方。

目前，WebAssembly 类型和 Web IDL 类型之间没有映射。这意味着，即使对于像数字这样的简单类型， 你的调用也必须通过 JavaScript。

下面是其中的工作机制：

1. WebAssembly 将值传递给 JS
2. 在这个过程中，引擎把这个值转换成 JavaScript 类型，放到内存中的 JS 堆中
3. 然后，将该 JS 值传递给 Web API 函数。在此过程中，引擎将 JS 值转换为 Web IDL 类型，并将其放入内存的不同部分，即渲染器的堆中

<img src="https://hacks.mozilla.org/files/2019/08/03-03-wasm-to-browser-01-768x422.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/03-03-wasm-to-browser-02-768x422.png" width=500/>

<img src="https://hacks.mozilla.org/files/2019/08/03-03-wasm-to-browser-03-768x422.png" width=500/>

这要做的工作比它需要的更多，而且会占用更多的内存。

对此有一个明显的解决方案 —— 创建一个从 WebAssembly 直接到 Web IDL 的映射。但这并不像看起来那么简单。

对于简单的 Web IDL 类型，如 `boolean` 和 `unsigned long`（这是一个数字），从 WebAssembly 到 Web IDL 有明确的映射。

但在大多数情况下，Web API 参数是更复杂的类型。例如，一个 API 可能需要一个字典，它基本上是一个具有属性的对象，或者一个序列，就像一个数组。

为了在 WebAssembly 类型和 Web IDL 类型之间直接映射，我们需要添加一些更高级别的类型。我们正在这样做 - 使用 [GC 提案](https://github.com/WebAssembly/gc)。有了这个，WebAssembly 模块将能够创建 GC 对象——比如结构和数组——可以映射到复杂的 Web IDL 类型。

但是，如果与 Web API 互操作的唯一方法是通过 GC 对象，那么对于 C++ 和 Rust 等不会使用 GC 对象的语言来说，这会变得更加艰难。每当代码与 Web API 交互时，它都必须创建一个新的 GC 对象并将值从其线性内存复制到该对象中。

这只是比我们今天使用 JS 胶水代码好一点。

我们不希望 JS 胶水代码必须构建 GC 对象 —— 这是一种时间和空间的浪费。出于同样的原因，我们也不希望 WebAssembly 模块这样做。

我们希望使用线性内存的语言（如 Rust 和 C++）调用 Web API 与使用引擎内置 GC 的语言一样容易。因此，我们也需要一种方法来创建线性内存中的对象和 Web IDL 类型之间的映射。

不过这里有一个问题。这些语言中的每一种都以不同的方式表示线性内存中的事物。而且我们不能只选择一种语言的表示。这将使所有其他语言的效率降低。

<img src="https://hacks.mozilla.org/files/2019/08/03-07-picking-lang-768x497.png" width=500/>

但即使这些东西在内存中的确切布局通常不同，但它们通常有一些共同的抽象概念。

例如，对于字符串，语言通常有一个指向内存中字符串开头和字符串长度的指针。并且即使字符串具有更复杂的内部表示形式，在调用外部 API 时通常也需要将字符串转换为这种格式。

这意味着我们可以将此字符串简化为 WebAssembly 可以理解的类型……两个 i32。

<img src="https://hacks.mozilla.org/files/2019/08/03-08-types-wasm-understands-768x411.png" width=500/>

我们可以在引擎中对这样的映射进行硬编码。所以引擎还有另一本参考书，这次是关于 WebAssembly 到 Web IDL 的映射。

但是这里有一个问题。 WebAssembly 是一种类型检查语言。为了保证[安全](https://webassembly.org/docs/security/)，引擎必须检查调用代码是否传入了与被调用者要求的类型相匹配的类型。

这是因为攻击者有多种方法可以利用类型不匹配并使引擎做不应该做的事情。

如果你正在调用一个接受字符串的东西，但你试图向函数传递一个整数，引擎会冲你大喊大叫。它应该对你大喊大叫。

<img src="https://hacks.mozilla.org/files/2019/08/03-09-type-mismatch-768x418.png" width=500/>

所以我们需要一种让模块明确告诉引擎的方法，比如：“我知道 Document.createElement() 接收一个字符串。但是当我调用它时，我会传递给你两个整数。使用这两个整数从我的线性内存中的数据创建一个 DOMString 。使用第一个整数作为字符串的起始地址，第二个作为长度。”

这就是 Web IDL 提案所做的。它为 WebAssembly 模块提供了一种在它使用的类型和 Web IDL 的类型之间进行映射的方法。

这些映射不是在引擎中硬编码的。相反，一个模块带有它自己的映射小册子。

<img src="https://hacks.mozilla.org/files/2019/08/03-10-booklet-768x418.png" width=500/>

因此，这让引擎有一种方法可以说 “对于这个函数，像这两个整数是一个字符串一样进行类型检查。”

然而，这本小册子随模块一起提供的另一个原因是有用的。

有时，通常将其字符串存储在线性内存中的模块在特定情况下会想要使用 `anyref` 或 GC 类型……例如，如果模块只是传递它从 JS 函数获取的对象（如 DOM 节点）到 Web API。

因此，模块需要能够在逐个函数（甚至逐个参数）的基础上选择如何处理不同的类型。由于映射是由模块提供的，因此可以为该模块量身定制。

<img src="https://hacks.mozilla.org/files/2019/08/03-11-granularity-768x418.png" width=500/>

你如何生成这本小册子？

编译器会为你处理这些信息。它向 WebAssembly 模块添加了一个自定义段。所以对于很多语言工具链来说，程序员不需要做太多的工作。

例如，让我们看看 Rust 工具链如何处理最简单的情况之一：将字符串传递给 `alert` 函数。

``` rust
#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}
```

程序员只需使用注释 `#[wasm_bindgen]` 告诉编译器将此函数包含在小册子中。默认情况下，编译器会将其视为线性内存字符串，并为我们添加正确的映射。如果我们需要以不同的方式处理它（例如，作为 `anyref`），我们必须使用第二个注释告诉编译器。

因此有了它，我们可以在中间切掉 JS。这使得在 WebAssembly 和 Web API 之间传递值更快。另外，这意味着我们不需要发布那么多的 JS。

我们不必就我们​​支持的语言种类做出任何妥协。可以将所有不同类型的语言编译为 WebAssembly。而且这些语言都可以将它们的类型映射到 Web IDL 类型 —— 无论该语言使用线性内存还是 GC 对象，或者两者兼而有之。

一旦我们退后一步查看这个解决方案，我们意识到它解决了一个更大的问题。

## WebAssembly 与所有事物通信

让我们回到介绍中的前景的地方。

是否有一种可行的方式让 WebAssembly 使用所有这些不同的类型系统来与所有不同的事物进行通信？

<img src="https://hacks.mozilla.org/files/2019/08/04-01-star-diagram-768x581.png" width=500/>

让我们看看选项。

你可以尝试在引擎中创建硬编码的映射，例如 WebAssembly 到 JS 和 JS 到 Web IDL。

但要做到这一点，你必须为每种语言创建一个特定的映射。并且引擎必须明确支持这些映射中的每一个，并在任一方的语言更改时更新它们。这造成了真正的混乱。

这就是早期编译器的设计方式。每种源语言到每种机器代码语言都有一个管道。我在 [WebAssembly 上的第一篇文章](https://hacks.mozilla.org/2017/02/a-cartoon-intro-to-webassembly/)中更多地讨论了这一点。

<img src="https://hacks.mozilla.org/files/2017/02/03-05-langs05-768x474.png" width=500/>

我们不想要这么复杂的东西。我们希望所有这些不同的语言和平台能够相互交流。但我们也需要它是可扩展的。

所以我们需要一种不同的方式来做到这一点……更像是现代编译器架构。这些在前端和后端之间有分裂。前端从源语言到抽象中间表示 (IR)。后端从该 IR 转到目标机器代码。

<img src="https://hacks.mozilla.org/files/2017/02/03-06-langs06-768x487.png" width=500/>

这就是来自 Web IDL 的洞察力的来源。当你眯着眼睛看它时，Web IDL 有点像一个 IR。

现在，Web IDL 非常特定于 Web。 WebAssembly 在 Web 之外有很多场景。所以 Web IDL 本身并不能作为一个很好的 IR 来使用。

但是，如果你只是使用 Web IDL 作为灵感并创建一组新的抽象类型呢？

这就是我们获得 WebAssembly interface types 提案的方式。

<img src="https://hacks.mozilla.org/files/2019/08/04-06-types-as-IR-768x494.png" width=500/>

这些类型不是具体类型。它们不像今天的 WebAssembly 中的 `int32` 或 `float64` 类型。在 WebAssembly 中没有对它们进行操作。

例如，不会向 WebAssembly 添加任何字符串连接操作。相反，所有操作都在任一端的具体类型上执行。

有一个关键点使这成为可能：对于接口类型，双方并不试图共享一个表示。相反，默认是在一侧和另一侧之间复制值。

<img src="https://hacks.mozilla.org/files/2019/08/04-07-copy-768x565.png" width=500/>

有一种情况似乎是这条规则的例外：我之前提到的新参考值（如 `anyref`）。在这种情况下，在两侧之间复制的是指向对象的指针。所以两个指针都指向同一件事。从理论上讲，这可能意味着他们需要共享一个表示。

在引用只是通过 WebAssembly 模块的情况下（如我上面给出的 `anyref` 示例），双方仍然不需要共享表示。该模块无论如何都不会理解该类型……只需将其传递给其他函数即可。

但有时双方会希望共享一个表示。例如，GC 提案增加了一种[创建类型定义](https://github.com/WebAssembly/gc/blob/master/proposals/gc/MVP-JS.md#type-definition-objects)的方式，以便双方可以共享表示。在这些情况下，选择共享多少表示取决于设计 API 的开发人员。

这使得单个模块与多种不同的语言通信变得更加容易。

在某些情况下，比如浏览器，从接口类型到宿主具体类型的映射将被硬编码到引擎中。

所以一组映射在编译时被硬编码，另一组映射在加载时传给引擎。

<img src="https://hacks.mozilla.org/files/2019/08/04-08-mapping-symmetry-host-768x374.png" width=500/>

但在其他情况下，比如当两个 WebAssembly 模块相互通信时，它们都会发送自己的小册子。他们每个人都将他们的函数类型映射到抽象类型。

<img src="https://hacks.mozilla.org/files/2019/08/04-09-mapping-symmetry-wasm-768x464.png" width=500/>

这并不是让用不同源语言编写的模块相互通信所需的唯一事情（我们将在未来写更多关于这个的文章），但这是朝着这个方向迈出的一大步。

所以现在你明白了为什么，让我们看看其中的机制。

## 这些接口类型实际上是什么样的？

在我们看细节之前，我要再说一遍：这个提案还在制定中。所以最终的提案可能看起来非常不同。

<img src="https://hacks.mozilla.org/files/2019/08/05-01-construction-768x455.png" width=500/>

此外，这一切都由编译器处理。因此，即使提案最终确定，你也只需要知道你的工具链希望你在代码中添加哪些注释（如上面的 wasm-bindgen 示例）。你真的不需要知道这一切是如何在幕后运作的。

但是[提案的细节](https://github.com/WebAssembly/interface-types/blob/master/proposals/interface-types/Explainer.md)非常简洁，所以让我们深入了解当前的想法。

### 要解决的问题

我们需要解决的问题是当一个模块与另一个模块（或直接与宿主，如浏览器）通信时，在不同类型之间转换值。

我们可能需要翻译的地方有四个：

#### 对于导出函数

- 接收来自调用者的参数
- 接收函数的返回值

#### 对于导入函数

- 向函数传递参数
- 接收函数的返回值

你可以将其中的每一个都视为朝着两个方向之一进行：

- 提升，用于离开模块的值。这些从具体类型到接口类型。
- 降低，用于进入模块的值。这些从接口类型到具体类型。

<img src="https://hacks.mozilla.org/files/2019/08/05-02-incoming-outgoing-768x469.png" width=500/>

### 告诉引擎如何在具体类型和接口类型之间进行转换

因此，我们需要一种方法来告诉引擎将哪些转换应用于函数的参数和返回值。我们如何做到这一点？

通过定义接口适配器。

例如，假设我们有一个编译为 WebAssembly 的 Rust 模块。它导出一个可以在没有任何参数的情况下调用的 `greeting_` 函数并返回一个问候语。

这是今天的样子（以 WebAssembly 文本格式）。

<img src="https://hacks.mozilla.org/files/2019/08/05-03-original-function-768x249.png" width=500/>

所以现在，这个函数返回两个整数。

但是我们希望它返回 `string` 的接口类型。所以我们添加了一个叫做接口适配器的东西。

如果一个引擎理解接口类型，那么当它看到这个接口适配器时，它就会用这个接口包装原来的模块。

<img src="https://hacks.mozilla.org/files/2019/08/05-04-interface-768x282.png" width=500/>

它不会再导出 `greeting_` 函数……只是封装了原始函数的 `greeting` 函数。这个新的问候函数返回一个字符串，而不是两个数字。

这提供了向后兼容性，因为不理解接口类型的引擎只会导出原始的 `greeting_` 函数（返回两个整数的函数）。

接口适配器如何告诉引擎将两个整数转换为字符串？

它使用一系列适配器指令。

<img src="https://hacks.mozilla.org/files/2019/08/05-05-adapter-inst-return-768x387.png" width=500/>

上面的适配器指令是提案指定的一组新指令中的两个。

以下是上述指令的作用：

1. 使用 `call-export` 适配器指令调用原始的 `greeting_` 函数。就是原始模块导出的那个，它返回两个数字。这些数字被放在堆栈上。
2. 使用 `memory-to-string ` 适配器指令将数字转换为组成字符串的字节序列。我们必须在这里指定“mem”，因为 WebAssembly 模块有一天可能有多个内存。这告诉引擎要查看哪个内存。然后引擎从堆栈顶部取出两个整数（即指针和长度）并使用它们来确定要使用的字节。

这可能看起来像是一种成熟的编程语言。但是这里没有控制流——你没有循环或分支。所以即使我们给出了引擎指令，它仍然是声明性的。

如果我们的函数也接受一个字符串作为参数（例如，要打招呼的人的名字）会是什么样子？

非常相似。我们只是改变了适配器函数的接口来添加参数。然后我们添加两个新的适配器指令。

<img src="https://hacks.mozilla.org/files/2019/08/05-06-adapter-inst-param-768x447.png" width=500/>

以下是这些新指令的作用：

1. 使用 `arg.get` 指令获取对字符串对象的引用并将其放入堆栈。

2. 使用 `string-to-memory` 指令从该对象中获取字节并将它们放入线性内存中。再一次，我们必须告诉它要将字节放入哪个内存。我们还必须告诉它如何分配字节。我们通过给它一个分配器函数（这将是原始模块提供的导出）来做到这一点。

使用这样的指令的一件好事：我们可以在未来扩展它们……就像我们可以扩展 WebAssembly 核心中的指令一样。我们认为我们定义的指令是一套很好的指令，但我们并不承诺这些指令一直是唯一的指令。

如果你有兴趣更多地了解这一切是如何工作的，[解释文档](https://github.com/WebAssembly/interface-types/blob/master/proposals/interface-types/Explainer.md)会更详细地介绍。

### 将这些指令发送到引擎

现在我们如何将它发送到引擎？

这些注释被添加到自定义段（custom section）的二进制文件中。

<img src="https://hacks.mozilla.org/files/2019/08/05-07-custom-section-768x387.png" width=500/>

如果引擎知道接口类型，它可以使用自定义段。如果没有，引擎可以忽略它，你可以使用 polyfill 来读取自定义段并创建胶水代码。

## 这与 CORBA、Protocol Buffers 等有何不同？

还有其他标准似乎解决了同样的问题——例如 CORBA、Protocol Buffers 和 Cap’n Proto。

那些有什么不同？它们正在解决一个更难的问题。

它们都经过设计，以便你可以与不与之共享内存的系统进行交互 —— 要么是因为它运行在不同的进程中，要么是因为它在网络上的完全不同的机器上。

这意味着你必须能够将中间的事物（对象的“中间表示”）发送到该边界。

所以这些标准需要定义一种可以高效跨越边界的序列化格式。这是它们标准化的很大一部分。

<img src="https://hacks.mozilla.org/files/2019/08/06-01-cross-boundary-ir-768x167.png" width=500/>

尽管这看起来是一个类似的问题，但实际上几乎是完全相反的。

对于接口类型，这个“IR”永远不需要离开引擎。它甚至对模块本身不可见。

模块只看到引擎在过程结束时为它们输出的内容 —— 什么被复制到它们的线性内存或作为参考提供给它们。所以我们不必告诉引擎为这些类型提供什么布局 —— 这不需要指定。

指定的是你与引擎通信的方式。这是你发送给引擎的这本小册子的声明性语言。

<img src="https://hacks.mozilla.org/files/2019/08/06-02-no-boundary-ir-768x177.png" width=500/>

这有一个很好的副作用：因为这都是声明性的，引擎可以看到什么时候不需要翻译，比如当两边的两个模块使用相同的类型时，并完全跳过翻译工作。

<img src="https://hacks.mozilla.org/files/2019/08/06-03-opt-768x503.png" width=500/>

## 你今天怎么使用接口类型？

正如我上面提到的，这是一个早期的提案。这意味着事情将迅速发生变化，你不想在生产中依赖于此。

但是如果你想开始使用它，我们已经在整个工具链中实现了它，从生产到消费：

- Rust 工具链
- wasm-bindgen
- WebAssembly 的运行时 —— Wasmtime

由于我们维护所有这些工具，并且由于我们正在制定标准本身，因此我们可以跟上标准的发展。

尽管所有这些部分都将继续更改，但我们会确保将更改同步到它们。因此，只要你使用所有这些的最新版本，事情就不应该破坏太多。

<img src="https://hacks.mozilla.org/files/2019/08/07-01-construction-768x455.png" width=500/>

因此，你今天可以通过以下多种方式使用它。如需最新版本，请查看此[演示代码仓库](https://github.com/bytecodealliance/wasmtime-demos)。

视频地址 https://www.youtube.com/embed/Qn_4F3foB3Q

## 致谢

- 感谢将所有这些语言和运行时的所有部分整合在一起的团队：Alex Crichton、Yury Delendik、Nick Fitzgerald、Dan Gohman 和 Till Schneidereit

- 感谢提案共同倡导者及其同事为提案所做的工作：Luke Wagner、Francis McCabe、Jacob Gravelle、Alex Crichton 和 Nick Fitzgerald

- 感谢我出色的合作者 Luke Wagner 和 Till Schneidereit，感谢他们对本文的宝贵意见和反馈

## 关于[Lin Clark](https://twitter.com/linclark)

Lin 在 Mozilla 从事高级开发工作，专注于 Rust 和 WebAssembly。

[Lin Clark 的更多文章……](https://hacks.mozilla.org/author/lclarkmozilla-com/)
