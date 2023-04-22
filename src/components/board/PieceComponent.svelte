<script lang="ts">
    import type { Piece } from "chess.js";
    import { onMount } from "svelte";

    export let piece: Piece | null = null;
    export let index;

    export let highlightLegalMoves: (index: number) => void;
    export let clearHighlightedLegalMoves: () => void;
    export let requestMove: (index: number, toX: number, toY: number) => void;
    export let canGrabPiece: (index: number) => boolean;
    export let pieceExistsAt: (index: number) => boolean;

    let dragStartX: number | null = null;
    let dragStartY: number | null = null;
    let mouseX: number | null = null;
    let mouseY: number | null = null;

    $: dragging = dragStartX !== null && dragStartY !== null;

    onMount(() => {
        window.addEventListener("mousemove", (event) => {
            if (dragging) {
                mouseX = event.clientX;
                mouseY = event.clientY;
            }
        });

        window.addEventListener("mouseup", () => {
            dragStartX = null;
            dragStartY = null;

            if (dragging) {
                requestMove(index, mouseX, mouseY);
            }
        });
    });
</script>

<div
    class="piece"
    on:mousedown={(event) => {
        if (!canGrabPiece(index)) {
            return;
        }

        highlightLegalMoves(index);

        dragStartX = event.clientX;
        dragStartY = event.clientY;

        mouseX = event.clientX;
        mouseY = event.clientY;
    }}
>
    {#if piece && !dragging}
        <img
            src={`/resources/assets/pieces/${piece.color}${piece.type}.svg`}
            alt=""
            class="piece-img"
        />
    {/if}

    {#if piece && dragging}
        <img
            src={`/resources/assets/pieces/${piece.color}${piece.type}.svg`}
            alt=""
            class="piece-img ghost"
            style:left={mouseX - dragStartX + "px"}
            style:top={mouseY - dragStartY + "px"}
        />
    {/if}
</div>

<style>
    .piece {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .piece-img {
        position: absolute;
        width: 100%;
        height: 100%;

        filter: drop-shadow(0 0.2rem 0.15rem rgba(0, 0, 0, 0.5));

        user-select: none;
        cursor: grab;

        -webkit-user-drag: none;
    }

    .piece-img.ghost {
        opacity: 0.5;
        z-index: 100;
    }
</style>
