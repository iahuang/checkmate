<script lang="ts">
    import type { ChessInterface, TimelineState } from "src/lib/chess/chess_interface";
    import { range } from "../lib/chess/util";
    import { onDestroy } from "svelte";

    export let chessInterface: ChessInterface;

    let timelineState: TimelineState;

    let unsub = chessInterface.stores.timelineState.subscribe((state) => {
        timelineState = state;
    });

    onDestroy(() => {
        unsub();
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
        window.removeEventListener("keydown", keydown);
    });

    

    function getMoveSAN(index: number): string {
        if (index === 0) {
            return "";
        } else {
            return timelineState.main[index].move!.san;
        }
    }

    $: start = Math.max(0, timelineState.position.index - 5);
    $: end = Math.min(timelineState.position.index + 6, timelineState.main.length);
</script>

<div class="main">
    <div class="timeline">
        {#each range(start, end) as i}
            <div class="timeline-item" class:highlighted={i === timelineState.position.index}>
                <span style:opacity={0.8}>{i === 0 ? "Start" : i + "."}</span>
                &nbsp;
                <span class="move-san">{getMoveSAN(i)}</span>
            </div>
        {/each}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow-x: hidden;
        
        width: 100%;
    }

    .timeline {
        height: auto;

        display: flex;
        flex-direction: row;
    }

    .timeline-item {
        width: 4rem;

        /* No wrapping */
        white-space: nowrap;

        background-color: #2d343a;

        display: flex;
        align-items: center;
        justify-content: center;

        border-radius: 5px;
        margin: 0 5px;

        padding: 5px;

        font-size: 0.8rem;

        font-family: "Source Code Pro";
    }

    .timeline-item.highlighted {
        background-color: #969d3e;
    }

    .move-san {
        font-weight: bold;
    }
</style>
