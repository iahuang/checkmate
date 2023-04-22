<script lang="ts">
    import { Chess } from "chess.js";
    import type { Piece, Square, PieceSymbol, Color } from "chess.js";
    import PieceComponent from "./board/PieceComponent.svelte";
    import EvalBar from "./board/EvalBar.svelte";
    import { onMount } from "svelte";
    import { Stockfish } from "../lib/stockfish";
    import type { StockfishEval } from "../lib/stockfish";

    export let fen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    let flipped = false;

    $: board = new ChessBoard(fen);

    let shownLegalMoves: number[] = [];

    let squareContainerElt: HTMLDivElement | null = null;

    /**
     * Chess board interface.
     */
    export class ChessBoard {
        private _chess: Chess;
        private _board: Board;

        constructor(fen: string) {
            this._chess = new Chess(fen);
            this._board = this._chess.board();
        }

        getTurn(): Color {
            return this._chess.turn();
        }

        getPieceAtIndex(index: number): Piece | null {
            let { row, column } = getCoordsFromIndex(index);

            return this._board[row][column];
        }

        /**
         * Returns the legal moves from the given square as an array of destination squares.
         */
        getLegalMovesFromSquare(index: number): string[] {
            return this._chess
                .moves({ square: boardIndexToSquare(index), verbose: true })
                .map((move) => move.to);
        }

        highlightLegalMoves(atIndex: number) {
            let legalMoves = this.getLegalMovesFromSquare(atIndex);

            shownLegalMoves = legalMoves.map((destination) => squareToBoardIndex(destination));
        }

        requestMove(from: number, toX: number, toY: number) {
            let to = getIndexAtScreenCoords(toX, toY);

            let fromSquare = boardIndexToSquare(from);
            let toSquare = boardIndexToSquare(to);

            this._chess.move({ from: fromSquare, to: toSquare, promotion: "q" });

            fen = this._chess.fen();

            stockfish.start_evaluation(fen);

            shownLegalMoves = [];
        }
    }

    type Board = (Piece | null)[][];

    // add squares to the board
    $: visualBoardIndices = generateBoardIndices(flipped);

    /**
     * Generates an array of indices for the board. If flipped is true, the array will be reversed.
     */
    function generateBoardIndices(flipped: boolean): number[] {
        let squares: number[] = [];

        for (let i = 0; i < 64; i++) {
            squares.push(i);
        }

        if (flipped) {
            squares.reverse();
        }

        return squares;
    }

    /**
     * Returns the row and column of the square at the given index.
     */
    function getCoordsFromIndex(index: number): { row: number; column: number } {
        let row = Math.floor(index / 8);
        let column = index % 8;

        return { row, column };
    }

    /**
     * Returns whether the square at the given index is a light square.
     */
    function isLightSquare(index: number): boolean {
        let { row, column } = getCoordsFromIndex(index);

        return (row + column) % 2 === 0;
    }

    /**
     * Parses a UCI string into a from and to square.
     */
    function parseUCI(uci: string): { from: Square; to: Square } {
        return {
            from: uci.slice(0, 2) as Square,
            to: uci.slice(2, 4) as Square,
        };
    }

    /**
     * Return the square at the given index.
     */
    function boardIndexToSquare(index: number): Square {
        let { row, column } = getCoordsFromIndex(index);

        return (String.fromCharCode(97 + column) + String.fromCharCode(56 - row)) as Square;
    }

    /**
     * Return the index of the given square.
     */
    function squareToBoardIndex(square: string): number {
        let column = square.charCodeAt(0) - 97;
        let row = 56 - square.charCodeAt(1);

        return row * 8 + column;
    }

    /**
     * Return the row annotation for the square at the given index.
     */
    function squareRowAnnotation(index: number): string | null {
        let { row, column } = getCoordsFromIndex(index);

        if (column === 0) {
            return String.fromCharCode(56 - row);
        }

        return null;
    }

    /**
     * Return the column annotation for the square at the given index.
     */
    function squareColumnAnnotation(index: number): string | null {
        let { row, column } = getCoordsFromIndex(index);

        if (row === 7) {
            return String.fromCharCode(97 + column);
        }

        return null;
    }

    /**
     * Returns the square at the given screen coordinates.
     */
    function getIndexAtScreenCoords(x: number, y: number) {
        let { left, top } = squareContainerElt.getBoundingClientRect();

        let squareSize = squareContainerElt.clientWidth / 8;

        let squareX = Math.floor((x - left) / squareSize);
        let squareY = Math.floor((y - top) / squareSize);

        if (flipped) {
            squareX = 7 - squareX;
            squareY = 7 - squareY;
        }
        
        return squareY * 8 + squareX;
    }

    function makeEvalStatusText(sfEval: StockfishEval): string {
        if (sfEval.continuations.length === 0) {
            return "No evaluation";
        }

        let score = sfEval.continuations[0].score;

        if (score["CentipawnAdvantage"]) {
            let cpa = score["CentipawnAdvantage"];
            return `${cpa > 0 ? "+" : ""}${(cpa / 100).toFixed(2)}`;
        } else if (score["Mate"]) {
            if (score["Mate"] > 0) {
                return `Mate in ${score["Mate"]}`;
            } else {
                return `Mate in ${-score["Mate"]}`;
            }
        }
    }

    let evalBarValue = 0.5;

    let stockfish = new Stockfish();
    let currentEval: StockfishEval | null = null;

    stockfish.start_evaluation(fen);

    setInterval(() => {
        stockfish.get_evaluation().then((stockfishEval) => {
            currentEval = stockfishEval;
            let score = stockfishEval.continuations[0].score;

            if (score["CentipawnAdvantage"]) {
                let cpa = score["CentipawnAdvantage"];
                let magnitude = cpa;
                let offset = Math.sqrt(Math.abs(magnitude)) / 80;

                evalBarValue = cpa > 0 ? 0.5 + offset : 0.5 - offset;
            } else if (score["Mate"]) {
                if (score["Mate"] > 0) {
                    evalBarValue = 1;
                } else {
                    evalBarValue = 0;
                }
            }
        });
    }, 500);
</script>

<div class="main">
    <span class="board-container">
        <div class="board">
            <div class="squares" bind:this={squareContainerElt}>
                {#each visualBoardIndices as square}
                    <div
                        class="square"
                        class:light={isLightSquare(square)}
                        class:dark={!isLightSquare(square)}
                        data-index={square}
                    >
                        {#if squareRowAnnotation(square)}
                            <div
                                class="square-annotation square-row-annotation"
                                class:flipped
                                class:normal={!flipped}
                            >
                                {squareRowAnnotation(square)}
                            </div>
                        {/if}
                        {#if squareColumnAnnotation(square)}
                            <div
                                class="square-annotation square-column-annotation"
                                class:flipped
                                class:normal={!flipped}
                            >
                                {squareColumnAnnotation(square)}
                            </div>
                        {/if}
                        {#if shownLegalMoves.includes(square)}
                            <div class="legal-move-overlay">
                                <div
                                    class="legal-move-overlay-circle"
                                    class:capturing={board.getPieceAtIndex(square) !== null}
                                />
                            </div>
                        {/if}
                        <PieceComponent
                            piece={board.getPieceAtIndex(square)}
                            index={square}
                            highlightLegalMoves={board.highlightLegalMoves.bind(board)}
                            clearHighlightedLegalMoves={() => (shownLegalMoves = [])}
                            requestMove={board.requestMove.bind(board)}
                            canGrabPiece={() => {
                                return board.getPieceAtIndex(square)?.color === board.getTurn();
                            }}
                            pieceExistsAt={(index) => board.getPieceAtIndex(index) !== null}
                        />
                    </div>
                {/each}
            </div>
        </div>
        <EvalBar value={evalBarValue} />
    </span>
    <div class="footer">
        <span>
            <button on:click={() => (flipped = !flipped)}>↺</button>
        </span>
        <span>
            {#if currentEval}
                <div class="sf-stats">
                    {makeEvalStatusText(currentEval)}
                </div>
            {/if}
        </span>
    </div>
</div>

<style>
    .main {
        width: 100%;
    }

    .board-container {
        display: grid;

        grid-template-columns: 1fr 20px;
    }

    .footer {
        display: flex;

        justify-content: space-between;
        align-items: center;

        opacity: 0.8;
    }

    .sf-stats {
        font-size: 0.8em;
        opacity: 0.8;
        text-align: right;

        font-weight: bold;
    }

    .board {
        width: 100%;
        height: 0;
        padding-bottom: 100%;
        box-sizing: border-box;
        overflow: hidden;

        border-radius: 6px;

        position: relative;

        user-select: none;
        -webkit-user-select: none;
    }

    .squares {
        position: absolute;
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: repeat(8, 12.5%);
        grid-template-rows: repeat(8, 12.5%);

        user-select: none;
    }

    .square {
        position: relative;
        display: flex;

        user-select: none;
    }

    .legal-move-overlay {
        position: absolute;
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;
    }

    .legal-move-overlay-circle {
        width: 25%;
        height: 25%;
        background-color: #3e150e51;

        border-radius: 50%;
    }

    .legal-move-overlay-circle.capturing {
        width: 80%;
        height: 80%;
    }

    .square-annotation {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 0.75rem;
        font-weight: bold;
        color: #3e150e51;

        position: absolute;

        margin: 0.1rem;
        width: auto;
        height: auto;
    }

    .square-row-annotation.normal {
        top: 0;
        left: 0;
    }
    .square-row-annotation.flipped {
        bottom: 0;
        right: 0;
    }

    .square-column-annotation.normal {
        bottom: 0;
        right: 0;
    }
    .square-column-annotation.flipped {
        top: 0;
        left: 0;
    }

    .light {
        background-color: #e1a770;
    }

    .dark {
        background-color: #c66942;
    }
</style>
