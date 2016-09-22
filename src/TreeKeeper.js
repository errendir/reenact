export const CreateTreeKeeper = (rootDOMNode) => {
  return Object.assign(
    Object.create(TreeKeeperPrototype),
    {
      rootDOMNode,
      prevVDOMTree: {},
      nextVDOMTree: {},
    }
  )
}

const TreeKeeperPrototype = {}

const primitiveNodeAndChildren = (element, vdomPath, vdomParentPath) => {
  const childrenWithPaths = []
  const vdomNode = {
    vdomPath,
    vdomParentPath,
    isTextNode: true,
    tag: element,   // TODO: don't reuse this field for text
    props: undefined,
    instance: undefined,
    element: element,
    isDirectlyRenderable: true,
    renderedNode: undefined,
    childVDOMPaths: [],
  }
  return { childrenWithPaths, vdomNode }
}

const stringNodeAndChildren = (element, vdomPath, vdomParentPath) => {
  const childrenWithPaths = element.children
    .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + i }))
  const vdomNode = {
    vdomPath,
    vdomParentPath,
    isTextNode: false,
    tag: element.component,
    props: element.props,
    instance: undefined,
    element: element,
    isDirectlyRenderable: true,
    renderedNode: undefined,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath),
  }
  return { childrenWithPaths, vdomNode }
}

const arrayNodeAndChildren = (element, vdomPath, vdomParentPath) => {
  const childrenWithPaths = element
    .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + (child.props.key !== undefined ? child.props.key : i) }))
  const vdomNode = {
    vdomPath,
    vdomParentPath,
    isTextNode: false,
    tag: undefined,
    props: undefined,
    instance: undefined,
    element: element,
    isDirectlyRenderable: false,
    renderedNode: undefined,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath)
  }
  return { childrenWithPaths, vdomNode }
}

const componentNodeAndChildren = (element, vdomPath, vdomParentPath, treeKeeper) => {
  let instance = treeKeeper.prevVDOMTree[vdomPath]
      ? treeKeeper.prevVDOMTree[vdomPath].instance : undefined

  if(instance) {
    instance.props = element.props
    instance.children = element.children
  } else {
    instance = Object.assign(
      Object.create(element.component),
      {
        props: element.props,
        children: element.children,
        __treeKeeper: treeKeeper,
        __vdomPath: vdomPath,
        __vdomParentPath: vdomParentPath,
        __element: element,
      }
    )
    if(instance.getInitialState) {
      const state = instance.getInitialState(element.props)
      instance.state = state
    }
    // TODO: bind the methods
  }

  const childrenWithPaths =
    [{ element: instance.render(), vdomPath: vdomPath + '-representative' }]
  const vdomNode = {
    vdomPath,
    vdomParentPath,
    isTextNode: false,
    tag: element.component,
    props: element.props,
    instance: instance,
    element: element,
    isDirectlyRenderable: false,
    renderedNode: undefined,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath),
  }

  return { childrenWithPaths, vdomNode }
}

TreeKeeperPrototype.shallowDeclareElement = function(vdomPath, elementsToDeclareByPath, parentPathsByPath) {
  const vdomParentPath = parentPathsByPath[vdomPath]
  const nextElement = elementsToDeclareByPath[vdomPath]
  const prevVDOMNode = this.prevVDOMTree[vdomPath]

  if(prevVDOMNode && !nextElement) {
    this.removeVDOMNode(vdomPath)
    prevVDOMNode.childVDOMPaths.forEach(childVDOMPath => {
      elementsToDeclareByPath[childVDOMPath] = false
      parentPathsByPath[childVDOMPath] = vdomPath
    })
    return prevVDOMNode.childVDOMPaths
  }

  let childrenWithPaths, vdomNode
  if(typeof nextElement !== 'object') {
    ({ vdomNode, childrenWithPaths } = primitiveNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if(typeof nextElement.component === 'string') {
    ({ vdomNode, childrenWithPaths } = stringNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if (Array.prototype.isPrototypeOf(nextElement)) {
    ({ vdomNode, childrenWithPaths } = arrayNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if (typeof nextElement.component === 'object') {
    ({ vdomNode, childrenWithPaths } = componentNodeAndChildren(nextElement, vdomPath, vdomParentPath, this))
  } else if (typeof nextElement.component === 'function') {
    // TODO: functional components
    throw new Error('Unimplemented pseudoElement type - functions are not yet supported')
  } else {
    throw new Error('Unsupported pseudoElement - currently only primitives arrays and Reenact.createElement() produced objects are supported ')
  }

  const childVDOMPaths = []

  childrenWithPaths.forEach(({ element: childElement, vdomPath: childVDOMPath }) => {
    elementsToDeclareByPath[childVDOMPath] = childElement
    parentPathsByPath[childVDOMPath] = vdomPath
    childVDOMPaths.push(childVDOMPath)
  })
  prevVDOMNode && prevVDOMNode.childVDOMPaths.forEach(childVDOMPath => {
    if(!elementsToDeclareByPath[childVDOMPath]) {
      elementsToDeclareByPath[childVDOMPath] = false
      parentPathsByPath[childVDOMPath] = vdomPath
      childVDOMPaths.push(childVDOMPath)
    }
  })

  this.nextVDOMTree[vdomPath] = vdomNode
  return childVDOMPaths
}

TreeKeeperPrototype.removeVDOMNode = function(vdomPath) {
  delete this.nextVDOMTree[vdomPath]
}

TreeKeeperPrototype.deepDeclareElement = function(element, vdomPath='root', vdomParentPath='') {
  const elementsToDeclareByPath = { [vdomPath]: element }
  const parentPathsByPath = { [vdomPath]: vdomParentPath }
  const pathsToVisit = [vdomPath]

  while(pathsToVisit.length > 0) {
    const vdomPath = pathsToVisit.pop()
    const childrenPaths = this.shallowDeclareElement(vdomPath, elementsToDeclareByPath, parentPathsByPath)
    pathsToVisit.splice(pathsToVisit.length, 0, ...childrenPaths)
  }

  // TODO: Don't flush the entire tree - stop on shouldComponentUpdating components
  this.flushVDOMToDOM(vdomPath)
}

TreeKeeperPrototype.findRenderableParent = function(vdomTree, vdomPath) {
  let renderableParentVDOMPath = vdomTree[vdomPath].vdomParentPath
  while(renderableParentVDOMPath !== '' && !vdomTree[renderableParentVDOMPath].isDirectlyRenderable) {
    renderableParentVDOMPath = vdomTree[renderableParentVDOMPath].vdomParentPath
  }

  return vdomTree[renderableParentVDOMPath]
}

const emptyObject = {}

const assignPropsToElement = function(oldProps, newProps, node) {
  oldProps = oldProps || emptyObject
  newProps = newProps || emptyObject
  Object.keys(newProps).forEach(attributeName => {
    if(attributeName === 'style' || attributeName === 'key' || attributeName === 'ref') return
    const newAttributeValue = newProps[attributeName]
    const oldAttributeValue = oldProps[attributeName]
    if(newAttributeValue !== oldAttributeValue) {
      node.setAttribute(attributeName, newAttributeValue)
    }
  })
  Object.keys(oldProps).forEach(attributeName => {
    if(attributeName === 'style' || attributeName === 'key' || attributeName === 'ref') return
    if(newProps[attributeName] !== undefined) return
    node.removeAttribute(attributeName)
  })

  const newStyle = newProps['style'] || emptyObject
  const oldStyle = oldProps['style'] || emptyObject
  Object.keys(newStyle).forEach(styleName => {
    const newStyleValue = newStyle[styleName]
    const oldStyleValue = oldStyle[styleName]
    if(newStyleValue !== oldStyleValue) {
      node.style[styleName] = newStyleValue
    }
  })
  Object.keys(oldStyle).forEach(styleName => {
    if(newStyle[styleName] !== undefined) return
    const oldStyleValue = oldStyle[styleName]
    if(newStyleValue !== oldStyleValue) {
      node.style.removeProperty(styleName)
    }
  })
}

TreeKeeperPrototype.flushVNodeToNode = function(vdomPath) {
  const nextVDOMNode = this.nextVDOMTree[vdomPath]
  const prevVDOMNode = this.prevVDOMTree[vdomPath]

  const isPreviousNodeDirectlyRenderable =
    prevVDOMNode && prevVDOMNode.isDirectlyRenderable
  const isNextNodeDirectlyRenderable =
    nextVDOMNode && nextVDOMNode.isDirectlyRenderable
  if(isPreviousNodeDirectlyRenderable && !isNextNodeDirectlyRenderable) {
    const renderableParentVDOM = this.findRenderableParent(this.prevVDOMTree, vdomPath)
    const parentRenderedNode = renderableParentVDOM.renderedNode || this.rootDOMNode
    parentRenderedNode.removeChild(prevVDOMNode.renderedNode)
  }

  if(prevVDOMNode && !nextVDOMNode) return nextVDOMNode

  // TODO: There is an issue with renderable nodes changed to non-renderable not being removed
  if(!nextVDOMNode.isDirectlyRenderable) return nextVDOMNode

  const renderableParentVDOM =
    this.findRenderableParent(this.nextVDOMTree, vdomPath)

  let parentRenderedNode = undefined
  if(renderableParentVDOM && !renderableParentVDOM.renderedNode) {
    throw new Error('VDOM changes should be flushed in the BFS order - a node is missing')
  } else if(renderableParentVDOM) {
    parentRenderedNode = renderableParentVDOM.renderedNode
  } else {
    parentRenderedNode = this.rootDOMNode
  }

  let oldRenderedNode
  let newRenderedNode
  let replaceNode = false
  if(prevVDOMNode !== undefined) {
    oldRenderedNode = prevVDOMNode.renderedNode
    newRenderedNode = prevVDOMNode.renderedNode
    if(nextVDOMNode.isTextNode) {
      replaceNode = false
      oldRenderedNode.textContent = nextVDOMNode.tag
    } else {
      const canPrevRenderedNodeBeReused = prevVDOMNode.tag === nextVDOMNode.tag
      if(canPrevRenderedNodeBeReused) {
        replaceNode = false
        assignPropsToElement(prevVDOMNode.props, nextVDOMNode.props, newRenderedNode)
      } else {
        replaceNode = true
        newRenderedNode = document.createElement(nextVDOMNode.tag)
        assignPropsToElement(undefined, nextVDOMNode.props, newRenderedNode)
      }
    }
  } else {
    replaceNode = false
    if(nextVDOMNode.isTextNode) {
      newRenderedNode = document.createTextNode(nextVDOMNode.tag)
    } else {
      newRenderedNode = document.createElement(nextVDOMNode.tag)
      assignPropsToElement(undefined, nextVDOMNode.props, newRenderedNode)
    }
  }

  if(oldRenderedNode && oldRenderedNode !== newRenderedNode) {
    parentRenderedNode.replaceChild(newRenderedNode, oldRenderedNode)
  } else if(newRenderedNode) {
    parentRenderedNode.appendChild(newRenderedNode)
  }

  if(newRenderedNode !== undefined) {
    return { ...nextVDOMNode, renderedNode: newRenderedNode }
  } else {
    return { ...nextVDOMNode, renderedNode: oldRenderedNode }
  }
}

TreeKeeperPrototype.flushVDOMToDOM = function(startingVDOMPath) {
  let vdomPaths = [startingVDOMPath]
  while(vdomPaths.length > 0) {
    const vdomPath = vdomPaths.pop()
    const updatedVNode = this.flushVNodeToNode(vdomPath)
    if(this.nextVDOMTree[vdomPath]) {
      this.nextVDOMTree[vdomPath] = updatedVNode
    }

    const prevChildVDOMPaths = this.prevVDOMTree[vdomPath]
      ? this.prevVDOMTree[vdomPath].childVDOMPaths : []
    const nextChildVDOMPaths = this.nextVDOMTree[vdomPath]
      ? this.nextVDOMTree[vdomPath].childVDOMPaths : []

    const allVDomPaths = nextChildVDOMPaths.slice().reverse()
    prevChildVDOMPaths.forEach(childVDOMPath => {
      // WARNING: This asserts that the nextVDOMTree will NOT contain any orphaned nodes
      if(this.nextVDOMTree[childVDOMPath] === undefined) {
        allVDomPaths.push(childVDOMPath)
      }
    })

    vdomPaths.unshift(...allVDomPaths)
  }

  this.prevVDOMTree = this.nextVDOMTree
  this.nextVDOMTree = Object.assign({}, this.prevVDOMTree)
}
