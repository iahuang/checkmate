<script lang="ts">
    import { onDestroy } from "svelte";
    import type { ChessInterface, TimelineState } from "../lib/chess/chess_interface";
    import {
        MoveFeedback,
        type Annotation,
        type TimelineAnnotations,
    } from "../lib/chess/game_review";
    import { pathForMoveFeedbackIcon } from "../lib/ui/assets";

    export let chessInterface: ChessInterface;
    let annotations: TimelineAnnotations;
    let timeline: TimelineState;

    let unsubAnnotations = chessInterface.stores.annotations.subscribe((data) => {
        annotations = data;
    });
    let unsubTimeline = chessInterface.stores.timelineState.subscribe((state) => {
        timeline = state;
    });

    function getCurrentAnnotation(
        timeline: TimelineState,
        annotations: TimelineAnnotations
    ): Annotation | null {
        if (timeline.main.length === 0 || !timeline.position.main) {
            return null;
        }

        return annotations.getAnnotationAt(timeline.position.index);
    }

    function getCurrentAnnotationText(
        timeline: TimelineState,
        annotations: TimelineAnnotations,
        currentAnnotation: Annotation | null
    ): string | null {
        if (timeline.main.length === 0 || !timeline.position.main || currentAnnotation === null) {
            return null;
        }

        let boardState = timeline.main[timeline.position.index];
        let previousBoardState = timeline.main[timeline.position.index - 1];
        let descriptor = "";
        let feedback = currentAnnotation.feedback;

        switch (feedback) {
            case MoveFeedback.Good:
                descriptor = "is a good move.";
                break;
            case MoveFeedback.Best:
                descriptor = "is the top engine move.";
                break;
            case MoveFeedback.Blunder:
                descriptor = "is a blunder.";
                break;
            case MoveFeedback.Book:
                descriptor = "is an opening book move.";
                break;
            case MoveFeedback.Dubious:
                descriptor = "is an inaccuracy.";
                break;
            case MoveFeedback.Miss:
                descriptor = "misses checkmate.";
                break;
        }

        if (previousBoardState.getAllLegalMoves().length == 1) {
            descriptor = "is forced.";
        }

        return `${boardState.move!.san} ${descriptor}`;
    }

    $: currentAnnotation = getCurrentAnnotation(timeline, annotations);
    $: currentAnnotationText = getCurrentAnnotationText(timeline, annotations, currentAnnotation);

    onDestroy(() => {
        unsubAnnotations();
        unsubTimeline();
    });
</script>

<div class="main">
    {#if currentAnnotation}
        <div class="header">
            <img
                src={pathForMoveFeedbackIcon(currentAnnotation.feedback)}
                alt=""
                class="feedback-icon"
            />
            <div>
                <span class="title">{currentAnnotationText}</span>
                {#if currentAnnotation.description}
                    <span class="description">
                        {@html currentAnnotation.description}
                    </span>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .main {
        padding: 1rem;
        height: 100%;
        box-sizing: border-box;

        display: flex;
        align-items: center;
    }

    .header {
        display: flex;
        align-items: center;
    }

    .title {
        font-weight: bold;
    }

    .description {
        display: block;
        margin-top: 0.5rem;
        font-size: 0.8rem;
        opacity: 0.5;
    }

    .feedback-icon {
        width: 2rem;
        height: 2rem;
        margin-right: 1rem;
    }
</style>
