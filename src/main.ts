import "./style.css";
import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan, throttleTime } from "rxjs/operators";

/** Constants */
const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

/** User input */
type Key = "KeyS" | "KeyA" | "KeyD" | "KeyQ" | "KeyE" | "KeyR";
type Event = "keydown" | "keyup" | "keypress";

/** Utility functions */
type Coordinate = { x: number; y: number };
type Square = { x: number; y: number };

function createSquareBlock(): Square[] {
  const center: Coordinate = {
    x: Math.floor(Constants.GRID_WIDTH / 2),
    y: 0, // Place the square block at the top edge
  };

  const squares: Square[] = [
      { x: center.x - 1, y: center.y },
      { x: center.x, y: center.y },
      { x: center.x - 1, y: center.y + 1 },
      { x: center.x, y: center.y + 1 },
  ];
  return squares;
}

function generateRandomBlock() {
  // Define the shapes of the different Tetris blocks
  const shapes = [
    // I-block
    [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    // J-block
    [
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    // L-block
    [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: -1 },
    ],
    // O-block
    [
      { x: -1, y: -1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
    ],
    // S-block
    [
      { x: -1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y:-1},
    ],
    // T-block
    [
      {x:-1,y :0},
      {x :0,y :-1},
      {x :0,y :0},
      {x :1,y :0}
    ],
    // Z-block
    [
     {x :-1,y :-1},
     {x :0,y :-1},
     {x :0,y :0},
     {x :1,y :0}
    ]
    
];

   // Generate a random block type using Math.random()
   const shapeIndex = Math.floor(Math.random() * shapes.length);
   const shape = shapes[shapeIndex];

   // Calculate the initial coordinates of the block based on its shape and size
   const initialX = Math.floor(Constants.GRID_WIDTH /2);
   const initialY = Math.min(...shape.map(square => square.y));
   const block = shape.map(square => ({
   x :square.x +initialX,
   y :square.y-initialY,
   }));

   // Return the coordinates of the new block
   return block;
}

const falling = (square: Square[]): Square[] => {
  return square.map(sq => ({
  x:sq.x,
  y:sq.y+1,
  }));
};

function updateStoredSquares(squares: Square[], storedSquares: (null | true)[][], value: boolean | null): (null | true)[][] {
  return storedSquares.map((row, rowIndex) =>
    row.map((cell, columnIndex) =>
      squares.some(sq => sq.y === rowIndex && sq.x === columnIndex) ? value : cell
    )
  );
}

function checkCollision(square :Square[],storedSquares:(null|true)[][]):boolean{
  return square.some(sq=>{
  const{x,y}=sq;

  //Check if the square is at the bottom of the grid
  if(y>=Constants.GRID_HEIGHT-1){
  return true;
  }

  //Check if there's a block below the current square
  if(storedSquares[y+1][x]!==null){
  return true;
  }

  return false;
  });
}

const move = (s: State, direction: "left" | "right"): State => {
  // Check if the game has ended
  if (s.gameEnd) {
    // If the game has ended, return the current state without updating it
    return s;
  }

  const canMove = s.currentBlock.every(
    square =>
      (direction === "left" && square.x > 0 && !s.storedSquares[square.y][square.x - 1]) ||
      (direction === "right" && square.x < Constants.GRID_WIDTH - 1 && !s.storedSquares[square.y][square.x + 1])
  );

  if (canMove) {
    const newcurrentBlock = s.currentBlock.map(square => ({
      x: square.x + (direction === "left" ? -1 : 1),
      y: square.y,
    }));
    return { ...s, currentBlock: newcurrentBlock };
  }

  return s;
};

//calculateDownDistance function
const calculateDownDistance=(s :State,distance=0):number=>{
  //Base case :if collision is detected ,return the distance
  if(checkCollision(falling(s.currentBlock),s.storedSquares)){
    return distance+1;
  }
  //Recursive case :increment distance and continue checking
  return calculateDownDistance({...s,currentBlock :falling(s.currentBlock)},distance+1);
};

//moveDown function
const moveDown = (s: State): State => {
  // Check if the game has ended
  if (s.gameEnd) {
    // If the game has ended, return the current state without updating it
    return s;
  }

  const downDistance = calculateDownDistance(s);

  const newcurrentBlock = s.currentBlock.map(square => ({
    x: square.x,
    y: square.y + downDistance,
  }));

  return {
    ...s,
    currentBlock: newcurrentBlock,
  };
};

function clearLines(s: State): [State, number] {
  // Filter out any rows that are completely filled
  const updatedstoredSquares = s.storedSquares.filter(row => row.some(cell => cell === null));

  // Calculate the number of rows that were cleared
  const clearedLines = s.storedSquares.length - updatedstoredSquares.length;

  // Create new empty rows to replace the cleared rows
  const newRows = Array.from({ length: clearedLines }, () => Array(Constants.GRID_WIDTH).fill(null));

  // Create an updated state with the new game grid
  const updatedStoredSquares: State = {
    ...s,
    storedSquares: [...newRows, ...updatedstoredSquares],
  };

  // Return the updated state and the number of cleared lines
  return [updatedStoredSquares, clearedLines];
}

function checkGameEnd(state: State): boolean {
  // Check if any cell in the top row of the game grid is filled
  return state.storedSquares[0].some(cell => cell !== null);
}

function generateRandomSquare(s: State, clearedRowIndex: number): State {
  // Find all empty coordinates above the cleared row
  const emptyCoordinates: Coordinate[] = s.storedSquares
    .slice(5, clearedRowIndex)
    .flatMap((row, rowIndex) =>
      row.map((cell, cellIndex) => (cell === null ? { x: cellIndex, y: rowIndex + 5 } : null))
    )
    .filter((coordinate): coordinate is Coordinate => coordinate !== null);

  // If there are no empty coordinates, return the current state without updating it
  if (emptyCoordinates.length === 0) {
    return s;
  }

  // Choose a random empty coordinate
  const randomIndex = Math.floor(Math.random() * emptyCoordinates.length);
  const randomCoordinate = emptyCoordinates[randomIndex];

  // Add a new square to the game state at the chosen coordinate
  const updatedstoredSquares = s.storedSquares.map((row, rowIndex) =>
    row.map((cell, cellIndex) =>
      rowIndex === randomCoordinate.y && cellIndex === randomCoordinate.x ? true : cell
    )
  );

  // Return the updated state with the new square added to the game state
  return { ...s, storedSquares: updatedstoredSquares };
}

const rotate = (s: State, direction: "left" | "right"): State => {
  if (s.gameEnd) {
    return s;
  }

  // Check if the current block is a square block
  const isSquareBlock = s.currentBlock.every(
    square =>
      Math.abs(square.x - s.currentBlock[0].x) <= 1 &&
      Math.abs(square.y - s.currentBlock[0].y) <= 1
  );

  // If the current block is a square block, do not perform the rotation
  if (isSquareBlock) {
    return s;
  }

  const center = {
    x: s.currentBlock[0].x,
    y: s.currentBlock[0].y,
  };

  const newcurrentBlock = s.currentBlock.map(square => {
    const x =
      direction === "left"
        ? center.x - center.y + square.y
        : center.x + center.y - square.y;
    const y =
      direction === "left"
        ? center.y + center.x - square.x
        : center.y - center.x + square.x;
    return { x, y };
  });

  const isValid = newcurrentBlock.every(
    square =>
      square.x >= 0 &&
      square.x < Constants.GRID_WIDTH &&
      square.y >= 0 &&
      square.y < Constants.GRID_HEIGHT &&
      !s.storedSquares[square.y][square.x]
  );

  if (isValid) {
    // Return a new state with the rotated block
    return { ...s, currentBlock: newcurrentBlock };
  }

  // Return the current state if the rotation is not valid
  return s;
};

const restartGame = (state: State): State => {
  // Define the initial game state
  const initialstoredSquares = {
    ...state,
    gameEnd: false,
    storedSquares: Array.from({ length: Constants.GRID_HEIGHT }, () =>
      Array(Constants.GRID_WIDTH).fill(null)
    ),
    currentBlock: generateRandomBlock(),
    score: 0,
    nextBlock: generateRandomBlock(),
    level: 0,
  };
  return { ...initialstoredSquares };
};

/** State processing */
type State = Readonly<{
  gameEnd: boolean;
  storedSquares: (null | true)[][];
  currentBlock: Square[];
  score: number;
  nextBlock: Square[];
  level: number;
  highScore: number; // Add the "highScore" property
}>;

const initialState: State = {
  gameEnd: false,
  storedSquares: Array.from({ length: Constants.GRID_HEIGHT }, () =>
    Array(Constants.GRID_WIDTH).fill(null)
  ),
  currentBlock: generateRandomBlock(),
  score: 0,
  nextBlock: generateRandomBlock(),
  level: 0,
  highScore: 0, // Initialize the "highScore" property
} as const;


/**
* Updates the state by proceeding with one time step.
*
* @param s Current state
* @returns Updated state
*/
function tick(s: State): State {
  // If the game has ended, return the current state without updating it
  if (s.gameEnd) {
    return s;
  }

  const newStoredSquaress = updateStoredSquares(s.currentBlock, s.storedSquares, null);
  const hasCollisionOrAtBottom = checkCollision(s.currentBlock, newStoredSquaress);

  // Only generate a new square if there is a collision or the square is at the bottom
  const newcurrentBlock = hasCollisionOrAtBottom ? s.nextBlock : falling(s.currentBlock);
  const newNextBlock = hasCollisionOrAtBottom ? generateRandomBlock() : s.nextBlock;

  const filledstoredSquares = hasCollisionOrAtBottom
    ? updateStoredSquares(s.currentBlock, newStoredSquaress, true)
    : newStoredSquaress;
  
  const [updatedStoredSquares, clearedLines] = clearLines({ ...s, storedSquares: filledstoredSquares });

  // Generate a random square for each cleared line
  const finalupdatedStoredSquares = Array.from({ length: clearedLines }, (_, i) => Constants.GRID_HEIGHT - clearedLines + i)
    .reduce((state, rowIndex) => generateRandomSquare(state, rowIndex), updatedStoredSquares);

  const newScore = finalupdatedStoredSquares.score + clearedLines;
  
   // Update the high score if the new score is higher than the current high score
   const newHighScore = Math.max(finalupdatedStoredSquares.highScore, newScore);

   // Update the level based on the number of lines cleared
   const newLevel = finalupdatedStoredSquares.level + clearedLines;

   // Check if the game has ended after updating the state
   const gameEnd = checkGameEnd(finalupdatedStoredSquares);

   return {
     ...finalupdatedStoredSquares,
     score: newScore,
     currentBlock: newcurrentBlock,
     nextBlock: newNextBlock,
     gameEnd,
     highScore: newHighScore,
     level: newLevel, // Update the level
   };
}

/** Rendering (side effects) */
// Render functions
const renderSquares = (svg: SVGGraphicsElement, s: State): void => {
  // Generate SVG elements for squares in the game state
  const squareElements = s.storedSquares.reduce((acc, row, rowIndex) => {
    const rowElements = row.reduce((acc2, cell, columnIndex) => {
      if (cell === true) {
        const xCoordinate = columnIndex * Block.WIDTH;
        const yCoordinate = rowIndex * Block.HEIGHT;
        const squareElement = createSvgElement(svg.namespaceURI, "rect", {
          height: `${Block.HEIGHT}`,
          width: `${Block.WIDTH}`,
          x: `${xCoordinate}`,
          y: `${yCoordinate}`,
          style: "fill: green",
        });
        return [...acc2, squareElement];
      }
      return acc2;
    }, [] as SVGElement[]);
    return [...acc, ...rowElements];
  }, [] as SVGElement[]);
  squareElements.map(squareElement => svg.appendChild(squareElement));
};

const renderCurrentBlock = (svg: SVGGraphicsElement, s: State): void => {
  // Generate SVG elements for the current falling square
  const currentBlockElements = s.currentBlock.map(square => {
    const xCoordinate = square.x * Block.WIDTH;
    const yCoordinate = square.y * Block.HEIGHT;
    const squareElement = createSvgElement(svg.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${xCoordinate}`,
      y: `${yCoordinate}`,
      style: "fill: green",
    });
    return squareElement;
  });
  currentBlockElements.map(squareElement => svg.appendChild(squareElement));
};

const renderNextBlock = (svg: SVGGraphicsElement, s: State): void => {
  // Generate SVG elements for the next block
  const nextBlockElements = s.nextBlock.map(square => {
    const xCoordinate = square.x * Block.WIDTH;
    const yCoordinate = square.y * Block.HEIGHT;
    const squareElement = createSvgElement(svg.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${xCoordinate}`,
      y: `${yCoordinate}`,
      style: "fill: green",
    });
    return squareElement;
  });
  nextBlockElements.map(squareElement => svg.appendChild(squareElement));
};

const renderLevel = (s: State) => {
  // Render the level
  const levelText = document.querySelector("#levelText") as HTMLElement;
  if (levelText) {
    levelText.textContent = `${s.level}`;
  }
};

const renderScore = (s: State) => {
  // Render the score
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  if (scoreText) {
    scoreText.textContent = `${s.score}`;
  }
};

const renderHighScore = (s: State) => {
  // Render the high score
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;
  if (highScoreText) {
    highScoreText.textContent = `${s.highScore}`;
  }
};
/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * This is the function called on page load.
/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */
  const key$ = fromEvent<KeyboardEvent>(document, "keypress");
  const fromKey = (keyCode: Key) =>
    key$.pipe(filter(({ code }) => code === keyCode));
  const left$ = fromKey("KeyA").pipe(map(() => (s: State) => move(s, "left")));
  const right$ = fromKey("KeyD").pipe(map(() => (s: State) => move(s, "right")));
  const down$ = fromKey("KeyS").pipe(
    throttleTime(400), // Add a delay of 400ms between successive 's' key presses
    map(() => moveDown)
  );
  const rotateLeft$ = fromKey("KeyQ").pipe(map(() => (s: State) => rotate(s, "left")));
  const rotateRight$ = fromKey("KeyE").pipe(map(() => (s: State) => rotate(s, "right")));
  const restart$ = fromKey("KeyR");

  /** Observables */
  const tick$ = interval(Constants.TICK_RATE_MS);

  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    // Clear the SVG canvas
    svg.innerHTML = '';
    preview.innerHTML = ''; // Clear the SVG preview
    renderSquares(svg, s);
    renderCurrentBlock(svg, s);
    renderNextBlock(preview, s);
    renderHighScore(s);
    renderLevel(s);
    renderScore(s);
    // Show or hide the game over element
    if (s.gameEnd) {
      svg.appendChild(gameover);
    } else {
      gameover.remove();
    }
  };
  /** Observables and subscription */
  
  const source$ = merge(
    tick$.pipe(map(() => tick)),
    left$,
    right$,
    down$.pipe(map(() => moveDown)),
    rotateLeft$,
    rotateRight$,
    restart$.pipe(map(() => (state: State) => restartGame(state)))
  )
  .pipe(scan((s: State, action: (s: State) => State) => action(s), initialState))
    .subscribe((s: State) => {
      render(s);
      if (s.gameEnd) {
        show(gameover);
      } else {
        hide(gameover);
      }
    });
}

// The following simply runs your main function on window load. Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
  main();
  };
}