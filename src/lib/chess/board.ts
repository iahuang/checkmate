import { Chess, type Move, type Piece, type Square } from "chess.js";

export type PGNMetadata = Record<string, string>;

export interface TimelinePosition {
    main: boolean;
    index: number;
}

export function positionsEqual(a: TimelinePosition, b: TimelinePosition): boolean {
    return a.main === b.main && a.index === b.index;
}

const INITIAL_BOARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A number between 0 and 63 representing a square on the board.
 */
export type SquareIndex = number;

/**
 * Returns the row and column of the square at the given index.
 * 
 * Precondition: `index` is between 0 and 63.
 */
export function getCoordsFromIndex(index: SquareIndex): { row: number; column: number } {
    let row = Math.floor(index / 8);
    let column = index % 8;

    return { row, column };
}

/**
 * Return the square at the given index.
 * 
 * Precondition: `index` is between 0 and 63.
 */
export function boardIndexToSquare(index: SquareIndex): Square {
    let { row, column } = getCoordsFromIndex(index);

    return (String.fromCharCode(97 + column) + String.fromCharCode(56 - row)) as Square;
}

/**
 * Return the index of the given square.
 * 
 * Precondition: `square` is a valid square.
 */
export function squareToBoardIndex(square: Square): SquareIndex {
    let column = square.charCodeAt(0) - 97;
    let row = 56 - square.charCodeAt(1);

    return row * 8 + column;
}

export interface MoveResult {
    valid: boolean;
    newPosition: TimelinePosition;
}

/**
 * A board state object as used by the `BoardTimeline` class.
 */
export class BoardState {
    /**
     * The board state as a FEN string.
     */
    readonly fen: string;

    readonly pieces: (Piece | null)[];

    /**
     * The move that led to this board state.
     */
    readonly move: Move | null;

    private _chess: Chess;

    constructor(boardFEN: string, move: Move | null) {
        this.fen = boardFEN;
        this.move = move;

        this._chess = new Chess(boardFEN);

        // flatten the board array
        this.pieces = this._chess.board().reduce((acc, row) => acc.concat(row), []);
    }

    getTurn(): "w" | "b" {
        return this._chess.turn();
    }

    getPieceAt(index: SquareIndex): Piece | null {
        return this.pieces[index];
    }

    getLegalMovesFrom(index: SquareIndex): SquareIndex[] {
        let moves = this._chess.moves({ square: boardIndexToSquare(index), verbose: true });

        return moves.map((move) => squareToBoardIndex(move.to));
    }

    getAllLegalMoves(): Move[] {
        return this._chess.moves({ verbose: true });
    }

    clone(): BoardState {
        return new BoardState(this.fen, { ...this.move } as Move);
    }

    /**
     * Return a new board state with the given move applied.
     */
    push(fromIndex: SquareIndex, toIndex: SquareIndex, promotion?: string): BoardState | null {
        let chess = new Chess(this.fen);

        try {
            let move = chess.move({
                from: boardIndexToSquare(fromIndex),
                to: boardIndexToSquare(toIndex),
                promotion,
            });

            return new BoardState(chess.fen(), move);
        } catch (e) {
            return null;
        }
    }

    static fromFEN(fen: string): BoardState {
        return new BoardState(fen, null);
    }
}

/**
 * A timeline of board states.
 *
 * `main` and `hypothetical` are both arrays of FEN strings.
 *
 * `main` refers to a main line of play, as imported from a PGN file.
 * The `main` timeline is immutable.
 *
 * `hypothetical` refers to a hypothetical line of play, as created by the user.
 *
 * `hypotheticalForksFrom` is the index of the `main` timeline that the
 * `hypothetical` timeline forks from.
 *
 * The `main` timeline is initially empty, and so the `hypothetical` timeline
 * is used. Any actions made on the board will be added to the `hypothetical`
 * timeline.
 *
 * Our `position` is an object containing a `main` boolean and an `index` number.
 *
 * - If we are on the `main` timeline, then `main` is `true` and `index` is the
 * index of the current board state in the `main` timeline.
 * - If we are on the `hypothetical` timeline, then `main` is `false` and `index` is the index of
 * the current board state in the `hypothetical` timeline.
 *
 * If we are on the `main` timeline, then the `hypothetical` timeline should be empty.
 */
export class BoardTimeline {
    private _position: TimelinePosition;
    private _main: BoardState[];
    private _hypothetical: BoardState[];
    private _hypotheticalForksFrom: number;

    constructor() {
        this._position = { main: false, index: 0 };
        this._main = [];
        this._hypothetical = [BoardState.fromFEN(INITIAL_BOARD_FEN)];
        this._hypotheticalForksFrom = 0;
    }

    getMainTimeline(): BoardState[] {
        return this._main.map((state) => state.clone());
    }

    getHypotheticalTimeline(): BoardState[] {
        return this._hypothetical.map((state) => state.clone());
    }

    /**
     * Overwrite the current board state with the given FEN string.
     *
     * This clears both timelines and adds the given FEN string to the `hypothetical` timeline.
     */
    loadFEN(fen: string) {
        this._position = { main: false, index: 0 };
        this._main = [];
        this._hypothetical = [BoardState.fromFEN(fen)];
        this._hypotheticalForksFrom = 0;
    }

    /**
     * Load a PGN file into the `main` timeline.
     *
     * This clears both timelines and pushes the given PGN file into the `main` timeline.
     *
     * The position is set to the first board state in the `main` timeline.
     * 
     * Return the PGN metadata.
     */
    loadPGN(pgn: string): PGNMetadata {
        let chess = new Chess();
        chess.loadPgn(pgn);

        this._position = { main: true, index: 0 };
        this._hypotheticalForksFrom = 0;
        this._hypothetical = [];

        this._main = [BoardState.fromFEN(INITIAL_BOARD_FEN)];
        this._main.push(
            ...chess.history({ verbose: true }).map((move) => new BoardState(move.after, move))
        );

        return chess.header();
    }

    getPosition(): TimelinePosition {
        return { ...this._position }; // Return a copy of the position as to prevent mutation.
    }

    /**
     * Return the current timeline item as a FEN string.
     */
    getBoardState(): BoardState {
        if (this._position.main) {
            return this._main[this._position.index];
        } else {
            return this._hypothetical[this._position.index];
        }
    }

    /**
     * Make a move on the board.
     *
     * If we are on the `main` timeline, then we will fork the timeline and
     * add the move to the `hypothetical` timeline. Keep in mind that the
     * `hypothetical` timeline should be empty before we do this.
     */
    makeMove(fromIndex: SquareIndex, toIndex: SquareIndex, promotion?: string): MoveResult {
        let nextState = this.getBoardState().push(fromIndex, toIndex, promotion);

        if (nextState === null) {
            return { valid: false, newPosition: this.getPosition() };
        }

        if (this._position.main) {
            this._hypotheticalForksFrom = this._position.index;

            // Create a new hypothetical timeline with the new FEN string.
            this._hypothetical = [nextState];

            // Update the position to be on the hypothetical timeline.
            this._position = { main: false, index: 0 };

            return { valid: true, newPosition: this.getPosition() };
        } else {
            // Check if we are at the end of the hypothetical timeline, and if so,
            // add a new FEN string. If not, clear the future of the hypothetical
            // timeline before adding the new FEN string.
            if (this._position.index === this._hypothetical.length - 1) {
                this._hypothetical.push(nextState);
            } else {
                this._hypothetical = this._hypothetical.slice(0, this._position.index + 1);
                this._hypothetical.push(nextState);
            }

            // Update the position to be on the hypothetical timeline.
            this._position.index++;

            return { valid: true, newPosition: this.getPosition() };
        }
    }

    /**
     * Go to the previous position on the timeline. Return the new position.
     *
     * If we are at the first position on the hypothetical timeline, then we
     * will go back to the main timeline, if it exists. If so, the hypothetical
     * timeline will be cleared.
     */
    previous(): TimelinePosition {
        if (this._position.main) {
            if (this._position.index > 0) {
                this._position.index--;
            }
        } else {
            if (this._position.index > 0) {
                this._position.index--;
            } else if (this._main.length > 0) {
                this._position = { main: true, index: this._hypotheticalForksFrom };
                this._hypothetical = [];
            }
        }

        return this.getPosition();
    }

    /**
     * Go to the next position on the timeline. Return the new position.
     */
    next(): TimelinePosition {
        if (this._position.main) {
            if (this._position.index < this._main.length - 1) {
                this._position.index++;
            }
        } else {
            if (this._position.index < this._hypothetical.length - 1) {
                this._position.index++;
            }
        }

        return this.getPosition();
    }

    /**
     * Go to the start of the timeline. Return the new position.
     *
     * This is done by repeatedly calling `previous()` until we are at the start.
     */
    jumpToStart(): TimelinePosition {
        let last = this.getPosition();

        while (1) {
            this.previous();

            if (positionsEqual(last, this.getPosition())) {
                break;
            }

            last = this.getPosition();
        }

        return this.getPosition();
    }

    /**
     * Go to the end of the timeline. Return the new position.
     *
     * This is done by repeatedly calling `next()` until we are at the end.
     */
    jumpToEnd(): TimelinePosition {
        let last = this.getPosition();

        while (1) {
            this.next();

            if (positionsEqual(last, this.getPosition())) {
                break;
            }

            last = this.getPosition();
        }

        return this.getPosition();
    }
}
