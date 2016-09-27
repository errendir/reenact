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
    // Look at this depth zero comparison :)
    return this.props !== nextProps
  }
})

const Component = Reenact.createClass({
  getInitialState() {
    return { list: [1,2,3], next: 4 }
  },

  componentDidMount() {
    this.intervalId = setInterval(this.advanceTheList,1000)
  },

  componentWillUnmount() {
    clearInterval(this.intervalId)
  },

  advanceTheList() {
    this.setState({
      list: this.state.list.slice(1).concat([this.state.next]),
      next: this.state.next+1
    })
  },

  render() {
    return <div>
      <Hello whoShouldIWelcome={this.props.whoShouldIWelcome} />
      <button onClick={() => console.log('click')}>I am a button</button>
      {this.state.list.map((key) => <ListItem key={key} />)}
    </div>
  }
})

ReenactDOM.render(
  document.querySelector('#root'),
  <Component whoShouldIWelcome={'world'} />
)
