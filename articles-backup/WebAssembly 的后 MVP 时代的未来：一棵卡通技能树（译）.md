> 文章首发于我的博客 https://github.com/mcuking/blog/issues/108

> 原文链接 https://hacks.mozilla.org/2018/10/webassemblys-post-mvp-future/

人们对 WebAssembly 有误解。他们认为 2017 年登陆浏览器的 WebAssembly —— 我们称之为 WebAssembly 的最小可行产品（也称 MVP）—— 就是 WebAssembly 的最终版本。

我能理解这种误解的来源。WebAssembly 社区组确实致力于向后兼容。这意味着你今天创建的 WebAssembly 将在未来继续在浏览器上工作。

但这并不意味着 WebAssembly 的功能是完整的。事实上，情况远非如此。WebAssembly 将提供许多功能，它们将从根本上改变你可以使用 WebAssembly 执行的操作。

我认为这些未来的功能有点像电子游戏中的技能树。我们已经完全填写了这些技能中的前几个，但下面还有整棵技能树，我们需要填写以解锁所有的应用。

<img src="https://hacks.mozilla.org/files/2018/10/01-07-runtime-09-final-e1539904436477-768x489.png" width=500/>

所以让我们看看已经填写的内容，然后我们可以看到尚未完成的内容。

## 最小可行产品（MVP）

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-00-A-1-e1539904807805-768x425.png" width=500/>

WebAssembly 故事的始于 [Emscripten](https://emscripten.org/)，它使通过将 C++ 代码转换为 JavaScript 在 Web 上运行 C++ 代码成为可能。这使得将现有的大型 C++ 代码库（用于游戏和桌面应用程序等）带到 Web 成为可能。

不过，它自动生成的 JS 仍然比可比的本地代码慢得多。但是 Mozilla 工程师发现了一个隐藏在生成的 JavaScript 中的类型系统，并想出了[如何让这个 JavaScript 运行得非常快](https://blog.mozilla.org/luke/2014/01/14/asm-js-aot-compilation-and-startup-performance/)。这个 JavaScript 子集被命名为 [asm.js](http://asmjs.org/)。

其他浏览器供应商看到 asm.js 的速度有多快，他们也开始向他们的引擎[添加相同的优化](https://hacks.mozilla.org/2015/03/asm-speedups-everywhere/)。

但这并不是故事的结局。这只是开始。引擎仍然可以做一些事情来加快速度。

但是他们无法在 JavaScript 本身中做到这一点。相反，他们需要一种新语言 —— 一种专为编译而设计的语言。那就是 WebAssembly。

那么第一个版本的 WebAssembly 需要哪些技能呢？我们需要什么才能得到一个可以在 Web 上实际有效运行 C 和 C++ 的最小可行产品？

### 技能：编译目标

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-01-SS-01-comp-target-e1539905023913-768x392.png" width=500/>

从事 WebAssembly 工作的人知道他们不想只支持 C 和 C++。他们希望许多不同的语言能够编译为 WebAssembly。所以他们需要一个与语言无关的编译目标。

他们需要诸如桌面应用程序之类的东西被编译成汇编语言之类的东西——比如 x86。但是这种汇编语言不适用于实际的物理机器。它将用于概念机器。

### 技能：快速执行

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-01-SS-02-fast-exec-e1539905310659-768x390.png" width=500/>

编译器目标的设计必须使其运行速度非常快。否则，在 Web 上运行的 WebAssembly 应用程序将无法满足用户对流畅交互和游戏体验的期望。

### 技能：紧凑

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-01-SS-03-compact-e1539905278906-768x390.png" width=500/>

除了执行时间，加载时间也需要很快。用户对某些内容的加载速度有一定的期望。对于桌面应用程序，期望它们会快速加载，因为该应用程序已安装在你的计算机上。对于 Web 应用程序，预期加载时间也会很快，因为 Web 应用程序通常不必加载几乎与桌面应用程序一样多的代码。

但是，当你将这两件事结合起来时，就会变得棘手。桌面应用程序通常是相当大的代码库。因此，如果它们在 Web 上，当用户第一次访问 URL 时，需要下载和编译很多内容。

为了满足这些期望，需要我们的编译器目标是紧凑的。这样，它可以快速通过 Web 下载。

### 技能：线性内存

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-01-SS-04-linear-memory-e1539905361396-768x392.png" width=500/>

这些语言还需要能够以不同于 JavaScript 使用内存的方式使用内存。他们需要能够直接管理他们的内存 —— 说出哪些字节放在一起。

这是因为像 C 和 C++ 这样的语言有一个称为指针的低级特性。你可以拥有一个没有值的变量，而是具有该值的内存地址。因此，如果你要支持指针，则程序需要能够从特定地址写入和读取。

但是你不能让从 Web 下载的程序只是随意访问内存中的字节，使用他们想要的任何地址。因此，为了创建一种访问内存的安全方式，就像本地程序所习惯的那样，我们必须创建一些可以访问内存中非常特定部分的东西，而不是其他任何部分。

为此，WebAssembly 使用线性内存模型。这是使用 TypedArrays 实现的。它基本上就像一个 JavaScript 数组，只是这个数组只包含内存字节。当你访问其中的数据时，你只需使用数组索引，你可以将它们视为内存地址。这意味着你可以假装这个数组是 C++ 内存。

### 已解锁成就

因此，有了所有这些技能，人们就可以在你的浏览器中运行桌面应用程序和游戏，就像在他们的计算机上本地运行一样。

这几乎就是 WebAssembly 作为 MVP 发布时所具备的技能。它确实是一个 MVP —— 一个最小可行的产品。

<img src="https://hacks.mozilla.org/files/2018/10/01-01-mvp-03-final-e1539905426663-768x664.png" width=500/>

这允许某些类型的应用程序工作，但仍有大量其他应用程序需要解锁。

## 重量级桌面应用程序

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-00-A-e1539905812771-768x425.png" width=500/>

下一个要解锁的成就是重​​量更重的桌面应用程序。

你能想像 Photoshop 之类的东西是否在你的浏览器中运行？如果你可以像使用 Gmail 一样在任何设备上即时加载它？

我们已经开始看到这样的事情。例如，Autodesk 的 AutoCAD 团队已在浏览器中提供了他们的 CAD 软件。 Adobe 已经使用 WebAssembly 通过浏览器提供了 Lightroom。

但是我们仍然需要添加一些功能，以确保所有这些应用程序，即使是最重的应用程序，都能在浏览器中良好运行。

### 技能：线程

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-01-SS-01-threading-e1540219281254-768x248.png" width=500/>

首先，我们需要支持多线程。现代计算机具有多个内核。这些基本上是多个大脑，可以同时处理你的问题。这可以使事情进展得更快，但要利用这些内核，你需要支持线程。

### 技能：SIMD

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-01-SS-02-SIMD-e1540219323375-768x245.png" width=500/>

除了线程之外，还有另一种利用现代硬件的技术，它使你能够并行处理事物。

那就是 SIMD：单指令多数据。使用 SIMD，可以将一大块内存拆分到不同的执行单元中，这些单元有点像内核。然后会有相同的代码单元（即相同的指令）运行在所有这些执行单元上，但每个执行单元都将该指令应用于自己的数据位上。

### 技能：64 位寻址

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-01-SS-03-wasm64-e1540219360998-768x245.png" width=500/>

WebAssembly 需要充分利用的另一个硬件功能是 64 位寻址。

内存地址只是数字，所以如果你的内存地址只有 32 位长，你只能有这么多内存地址 —— 足够 4 GB 的线性内存。

但是对于 64 位寻址，你有 16 艾字节。当然，你的计算机中没有 16 艾字节的实际内存。所以最大值取决于系统实际上可以给你多少内存。但这将消除 WebAssembly 对地址空间的人为限制。

### 技能：流编译

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-02-SS-01-streaming-e1539905897570-768x560.png" width=500/>

对于这些应用程序，我们不仅需要它们快速运行。我们需要比现在更快的加载时间。我们特别需要一些技能来改善加载时间。

一大步是进行流编译 —— 在 WebAssembly 文件仍在下载时编译它。WebAssembly 是专门为实现轻松的流编译而设计的。在 Firefox 中，我们实际上编译它的速度非常快 —— [比它通 Web 传入的速度还要快](https://hacks.mozilla.org/2018/01/making-webassembly-even-faster-firefoxs-new-streaming-and-tiering-compiler/)，以至于在你下载文件时它几乎已经完成了编译。其他浏览器也在添加流编译。

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-02-SS-02-tiered-e1540219464572-768x554.png" width=500/>

另一件有帮助的事情是拥有分层编译器。

对于我们在 Firefox 中，这意味着有[两个编译器](https://hacks.mozilla.org/2018/01/making-webassembly-even-faster-firefoxs-new-streaming-and-tiering-compiler/)。第一个 —— 基线编译器 —— 在文件开始下载后立即启动。它编译代码的速度非常快，因此它可以快速启动。

它生成的代码很快，但不是 100% 快。为了获得额外的性能，我们在后台的多个线程上运行另一个编译器 —— 优化编译器。这需要更长的时间来编译，但生成的代码非常快。完成后，我们将基准版本替换为完全优化的版本。

通过这种方式，我们可以使用基线编译器快速启动，并使用优化编译器快速执行。

此外，我们正在开发一种名为 [Cranelift](https://github.com/bytecodealliance/cranelift) 的新优化编译器。 Cranelift 旨在快速编译代码，并在逐个函数级别并行执行。同时，它生成的代码的性能甚至比我们当前的优化编译器还要好。

Cranelift 目前处于 Firefox 的开发版本中，但默认情况下处于禁用状态。一旦我们启用它，我们将更快地获得完全优化的代码，并且该代码将运行得更快。

但是我们可以使用一个更好的技巧来制作它，这样我们就不必在大多数时间进行编译……

### 技能：隐式 HTTP 缓存

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-02-SS-03-http-e1540219501952-768x551.png" width=500/>

使用 WebAssembly，如果在两个页面加载时加载相同的代码，它将编译为相同的机器代码。它不需要根据流经它的数据而改变，就像 JS JIT 编译器需要的那样。

这意味着我们可以将编译后的代码存储在 HTTP 缓存中。然后当页面加载并去获取 .wasm 文件时，它只会从缓存中提取预编译的机器代码。这将完全跳过已经访问过的任何缓存页面的编译。

### 技能：其他改进

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-02-SS-04-other-e1540219569386-768x551.png" width=500/>

目前，许多讨论都围绕着其他改进方法展开，跳过了更多工作，因此请继续关注其他加载时间改进。

### 关于这些我们在哪里呢？

我们现在在哪里支持这些重量级应用程序？

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-03-P-07-e1540219610872-768x551.png" width=500/>

#### 线程

对于线程，我们有一个几乎已经完成的[提案](https://github.com/WebAssembly/threads)，但其中一个关键部分 —— [SharedArrayBuffers](https://hacks.mozilla.org/2017/06/a-cartoon-intro-to-arraybuffers-and-sharedarraybuffers/) —— 必须在今年早些时候[在浏览器中关闭](https://blog.mozilla.org/security/2018/01/03/mitigations-landing-new-class-timing-attack/)。

它们将再次开启。关闭它们只是一种临时措施，以减少今年早些时候在 CPU 中发现并披露的 Spectre 安全问题的影响，但正在取得进展，敬请期待。

#### SIMD

[SIMD](https://github.com/WebAssembly/simd/blob/main/proposals/simd/SIMD.md) 目前正处于非常活跃的开发阶段。

#### 64 位寻址

对于 [wasm-64](https://github.com/WebAssembly/design/blob/main/FutureFeatures.md#linear-memory-bigger-than-4-gib)，我们对如何添加它有一个很好的了解，这与 x86 或 ARM 如何获得对 64 位寻址的支持非常相似。

#### 流编译

我们在 2017 年底添加了[流编译](https://hacks.mozilla.org/2018/01/making-webassembly-even-faster-firefoxs-new-streaming-and-tiering-compiler/)，其他浏览器也在努力。

#### 分层编译

我们也在 2017 年底添加了我们的[基线编译器](https://hacks.mozilla.org/2018/01/making-webassembly-even-faster-firefoxs-new-streaming-and-tiering-compiler/)，其他浏览器在过去一年中也添加了相同类型的架构。

#### 隐式 HTTP 缓存

在 Firefox 中，我们[接近完成](https://bugzilla.mozilla.org/show_bug.cgi?id=1487113)对隐式 HTTP 缓存的支持。

#### 其他改进

其他改进目前正在讨论中。

尽管这一切仍在进行中，但你已经看到今天出现了一些重量级应用程序，因为 WebAssembly 已经为这些应用程序提供了它们所需的性能。

但是一旦这些功能都到位，这将是另一个解锁的成就，更多这些重量级应用程序将能够进入浏览器。

<img src="https://hacks.mozilla.org/files/2018/10/01-02-heavyweight-04-final-e1540219657102-768x696.png" width=500/>

## 与 JavaScript 互操作的小模块

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-00-A-768x432.png" width=500/>

但 WebAssembly 不仅适用于游戏和重量级应用程序。它也适用于常规的 Web 开发……对于人们习惯的 Web 开发类型：小型模块类型的 Web 开发。

有时，你的应用程序的小角落里会进行大量繁重的处理，而在某些情况下，使用 WebAssembly 可以更快地进行处理。我们希望可以轻松地将这些位移植到 WebAssembly。

同样，这是其中一些已经发生的情况。开发人员已经将 WebAssembly 模块合并到有很多小模块执行大量繁重工作的地方。

一个例子是在 Firefox 的 DevTools 和 webpack 中使用的 source map 中的解析器。它[用 Rust 重写](https://hacks.mozilla.org/2018/01/oxidizing-source-maps-with-rust-and-webassembly/)，编译为 WebAssembly，使其速度提高了 11 倍。 WordPress 的 Gutenberg 解析器在进行相同类型的重写后[平均速度提高了 86 倍](https://mnt.io/2018/08/22/from-rust-to-beyond-the-webassembly-galaxy/)。

但是为了让这种用途真正广泛地普及 —— 让人们真的很舒服地这样做 —— 我们需要做更多的事情。

### 技能：JS 和 WebAssembly 之间的快速调用

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-01-SS-01-call-opts-e1540220093322-768x399.png" width=500/>

首先，我们需要 JS 和 WebAssembly 之间的快速调用，因为如果你将一个小模块集成到现有的 JS 系统中，你很有可能需要在两者之间进行大量调用。因此，你需要这些调用快速。

但是当 WebAssembly 首次出现时，这些调用并不快。这就是我们回到整个 MVP 事情的地方 —— 引擎对两者之间的调用提供了最低限度的支持。他们只是让调用正常工作，他们并没有让他们快速。所以引擎需要优化这些。

我们最近在 Firefox 中完成了这方面的工作。现在，其中一些调用实际上[比非内联 JavaScript 到 JavaScript 调用更快](https://hacks.mozilla.org/2018/10/calls-between-javascript-and-webassembly-are-finally-fast-%f0%9f%8e%89/)。其他引擎也在致力于此。

### 技能：简单快速的数据交换

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-01-SS-02-data-exchange-e1540220133991-768x399.png" width=500/>

不过，这让我们想到了另一件事。当你在 JavaScript 和 WebAssembly 之间调用时，你经常需要在它们之间传递数据。

你需要将值传递给 WebAssembly 函数或从中返回一个值。这也可能很慢，也可能很困难。

有几个原因很难。一个是因为，目前，WebAssembly 只理解数字。这意味着你不能将更复杂的值（如对象）作为参数传入。你需要将该对象转换为数字并将其放入线性内存中。然后将线性内存中的位置传递给 WebAssembly。

这有点复杂。并且将数据转换成线性内存需要一些时间。所以我们需要这更容易和更快。

### 技能：ES模块集成

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-01-SS-03-es-module-e1540220169128-768x397.png" width=500/>

我们需要的另一件事是与浏览器内置的 ES 模块支持集成。现在，你使用命令式 API 实例化 WebAssembly 模块。你调用一个函数，它会给你一个模块。

但这意味着 WebAssembly 模块实际上并不是 JS 模块图的一部分。为了像使用 JS 模块一样使用导入和导出，你需要集成 ES 模块。

### 技能：工具链集成

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-01-SS-04-toolchain-e1540220201137-768x399.png" width=500/>

但是，仅仅能够导入和导出并不能让我们一路顺利。我们需要一个地方来分发这些模块，并从中下载它们，以及将它们捆绑在一起的工具。

npm 对于 WebAssembly 是什么？

webpack 或 Parcel 对于 WebAssembly 是什么？

这些模块对于使用它们的人来说应该没有什么不同，所以没有理由创建一个单独的生态系统。我们只需要现有工具来与它们集成。

### 技能：向后兼容

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-01-SS-05-bc-compat-e1540220231412-768x397.png" width=500/>

我们还需要在现有的 JS 应用程序中真正做好一件事 —— 支持旧版本的浏览器，甚至那些不知道 WebAssembly 是什么的浏览器。我们需要确保你不必为了支持 IE11 而用 JavaScript 编写模块的第二个实现。

### 关于这些我们在哪里呢？

那么关于这些我们在哪里呢？

<img src="https://hacks.mozilla.org/files/2018/10/01-04-js-interop-02-P-05-e1540220264112-768x395.png" width=500/>

#### JS 和 WebAssembly 之间的快速调用

[现在 Firefox 中 JS 和 WebAssembly 之间的调用很快](https://hacks.mozilla.org/2018/10/calls-between-javascript-and-webassembly-are-finally-fast-%f0%9f%8e%89/)，其他浏览器也在努力。

#### 简单快速的数据交换

为了轻松快速地交换数据，有一些建议可以帮助实现这一点。

正如我之前提到的，对更复杂的数据必须使用线性内存的一个原因是 WebAssembly 只理解数字。它仅有的类型是整数和浮点数。

随着[引用类型的提议](https://github.com/WebAssembly/reference-types/blob/master/proposals/reference-types/Overview.md)，这将会改变。该提案添加了一种新类型，WebAssembly 函数可以将其作为参数并返回。而这种类型是对来自 WebAssembly 外部的对象的引用 —— 例如，一个 JavaScript 对象。

但是 WebAssembly 不能直接操作这个对象。要实际执行诸如在其上调用方法之类的操作，它仍然需要使用一些 JavaScript 胶水代码。这意味着它可以工作，但它比它需要的要慢。

为了加快速度，有一个我们一直称之为 [Web IDL 绑定](https://github.com/WebAssembly/interface-types/blob/master/proposals/webidl-bindings/Explainer.md) 的提案。它让一个 wasm 模块声明对其导入和导出必须应用什么样的胶水代码，这样胶水代码就不需要只能用 JS 编写了。通过将 JS 中的胶水代码转移到 wasm 中，可以在调用内置 Web API 时完全优化掉胶水代码。

我们还可以简化数据交互的另一部分。这与跟踪数据需要在内存中保留多长时间有关。如果你在线性内存中有一些 JS 需要访问的数据，那么你必须把它留在那里，直到 JS 读取数据。但是如果你把它永远留在那里，你就会发生所谓的内存泄漏。你怎么知道什么时候可以删除数据？你怎么知道 JS 什么时候用完了？目前，你必须自己管理。

一旦 JS 处理完数据，JS 代码就必须调用类似 free 函数的东西来释放内存。但这既乏味又容易出错。为了简化这个过程，我们将 [WeakRefs](https://github.com/tc39/proposal-weakrefs) 添加到 JavaScript。有了这个，你将能够在 JS 端观察对象。然后，当该对象被垃圾收集时，你可以在 WebAssembly 端进行清理。

所以这些提议都在进行中。与此同时，[Rust 生态系统已经创建了一些工具](https://hacks.mozilla.org/2018/03/making-webassembly-better-for-rust-for-all-languages/)，可以为你自动化这一切，并且 polyfill 正在运行的提案。

特别值得一提的是一个工具，因为其他语言也可以使用它。它被称为 [wasm-bindgen](https://rustwasm.github.io/wasm-bindgen/)。当它看到你的 Rust 代码应该执行诸如接收或返回某些类型的 JS 值或 DOM 对象之类的操作时，它会自动创建 JavaScript 胶水代码来为你执行此操作，因此你无需考虑它。而且因为它是以一种独立于语言的方式编写的，所以其他语言工具链可以采用它。

#### ES 模块集成

对于 ES 模块集成，[该提议](https://github.com/WebAssembly/esm-integration/tree/master/proposals/esm-integration)已经很远了。我们正在开始与浏览器供应商合作来实现它。

#### 工具链支持

对于工具链支持，Rust 生态系统中有像 [`wasm-pack`](https://github.com/rustwasm/wasm-pack) 这样的工具，它会自动运行 npm 打包代码所需的一切。打包工具也在积极致力于支持。

#### 向后兼容

最后，为了向后兼容，还有 `wasm2js` 工具。这需要一个 wasm 文件并输出等效的 JS。那个 JS 不会很快，但至少这意味着它可以在不理解 WebAssembly 的旧版本浏览器中工作。

所以我们离解锁这个成就越来越近了。一旦我们解锁它，我们就会打开通往另外两个的道路。

## JS 框架和编译为 JS 的语言

一种是使用 WebAssembly 重写 JavaScript 框架之类的大部分内容。

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-01-A-01-frameworks-e1540220354792-768x419.png" width=500/>

另一个是让静态类型的 compile-to-js 语言可以编译为 WebAssembly —— 例如，让像 [Scala.js](https://www.scala-js.org/)、[Reason](https://reasonml.github.io/) 或 [Elm](https://elm-lang.org/) 这样的语言编译为 WebAssembly。

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-01-A-02-langs-e1540220481271-768x423.png" width=500/>

对于这两个用例，WebAssembly 都需要支持高级语言功能。

### 技能：GC

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-02-SS-01-gc-e1540220514444-768x244.png" width=500/>

出于几个原因，我们需要与浏览器的垃圾收集器集成。

首先，让我们看看重写部分 JS 框架。由于几个原因，这可能是好的。例如，在 React 中，你可以做的一件事是在 Rust 中重写 DOM diff 算法，它具有非常符合人体工程学的多线程支持，并行化该算法。

你还可以通过以不同方式分配内存来加快速度。在虚拟 DOM 中，你可以使用特殊的内存分配方案，而不是创建一堆需要垃圾收集的对象。例如，你可以使用具有极其廉价的分配和一次性解除分配的线性分配器方案。这可能有助于加快速度并减少内存使用。

但是你仍然需要通过该代码与 JS 对象（例如组件）进行交互。你不能只是不断地将所有内容复制进和出线性内存，因为这既困难又低效。

因此，你需要能够与浏览器的 GC 集成，以便你可以使用由 JavaScript VM 管理的组件。其中一些 JS 对象需要指向线性内存中的数据，有时线性内存中的数据需要指向 JS 对象。

如果这最终会产生循环，则可能会给垃圾收集器带来麻烦。这意味着垃圾收集器将无法判断对象是否已被使用，因此它们将永远不会被收集。WebAssembly 需要与 GC 集成以确保这些类型的跨语言数据依赖项起作用。

这也将有助于编译为 JS 的静态类型语言，如 Scala.js、Reason、Kotlin 或 Elm。这些语言在编译为 JS 时使用 JavaScript 的垃圾收集器。因为 WebAssembly 可以使用相同的 GC（引擎内置的那个），所以这些语言将能够编译为 WebAssembly 并使用相同的垃圾收集器。他们不需要改变 GC 为他们工作的方式。

### 技能：异常处理

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-02-SS-02-exception-e1540220563466-768x238.png" width=500/>

我们还需要更好的支持来处理异常。

一些语言，比如 Rust，没有异常。但在其他语言中，如 C++、JS 或 C#，有时会广泛使用异常处理。

你当前可以使用 polyfill 异常处理，但是 polyfill 会使代码运行非常缓慢。所以编译为 WebAssembly 时的默认设置是当前编译时不进行异常处理。

但是，由于 JavaScript 有异常，即使你编译代码不使用它们，JS 也可能会抛出异常。如果你的 WebAssembly 函数调用抛出的 JS 函数，则 WebAssembly 模块将无法正确处理异常。所以在这种情况下，像 Rust 这样的语言选择中止。我们需要更好地完成这项工作。

### 技能：调试

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-02-SS-03-debugging-e1540220592314-768x244.png" width=500/>

使用 JS 和编译为 JS 语言的人们习惯的另一件事是良好的调试支持。所有主要浏览器中的 Devtools 使单步执行 JS 变得容易。我们需要同样级别的支持来在浏览器中调试 WebAssembly。

### 技能：尾调用

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-02-SS-04-tail-calls-e1540220637629-768x246.png" width=500/>

最后，对于许多函数式语言，你需要支持称为[尾调用](https://en.wikipedia.org/wiki/Tail_call)的东西。我不打算详细介绍这方面的内容，但基本上它可以让你调用新函数而无需向堆栈添加新的堆栈帧。所以对于支持这一点的函数式语言，我们希望 WebAssembly 也支持它。

### 关于这些我们在哪里呢？

那么关于这些我们在哪里呢？

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-03-P-04-e1540220662110-768x240.png" width=500/>

#### 垃圾收集

对于垃圾回收，目前有两个提案正在进行中：

JS 的 [Typed Objects 提案](https://github.com/tschneidereit/proposal-typed-objects)和 [WebAssembly 的 GC 提案](https://github.com/WebAssembly/gc)。类型化对象将使描述对象的固定结构成为可能。这是一个解释方案，该提案将在即将举行的 TC39 会议上讨论。

WebAssembly GC 提案将使直接访问该结构成为可能。该提案正在积极制定中。

有了这两者，JS 和 WebAssembly 都知道对象是什么样子，并且可以共享该对象并有效地访问存储在其上的数据。我们的团队实际上已经有了这个工作的原型。但是，这些还需要一些时间才能通过标准化，因此我们可能会在明年的某个时候进行研究。

#### 异常处理

[异常处理](https://github.com/WebAssembly/exception-handling/blob/master/proposals/Exceptions.md)仍处于研究和开发阶段，现在有工作看它是否可以利用其他提案，例如我之前提到的引用类型提案。

#### 调试

对于调试，目前在浏览器开发工具中有一些支持。比如在 Firefox 调试器中可以单步调试 WebAssembly 的文本格式，但还是不理想。我们希望能够向你展示你在实际源代码中的位置，而不是在“汇编”中。为此，我们需要做的是弄清楚源映射（或源映射类型的事物）如何为 WebAssembly 工作。因此，WebAssembly CG 的一个子组致力于指定这一点。

#### 尾调用

[尾调用提案](https://github.com/WebAssembly/tail-call/blob/master/proposals/tail-call/Overview.md)也在进行中。

一旦这些都到位，我们将解锁 JS 框架和许多编译为 JS 的语言。

<img src="https://hacks.mozilla.org/files/2018/10/01-05-high-level-04-final-e1540220704600-768x621.png" width=500/>

所以，这些都是我们可以在浏览器中解锁的成就。但是在浏览器之外呢？

# 浏览器之外

现在，当我谈论“浏览器之外”时，你可能会感到困惑。因为浏览器不是你用来查看 Web 的吗？WebAssembly 的名字对不对？

但事实是你在浏览器中看到的东西 —— HTML、CSS 和 JavaScript —— 只是构成 Web 的一部分。它们是可见的部分 —— 它们是你用来创建用户接口的东西 —— 所以它们是最明显的。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-02-browser-toolbox-e1540221152912-768x338.png" width=500/>

但是 Web 中还有另一个非常重要的部分，它具有不那么明显的属性。

那就是链接。这是一种非常特殊的链接。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-03-link-e1540220782538-768x332.png" width=500/>

这个链接的创新之处在于，我可以链接到你的页面，而无需将其放在中央注册表中，也无需询问你甚至不知道你是谁。我可以把那个链接放在那里。

正是这种轻松的链接，没有任何监督或审批瓶颈，使我们的 Web 成为可能。这就是让我们能够与我们不认识的人形成这些全球社区的原因。

但是，如果我们只有链接，那么这里有两个问题我们还没有解决。

第一个是……你去访问这个网站，它会向你提供一些代码。它怎么知道它应该向你交付什么样的代码？因为如果你在 Mac 上运行，那么你需要与在 Windows 上不同的机器代码。这就是为什么对于不同的操作系统有不同版本的程序。

那么网站是否应该为每种可能的设备提供不同版本的代码？不。

相反，该站点有一个版本的代码 —— 源代码。这就是交付给用户的内容。然后它被翻译成用户设备上的机器代码。

这个概念的名称是可移植性。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-04-portability-02-e1540220821857-768x522.png" width=500/>

太好了，你可以从不认识你并且不知道你正在运行的设备类型的人那里加载代码。

但这给我们带来了第二个问题。如果你不认识你正在加载的网页的这些人，你怎么知道他们给你什么样的代码？它可能是恶意代码。它可能试图接管你的系统。

Web 的这种愿景 —— 运行来自你所关注链接的任何人的代码 —— 是否意味着你必须盲目信任 Web 上的任何人？

这是来自 Web 的另一个关键概念的用武之地。

这就是安全模型。我将称之为沙箱。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-04-security-02-e1540220859323-768x378.png" width=500/>

基本上，浏览器获取页面 —— 其他人的代码 —— 而不是让它在你的系统中随意运行，而是将它放在一个沙箱中。它将一些没有危险的玩具放入沙箱中，以便代码可以做一些事情，但它将危险的事情留在沙箱之外。

所以链接的效用基于以下两点：

- 可移植性 —— 将代码交付给用户并使其在可以运行浏览器的任何类型的设备上运行的能力。

- 还有沙箱 —— 这种安全模型可以让你运行该代码而不会冒着机器完整性的风险。

那么为什么这种区别很重要呢？如果我们将 Web 视为浏览器使用 HTML、CSS 和 JS 向我们展示的东西，或者如果我们将 Web 视为可移植性和沙箱，为什么会有所不同？

因为它改变了你对 WebAssembly 的看法。

你可以将 WebAssembly 视为浏览器工具箱中的另一个工具……确实如此。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-04-wasm-in-tb-1-e1540221053348-768x346.png" width=500/>

它是浏览器工具箱中的另一个工具。但不仅如此。它还为我们提供了一种方法，可以将 Web 的另外两个功能 —— 可移植性和安全模型 —— 带到其他需要它们的场景中。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-intro-06-expand-02-e1540220978397-768x336.png" width=500/>

我们可以将 Web 扩展到浏览器的边界之外。现在让我们看看 Web 的这些属性在哪里有用。

## Node.js

<img src="https://hacks.mozilla.org/files/2018/10/01-06-node-01-A-e1540221197730-768x425.png" width=500/>

WebAssembly 如何帮助 Node？它可以为 Node.js 带来完全的可移植性。

Node 为你提供了 JavaScript 在 Web 上的大部分可移植性。但是在很多情况下，Node 的 JS 模块还不够用 —— 你需要提高性能或重用不是用 JS 编写的现有代码。

在这些情况下，你需要 Node 的原生模块。这些模块是用 C 等语言编写的，需要针对用户运行的特定类型的机器进行编译。

原生模块要么在用户安装时编译，要么为众多不同的系统预编译成二进制文件。这些方法之一是用户的痛苦，另一种是包维护者的痛苦。

现在，如果这些原生模块是用 WebAssembly 编写的，那么它们就不需要专门针对目标架构进行编译。相反，它们只是像 Node 中的 JavaScript 一样运行。但他们会以近乎原生的性能做到这一点。

因此，我们获得了在 Node.js 中运行的代码的完全可移植性。你可以使用完全相同的 Node 应用程序并在所有不同类型的设备上运行它，而无需编译任何内容。

但是 WebAssembly 不能直接访问系统资源。 Node 中的原生模块没有被沙箱化 —— 它们可以完全访问浏览器保留在沙箱之外的所有危险玩具。在 Node 中，JS 模块也可以访问这些危险的玩具，因为 Node 使它们可用。例如，Node 提供了从系统读取文件和向系统写入文件的方法。

对于 Node 的情况，模块对危险的系统 API 进行这种访问是有一定意义的。因此，如果 WebAssembly 模块默认没有这种访问权限（就像 Node 的当前模块那样），我们怎么能给 WebAssembly 模块提供它们需要的访问权限？我们需要传入函数，以便 WebAssembly 模块可以与操作系统一起工作，就像 Node 与 JS 一样。

对于 Node，这可能会包含很多 C 标准库之类的功能。它还可能包括 POSIX 的一部分—— 可移植的操作系统接口—— 这是一个有助于兼容性的旧标准。它提供了一个 API，用于跨一堆不同的类 Unix 操作系统与系统交互。模块肯定需要一堆类似 POSIX 的函数。

### 技能：可移植的接口

<img src="https://hacks.mozilla.org/files/2018/10/01-06-node-01-SS-e1540221292681-768x298.png" width=500/>

Node 核心人员需要做的是弄清楚要公开的函数集和要使用的 API。

但如果这真的是标准的东西，那不是很好吗？不是特定于 Node 的东西，但也可以在其他运行时和场景中使用？

如果你愿意，可以为 WebAssembly 使用 POSIX。 PWSIX？一个可移植的 WebAssembly 系统接口。

如果以正确的方式完成，你甚至可以为 Web 实现相同的 API。这些标准 API 可以填充到现有的 Web API 上。

这些函数不会成为 WebAssembly 规范的一部分。并且会有 WebAssembly 宿主不提供它们。但是对于那些可以使用它们的平台，无论代码在哪个平台上运行，都会有一个统一的 API 来调用这些函数。这将使通用模块 —— 在 Web 和 Node 上运行的模块 —— 变得更加容易。

### 关于这些我们在哪里呢？

那么，这真的可能发生吗？

有一些事情对这个想法有利。有一个名为[包名称映射](https://github.com/WICG/import-maps)的提案，它将提供一种机制，用于将模块名称映射到加载模块的路径。浏览器和 Node 可能都支持这种方式，它们可以使用它来提供不同的路径，从而加载完全不同的模块，但具有相同的 API。这样， .wasm 模块本身可以指定一个（模块名称，函数名称）导入对，可以在不同的环境中工作，甚至是 Web。

有了这种机制，剩下要做的就是弄清楚哪些函数有意义以及它们的接口应该是什么。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-node-01-P-e1540221369730-768x287.png" width=500/>

目前没有这方面的积极工作。但是现在很多讨论都朝着这个方向发展。它看起来很可能以一种或另一种形式发生。

这很好，因为解锁它可以让我们解锁浏览器之外的其他一些场景。有了这个，我们就可以加快步伐。

<img src="https://hacks.mozilla.org/files/2018/10/01-06-node-04-final-768x462.png" width=500/>

那么，这些其他场景的一些示例是什么？

## CDNs, Serverless 和边缘计算

<img src="https://hacks.mozilla.org/files/2018/10/01-07-runtime-01-A-cloud-e1540221412524-768x427.png" width=500/>

一个例子是 CDN、Serverless 和边缘计算等。在这些情况下，你将代码放在其他人的服务器上，并确保服务器得到维护并且代码靠近所有用户。

为什么要在这些情况下使用 WebAssembly？最近在一次会议上有一个很好的演讲解释了这一点。

Fastly 是一家提供 CDN 和边缘计算的公司。他们的 CTO Tyler McMullen 是[这样解释的](https://www.youtube.com/watch?v=FkM1L8-qcjU)（我在这里解释一下）：

如果你查看一个进程是如何工作的，那么进程中的代码没有边界。函数可以访问他们想要的进程中的任何内存，并且他们可以调用他们想要的任何其他函数。

当你在同一个进程中运行一堆不同人的服务时，这是一个问题。沙盒可能是解决这个问题的一种方式。但随后你会遇到规模问题。

例如，如果你使用像 Firefox 的 SpiderMonkey 或 Chrome 的 V8 这样的 JavaScript VM，你将获得一个沙箱，你可以将数百个实例放入一个进程中。但是随着 Fastly 服务的请求数量众多，每个进程不仅需要数百个，还需要数万个。

Tyler 在他的演讲中更好地解释了所有这些，所以你应该去看看。但关键是 WebAssembly 为 Fastly 提供了此用例所需的安全性、速度和规模。

那么他们需要什么来完成这项工作？

### 技能：运行时

<img src="https://hacks.mozilla.org/files/2018/10/01-07-runtime-02-SS-e1540221444910-768x287.png" width=500/>

他们需要创建自己的运行时。这意味着采用 WebAssembly 编译器 —— 可以将 WebAssembly 编译成机器码的东西 —— 并将它与我之前提到的与系统交互的函数结合起来。

对于 WebAssembly 编译器，Fastly 使用了 [Cranelift](https://github.com/bytecodealliance/cranelift)，我们也在 Firefox 中构建了该编译器。它的设计速度非常快，并且不会使用太多内存。

现在，对于与系统其余部分交互的功能，他们必须创建自己的功能，因为我们还没有那个可移植的接口可用。

因此，今天可以创建自己的运行时，但需要付出一些努力。这种努力必须在不同的公司之间重复进行。

如果我们不仅拥有可移植的接口，而且还有一个可以在所有这些公司和其他场景中使用的通用运行时会怎样？那肯定会加速发展。

然后其他公司可以直接使用该运行时 —— 就像他们今天使用 Node 一样 —— 而不是从头开始创建自己的运行时。

### 关于这些我们在哪里呢？

那么这是什么状态呢？

尽管还没有标准的运行时，但现在有一些运行时项目正在运行中。其中包括构建在 LLVM 之上的 [WAVM](https://github.com/WAVM/WAVM) 和 wasmjit。

此外，我们正在计划一个构建在 Cranelift 之上的运行时，称为 wasmtime。

一旦我们有了一个通用的运行时，就可以加快针对一系列不同场景的开发。例如…

## 可移植的 CLI 工具

<img src="https://hacks.mozilla.org/files/2018/10/01-07-runtime-05-A-cli-e1540221504824-768x421.png" width=500/>

WebAssembly 也可以在更传统的操作系统中使用。现在要明确一点，我不是在内核中谈论（尽管勇敢的灵魂也在尝试），而是在 Ring 3 中运行的 WebAssembly —— 在用户模式下。

然后你可以做一些事情，比如拥有可在所有不同类型的操作系统中使用的可移植的 CLI 工具。

这与另一个场景非常接近......

## 物联网

<img src="https://hacks.mozilla.org/files/2018/10/01-07-runtime-05-A-iot-e1540221544774-768x425.png" width=500/>

物联网包括可穿戴技术和智能家电等设备。

这些设备通常是资源受限的 —— 它们没有太多的计算能力，也没有太多的内存。这正是像 Cranelift 这样的编译器和像 wasmtime 这样的运行时会大放异彩的情况，因为它们将高效且低内存。在资源极度受限的情况下，WebAssembly 可以在将应用程序加载到设备上之前完全编译为机器代码。

还有一个事实是，这些不同的设备太多了，而且它们都略有不同。 WebAssembly 的可移植性真的会对此有所帮助。

所以这是 WebAssembly 有未来的另一个地方。

# 结论

现在让我们缩小并查看这棵技能树。

<img src="https://2r4s9p1yi1fa2jd7j43zph8r-wpengine.netdna-ssl.com/files/2018/10/01-07-runtime-09-final-500x301.png" width=500/>

我在这篇文章的开头说过，人们对 WebAssembly 有一种误解 —— 认为进入 MVP 的 WebAssembly 就是 WebAssembly 的最终版本。

我想你现在可以明白为什么这是一个误解。

是的，MVP 开辟了很多机会。它使将许多桌面应用程序带入 Web 成为可能。但是我们还有很多用例需要解锁，从重量级的桌面应用程序到小模块，再到 JS 框架，再到浏览器之外的所有东西……Node.js、Serverless、区块链和可移植的 CLI 工具，以及物联网。

所以我们今天拥有的 WebAssembly 并不是这个故事的结束 —— 它只是一个开始。

## 关于[Lin Clark](https://twitter.com/linclark)

Lin 在 Mozilla 从事高级开发工作，专注于 Rust 和 WebAssembly。

[Lin Clark 的更多文章……](https://hacks.mozilla.org/author/lclarkmozilla-com/)
