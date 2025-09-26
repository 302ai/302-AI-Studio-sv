<script lang="ts">
	import { onMount } from "svelte";

	let fps = $state(0);
	let lastTime = 0;
	let frameCount = 0;
	let animationId: number;

	function updateFPS(currentTime: number) {
		frameCount++;

		if (currentTime - lastTime >= 1000) {
			fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
			frameCount = 0;
			lastTime = currentTime;
		}

		animationId = requestAnimationFrame(updateFPS);
	}

	onMount(() => {
		lastTime = performance.now();
		animationId = requestAnimationFrame(updateFPS);

		return () => {
			if (animationId) {
				cancelAnimationFrame(animationId);
			}
		};
	});
</script>

<div class="fixed bottom-4 right-4 z-50 rounded bg-black/80 px-2 py-1 text-xs text-white font-mono">
	FPS: {fps}
</div>
