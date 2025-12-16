<script>
	let { children } = $props();
</script>

<svelte:head>
	<title>Chat with Veer</title>
	<meta name="description" content="Chat with Veer's AI assistant" />
</svelte:head>

<main>
	{@render children()}
</main>

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(html, body) {
		height: 100%;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
		background: #000;
		color: #fff;
	}

	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
</style>
