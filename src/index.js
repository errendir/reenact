import { CreateTreeKeeper } from './TreeKeeper'

const Reenact = {}
const ReenactDOM = {}

const ComponentPrototype = {}

ComponentPrototype.setState = function(newState) {
  if(this.state === null) throw new Error('Component keeps track of no state')
  // TODO: don't immediately set state and rerender - wait for events to be done like React does
  this.state = Object.assign(this.state, newState)
  this.__treeKeeper.deepDeclareElement(this.__element, this.__vdomPath, this.__vdomParentPath)
}

Reenact.createClass = (prototype) => {
  return Object.assign(
    Object.create(ComponentPrototype),
    prototype
  )
}

Reenact.createElement = (component, props, ...children) => {
  return {
    component,
    props,
    children
  }
}

ReenactDOM.render = (rootDOMNode, rootElement) => {
  const treeKeeper = CreateTreeKeeper(rootDOMNode)
  treeKeeper.deepDeclareElement(rootElement)
}

export {
  ReenactDOM,
  Reenact
}
