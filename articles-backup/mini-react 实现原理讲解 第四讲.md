> 文章首发于我的博客 https://github.com/mcuking/blog/issues/23

> 相关代码请查阅 https://github.com/mcuking/blog/tree/master/mini-react

# 更新属性
本讲接着上一讲diff算法简介，主要介绍其中更新属性的机制。
对比新的vnode的props和老的vnode的props，

- 找到仅存在于新DOM节点属性的集合，调用setAttrs(olddom, onlyInLeft)
- 找到仅存在于旧DOM节点属性的集合，调用removeAttrs(olddom, onlyInRight)
- 找到旧DOM节点和新DOM节点均存在的属性的集合，调用diffAttrs(olddom, bothIn.left, bothIn.right)

```javascript
// 更新属性
const { onlyInLeft, onlyInRight, bothIn } = diffObject(vnode.props, olddom._vnode.props)
setAttrs(olddom, onlyInLeft)
removeAttrs(olddom, onlyInRight)
diffAttrs(olddom, bothIn.left, bothIn.right)

// 比较VNode与旧DOM节点的属性的 交集  差集
function diffObject(leftProps, rightProps) {
    const onlyInLeft = {} // 只存在于新DOM节点属性的集合
    const onlyInRight = {} // 只存在于旧DOM节点属性的集合
    const bothLeft = {} // 共同存在的属性中新DOM节点属性的集合
    const bothRight = {} // 共同存在的属性中旧DOM节点属性的集合

    for (let key in leftProps) {
        if (rightProps[key] === undefined) {
            onlyInLeft[key] = leftProps[key]
        } else {
            bothLeft[key] = leftProps[key]
            bothRight[key] = rightProps[key]
        }
    }

    for (let key in rightProps) {
        if (leftProps[key] === undefined) {
            onlyInRight[key] = rightProps[key]
        }
    }

    return {
        onlyInLeft,
        onlyInRight,
        bothIn: {
            left: bothLeft,
            right: bothRight
        }
    }
}

// 设置DOM节点属性
function setAttrs(dom, props) {
    for (let k in props) {
        // 属性为className时，改为class
        if (k === 'className') {
            dom.setAttribute('class', props[k])
            continue
        }

        // 属性为style时
        if (k === 'style') {
            if (typeof props[k] === 'string') {
                dom.style.cssText = props[k]
            }

            if (typeof props[k] === 'object') {
                for (let v in props[k]) {
                    dom.style[v] = props[k][v]
                }
            }
            continue
        }

        // 属性为on开头的绑定的事件
        if (k[0] === 'o' && k[1] === 'n') {
            dom.addEventListener(k.substring(2).toLowerCase(), props[k], false)
            continue
        }


        // 其余属性直接赋值
        dom.setAttribute(k, props[k])
    }
}

// 去除DOM节点属性
function removeAttrs(dom, props) {
    for (let k in props) {
        if (k === 'className') {
            dom.removeAttribute('class', props[k])
            continue
        }

        if (k === 'style') {
            dom.style.cssText = ''
            continue
        }

        if (k[0] === 'o' && k[1] === 'n') {
            dom.removeEventListener(k.substring(2).toLowerCase(), props[k], false)
            continue
        }

        // 其余属性直接去除
        dom.removeAttribute(k, props[k])
    }
}

// 修改DOM节点属性
function diffAttrs(dom, newProps, oldProps) {
    for (let k in newProps) {
        if (newProps[k] === oldProps[k]) continue

        if (k === 'className') {
            dom.setAttribute('class', newProps[k])
            continue
        }

        if (k === 'style') {
            if (typeof newProps[k] === 'string') {
                dom.style.cssText = newProps[k]
            }

            if (typeof newProps[k] === 'object' && typeof oldProps[k] === 'object') {
                for (let v in newProps[k]) {
                    // 若新属性的css属性与旧属性的css属性不同，则css属性赋值为新属性的css属性
                    if (newProps[k][v] !== oldProps[k][v]) {
                        dom.style[v] = newProps[k][v]
                    }
                }

                // 若旧属性的css属性中某个属性，在新属性的css属性中不存在，则将该css属性设置为空
                for (let v in oldProps[k]) {
                    if (newProps[k][v] === undefined) {
                        dom.style[v] = ''
                    }
                }
            }
            continue
        }

        if (k[0] === 'o' && k[1] === 'n') {
            dom.removeEventListener(k.substring(2).toLowerCase(), oldProps[k], false)
            dom.addEventListener(k.substring(2).toLowerCase(), newProps[k], false)
            continue
        }

        // 其余属性直接赋值
        dom.setAttribute(k, newProps[k])
    }
}
```


相关文章
- [mini-react 实现原理讲解 第一讲](https://github.com/mcuking/blog/issues/20)
- [mini-react 实现原理讲解 第二讲](https://github.com/mcuking/blog/issues/21)
- [mini-react 实现原理讲解 第三讲](https://github.com/mcuking/blog/issues/22)
- [mini-react 实现原理讲解 第四讲](https://github.com/mcuking/blog/issues/23)
- [mini-react 实现原理讲解 第五讲](https://github.com/mcuking/blog/issues/24)
