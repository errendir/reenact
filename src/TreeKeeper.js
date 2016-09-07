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

const primitiveNodeAndChildren = (element, vdomPath) => {
  const childrenWithPaths = []
  const vdomNode = {
    path: vdomPath,
    isTextNode: true,
    tag: element,   // TODO: don't reuse this field for text
    instance: null,
    element: element,
    isDirectlyRenderable: true,
    renderedNode: null,
    childVDOMPaths: [],
  }
  return { childrenWithPaths, vdomNode }
}

const stringNodeAndChildren = (element, vdomPath) => {
  const childrenWithPaths = element.children
    .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + i }))
  const vdomNode = {
    path: vdomPath,
    isTextNode: false,
    tag: element.component,
    instance: null,
    element: element,
    isDirectlyRenderable: true,
    renderedNode: null,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath),
  }
  return { childrenWithPaths, vdomNode }
}

const arrayNodeAndChildren = (element, vdomPath) => {
  const childrenWithPaths = element
    .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + (child.props.key !== undefined ? child.props.key : i) }))
  const vdomNode = {
    path: vdomPath,
    isTextNode: false,
    tag: null,
    instance: null,
    element: element,
    isDirectlyRenderable: false,
    renderedNode: null,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath)
  }
  return { childrenWithPaths, vdomNode }
}

const componentNodeAndChildren = (element, vdomPath, treeKeeper) => {
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
    path: vdomPath,
    isTextNode: false,
    tag: element.component,
    instance: instance,
    element: element,
    isDirectlyRenderable: false,
    renderedNode: null,
    childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath),
  }

  return { childrenWithPaths, vdomNode }
}

TreeKeeperPrototype.shallowDeclareElement = function(prevVDOMNode, nextElement, vdomPath) {
  if(prevVDOMNode && !nextElement) {
    this.removeVDOMNode(vdomPath)
    return prevVDOMNode.childVDOMPaths.map(vdomPath => ({ vdomPath, element: undefined }))
  }

  let childrenWithPaths, vdomNode
  if(typeof nextElement !== 'object') {
    ({ vdomNode, childrenWithPaths } = primitiveNodeAndChildren(nextElement, vdomPath))
  } else if(typeof nextElement.component === 'string') {
    ({ vdomNode, childrenWithPaths } = stringNodeAndChildren(nextElement, vdomPath))
  } else if (Array.prototype.isPrototypeOf(nextElement)) {
    ({ vdomNode, childrenWithPaths } = arrayNodeAndChildren(nextElement, vdomPath))
  } else if (typeof nextElement.component === 'object') {
    ({ vdomNode, childrenWithPaths } = componentNodeAndChildren(nextElement, vdomPath, this))
  } else if (typeof nextElement.component === 'function') {
    // TODO: functional components
    throw new Error('Unimplemented pseudoElement type - functions are not yet supported')
  } else {
    throw new Error('Unsupported pseudoElement - currently only primitives arrays and Reenact.createElement() produced objects are supported ')
  }

  // TODO: improve the performance of the follwing
  if(prevVDOMNode) {
    prevVDOMNode.childVDOMPaths.forEach(vdomPath => {
      if(childrenWithPaths.find(({ element, vdomPath: childVDOMPath}) => vdomPath === childVDOMPath) === undefined) {
        childrenWithPaths.push({ vdomPath, element: undefined })
      }
    })
  }

  this.nextVDOMTree[vdomPath] = vdomNode
  return childrenWithPaths
}

TreeKeeperPrototype.removeVDOMNode = function(vdomPath) {
  delete this.nextVDOMTree[vdomPath]
}

TreeKeeperPrototype.deepDeclareElement = function(element, vdomPath='root') {
  const elementsToDeclare = [{ element, vdomPath }]

  while(elementsToDeclare.length > 0) {
    const { element: nextElement, vdomPath } = elementsToDeclare.pop()
    const prevVDOMNode = this.prevVDOMTree[vdomPath]
    const childrenWithPaths = this.shallowDeclareElement(prevVDOMNode, nextElement, vdomPath)
    elementsToDeclare.splice(elementsToDeclare.length, 0, ...childrenWithPaths)
  }

  this.flushVDOMToDOM()
}

const getParentPath = (vdomPath) => {
  // TODO: don't use the - character in paths
  return vdomPath.split('-').slice(0,-1).join('-')
}

TreeKeeperPrototype.findRenderableParent = function(vdomTree, vdomPath) {
  let renderableParentVDOMPath = getParentPath(vdomPath)
  while(renderableParentVDOMPath !== '' && !vdomTree[renderableParentVDOMPath].isDirectlyRenderable) {
    renderableParentVDOMPath = getParentPath(renderableParentVDOMPath)
  }

  return vdomTree[renderableParentVDOMPath]
}

TreeKeeperPrototype.flushVNodeToNode = function(vdomPath) {
  const nextVDOMNode = this.nextVDOMTree[vdomPath]
  const prevVDOMNode = this.prevVDOMTree[vdomPath]

  if(prevVDOMNode && prevVDOMNode.isDirectlyRenderable && !nextVDOMNode) {
    const renderableParentVDOM = this.findRenderableParent(this.prevVDOMTree, vdomPath)
    const parentRenderedNode = renderableParentVDOM.renderedNode || this.rootDOMNode
    parentRenderedNode.removeChild(prevVDOMNode.renderedNode)
  }

  if(prevVDOMNode && !nextVDOMNode) return nextVDOMNode

  // TODO: There is an issue with renderable nodes changed to non-renderable not being removed
  if(!nextVDOMNode.isDirectlyRenderable) return nextVDOMNode

  const renderableParentVDOM = this.findRenderableParent(this.nextVDOMTree, vdomPath)

  let parentRenderedNode = null
  if(renderableParentVDOM && !renderableParentVDOM.renderedNode) {
    throw new Error('VDOM changes should be flushed in the BFS order - a node is missing')
  } else if(renderableParentVDOM) {
    parentRenderedNode = renderableParentVDOM.renderedNode
  } else if(renderableParentVDOM === undefined) {
    parentRenderedNode = this.rootDOMNode
  } else {
    throw new Error('No DOM node was rendered for ' + renderableParentVDOMPath)
  }

  let oldRenderedNode
  let newRenderedNode
  let replaceNode = false
  if(prevVDOMNode !== undefined) {
    oldRenderedNode = prevVDOMNode.renderedNode
    if(nextVDOMNode.isTextNode) {
      replaceNode = false
      oldRenderedNode.textContent = nextVDOMNode.tag
    } else {
      const canPrevRenderedNodeBeReused = prevVDOMNode.tag === nextVDOMNode.tag
      if(canPrevRenderedNodeBeReused) {
        replaceNode = false
      } else {
        replaceNode = true
        newRenderedNode = document.createElement(nextVDOMNode.tag)
      }
    }
  } else {
    replaceNode = false
    if(nextVDOMNode.isTextNode) {
      newRenderedNode = document.createTextNode(nextVDOMNode.tag)
    } else {
      newRenderedNode = document.createElement(nextVDOMNode.tag)
    }
  }

  if(replaceNode) {
    parentRenderedNode.replaceChild(newRenderedNode, oldRenderedNode)
  } else if(oldRenderedNode && newRenderedNode) {
    parentRenderedNode.removeChild(oldRenderedNode)
    parentRenderedNode.appendChild(newRenderedNode)
  } else if(newRenderedNode) {
    parentRenderedNode.appendChild(newRenderedNode)
  }

  if(newRenderedNode !== undefined) {
    return { ...nextVDOMNode, renderedNode: newRenderedNode }
  } else {
    return { ...nextVDOMNode, renderedNode: oldRenderedNode }
  }
}

TreeKeeperPrototype.flushVDOMToDOM = function() {
  let vdomPaths = ['root']
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

    // TODO: improve the performance of the follwing
    const allVDomPaths = nextChildVDOMPaths.slice().reverse()
    prevChildVDOMPaths.forEach(vdomPath => {
      if(allVDomPaths.indexOf(vdomPath) === -1) {
        allVDomPaths.push(vdomPath)
      }
    })

    vdomPaths.unshift(...allVDomPaths)
  }

  this.prevVDOMTree = this.nextVDOMTree
  this.nextVDOMTree = Object.assign({}, this.prevVDOMTree)
}
