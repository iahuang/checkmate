<script lang="ts">
	import { invoke } from '@tauri-apps/api/tauri';
	import { onMount } from 'svelte';

	class Stockfish {
        startEvalutation(fen: string) {
            return invoke('start_evaluation', { fen });
        }

        getEvaluation() {
            return invoke('get_evaluation');
        }
    }

    const stockfish = new Stockfish();
    let currentEvaluation: any = null;

    onMount(async () => {
        await stockfish.startEvalutation('rnbqkbnr/pppppppp/8/88/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    setInterval(async () => {
        currentEvaluation = await stockfish.getEvaluation();
    }, 500);
</script>

<div>
	<h1>Stockfish</h1>
    {#if currentEvaluation}
        <p>Current evaluation: {JSON.stringify(currentEvaluation)}</p>
    {:else}
        <p>Waiting for evaluation...</p>
    {/if}
</div>
