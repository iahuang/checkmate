<script lang="ts">
    import type { Move } from "chess.js";
    import type { BoardState, PGNMetadata } from "../lib/chess/board";
    import type { ChessInterface, TimelineState } from "../lib/chess/chess_interface";
    import { range } from "../lib/chess/util";
    import { onDestroy } from "svelte";
    import type { TimelineAnnotations } from "../lib/chess/game_review";
    import { pathForMoveFeedbackIcon } from "../lib/ui/assets";

    export let chessInterface: ChessInterface;

    let timelineState: TimelineState;
    let metadata: PGNMetadata;
    let annotations: TimelineAnnotations;

    let unsubTimeline = chessInterface.stores.timelineState.subscribe((state) => {
        timelineState = state;
    });

    let unsubMetadata = chessInterface.stores.matchMetadata.subscribe((data) => {
        metadata = data;
    });

    let unsubAnnotations = chessInterface.stores.annotations.subscribe((data) => {
        annotations = data;
    });

    onDestroy(() => {
        unsubTimeline();
        unsubMetadata();
        unsubAnnotations();
    });

    $: whiteUsernameAvailable = metadata["White"] !== undefined && metadata["White"] !== "?";
    $: blackUsernameAvailable = metadata["Black"] !== undefined && metadata["Black"] !== "?";

    /**
     * Returns the timeline that should be displayed to the user.
     *
     * If the main timeline is empty (i.e. no game has been imported), then the hypothetical timeline
     * is displayed instead, since any moves made by the user will be hypothetical.
     */
    function getDisplayedTimeline(timelineState: TimelineState): BoardState[] {
        if (timelineState.main.length === 0) {
            return timelineState.hypothetical;
        }

        return timelineState.main;
    }

    function isMoveNoSelected(timelineState: TimelineState, i: number): boolean {
        if (timelineState.main.length === 0) {
            return false;
        }

        if (!timelineState.position.main) {
            return false;
        }

        return timelineState.position.index === i;
    }

    function getNthMoveInTimeline(timelineState: TimelineState, i: number): Move | null {
        let timeline = getDisplayedTimeline(timelineState);

        return timeline[i] === undefined ? null : timeline[i].move;
    }

    function displayMove(move: Move | null): string {
        if (move === null) {
            return "";
        }

        return move.san ?? "";
    }

    function annotationDeltaScoreText(index: number): string {
        let annotation = annotations.getAnnotationAt(index);

        if (!annotation) {
            return "";
        }

        if (annotation.evaluation.outcome === "Draw") {
            return "1/2-1/2";
        } else if (annotation.evaluation.outcome === "WhiteWin") {
            return "1-0";
        } else if (annotation.evaluation.outcome === "BlackWin") {
            return "0-1";
        }

        let score = annotation.evaluation.continuations[0]?.score;

        if (score) {
            if ("Mate" in score) {
                return `#${score["Mate"]}`;
            }
        }

        let deltaScoreText = (annotation.deltaScore / 100).toFixed(2).toString();

        return annotation.deltaScore >= 0 ? `+${deltaScoreText}` : `${deltaScoreText}`;
    }

    function moveFeedbackIconSrc(index: number): string {
        return pathForMoveFeedbackIcon(annotations.getAnnotationAt(index)!.feedback);
    }
</script>

<div class="main">
    <div class="header">
        <div class="names">
            <div class="side">
                <div class="color-circle white" />
                <span class:no-name={!whiteUsernameAvailable}>
                    {whiteUsernameAvailable ? metadata["White"] : "White"}
                </span>
            </div>
            <div class="side">
                <span class:no-name={!blackUsernameAvailable}>
                    {blackUsernameAvailable ? metadata["Black"] : "Black"}
                </span>
                <div class="color-circle black" />
            </div>
        </div>
        <hr />
    </div>

    <div class="move-table">
        {#each range(0, getDisplayedTimeline(timelineState).length / 2) as i}
            <div class="move-row">
                {#each [i * 2 + 1, i * 2 + 2] as j}
                    <div
                        class="move"
                        class:selected={isMoveNoSelected(timelineState, j)}
                        on:click={() => {
                            if (j >= timelineState.main.length) {
                                return;
                            }

                            chessInterface.setMoveIndex(j);
                        }}
                        role="presentation"
                    >
                        <span>
                            <span class="move-no">{j}.</span>
                            <span class="move-san">
                                {displayMove(getNthMoveInTimeline(timelineState, j))}
                            </span>
                        </span>
                        {#if annotations.getAnnotationAt(j)}
                            <span class="annotation">
                                <span class="delta-score-text">
                                    {annotationDeltaScoreText(j)}
                                </span>
                                <img src={moveFeedbackIconSrc(j)} alt="" class="feedback-icon" />
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .main {
        display: grid;
        grid-template-rows: auto 1fr;
        max-height: 100%;

        padding: 1rem;
        box-sizing: border-box;
    }

    .header {
        display: flex;
        flex-direction: column;
    }

    .names {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
    }

    .side {
        display: flex;
        align-items: center;

        font-weight: bold;
    }

    .no-name {
        opacity: 0.5;
    }

    .color-circle {
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 50%;
    }

    .color-circle.white {
        background-color: white;
        margin-right: 0.5rem;
    }

    .color-circle.black {
        background-color: black;
        border: 1px solid white;
        margin-left: 0.5rem;
    }

    .move-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .move {
        padding: 0.3rem 0.3rem;
        font-size: 0.8rem;

        display: flex;
        align-items: center;
        justify-content: space-between;

        cursor: pointer;
    }

    .move:hover {
        background-color: #ffffff11;
        border-radius: 0.5rem;
    }

    .move.selected {
        background-color: #ffffff1a;
        border-radius: 0.5rem;
    }

    .move-table {
        width: 100%;
        overflow-y: auto;
    }

    .move-no {
        padding-right: 0.5rem;
        opacity: 0.5;
        display: inline-block;
        min-width: 1.5rem;
    }

    .move-san {
        font-weight: bold;
    }

    .delta-score-text {
        font-size: 0.75rem;
        opacity: 0.8;
        font-family: "Source Code Pro";
    }

    .annotation {
        display: flex;
        align-items: center;
    }

    .feedback-icon {
        width: 1rem;
        height: 1rem;
        margin-left: 0.5rem;
    }
</style>
