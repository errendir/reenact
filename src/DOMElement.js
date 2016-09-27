const emptyObject = {}

const nonPropagatingProps = {
  'style': true,
  'key': true,
  'ref': true,
}

// Lists of events copied from https://facebook.github.io/react/docs/events.html
const dragEvents = {
  'onDrag': true,
  'onDragEnd': true,
  'onDragEnter': true,
  'onDragExit': true,
  'onDragLeave': true,
  'onDragOver': true,
  'onDragStart': true,
  'onDrop': true,
}

const mouseEvents = {
  'onClick': true,
  'onContextMenu': true,
  'onDoubleClick': true,
  'onMouseDown': true,
  'onMouseEnter': true,
  'onMouseLeave': true,
  'onMouseMove': true,
  'onMouseOut': true,
  'onMouseOver': true,
  'onMouseUp': true,
}

const eventsByTagName = {
  'div': {
    ...mouseEvents,
  },
  'button': {
    ...mouseEvents,
  }
}

export const assignPropsToElement = function(oldProps, newProps, element, node) {
  if(!element || !element.component) {
    throw new Error('Only nodes created from elements returned by Reenact.createElement can be assigned props')
  }
  if(typeof element.component !== 'string') {
    throw new Error('Only nodes corresponding to basic tags can be assigned props')
  }

  oldProps = oldProps || emptyObject
  newProps = newProps || emptyObject
  Object.keys(newProps).forEach(attributeName => {
    if(nonPropagatingProps[attributeName] === true) return
    const newAttributeValue = newProps[attributeName]
    const oldAttributeValue = oldProps[attributeName]
    if(newAttributeValue !== oldAttributeValue) {
      if(eventsByTagName[element.component][attributeName] === true) {
        node.removeEventListener(
          attributeName.toLowerCase().slice(2),
          oldAttributeValue
        )
        node.addEventListener(
          attributeName.toLowerCase().slice(2),
          newAttributeValue
        )
      } else {
        node.setAttribute(attributeName, newAttributeValue)
      }
    }
  })
  Object.keys(oldProps).forEach(attributeName => {
    if(nonPropagatingProps[attributeName] === true) return
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
