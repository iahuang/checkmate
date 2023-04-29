<script lang="ts">
    import PieceComponent from "./board/PieceComponent.svelte";
    import { onDestroy } from "svelte";

    import { boardIndexToSquare, squareToBoardIndex, type BoardState } from "../lib/chess/board";
    import type { ChessInterface, TimelineState } from "../lib/chess/chess_interface";
    import type { TimelineAnnotations } from "../lib/chess/game_review";
    import { pathForMoveFeedbackIcon } from "../lib/ui/assets";

    export let chessInterface: ChessInterface;

    function makeSquareIndexList(flipped: boolean): number[] {
        let indices: number[] = [];
        for (let i = 0; i < 64; i++) {
            indices.push(flipped ? 63 - i : i);
        }
        return indices;
    }

    function isLightSquare(index: number): boolean {
        return (index % 8) % 2 === Math.floor(index / 8) % 2;
    }

    function indexAsRowCol(index: number): { row: number; col: number } {
        return {
            row: Math.floor(index / 8),
            col: index % 8,
        };
    }

    function squareRowAnnotation(index: number): string | null {
        let { row, col } = indexAsRowCol(index);

        if (col === 0) {
            return (7 - row + 1).toString();
        } else {
            return null;
        }
    }

    function squareColumnAnnotation(index: number): string | null {
        let { row, col } = indexAsRowCol(index);

        if (row === 7) {
            return String.fromCharCode(97 + col);
        } else {
            return null;
        }
    }

    /**
     * If an annotation should be displayed at the given square,
     * returns the path to the icon that should be displayed.
     */
    function moveFeedbackAnnotationAtSquare(
        boardState: BoardState,
        timelineState: TimelineState,
        annotations: TimelineAnnotations,
        index: number
    ): string | null {
        if (!timelineState.position.main) {
            return null;
        }

        let annotation = annotations.getAnnotationAt(timelineState.position.index);

        if (annotation === null) {
            return null;
        }

        if (boardState.move === null) {
            return null;
        }

        console.log(squareToBoardIndex(boardState.move.to) === index);

        if (squareToBoardIndex(boardState.move.to) === index) {
            return pathForMoveFeedbackIcon(annotation.feedback);
        }

        return null;
    }

    /* Elements */
    let boardElement: HTMLDivElement;

    /* State */

    let shownLegalMoves: number[] = [];
    let flipped = false;

    let boardState: BoardState;
    let annotations: TimelineAnnotations;
    let timelineState: TimelineState;

    let visualBoardIndices: number[] = [];
    
    $: visualBoardIndices = makeSquareIndexList(flipped);

    let unsubBoard = chessInterface.stores.boardState.subscribe((state) => {
        boardState = state;
        shownLegalMoves = [];
    });

    let unsubAnnotations = chessInterface.stores.annotations.subscribe((data) => {
        annotations = data;
    });

    let unsubTimelineState = chessInterface.stores.timelineState.subscribe((state) => {
        timelineState = state;
    });

    function keydown(e: KeyboardEvent): void {
        if (e.key === "ArrowLeft") {
            chessInterface.previous();
        } else if (e.key === "ArrowRight") {
            chessInterface.next();
        } else if (e.key === "ArrowUp") {
            chessInterface.jumpToStart();
        } else if (e.key === "ArrowDown") {
            chessInterface.jumpToEnd();
        }
    }

    window.addEventListener("keydown", keydown);

    onDestroy(() => {
        unsubBoard();
        unsubAnnotations();
        unsubTimelineState();

        window.removeEventListener("keydown", keydown);
    });
</script>

<div class="main">
    <div class="board" bind:this={boardElement}>
        <div class="squares">
            {#each visualBoardIndices as idx}
                <div
                    class="square"
                    class:light={isLightSquare(idx)}
                    class:dark={!isLightSquare(idx)}
                    data-index={idx}
                >
                    <!-- Row and Column Annotations -->
                    {#if squareRowAnnotation(idx)}
                        <div
                            class="square-annotation square-row-annotation"
                            class:flipped
                            class:normal={!flipped}
                        >
                            {squareRowAnnotation(idx)}
                        </div>
                    {/if}
                    {#if squareColumnAnnotation(idx)}
                        <div
                            class="square-annotation square-column-annotation"
                            class:flipped
                            class:normal={!flipped}
                        >
                            {squareColumnAnnotation(idx)}
                        </div>
                    {/if}

                    <!-- Legal Move Annotations -->
                    {#if shownLegalMoves.includes(idx)}
                        <div class="legal-move-overlay">
                            <div
                                class="legal-move-overlay-circle"
                                class:capturing={boardState.getPieceAt(idx) !== null}
                            />
                        </div>
                    {/if}

                    <!-- Last Move Annotations -->
                    {#if boardState.move && (boardState.move.from === boardIndexToSquare(idx) || boardState.move.to === boardIndexToSquare(idx))}
                        <div class="last-move-overlay" />
                    {/if}

                    <!-- Piece -->
                    <PieceComponent
                        piece={boardState.pieces[idx]}
                        index={idx}
                        highlightLegalMoves={() => {
                            boardElement.focus();
                            shownLegalMoves = boardState.getLegalMovesFrom(idx);
                        }}
                        clearHighlightedLegalMoves={() => (shownLegalMoves = [])}
                        requestMove={() => {}}
                        canGrabPiece={() => {
                            return boardState.getPieceAt(idx)?.color === boardState.getTurn();
                        }}
                        pieceExistsAt={(index) => boardState.getPieceAt(index) !== null}
                    />

                    <!-- Move Feedback Annotations -->
                    {#if moveFeedbackAnnotationAtSquare(boardState, timelineState, annotations, idx)}
                        <img
                            src={moveFeedbackAnnotationAtSquare(boardState, timelineState, annotations, idx)}
                            alt=""
                            class="move-feedback-annotation"
                        />
                    {/if}
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .main {
        width: 100%;
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

    .last-move-overlay {
        position: absolute;
        width: 100%;
        height: 100%;

        background-color: #ffd151ab;
    }

    .move-feedback-annotation {
        position: absolute;
        width: 5vh;
        height: 5vh;

        right: -0.5vh;

        display: flex;
        justify-content: center;
        align-items: center;

        z-index: 1;

        filter: drop-shadow(0 4px 5px #00000081);
    }

    .square-annotation {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 0.8rem;
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
