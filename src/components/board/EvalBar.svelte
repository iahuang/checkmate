<script lang="ts">
    export let value = 0.5; // 0 to 1
</script>

<div class="bar">
    <div class="bar-inner" style="height: {Math.min(Math.max(value, 0), 1) * 100}%; bottom: 0;" />
</div>

<style>
    .bar {
        width: 20px;
        margin-left: 5px;
        border-radius: 5px;
        height: 100%;
        background-color: #282f36;

        position: relative;
    }

    .bar-inner {
        width: 100%;
        background-color: #ffefec;
        border-radius: 5px;
        transition: height 1s ease-in-out;

        position: absolute;
    }
</style>
