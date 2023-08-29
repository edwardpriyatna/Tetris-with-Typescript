/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

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

const moveSquareDown = (square: Square[]): Square[] => {
  return square.map(sq => ({
    x: sq.x,
    y: sq.y + 1,
  }));
};

function updateGameState(squares: Square[], gameState: (null | any)[][], value: boolean | null): (null | any)[][] {
  const updatedGameState = [...gameState.map(row => [...row])];
  squares.forEach(sq => {
    if (sq.y >= 0 && sq.y < Constants.GRID_HEIGHT) {
      updatedGameState[sq.y][sq.x] = value;
    }
  });
  return updatedGameState;
}

function checkCollision(square: Square[], gameState: (null | any)[][]): boolean {
  return square.some(sq => {
    const { x, y } = sq;

    // Check if the square is at the bottom of the grid
    if (y >= Constants.GRID_HEIGHT - 1) {
      return true;
    }

    // Check if there's a block below the current square
    if (gameState[y + 1][x] !== null) {
      return true;
    }

    return false;
  });
}

/** State processing */
type State = Readonly<{
  gameEnd: boolean;
  gameState: (null | any)[][];
  currentSquare: Square[]; // Add a property to store the current square
}>;

const initialState: State = {
  gameEnd: false,
  gameState: Array.from({ length: Constants.GRID_HEIGHT }, () => Array(Constants.GRID_WIDTH).fill(null)),
  currentSquare: createSquareBlock(), // Initialize the current square
} as const;

/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
function tick(s: State): State {
  // Update game state based on the current square's position
  const clearedGameState = updateGameState(s.currentSquare, s.gameState, null);

  // Check for collision or if the square is at the bottom
  const hasCollisionOrAtBottom = checkCollision(s.currentSquare, clearedGameState);

  if (hasCollisionOrAtBottom) {
    // Update game state and create a new square
    const filledGameState = updateGameState(s.currentSquare, clearedGameState, true);
    const newCurrentSquare = createSquareBlock();
    return {
      ...s,
      gameState: filledGameState,
      currentSquare: newCurrentSquare,
    };
  } else {
    // Move the current square down
    const newCurrentSquare = moveSquareDown(s.currentSquare);
    return {
      ...s,
      gameState: clearedGameState,
      currentSquare: newCurrentSquare,
    };
  }
}

/** Rendering (side effects) */

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

  /** Determines the rate of time steps */
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
  s.gameState.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell === true) {
        const xCoordinate = columnIndex * Block.WIDTH;
        const yCoordinate = rowIndex * Block.HEIGHT;

        const squareElement = createSvgElement(svg.namespaceURI, "rect", {
          height: `${Block.HEIGHT}`,
          width: `${Block.WIDTH}`,
          x: `${xCoordinate}`,
          y: `${yCoordinate}`,
          style: "fill: green", // Customize the color as needed
        });

        svg.appendChild(squareElement);
      }
    });
  });

  // Render the currentSquare from the state
  s.currentSquare.forEach(square => {
    const xCoordinate = square.x * Block.WIDTH;
    const yCoordinate = square.y * Block.HEIGHT;

    const squareElement = createSvgElement(svg.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${xCoordinate}`,
      y: `${yCoordinate}`,
      style: "fill: green", // Customize the color as needed
    });

    svg.appendChild(squareElement);
  });

  // Add a block to the preview canvas
  const cubePreview = createSvgElement(preview.namespaceURI, "rect", {
    height: `${Block.HEIGHT}`,
    width: `${Block.WIDTH}`,
    x: `${Block.WIDTH * 2}`,
    y: `${Block.HEIGHT}`,
    style: "fill: green",
  });
  preview.appendChild(cubePreview);
};
 

const source$ = merge(tick$)
  .pipe(
    scan((s: State) => tick(s), initialState)
  ).subscribe((s: State) => {
    render(s);

    if (s.gameEnd) {
      show(gameover);
    } else {
      hide(gameover);
    }
  });
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
