<script lang="ts">
    import ChessBoard from "./components/ChessBoard.svelte";
    import Modal from "./components/Modal.svelte";
    import { ChessInterface, type TimelineState } from "./lib/chess/chess_interface";
    import ModalManager from "./lib/ui/modal_manager";
    import type { BoardState } from "./lib/chess/board";

    import Upload from "./components/modals/Upload.svelte";
    import GameReview from "./components/modals/GameReview.svelte";

    import { onDestroy } from "svelte";
    import MatchSummary from "./components/MatchSummary.svelte";
    import MoveFeedback from "./components/MoveFeedback.svelte";

    let modalManager = new ModalManager();
    let chessInterface = new ChessInterface();

    let boardState: BoardState;
    let timelineState: TimelineState;

    let unsubBoard = chessInterface.stores.boardState.subscribe((state) => {
        boardState = state;
    });

    let unsubTimeline = chessInterface.stores.timelineState.subscribe((state) => {
        timelineState = state;
    });

    onDestroy(() => {
        unsubBoard();
        unsubTimeline();
    });
</script>

<main>
    <div class="content">
        <div>
            <ChessBoard {chessInterface} />
        </div>
        <div class="right-panel">
            <div>
                <button on:click={() => modalManager.open(Upload, { chessInterface })}>
                    Import Game
                </button>
                <button
                    class="green"
                    disabled={timelineState.main.length === 0}
                    on:click={() => {
                        chessInterface.jumpToStart();

                        modalManager.open(GameReview, { chessInterface });
                    }}
                >
                    Review Game
                </button>
            </div>
            <div class="panel-component">
                <MatchSummary {chessInterface} />
            </div>
            <div class="panel-component">
                <MoveFeedback {chessInterface} />
            </div>
        </div>
    </div>
    <Modal {modalManager} />
</main>

<style>
    .content {
        display: grid;
        grid-template-columns: 80vh 1fr;
        grid-gap: 1rem;

        padding: 2rem;
    }

    .right-panel {
        display: grid;
        grid-row-gap: 1rem;
        grid-template-rows: auto minmax(5rem, 60vh) 5rem;
    }

    .panel-component {
        background-color: #13181c;
        border-radius: 0.5rem;
    }

    main {
        width: 100%;
        height: 100vh;

        box-sizing: border-box;

        position: relative;
    }
</style>
