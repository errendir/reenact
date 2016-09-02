console.log('Hello world')

import { ReenactDOM, Reenact } from '../src/index'

const ListItem = Reenact.createClass({
  render() {
    return <div>Hey, I am an element {this.props.key}</div>
  }
})

const Component = Reenact.createClass({
  getInitialState() {
    setInterval(() => this.setState({ list: this.state.list.slice(1).concat([this.state.next]), next: this.state.next+1 }),1000)
    return { list: [1,2,3], next: 4 }
  },

  render() {
    return <div>
      Hello {this.props.whoShouldIWelcome}!
      {this.state.list.map((key) => <ListItem key={key} />)}
    </div>
  }
})

ReenactDOM.render(
  document.querySelector('#root'),
  <Component whoShouldIWelcome={'world'} />
)
