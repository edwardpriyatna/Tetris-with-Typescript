import "./style.css";
import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan } from "rxjs/operators";

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
type Key = "KeyS" | "KeyA" | "KeyD";
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

const falling = (square: Square[]): Square[] => {
  return square.map(sq => ({
  x:sq.x,
  y:sq.y+1,
  }));
};

function updateGameState(squares: Square[], gameState: (null | any)[][], value: boolean | null): (null | any)[][] {
  return gameState.map((row, rowIndex) =>
    row.map((cell, columnIndex) =>
      squares.some(sq => sq.y === rowIndex && sq.x === columnIndex) ? value : cell
    )
  );
}

function checkCollision(square :Square[],gameState:(null|any)[][]):boolean{
  return square.some(sq=>{
  const{x,y}=sq;

  //Check if the square is at the bottom of the grid
  if(y>=Constants.GRID_HEIGHT-1){
  return true;
  }

  //Check if there's a block below the current square
  if(gameState[y+1][x]!==null){
  return true;
  }

  return false;
  });
}

//moveLeft function
const moveLeft = (s: State): State => {
  // Check if the game has ended
  if (s.gameEnd) {
    // If the game has ended, return the current state without updating it
    return s;
  }

  const canMoveLeft = s.currentSquare.every(
    square => square.x > 0 && !s.gameState[square.y][square.x - 1]
  );

  if (canMoveLeft) {
    const newCurrentSquare = s.currentSquare.map(square => ({
      x: square.x - 1,
      y: square.y,
    }));
    return { ...s, currentSquare: newCurrentSquare };
  }

  return s;
};

//moveRight function
const moveRight = (s: State): State => {
  // Check if the game has ended
  if (s.gameEnd) {
    // If the game has ended, return the current state without updating it
    return s;
  }

  const canMoveRight = s.currentSquare.every(
    square => square.x < Constants.GRID_WIDTH - 1 && !s.gameState[square.y][square.x + 1]
  );

  if (canMoveRight) {
    const newCurrentSquare = s.currentSquare.map(square => ({
      x: square.x + 1,
      y: square.y,
    }));
    return { ...s, currentSquare: newCurrentSquare };
  }

  return s;
};

//calculateDownDistance function
const calculateDownDistance=(s :State,distance=0):number=>{
  //Base case :if collision is detected ,return the distance
  if(checkCollision(falling(s.currentSquare),s.gameState)){
    return distance+1;
  }
  //Recursive case :increment distance and continue checking
  return calculateDownDistance({...s,currentSquare :falling(s.currentSquare)},distance+1);
};

//moveDown function
const moveDown = (s: State): State => {
  // Check if the game has ended
  if (s.gameEnd) {
    // If the game has ended, return the current state without updating it
    return s;
  }

  const downDistance = calculateDownDistance(s);

  const newCurrentSquare = s.currentSquare.map(square => ({
    x: square.x,
    y: square.y + downDistance,
  }));

  return {
    ...s,
    currentSquare: newCurrentSquare,
  };
};

function clearLines(s: State): [State, number] {
  // Filter out any rows that are completely filled
  const updatedGameState = s.gameState.filter(row => row.some(cell => cell === null));

  // Calculate the number of rows that were cleared
  const clearedLines = s.gameState.length - updatedGameState.length;

  // Create new empty rows to replace the cleared rows
  const newRows = Array.from({ length: clearedLines }, () => Array(Constants.GRID_WIDTH).fill(null));

  // Create an updated state with the new game grid
  const updatedState: State = {
    ...s,
    gameState: [...newRows, ...updatedGameState],
  };

  // Return the updated state and the number of cleared lines
  return [updatedState, clearedLines];
}

function checkGameEnd(state: State): boolean {
  // Check if any cell in the top row of the game grid is filled
  return state.gameState[0].some(cell => cell !== null);
}

/** State processing */
type State=Readonly<{
  gameEnd:boolean;
  gameState:(null|any)[][];
  currentSquare:Square[];
  score:number;//Add the "score" property
}>;

const initialState:State={
  gameEnd:false,
  gameState:Array.from({length:Constants.GRID_HEIGHT},()=>Array(Constants.GRID_WIDTH).fill(null)),
  currentSquare:createSquareBlock(),
  score:0,//Initialize the score property
} as const;

/**
* Updates the state by proceeding with one time step.
*
* @param s Current state
* @returns Updated state
*/
function tick(s: State): State {
  const clearedGameState = updateGameState(s.currentSquare, s.gameState, null);
  const hasCollisionOrAtBottom = checkCollision(s.currentSquare, clearedGameState);

  // Check if the game has ended
  const gameEnd = checkGameEnd(s);

  // Only generate a new square if the game has not ended and there is a collision or the square is at the bottom
  const newCurrentSquare = !gameEnd && hasCollisionOrAtBottom ? createSquareBlock() : falling(s.currentSquare);

  const filledGameState = hasCollisionOrAtBottom
    ? updateGameState(s.currentSquare, clearedGameState, true)
    : clearedGameState;
  const [finalUpdatedState, clearedLines] = clearLines({ ...s, gameState: filledGameState });

  const newScore = finalUpdatedState.score + clearedLines;

  return {
    ...finalUpdatedState,
    score: newScore,
    currentSquare: newCurrentSquare,
    gameEnd,
  };
}

/** Rendering (side effects) */
// Render functions
const renderSquares = (svg: SVGGraphicsElement, s: State): SVGElement[] => {
  // Generate SVG elements for squares in the game state
  const squareElements = s.gameState.reduce((acc, row, rowIndex) => {
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
  return squareElements;
};

const renderCurrentSquare = (svg: SVGGraphicsElement, s: State): SVGElement[] => {
  // Generate SVG elements for the current falling square
  const currentSquareElements = s.currentSquare.map(square => {
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
  return currentSquareElements;
};

const renderScore = (svg: SVGGraphicsElement, score: number): SVGElement => {
  // Create an SVG text element
  const scoreTextElement = createSvgElement(svg.namespaceURI, "text", {
    x: `${Block.WIDTH * Constants.GRID_WIDTH + 10}`,
    y: `${Block.HEIGHT * (Constants.GRID_HEIGHT - 1)}`,
    fill: "white",
  });
  
  // Set the text content to display the current score
  scoreTextElement.textContent = `Score: ${score}`;
  
  // Return the text element
  return scoreTextElement;
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
  const left$ = fromKey("KeyA");
  const right$ = fromKey("KeyD");
  const down$ = fromKey("KeyS");

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
  
    // Iterate through the game state and render squares as needed
    const squareElements = renderSquares(svg, s);
    squareElements.map(squareElement => svg.appendChild(squareElement));
  
    // Render the currentSquare from the state
    const currentSquareElements = renderCurrentSquare(svg, s);
    currentSquareElements.map(squareElement => svg.appendChild(squareElement));
  
    // Render the score
    const scoreText = document.querySelector("#scoreText") as HTMLElement; // Properly select the scoreText element
    if (scoreText) {
      scoreText.textContent = `${s.score}`; 
    }
  
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
    left$.pipe(map(() => moveLeft)),
    right$.pipe(map(() => moveRight)),
    down$.pipe(map(() => moveDown))
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