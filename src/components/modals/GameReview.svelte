<script lang="ts">
    import type { ChessInterface } from "../../lib/chess/chess_interface";
    import { GameReviewer } from "../../lib/chess/game_review";
    import type ModalManager from "../../lib/ui/modal_manager";
    import { get } from "svelte/store";
    import { onDestroy } from "svelte";

    export let modalManager: ModalManager;
    export let args: { chessInterface: ChessInterface };

    let reviewer = new GameReviewer(get(args.chessInterface.stores.timelineState).main);
    reviewer.beginGameReview();

    let progress = reviewer.getProgress();
    
    let interval = setInterval(() => {
        progress = reviewer.getProgress();

        if (reviewer.isCompleted()) {
            clearInterval(interval);
            args.chessInterface.loadAnnotations(reviewer.getAnnotations()!);
            modalManager.close();
        }
    }, 500);

    onDestroy(() => {
        clearInterval(interval);
    });

</script>

<div class="modal-base modal-body">
    <span class="title">Reviewing game...</span>
    <div class="progress-bar">
        <div class="progress" style="width: {progress * 100}%"></div>
    </div>
</div>

<style>
    .modal-body {
        width: max(50vw, min(500px, 80vw));

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        padding: 2rem 2rem;
    }

    .title {
        font-size: 1.5rem;
        font-weight: bold;
    }

    .progress-bar {
        width: 100%;
        height: 2rem;
        background-color: #20252a;
        border-radius: 1rem;
        overflow: hidden;
        margin-top: 2rem;
    }

    .progress {
        height: 100%;
        background-color: #4bdf49;
        border-radius: 1rem;
        transition: width 0.1s ease-in-out;
    }
</style>