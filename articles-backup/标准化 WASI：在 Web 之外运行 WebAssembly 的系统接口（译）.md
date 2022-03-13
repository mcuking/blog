> 文章首发于我的博客 https://github.com/mcuking/blog/issues/99

> 原文链接 https://hacks.mozilla.org/2019/03/standardizing-wasi-a-webassembly-system-interface/

今天，我们宣布开始一项新的标准化工作 —— WASI，WebAssembly 系统接口。

**Why**：开发人员开始将 WebAssembly 推向浏览器之外，因为它提供了一种快速、可扩展、安全的方式来在所有机器上运行相同的代码。

但是我们还没有一个坚实的基础可以建立。浏览器之外的代码需要一种与系统对话的方式 —— 系统接口。而 WebAssembly 平台还没有。

**What**：WebAssembly 是一种用于概念机器的汇编语言，而不是物理机器。这就是为什么它可以在各种不同的机器架构上运行。

正如 WebAssembly 是概念机器的汇编语言一样，WebAssembly 需要概念操作系统的系统接口，而不是任何单个操作系统。这样，它就可以在所有不同的操作系统上运行。

这就是 WASI —— WebAssembly 平台的系统接口。

我们的目标是创建一个系统接口，它将成为 WebAssembly 的真正伴侣并经得起时间的考验。这意味着坚持 WebAssembly — 可移植性和安全性的关键原则。

**Who**：我们正在组建一个 WebAssembly 下的子组，专注于标准化 [WASI](https://wasi.dev/)。我们已经聚集了感兴趣的合作伙伴，正在寻找更多的合作伙伴。

以下是我们、我们的合作伙伴和我们的支持者认为这很重要的一些原因：

**Mozilla 首席研发官 Sean White**

“WebAssembly 已经改变了 Web 为人们带来全新的引人入胜的内容的方式，并使开发人员和创作者能够在 Web 上做到极致。到目前为止，这一直是通过浏览器实现的，但是通过 WASI，我们可以将 WebAssembly 和 Web 的好处提供给更多用户、更多地方、更多设备，并作为更多体验的一部分。”

**Fastly 的 CTO Tyler McMullen**

“我们正在让 WebAssembly 超越浏览器，作为在我们的 edge cloud 中快速、安全地执行代码的平台。尽管我们的 edge 和浏览器之间的环境存在差异，但 WASI 意味着 WebAssembly 开发人员不必将他们的代码移植到每个不同的平台。”

**Myles Borins，Node 技术指导委员会主任**

“WebAssembly 可以解决 Node 中最大的问题之一—— 如何获得接近本地的速度并像使用本地模块一样复用其他语言（如 C 和 C++）编写的代码，同时仍然保持可移植性和安全性。标准化这个系统接口是实现这一目标的第一步。”

**Laurie Voss，npm 的联合创始人**

“npm 对 WebAssembly 拥有扩展 npm 生态系统功能的潜力感到非常兴奋，同时极大地简化了让本地代码在服务器端 JavaScript 应用程序中运行的过程。我们期待这个过程的结果。”

所以这里有个大新闻！ 🎉

目前有 3 种 WASI 实现：

- [wasmtime](https://github.com/bytecodealliance/wasmtime)，Mozilla 的 WebAssembly 运行时

- [Lucet](https://www.fastly.com/blog/announcing-lucet-fastly-native-webassembly-compiler-runtime)，Fastly 的 WebAssembly 运行时

- [一个浏览器的 polyfill](https://wasi.dev/polyfill/)

你可以在此视频中看到 WASI 的是如何运行的：

视频链接 https://www.youtube.com/embed/ggtEJC0Jv8A

如果你想更多地了解我们关于此系统接口如何工作的提案，请继续阅读。

## 什么是系统接口？

许多人会想到 C 这样的语言，可以让你直接访问系统资源。但这并不完全正确。

这些语言无法在大多数系统上直接执行诸如打开或创建文件之类的操作。为什么不？

因为这些系统资源 —— 比如文件、内存和网络连接 —— 对于稳定性和安全性来说太重要了。

如果一个程序无意中搞乱了另一个程序的资源，那么它可能会使那个程序崩溃。更糟糕的是，如果一个程序（或用户）故意搞乱另一个程序（或用户）的资源，它可能会窃取敏感数据。

<img src="https://hacks.mozilla.org/files/2019/03/01-01_crash-data-leak-1-768x338.png" width=500/>

所以我们需要一种方法来控制哪些程序和用户可以访问哪些资源。人们很早就意识到了这一点，并想出了一种提供这种控制的方法：`protection ring security`。

通过 `protection ring security`，操作系统基本上在系统资源周围设置了一个保护屏障。这是 kernel（即内核）。kernel 是唯一可以执行诸如创建新文件或打开文件或打开网络连接之类的操作的东西。

用户程序在这个 kernel 之外运行，称为用户模式。如果一个程序想要做任何事情，比如打开一个文件，它必须要求 kernel 为它打开文件。

<img src="https://hacks.mozilla.org/files/2019/03/01-02-protection-ring-sec-1-768x457.png" width=500/>

这就是系统调用概念的用武之地。当程序需要让 kernel 做这些事情时，它会要求使用系统调用。这使 kernel 有机会确定哪个用户在询问。然后它可以在打开文件之前查看该用户是否有权访问该文件。

在大多数设备上，这是你的代码可以访问系统资源的唯一方式 —— 通过系统调用。

<img src="https://hacks.mozilla.org/files/2019/03/01-03-syscall-1-768x349.png" width=500/>

操作系统使得系统调用有效。但是，如果每个操作系统都有自己的系统调用，难道你需要为每个操作系统使用不同版本的代码吗？幸运的是，你没有。

这个问题是如何解决的呢？抽象。

大多数语言都提供标准库。在编码时，程序员不需要知道他们的目标系统是什么。他们只是使用接口。

然后，在编译时，你的工具链会根据你的目标系统选择要使用的接口实现。这个实现使用了来自操作系统 API 中的函数，因此它因系统而异。

这就是系统接口的用武之地。例如，为 Windows 机器编译的 printf 可以使用 Windows API 与机器交互。如果它是为 Mac 或 Linux 编译的，它将改用 POSIX。

<img src="https://hacks.mozilla.org/files/2019/03/02-01-implementations-1-768x409.png" width=500/>

不过，这给 WebAssembly 带来了问题。

使用 WebAssembly，即使在编译时也不知道要针对哪种操作系统。所以你不能在 WebAssembly 实现的标准库中使用任何单个操作系统的系统接口。

<img src="https://hacks.mozilla.org/files/2019/03/02-02-implementations-1-768x399.png" width=500/>

我之前谈到过 WebAssembly 是[一种用于概念机的汇编语言，而不是真正的机器](https://hacks.mozilla.org/2017/02/creating-and-working-with-webassembly-modules/)。同样，WebAssembly 需要一个概念操作系统的系统接口，而不是真正的操作系统。

但是已经有运行时可以在浏览器之外运行 WebAssembly，即使没有这个系统接口。他们是怎么做到的呢？让我们来看看。

## WebAssembly 现在如何在浏览器之外运行？

生成 WebAssembly 的第一个工具是 Emscripten。它在 Web 上模拟特定的操作系统的系统接口 —— POSIX。这意味着程序员可以使用 C 标准库 (libc) 中的函数。

为此，Emscripten 创建了自己的 libc 实现。这个实现被分成了两部分 —— 一部分被编译进了WebAssembly 模块，另一部分是用 JS 胶水代码实现的。然后这个 JS 胶水代码会调用浏览器，然后浏览器会与操作系统对话。

<img src="https://hacks.mozilla.org/files/2019/03/03-01-emscripten-1-768x505.png" width=500/>

大多数早期的 WebAssembly 代码都是用 Emscripten 编译的。因此，当人们开始想要在没有浏览器的情况下运行 WebAssembly 时，他们首先让 Emscripten 编译的代码运行。

因此，这些运行时需要为 JS 胶水代码中的所有这些函数创建自己的实现。

不过这里有一个问题。这个 JS 胶水代码提供的接口不是设计成标准的，甚至不是面向公众的接口。这不是它要解决的问题。

例如，对于在被设计为公共接口的 API 中被称为 read 之类的函数，JS 胶水代码改为使用 `_system3(which, varargs)`。

<img src="https://hacks.mozilla.org/files/2019/03/03-02-system3-1-768x275.png" width=500/>

第一个参数 `which` 是一个整数，它始终与名称中的数字相同（在本例中为 3）。

第二个参数 `varargs` 是要使用的参数。之所以称为可变参数，是因为你可以拥有可变数量的可变参数。但是 WebAssembly 没有提供将可变数量的参数传递给函数的方法。因此，参数是通过线性内存传入的。这不是类型安全的，而且它也比使用寄存器传递参数要慢。

这对于在浏览器中运行的 Emscripten 来说很好。但是现在运行时将其视为事实上的标准，实现了他们自己版本的 JS 胶水代码。他们正在模拟 POSIX 模拟层的内部细节。

这意味着他们正在重新实现基于 Emscripten 约束的选择，例如将参数作为堆值传递，即使这些约束不适用于他们的环境。

<img src="https://hacks.mozilla.org/files/2019/03/03-03-emulation-1-768x524.png" width=500/>

如果我们要构建一个持续数十年的 WebAssembly 生态系统，我们需要坚实的基础。这意味着我们事实上的标准不能是模拟的模拟。

但是我们应该应用什么原则呢？

## WebAssembly 系统接口需要遵循哪些原则？

WebAssembly 中有两个重要的原则：

- 可移植性
- 安全性

当我们转向浏览器之外的场景时，我们需要维护这些关键原则。

事实上，POSIX 和 Unix 的安全访问控制方法并没有让我们达到目标。让我们看看它们的不足之处。

### 可移植性

POSIX 提供源代码可移植性。你可以使用不同版本的 libc 编译相同的源代码以针对不同的机器。

<img src="https://hacks.mozilla.org/files/2019/03/04-01-portability-1-768x576.png" width=500/>

但 WebAssembly 需要更进一步。我们需要能够编译一次并在一大堆不同的机器上运行。我们需要可移植的二进制文件。

<img src="https://hacks.mozilla.org/files/2019/03/04-02-portability-1-768x743.png" width=500/>

这种可移植性使得向用户分发代码变得更加容易。

例如，如果 Node 的原生模块是用 WebAssembly 编写的，那么用户在安装带有原生模块的应用程序时就不需要运行 node-gyp，开发人员也不需要配置和分发几十个二进制文件。

### 安全性

当一行代码要求操作系统执行某些输入或输出时，操作系统需要确定执行代码要求的操作是否安全。

操作系统通常通过基于所有权和组的访问控制来处理此问题。

例如，程序可能会要求操作系统打开一个文件。用户拥有他们有权访问的特定文件集。

当用户启动程序时，程序代表该用户运行。如果用户有权访问文件（因为他们是所有者或因为他们在具有访问权限的组中），那么程序也具有相同的访问权限。

<img src="https://hacks.mozilla.org/files/2019/03/04-03-access-control-1-768x344.png" width=500/>

这可以保护用户免受彼此的侵害。这在开发早期操作系统时很有意义。系统通常是多用户的，管理员控制安装的软件。因此，最突出的威胁是其他用户偷看你的文件。

那已经改变了。现在的系统通常是单用户，但它们运行的​​代码会引入许多其他可信度未知的第三方代码。现在最大的威胁是你自己正在运行的代码会对你不利。

例如，假设你在应用程序中使用的库有一个新的维护者（就像在开源中经常发生的那样）。那个维护者可能对你很感兴趣……，或者他们可能是坏人之一。如果他们有权在你的系统上执行任何操作，例如打开你的任何文件并通过网络发送它们，那么他们的代码可能会造成很大的破坏。

<img src="https://hacks.mozilla.org/files/2019/03/04-04-bitcoin-1-768x396.png" width=500/>

这就是为什么使用可以直接与系统对话的第三方库会很危险的原因。

WebAssembly 的安全方式是不同的。 WebAssembly 是沙盒化的。

这意味着代码不能直接与操作系统对话。但是它如何处理系统资源呢？宿主（可能是浏览器，也可能是 Wasm 运行时）将函数放入代码可以使用的沙箱中。

这意味着宿主可以在每个程序的基础上限制程序可以做什么。它不仅仅让程序代表用户运行，以用户的完全权限调用任何系统调用。

仅仅拥有沙盒机制并不能使系统本身安全，宿主仍然可以将所有功能放入沙盒中，在这种情况下我们也没有更好，但它至少让宿主可以选择创建一个更安全的系统。

<img src="https://hacks.mozilla.org/files/2019/03/04-05-sandbox-1-768x427.png" width=500/>

在我们设计的任何系统接口时，都需要坚持这两个原则。可移植性使开发和分发软件变得更加容易，而为宿主提供工具来保护自己或他们的用户是绝对必要的。

## 这个系统接口应该是什么样的？

鉴于这两个关键原则，WebAssembly 系统接口的设计应该是什么样的？

这就是我们将通过标准化过程弄清楚的。不过，我们确实有一个提案：

- 创建一组模块化的标准接口

- 从标准化最基本的模块 wasi-core 开始

<img src="https://hacks.mozilla.org/files/2019/03/05-01-wasi-1-768x644.png" width=500/>

wasi-core 中会有什么？

wasi-core 将包含所有程序所需的基础内容。它将涵盖与 POSIX 相同的大部分内容，包括文件、网络连接、时钟和随机数等内容。

对于许多这些事情，它将采用与 POSIX 非常相似的方法。例如，它将使用 POSIX 的面向文件的方法，在该方法中，你有系统调用，例如打开、关闭、读取和写入以及其他一切，基本上都提供了增强功能。

但是 wasi-core 不会涵盖 POSIX 所做的一切。例如，进程概念并没有清楚地映射到 WebAssembly。除此之外，说每个 WebAssembly 引擎都需要支持像 `fork` 这样的进程操作是没有意义的。但我们也想让标准化 `fork` 成为可能。

这就是模块化方法的用武之地。通过这种方式，我们可以获得良好的标准化覆盖率，同时仍然允许小众平台仅使用对它们有意义的 WASI 部分。

<img src="https://hacks.mozilla.org/files/2019/03/05-02-wasi-1-768x385.png" width=500/>

像 Rust 这样的语言将直接在其标准库中使用 wasi-core。例如，Rust 的 `open` 是通过在编译为 WebAssembly 时调用 `__wasi_path_open` 来实现的。

对于 C 和 C++，我们创建了一个 [wasi-sysroot](https://github.com/WebAssembly/wasi-libc)，它根据 wasi-core 函数实现了 libc。

<img src="https://hacks.mozilla.org/files/2019/03/05-03-open-imps-1-768x352.png" width=500/>

我们希望像 Clang 这样的编译器准备好与 WASI API 交互，并且像 Rust 编译器和 Emscripten 这样的完整工具链可以使用 WASI 作为其系统实现的一部分。

用户的代码如何调用这些 WASI 函数？

运行代码的运行时将 wasi-core 函数作为导入传入。

<img src="https://hacks.mozilla.org/files/2019/03/05-04-imports-1-768x438.png" width=500/>

这为我们提供了可移植性，因为每个宿主都可以有自己的 wasi-core 实现，专门为他们的平台编写 —— 从 WebAssembly 运行时，如 Mozilla 的 wasmtime 和 Fastly 的 Lucet，到 Node，甚至浏览器。

它还为我们提供了沙箱功能，因为宿主可以逐个程序地选择要传入哪些 wasi 核心函数 —— 哪些系统调用是被允许。这保留了安全性。

<img src="https://hacks.mozilla.org/files/2019/03/05-05-sec-port-2-768x1082.png" width=500/>

WASI 为我们提供了一种进一步扩展这种安全性的方法。它从基于功能的安全性（capability-based security）中引入了更多概念。

传统上，如果代码需要打开一个文件，它会用一个字符串调用 `open`，这个字符串是路径名。然后操作系统会检查代码是否有权限（基于启动程序的用户）。

使用 WASI，如果你正在调用需要访问文件的函数，则必须传入一个文件描述符，该描述符具有附加的权限。这可能是针对文件本身，也可能是针对包含该文件的目录。

这样，你就不能拥有随机要求打开 `/etc/passwd` 的代码。相反，代码只能对传递给它的目录进行操作。

<img src="https://hacks.mozilla.org/files/2019/03/05-06-openat-path-1-768x296.png" width=500/>

这使得可以安全地让沙盒代码更多地访问不同的系统调用 —— 因为这些系统调用的能力是有限的。

这是在逐个模块的基础上发生的。默认情况下，模块无权访问文件描述符。但是如果一个模块中的代码有一个文件描述符，它可以选择将该文件描述符传递给它在其他模块中调用的函数。或者它可以创建更有限版本的文件描述符以传递给其他函数。

因此，运行时将应用程序可以使用的文件描述符传递给顶级代码，然后文件描述符根据需要传播到系统的其余部分。

<img src="https://hacks.mozilla.org/files/2019/03/05-07-file-perms-1-768x649.png" width=500/>

这让 WebAssembly 更接近于最小特权原则，即模块只能访问它完成工作所需的确切资源。

这些概念来自于面向功能系统(capability-oriented systems)，如 CloudABI 和 Capsicum。面向功能系统的一个问题是通常很难将代码移植到它们。但我们认为这个问题是可以解决的。

如果代码已经将 `openat` 与相对文件路径一起使用，则编译代码将正常工作。

如果代码使用 `open` 并且迁移到 `openat` 风格需要太多的前期投资，WASI 可以提供增量解决方案。使用 [libpreopen](https://github.com/musec/libpreopen)，你可以创建应用程序合法需要访问的文件路径列表。然后你可以使用 `open`，但仅限于这些路径。

## 下一步是什么？

我们认为 wasi-core 是一个好的开始。它保留了 WebAssembly 的可移植性和安全性，为生态系统提供了坚实的基础。

但是在 wasi-core 完全标准化之后，我们仍然需要解决一些问题。这些问题包括：

- 异步 I/O

- 文件监听

- 文件锁

这只是开始，所以如果你对如何解决这些问题有想法，[加入我们](https://wasi.dev/);

## 关于[Lin Clark](https://twitter.com/linclark)

Lin 在 Mozilla 从事高级开发工作，专注于 Rust 和 WebAssembly。

[Lin Clark 的更多文章……](https://hacks.mozilla.org/author/lclarkmozilla-com/)
