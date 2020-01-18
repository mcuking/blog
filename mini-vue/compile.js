class Compile {
  constructor(el, vm) {
    this.el = isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    if (this.el) {
      // 如果这个元素能获取到则开始编译
      // 1. 先把真实 DOM 移到内存中 fragment
      this.fragment = node2fragment(this.el);
      // 2. 编译 => 提取想要的元素节点 v-model 和文本节点
      this.compile(this.fragment);
      // 3. 把编译好的 fragment 再塞回到页面里
      this.el.appendChild(this.fragment);
    }
  }

  // 编译元素节点，以 <div v-model="a"></div> 为例
  compileElement(node) {
    // attributes 是类数组
    const attributes = node.attributes;
    [...attributes].forEach(attr => {
      const { name, value } = attr;
      // 判断属性名是否包含 v-
      if (isDirective(name)) {
        // 取到对应的值放到节点中
        const [, type] = name.split('-');
        CompileUtils[type](node, this.vm, value);
      }
    });
  }

  // 编译文本节点，以 {{a.b.c}} 为例
  compileText(node) {
    const expr = node.textContent;
    const reg = /\{\{(.+?)\}\}/g;
    if (reg.test(expr)) {
      CompileUtils['text'](node, this.vm, expr);
    }
  }

  compile(fragment) {
    const childNodes = fragment.childNodes;

    [...childNodes].forEach(child => {
      if (isElementNode(child)) {
        this.compileElement(child);
        // 如果是元素，还需要继续遍历它的子节点
        this.compile(child);
      } else {
        this.compileText(child);
      }
    });
  }
}
