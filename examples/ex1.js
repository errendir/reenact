console.log('Hello world')

import { ReenactDOM, Reenact } from '../src/index'

const Hello = Reenact.createClass({
  render() {
    console.log('rerendering hello', this.props.whoShouldIWelcome)
    return <span>
      Hello {this.props.whoShouldIWelcome}!
    </span>
  }
})

const Span = Reenact.createClass({
  render() {
    console.log('rerendering span with', this.props.value)
    return <span>
      {this.props.value}
    </span>
  }
})

const ListItem = Reenact.createClass({
  render() {
    console.log('rerendering', this.props.key)
    return <div
      style={{
        display: 'block',
        fontSize: '16pt',
        position: 'relative',
        left: (Math.random() * 10) + 'px',
      }}
      className='someclass someotherclass'
    >
      Hey, I am an element <Span value={this.props.key} />
    </div>
  },

  shouldComponentUpdate(nextProps) {
    return this.props !== nextProps
  }
})

const Component = Reenact.createClass({
  getInitialState() {
    setInterval(() => {
        this.setState({
          list: this.state.list.slice(1).concat([this.state.next]),
          next: this.state.next+1
        })
      },
      1000
    )
    return { list: [1,2,3], next: 4 }
  },

  render() {
    return <div>
      <Hello whoShouldIWelcome={this.props.whoShouldIWelcome} />
      {this.state.list.map((key) => <ListItem key={key} />)}
    </div>
  }
})

ReenactDOM.render(
  document.querySelector('#root'),
  <Component whoShouldIWelcome={'world'} />
)
