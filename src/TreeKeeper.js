import { assignPropsToElement } from './DOMElement'

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

// TODO: experiment with Proxies
const bindAndAssign = (object, prototype) => {
  Object.keys(prototype).forEach(prop => {
    if(typeof prototype[prop] === 'function') {
      object[prop] = prototype[prop].bind(object)
    }
  })
}

const componentNodeAndChildren = (element, vdomPath, vdomParentPath, treeKeeper) => {
  let instance = treeKeeper.prevVDOMTree[vdomPath]
      ? treeKeeper.prevVDOMTree[vdomPath].instance
      : undefined

  const isInstanceFresh = instance === undefined
  if(!isInstanceFresh) {
    if(instance.componentWillReceiveProps !== undefined) {
      instance.componentWillReceiveProps(element.props)
    }
    instance.props = element.props
    instance.children = element.children
  } else {
    instance = Object.create(element.component)
    bindAndAssign(instance, element.component)
    instance.props = element.props
    instance.children = element.children
    instance.__treeKeeper = treeKeeper
    instance.__vdomPath = vdomPath
    instance.__vdomParentPath = vdomParentPath
    instance.__element = element

    if(instance.getInitialState) {
      const state = instance.getInitialState(element.props)
      instance.state = state
    }
    // TODO: bind the methods
  }

  const shouldRender = isInstanceFresh ||
    (instance.shouldComponentUpdate === undefined) ||
    instance.shouldComponentUpdate(element.props)

  const representativeElementTree = shouldRender
    ? instance.render()
    : treeKeeper.prevVDOMTree[vdomPath + '-representative'].element

  const childrenWithPaths = [{
    element: representativeElementTree,
    vdomPath: vdomPath + '-representative'
  }]
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
    childVDOMPaths: [vdomPath + '-representative'],
  }

  return { childrenWithPaths, vdomNode, updateChildren: shouldRender }
}

TreeKeeperPrototype.shallowDeclareElement = function(
  vdomPath,
  elementsToDeclareByPath,
  parentPathsByPath,
  pathsToVisit
) {
  const vdomParentPath = parentPathsByPath[vdomPath]
  const nextElement = elementsToDeclareByPath[vdomPath]
  const prevVDOMNode = this.prevVDOMTree[vdomPath]

  if(prevVDOMNode && !nextElement) {
    this.removeVDOMNode(vdomPath)
    prevVDOMNode.childVDOMPaths.forEach(childVDOMPath => {
      elementsToDeclareByPath[childVDOMPath] = false
      parentPathsByPath[childVDOMPath] = vdomPath
    })
    Array.prototype.push.apply(pathsToVisit, prevVDOMNode.childVDOMPaths)
    return
  }

  let childrenWithPaths, vdomNode
  let updateChildren = true
  if(typeof nextElement !== 'object') {
    ({ vdomNode, childrenWithPaths } = primitiveNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if(typeof nextElement.component === 'string') {
    ({ vdomNode, childrenWithPaths } = stringNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if (Array.prototype.isPrototypeOf(nextElement)) {
    ({ vdomNode, childrenWithPaths } = arrayNodeAndChildren(nextElement, vdomPath, vdomParentPath))
  } else if (typeof nextElement.component === 'object') {
    ({ vdomNode, childrenWithPaths, updateChildren } = componentNodeAndChildren(nextElement, vdomPath, vdomParentPath, this))
  } else if (typeof nextElement.component === 'function') {
    // TODO: functional components
    throw new Error('Unimplemented pseudoElement type - functions are not yet supported')
  } else {
    throw new Error('Unsupported pseudoElement - currently only primitives arrays and Reenact.createElement() produced objects are supported ')
  }

  if(updateChildren) {
    for(let i=childrenWithPaths.length-1; i>=0; --i) {
      const { element: childElement, vdomPath: childVDOMPath } = childrenWithPaths[i]
      elementsToDeclareByPath[childVDOMPath] = childElement
      parentPathsByPath[childVDOMPath] = vdomPath
      pathsToVisit.push(childVDOMPath)
    }
    prevVDOMNode && prevVDOMNode.childVDOMPaths.forEach(childVDOMPath => {
      if(!elementsToDeclareByPath[childVDOMPath]) {
        elementsToDeclareByPath[childVDOMPath] = undefined
        parentPathsByPath[childVDOMPath] = vdomPath
        pathsToVisit.push(childVDOMPath)
      }
    })
  }

  this.nextVDOMTree[vdomPath] = vdomNode
  this.flushVNodeToDOMNode(vdomPath)
}

TreeKeeperPrototype.shallowFinishElement = function(vdomPath) {
  const prevVDOMNode = this.prevVDOMTree[vdomPath]
  const nextVDOMNode = this.nextVDOMTree[vdomPath]

  const prevInstance = prevVDOMNode ? prevVDOMNode.instance : undefined
  const nextInstance = nextVDOMNode ? nextVDOMNode.instance : undefined

  // TODO: make sure that the refs are correctly set
  if(prevVDOMNode && prevInstance && nextVDOMNode && nextInstance) {
    nextInstance.componentDidUpdate && nextInstance.componentDidUpdate()
  } else if(nextVDOMNode && nextInstance) {
    nextInstance.componentDidMount && nextInstance.componentDidMount()
  }
}

TreeKeeperPrototype.removeVDOMNode = function(vdomPath) {
  const vdomNode = this.prevVDOMTree[vdomPath]
  if(vdomNode.instance && vdomNode.instance.componentWillUnmount) {
    vdomNode.instance.componentWillUnmount()
  }
  delete this.nextVDOMTree[vdomPath]
  this.flushVNodeToDOMNode(vdomPath)
}

TreeKeeperPrototype.deepDeclareElement = function(element, vdomPath='root', vdomParentPath='') {
  const elementsToDeclareByPath = { [vdomPath]: element }
  const elementsWaitingForMountByPath = { }
  const parentPathsByPath = { [vdomPath]: vdomParentPath }
  const pathsToVisit = [vdomPath]

  while(pathsToVisit.length > 0) {
    const vdomPath = pathsToVisit[pathsToVisit.length-1]
    if(elementsWaitingForMountByPath[vdomPath] === true) {
      this.shallowFinishElement(
        vdomPath,
      )
      pathsToVisit.pop()
    } else {
      this.shallowDeclareElement(
        vdomPath,
        elementsToDeclareByPath,
        parentPathsByPath,
        pathsToVisit,
      )
      elementsWaitingForMountByPath[vdomPath] = true
    }
  }
  this.prevVDOMTree = this.nextVDOMTree
  this.nextVDOMTree = Object.assign({}, this.prevVDOMTree)
}

TreeKeeperPrototype.findRenderableParent = function(vdomTree, vdomPath) {
  let renderableParentVDOMPath = vdomTree[vdomPath].vdomParentPath
  while(renderableParentVDOMPath !== '' && !vdomTree[renderableParentVDOMPath].isDirectlyRenderable) {
    renderableParentVDOMPath = vdomTree[renderableParentVDOMPath].vdomParentPath
  }

  return vdomTree[renderableParentVDOMPath]
}

TreeKeeperPrototype.flushVNodeToDOMNode = function(vdomPath) {
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

  if(prevVDOMNode && !nextVDOMNode) {
    return nextVDOMNode
  }

  // TODO: Test renderable nodes changed to non-renderable
  if(!nextVDOMNode.isDirectlyRenderable) {
    return nextVDOMNode
  }

  const renderableParentVDOM =
    this.findRenderableParent(this.nextVDOMTree, vdomPath)

  let parentRenderedNode = undefined
  if(renderableParentVDOM && !renderableParentVDOM.renderedNode) {
    throw new Error('VDOM changes should be flushed in the DFS order - a node is missing')
  } else if(renderableParentVDOM) {
    parentRenderedNode = renderableParentVDOM.renderedNode
  } else {
    parentRenderedNode = this.rootDOMNode
  }

  let oldRenderedNode
  let newRenderedNode
  let replaceNode = false
  if(isPreviousNodeDirectlyRenderable && prevVDOMNode !== undefined) {
    newRenderedNode = oldRenderedNode = prevVDOMNode.renderedNode
    if(nextVDOMNode.isTextNode) {
      replaceNode = false
      oldRenderedNode.textContent = nextVDOMNode.tag
    } else {
      const canPrevRenderedNodeBeReused = prevVDOMNode.tag === nextVDOMNode.tag
      if(canPrevRenderedNodeBeReused) {
        replaceNode = false
        assignPropsToElement(prevVDOMNode.props, nextVDOMNode.props, nextVDOMNode.element, newRenderedNode)
      } else {
        replaceNode = true
        newRenderedNode = document.createElement(nextVDOMNode.tag)
        assignPropsToElement(undefined, nextVDOMNode.props, nextVDOMNode.element, newRenderedNode)
      }
    }
  } else {
    replaceNode = false
    if(nextVDOMNode.isTextNode) {
      newRenderedNode = document.createTextNode(nextVDOMNode.tag)
    } else {
      newRenderedNode = document.createElement(nextVDOMNode.tag)
      assignPropsToElement(undefined, nextVDOMNode.props, nextVDOMNode.element, newRenderedNode)
    }
  }

  if(oldRenderedNode && oldRenderedNode !== newRenderedNode) {
    parentRenderedNode.replaceChild(newRenderedNode, oldRenderedNode)
  } else if(newRenderedNode && oldRenderedNode !== newRenderedNode) {
    parentRenderedNode.appendChild(newRenderedNode)
  }

  if(newRenderedNode !== undefined) {
    this.nextVDOMTree[vdomPath] = {
      ...nextVDOMNode,
      renderedNode: newRenderedNode
    }
  } else {
    this.nextVDOMTree[vdomPath] = {
      ...nextVDOMNode,
      renderedNode: oldRenderedNode
    }
  }
  return this.nextVDOMTree[vdomPath]
}
