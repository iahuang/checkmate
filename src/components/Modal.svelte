<script lang="ts">
    import { onDestroy } from "svelte";
    import type { ModalComponent } from "../lib/ui/modal_manager";
    import type ModalManager from "../lib/ui/modal_manager";

    export let modalManager: ModalManager;

    let currentModal: ModalComponent<any> | null = null;
    let modalArgs: any = null;

    let unsub_1 = modalManager.modal.subscribe((modal) => {
        currentModal = modal;
    });

    let unsub_2 = modalManager.args.subscribe((args) => {
        modalArgs = args;
    });

    onDestroy(() => {
        unsub_1();
        unsub_2();
    });
</script>

<div class="modal-container">
    {#if currentModal}
        <div
            class="overlay"
            on:click={() => {
                modalManager.close();
            }}
            role="presentation"
        />
        <div class="container">
            <svelte:component this={currentModal} {modalManager} args={modalArgs} />
        </div>
    {/if}
</div>

<style>
    .modal-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        display: flex;
        justify-content: center;
        align-items: center;

        pointer-events: none;
    }

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        /* dark mode */
        background-color: #1d2226;

        opacity: 0.9;

        cursor: pointer;

        pointer-events: all;
    }

    .container {
        position: relative;

        pointer-events: all;
    }
</style>
