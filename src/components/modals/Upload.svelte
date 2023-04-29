<script lang="ts">
    import { Chess } from "chess.js";
    import type ModalManager from "../../lib/ui/modal_manager";
    import { listen } from "@tauri-apps/api/event";
    import { fs } from "@tauri-apps/api";
    import type { ChessInterface } from "../../lib/chess/chess_interface";

    export let modalManager: ModalManager;
    export let args: { chessInterface: ChessInterface };

    let textarea: HTMLTextAreaElement;
    let isValidPGN = false;

    function validatePGN(pgn: string): boolean {
        if (pgn.length === 0) return false;

        try {
            let game = new Chess();
            game.loadPgn(pgn);
            return true;
        } catch (e) {
            return false;
        }
    }

    listen("tauri://file-drop", (event) => {
        let files = event.payload as string[];

        if (files.length === 0) return;

        let file = files[0];

        fs.readTextFile(file).then((pgn) => {
            textarea.value = pgn;
            isValidPGN = validatePGN(pgn);
        });
    });
</script>

<div class="modal-base upload-modal">
    <textarea
        placeholder="Paste or drag a PGN here"
        bind:this={textarea}
        on:input={(event) => {
            isValidPGN = validatePGN(event.currentTarget.value);
        }}
    />
    <button
        class="green"
        disabled={!isValidPGN}
        on:click={() => {
            args.chessInterface.loadPGN(textarea.value);
            args.chessInterface.clearAnnotations();
            modalManager.close();
        }}>Import</button
    >
</div>

<style>
    .upload-modal {
        width: max(50vw, min(500px, 80vw));

        display: grid;
        grid-row-gap: 1rem;
        grid-template-rows: 1fr auto;

        height: 60vh;
        padding: 1rem;
    }

    textarea {
        font-family: "Source Code Pro";
    }
</style>
