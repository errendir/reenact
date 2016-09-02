const Reenact = {}
const ReenactDOM = {}

Reenact.createClass = (prototype) => {
  return prototype
}

Reenact.createElement = (component, props, ...children) => {
  return {
    component,
    props,
    children
  }
}

const CreateTreeKeeper = (rootDOMNode) => {
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

TreeKeeperPrototype.shallowAddAndInstantiate = function(element, vdomPath) {
  let instance = null
  let childrenWithPaths = null
  let vdomNode = null
  if(typeof element !== 'object') {
    childrenWithPaths = []
    vdomNode = {
      path: vdomPath,
      isTextNode: true,
      tag: element,   // TODO: don't reuse this field for text
      instance: null,
      isDirectlyRenderable: true,
      renderedNode: null,
      childVDOMPaths: [],
    }
  } else if(typeof element.component === 'string') {
    childrenWithPaths = element.children
      .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + i }))
    vdomNode = {
      path: vdomPath,
      isTextNode: false,
      tag: element.component,
      instance: null,
      isDirectlyRenderable: true,
      renderedNode: null,
      childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath),
    }
  } else if (Array.prototype.isPrototypeOf(element)) {
    childrenWithPaths = element
      .map((child,i) => ({ element: child, vdomPath: vdomPath + '-' + i }))
    vdomNode = {
      path: vdomPath,
      isTextNode: false,
      tag: null,
      instance: instance,
      isDirectlyRenderable: false,
      renderedNode: null,
      childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath)
    }
  } else if (typeof element.component === 'object') {
    instance = Object.assign(
      Object.create(element.component),
      { props: element.props, children: element.children }
    )
    if(instance.getInitialState) {
      const state = instance.getInitialState(element.props)
      instance.state = state
    }
    // TODO: bind the methods
    childrenWithPaths =
      [{ element: instance.render(), vdomPath: vdomPath + '-representative' }]
    vdomNode = {
      path: vdomPath,
      isTextNode: false,
      tag: element.component,
      instance: instance,
      isDirectlyRenderable: false,
      renderedNode: null,
      childVDOMPaths: childrenWithPaths.map(({ vdomPath }) => vdomPath)
    }
  } else if (typeof element.component === 'function') {
    // TODO: functional components
  } else {
    throw new Error('Unsupported pseudoElement - currently only primitives arrays and Reenact.createElement() produced objects are supported ')
  }

  this.nextVDOMTree[vdomPath] = vdomNode
  if(childrenWithPaths === null) debugger
  return childrenWithPaths
}

TreeKeeperPrototype.deepAddAndInstantiate = function(element, vdomPath='root') {
  const elementsToAdd = [{ element, vdomPath }]

  while(elementsToAdd.length > 0) {
    const { element, vdomPath } = elementsToAdd.pop()
    const childrenWithPaths = this.shallowAddAndInstantiate(element, vdomPath)
    elementsToAdd.splice(elementsToAdd.length, 0, ...childrenWithPaths)
  }
}

const getParentPath = (vdomPath) => {
  // TODO: don't use the - character in paths
  return vdomPath.split('-').slice(0,-1).join('-')
}

TreeKeeperPrototype.flushVNodeToNode = function(vdomPath) {
  const nextVDOMNode = this.nextVDOMTree[vdomPath]

  // TODO: Actually do the diff
  const prevVDOMNode = this.prevVDOMTree[vdomPath]

  if(!nextVDOMNode.isDirectlyRenderable) return nextVDOMNode

  let renderableParentVDOMPath = getParentPath(vdomPath)
  while(renderableParentVDOMPath !== '' && !this.nextVDOMTree[renderableParentVDOMPath].isDirectlyRenderable) {
    renderableParentVDOMPath = getParentPath(renderableParentVDOMPath)
  }

  const renderableParentVDOM = this.nextVDOMTree[renderableParentVDOMPath]
  let parentRenderedNode = null
  if(renderableParentVDOM && !renderableParentVDOM.renderedNode) {
    throw new Error('VDOM changes should be flushed in the BFS order - a node is missing')
  } else if(renderableParentVDOM) {
    parentRenderedNode = this.nextVDOMTree[renderableParentVDOMPath].renderedNode
  } else if(renderableParentVDOMPath == '') {
    parentRenderedNode = this.rootDOMNode
  } else {
    throw new Error('No DOM node was rendered for ' + renderableParentVDOMPath)
  }

  let renderedNode
  if(nextVDOMNode.isTextNode) {
    renderedNode = document.createTextNode(nextVDOMNode.tag)
  } else {
    renderedNode = document.createElement(nextVDOMNode.tag)
  }
  parentRenderedNode.appendChild(renderedNode)

  return { ...nextVDOMNode, renderedNode }
}

TreeKeeperPrototype.flushVDOMToDOM = function() {
  let vdomPaths = ['root']
  while(vdomPaths.length > 0) {
    const vdomPath = vdomPaths.pop()
    const updatedVNode = this.flushVNodeToNode(vdomPath)
    this.nextVDOMTree[vdomPath] = updatedVNode

    vdomPaths.unshift(...updatedVNode.childVDOMPaths.slice().reverse())
  }

  this.prevVDOMTree = this.nextVDOMTree
  this.nextVDOMTree = Object.assign({}, this.prevVDOMTree)
}

const buildVirtualDOMTreeFromElements = (rootElement) => {
  const vdomParentNode = {}
}

ReenactDOM.render = (rootDOMNode, rootElement) => {
  const treeKeeper = CreateTreeKeeper(rootDOMNode)
  treeKeeper.deepAddAndInstantiate(rootElement)
  treeKeeper.flushVDOMToDOM()
}

export {
  ReenactDOM,
  Reenact
}
