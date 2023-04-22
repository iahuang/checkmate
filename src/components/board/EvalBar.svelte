<script lang="ts">
    export let value = 0.5; // 0 to 1
</script>
    
<div class="bar">
    <div class="bar-inner" style="height: {value * 100}%; bottom: 0;"></div>
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
        transition: height 0.2s ease-in-out;

        position: absolute;
    }
</style>