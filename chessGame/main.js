// Simple chess implementation (two-player, local). Uses Unicode pieces.
const PIECES = {
  p: { w: "♙", b: "♟" },
  r: { w: "♖", b: "♜" },
  n: { w: "♘", b: "♞" },
  b: { w: "♗", b: "♝" },
  q: { w: "♕", b: "♛" },
  k: { w: "♔", b: "♚" },
};

// Board state: 8x8 array, each cell null or {type:'p', color:'w'}
let board = [];
let turn = "w"; // 'w' or 'b'
let selected = null; // {r,c}
let legalMoves = []; // array of {r,c,capture}
let history = []; // for undo {from,to,captured,promotion,prevTurn}
let moveList = [];
let flipped = false;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const movesOl = document.getElementById("movesOl");

function newGame() {
  // starting position
  const startFEN = [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    ["r", "n", "b", "q", "k", "b", "n", "r"],
  ];
  board = [];
  for (let r = 0; r < 8; r++) {
    board[r] = [];
    for (let c = 0; c < 8; c++) {
      const x = startFEN[r][c];
      if (x) {
        const color = r < 2 ? "b" : "w";
        board[r][c] = { type: x, color };
      } else board[r][c] = null;
    }
  }
  turn = "w";
  selected = null;
  legalMoves = [];
  history = [];
  moveList = [];
  updateStatus();
  render();
}

function render() {
  boardEl.innerHTML = "";
  // create squares from 0..7 rows top->bottom; but flip if needed
  const rows = [...Array(8).keys()];
  const cols = [...Array(8).keys()];
  const rIter = flipped ? rows.reverse() : rows;
  const cIter = flipped ? cols.reverse() : cols;

  for (let r of rIter) {
    for (let c of cIter) {
      const square = document.createElement("div");
      square.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");
      square.dataset.r = r;
      square.dataset.c = c;

      // last move markers
      const last = history.length ? history[history.length - 1] : null;
      if (last) {
        if (
          (last.from.r == r && last.from.c == c) ||
          (last.to.r == r && last.to.c == c)
        ) {
          square.classList.add("last-move");
        }
      }

      const p = board[r][c];
      if (p) {
        const span = document.createElement("div");
        span.textContent = PIECES[p.type][p.color == "w" ? "w" : "b"];
        span.style.fontSize = "40px";
        square.appendChild(span);
      }

      // highlight selected
      if (selected && selected.r == r && selected.c == c)
        square.classList.add("highlight");

      // show legal move markers
      if (legalMoves.some((m) => m.r == r && m.c == c)) {
        const m = legalMoves.find((x) => x.r == r && x.c == c);
        if (m.capture) square.classList.add("capture");
        square.classList.add("valid-move");
      }

      square.addEventListener("click", onSquareClick);
      boardEl.appendChild(square);
    }
  }
  renderMoves();
}

function updateStatus() {
  statusEl.textContent = `Turn: ${turn == "w" ? "White" : "Black"}`;
}

function onSquareClick(e) {
  const r = Number(e.currentTarget.dataset.r);
  const c = Number(e.currentTarget.dataset.c);
  const p = board[r][c];
  // if clicked a legal destination
  const lm = legalMoves.find((m) => m.r == r && m.c == c);
  if (lm) {
    makeMove(selected, { r, c }, lm.promotion || null);
    selected = null;
    legalMoves = [];
    render();
    return;
  }

  // otherwise select if piece of current color
  if (p && p.color == turn) {
    selected = { r, c };
    legalMoves = calcLegalMoves(r, c);
  } else {
    // deselect
    selected = null;
    legalMoves = [];
  }
  render();
}

function calcLegalMoves(r, c) {
  // returns array of {r,c,capture,promotion}
  const p = board[r][c];
  if (!p) return [];
  const moves = [];
  const dir = p.color == "w" ? -1 : 1; // white moves "up" (to smaller row index)

  const inside = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
  const push = (rr, cc, cap = false, promo = false) => {
    if (inside(rr, cc))
      moves.push({ r: rr, c: cc, capture: cap, promotion: promo });
  };

  switch (p.type) {
    case "p":
      // forward one
      if (!board[r + dir] || true) {
      }
      if (inside(r + dir, c) && !board[r + dir][c]) {
        push(
          r + dir,
          c,
          false,
          (p.color == "w" && r + dir == 0) || (p.color == "b" && r + dir == 7)
        );
        // two steps
        const startRow = p.color == "w" ? 6 : 1;
        if (r == startRow && !board[r + dir * 2][c])
          push(r + dir * 2, c, false, false);
      }
      // captures
      for (const dc of [-1, 1]) {
        const rr = r + dir,
          cc = c + dc;
        if (inside(rr, cc) && board[rr][cc] && board[rr][cc].color != p.color) {
          push(
            rr,
            cc,
            true,
            (p.color == "w" && rr == 0) || (p.color == "b" && rr == 7)
          );
        }
      }
      break;
    case "n":
      [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ].forEach((d) => {
        const rr = r + d[0],
          cc = c + d[1];
        if (
          inside(rr, cc) &&
          (!board[rr][cc] || board[rr][cc].color != p.color)
        )
          push(rr, cc, !!board[rr][cc]);
      });
      break;
    case "b":
      for (const d of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        let rr = r + d[0],
          cc = c + d[1];
        while (inside(rr, cc)) {
          if (!board[rr][cc]) {
            push(rr, cc, false);
          } else {
            if (board[rr][cc].color != p.color) push(rr, cc, true);
            break;
          }
          rr += d[0];
          cc += d[1];
        }
      }
      break;
    case "r":
      for (const d of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        let rr = r + d[0],
          cc = c + d[1];
        while (inside(rr, cc)) {
          if (!board[rr][cc]) {
            push(rr, cc, false);
          } else {
            if (board[rr][cc].color != p.color) push(rr, cc, true);
            break;
          }
          rr += d[0];
          cc += d[1];
        }
      }
      break;
    case "q":
      for (const d of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        let rr = r + d[0],
          cc = c + d[1];
        while (inside(rr, cc)) {
          if (!board[rr][cc]) {
            push(rr, cc, false);
          } else {
            if (board[rr][cc].color != p.color) push(rr, cc, true);
            break;
          }
          rr += d[0];
          cc += d[1];
        }
      }
      break;
    case "k":
      for (const d of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        const rr = r + d[0],
          cc = c + d[1];
        if (
          inside(rr, cc) &&
          (!board[rr][cc] || board[rr][cc].color != p.color)
        )
          push(rr, cc, !!board[rr][cc]);
      }
      break;
  }

  // NOTE: This simple engine DOES NOT check for checks (moving into check allowed). It's a simple ruleset for friendly play.
  return moves;
}

function makeMove(from, to, promotionType = null) {
  const piece = board[from.r][from.c];
  const captured = board[to.r][to.c];
  const moveRecord = {
    from: { ...from },
    to: { ...to },
    piece: JSON.parse(JSON.stringify(piece)),
    captured: captured ? JSON.parse(JSON.stringify(captured)) : null,
    prevTurn: turn,
  };

  // move
  board[to.r][to.c] = piece;
  board[from.r][from.c] = null;

  // pawn promotion: if pawn reached last rank
  let promotion = null;
  if (piece.type == "p" && (to.r == 0 || to.r == 7)) {
    // auto-queen for simplicity
    board[to.r][to.c] = { type: "q", color: piece.color };
    promotion = "q";
    moveRecord.promotion = "q";
  }

  history.push(moveRecord);
  // add to moveList
  const algebraic = toAlgebraic(from, to, piece.type, captured, promotion);
  moveList.push(algebraic);

  // change turn
  turn = turn == "w" ? "b" : "w";
  selected = null;
  legalMoves = [];
  updateStatus();
  render();
}

function toAlgebraic(from, to, type, captured, promotion) {
  // simple algebraic: e2-e4, exd5, e7-e8=Q
  const file = (c) => String.fromCharCode("a".charCodeAt(0) + c);
  const fromS = file(from.c) + (8 - from.r);
  const toS = file(to.c) + (8 - to.r);
  let s = fromS + (captured ? "x" : "-") + toS;
  if (promotion) s += "=" + promotion.toUpperCase();
  return s;
}

function renderMoves() {
  movesOl.innerHTML = "";
  for (let i = 0; i < moveList.length; i += 2) {
    const li = document.createElement("li");
    const white = moveList[i] || "";
    const black = moveList[i + 1] || "";
    li.textContent = Math.floor(i / 2) + 1 + ". " + white + " " + black;
    movesOl.appendChild(li);
  }
}

// Undo last move
function undo() {
  if (!history.length) return;
  const last = history.pop();
  // revert board
  board[last.from.r][last.from.c] = last.piece;
  board[last.to.r][last.to.c] = last.captured;
  turn = last.prevTurn;
  moveList.pop();
  selected = null;
  legalMoves = [];
  updateStatus();
  render();
}

// Flip board
function flipBoard() {
  flipped = !flipped;
  render();
}

// UI bindings
document.getElementById("newBtn").addEventListener("click", newGame);
document.getElementById("flipBtn").addEventListener("click", () => {
  flipBoard();
});
document.getElementById("undoBtn").addEventListener("click", undo);

// init
newGame();

// Expose some helpers for debugging in console
window._chess = { board, calcLegalMoves, makeMove, history };
