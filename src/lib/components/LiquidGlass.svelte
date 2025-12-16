<script>
	import { onMount } from 'svelte';

	let {
		children,
		contrast = 'dark',
		roundness = 32,
		blur = 20,
		opacity = 0.6
	} = $props();

	let rootElement = $state();
	let filterId = $state(`lg-dist-${Math.random().toString(36).substr(2, 9)}`);

	let isDark = $derived(contrast === 'dark' || contrast === 'dark-contrast');

	onMount(() => {
		if (rootElement) {
			rootElement.style.setProperty('--roundness', `${roundness}px`);
			rootElement.style.setProperty('--blur', `${blur}px`);
			rootElement.style.setProperty('--opacity', opacity);
		}
	});
</script>

<div
	bind:this={rootElement}
	class="liquid-glass-wrap"
	class:dark={isDark}
	class:light={!isDark}
>
	<div class="glass-content">
		{@render children()}
	</div>
	<div class="glass-filter" style="filter: url(#{filterId}) saturate(120%);"></div>
</div>

<svg style="display: none; position: absolute; width: 0; height: 0;">
	<filter id={filterId} x="0%" y="0%" width="100%" height="100%">
		<feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="2" seed="42" result="noise" />
		<feGaussianBlur in="noise" stdDeviation="3" result="blurred" />
		<feDisplacementMap in="SourceGraphic" in2="blurred" scale="80" xChannelSelector="R" yChannelSelector="G" />
	</filter>
</svg>

<style>
	.liquid-glass-wrap {
		--roundness: 32px;
		--blur: 20px;
		--opacity: 0.6;

		position: relative;
		border-radius: var(--roundness);
		overflow: hidden;
	}

	.glass-content {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 100%;
		border-radius: var(--roundness);
		backdrop-filter: blur(var(--blur));
		-webkit-backdrop-filter: blur(var(--blur));
	}

	.glass-filter {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: var(--roundness);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		pointer-events: none;
	}

	/* Dark variant - for dark containers on light/colorful backgrounds */
	.liquid-glass-wrap.dark .glass-content {
		background: linear-gradient(
			135deg,
			rgba(30, 30, 30, var(--opacity)),
			rgba(50, 50, 50, calc(var(--opacity) * 0.8))
		);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.1),
			inset 0 -1px 1px rgba(0, 0, 0, 0.3),
			0 8px 32px rgba(0, 0, 0, 0.2),
			0 0 0 1px rgba(255, 255, 255, 0.1);
	}

	/* Light variant - for transparent containers */
	.liquid-glass-wrap.light .glass-content {
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, calc(var(--opacity) * 0.3)),
			rgba(255, 255, 255, calc(var(--opacity) * 0.15))
		);
		box-shadow:
			inset 0 1px 1px rgba(255, 255, 255, 0.4),
			inset 0 -1px 1px rgba(0, 0, 0, 0.1),
			0 8px 32px rgba(0, 0, 0, 0.1),
			0 0 0 1px rgba(255, 255, 255, 0.2);
	}
</style>
