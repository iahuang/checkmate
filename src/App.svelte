<script lang="ts">
    import { invoke } from "@tauri-apps/api/tauri";
    import { onMount } from "svelte";
    import ChessBoard from "./components/ChessBoard.svelte";

    class Stockfish {
        startEvalutation(fen: string) {
            return invoke("start_evaluation", { fen });
        }

        getEvaluation() {
            return invoke("get_evaluation");
        }
    }

    const stockfish = new Stockfish();
</script>

<main>
    <div>
        <ChessBoard />
    </div>
    <div />
</main>

<style>
    main {
        display: grid;
        grid-template-columns: 1fr 1fr;

        width: 100%;
        height: 100vh;

        /* dark mode */
        background-color: #1d2226;

        padding: 2rem;

        box-sizing: border-box;
    }
</style>
