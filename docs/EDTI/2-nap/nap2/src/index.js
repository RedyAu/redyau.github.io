import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

function Square(props) {
  return (
    <button className="square" onClick={props.onClick}>
      {props.value}
    </button>
  );
}

class Board extends React.Component {
  renderSquare(i) {
    return (
      <Square
        value={this.props.squares[i]}
        onClick={() => this.props.onClick(i)}
      />
    );
  }

  render() {
    let boardElements = [];
    let boardRowElements = [];

    for (let x = 0; x < this.props.boardSize; x++) {
      for (let y = 0; y < this.props.boardSize; y++) {
        boardRowElements.push(
          this.renderSquare((x * this.props.boardSize) + y)
        );
      }
      boardElements.push(
        <div className='board-row'>
          {boardRowElements}
        </div>
      );
      boardRowElements = [];
    }

    return (
      <div className="board-itself">
        {boardElements}
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      history: [{
        squares: []
      }],
      xIsNext: true,
      stepNumber: 0,
      boardSize: null,
      boardSizePre: 3
    };
  }

  handleClick(i) {
    const history = this.state.history.slice(0, this.state.stepNumber + 1);
    const current = history[history.length - 1];
    const squares = current.squares.slice();
    if (calculateWinner(squares, this.state.boardSize) || squares[i]) {
      return;
    }
    squares[i] = this.state.xIsNext ? 'X' : 'O';
    this.setState({
      history: history.concat([{
        squares: squares
      }]),
      stepNumber: history.length,
      xIsNext: !this.state.xIsNext,
    });
  }

  jumpTo(index) {
    this.setState({
      stepNumber: index,
      xIsNext: (index % 2) === 0,
    });
  }

  render() {
    const history = this.state.history;
    const current = history[this.state.stepNumber];
    const winner = calculateWinner(current.squares, this.state.boardSize);

    const moveElements = history.map((step, index) => (
      <li
        key={index}
      >
        <button
          onClick={() => {
            this.jumpTo(index);
          }}
        >
          {index === 0 ? `Start` : `Go to move #${index}`}
        </button>
      </li>
    ));

    let status;
    if (winner) {
      status = 'Winner: ' + winner;
    } else {
      status = 'Next player: ' + (this.state.xIsNext ? 'X' : 'O');
    }

    return (
      this.state.boardSize
        ?
        <div className="game">
          <div className="game-board">
            <div>
              <Board
                squares={current.squares}
                onClick={(i) => this.handleClick(i)}
                boardSize={this.state.boardSize}
              />
              <div>
                <button onClick={() => {window.location.reload()}}>
                  New Board
                </button>
              </div>
            </div>
          </div>
          <div className="game-info">
            <div>{status}</div>
            <p>
              Moves:
            </p>
            <ul>{moveElements}</ul>
          </div>
        </div>
        :
        <div className="size-select">
          <div>
            Select board size: {`${this.state.boardSizePre}x${this.state.boardSizePre}`}
          </div>
          <input type="range" onInput={(c) => this.setState({ boardSizePre: c.target.value })} min="1" max="15" value={this.state.boardSizePre} />
          <div>
            <button onClick={() => { this.setState({ boardSize: this.state.boardSizePre }) }}>
              OK
            </button>
          </div>
        </div>
    );
  }
}

// ========================================

ReactDOM.render(
  <Game />,
  document.getElementById('root')
);

function calculateWinner(squares, boardSize) {
  let winPossibilities = [];
  let current = [];

  //! Rows
  let k = 0;
  for (let i = 0; i < boardSize; i++) {
    for (let j = 0; j < boardSize; j++) {
      current.push((k + j));
      console.log("j"+j+",k"+k);
    }
    console.log(i);
    k += boardSize;
    winPossibilities.push(current);
  }

  //! Columns
  for (let i = 0; i < boardSize; i++) {
    k = 0;
    for (let j; j < boardSize; j++) {
      current.push((k + i));
      k += boardSize;
    }
    winPossibilities.push(current);
  }

  console.log(winPossibilities);

  for (let i = 0; i < winPossibilities.length; i++) {
    const [a, b, c] = winPossibilities[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}