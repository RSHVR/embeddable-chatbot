<script>
	import ChatPopup from '$lib/components/ChatPopup.svelte';
</script>

<div class="demo-page">
	<h1>Popup Mode Demo</h1>
	<p>Click the chat button in the bottom-right corner to open the chat widget.</p>

	<div class="content">
		<p>This is a sample page with some content. The chat popup floats over everything.</p>
		<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
	</div>
</div>

<ChatPopup />

<style>
	.demo-page {
		padding: 40px;
		max-width: 800px;
		margin: 0 auto;
		color: #fff;
	}

	h1 {
		font-size: 32px;
		margin-bottom: 16px;
	}

	p {
		font-size: 16px;
		line-height: 1.6;
		margin-bottom: 16px;
		color: rgba(255, 255, 255, 0.8);
	}

	.content {
		margin-top: 40px;
		padding: 24px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
	}
</style>
