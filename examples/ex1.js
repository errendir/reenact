console.log('Hello world')

import { ReenactDOM, Reenact } from '../src/index'

const ListItem = Reenact.createClass({
  render() {
    return <div>Hey, I am an element {this.props.key}</div>
  }
})

const Component = Reenact.createClass({
  render() {
    return <div>
      Hello {this.props.whoShouldIWelcome}!
      {[1,2,3,4,5].map((key) => <ListItem key={key} />)}
    </div>
  }
})

ReenactDOM.render(
  document.querySelector('#root'),
  <Component whoShouldIWelcome={'world'} />
)
