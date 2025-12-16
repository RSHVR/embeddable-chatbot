<script>
	import Chat from './Chat.svelte';

	let {
		apiEndpoint = '/api/chat',
		welcomeText = "Hey! I'm Veer's AI assistant. What brings you here today?",
		placeholder = 'Message Veer...',
		position = 'bottom-right'
	} = $props();

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}
</script>

<div class="chat-popup-wrapper" class:bottom-right={position === 'bottom-right'} class:bottom-left={position === 'bottom-left'}>
	{#if isOpen}
		<div class="chat-window">
			<div class="chat-header">
				<span class="header-title">Chat with Veer</span>
				<button class="close-btn" onclick={close} aria-label="Close chat">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			</div>
			<div class="chat-content">
				<Chat mode="popup" {apiEndpoint} {welcomeText} {placeholder} />
			</div>
		</div>
	{/if}

	<button class="chat-toggle-btn" onclick={toggle} aria-label={isOpen ? 'Close chat' : 'Open chat'}>
		{#if isOpen}
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		{:else}
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		{/if}
	</button>
</div>

<style>
	.chat-popup-wrapper {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 16px;
	}

	.chat-popup-wrapper.bottom-right {
		bottom: 24px;
		right: 24px;
	}

	.chat-popup-wrapper.bottom-left {
		bottom: 24px;
		left: 24px;
		align-items: flex-start;
	}

	.chat-window {
		width: 380px;
		height: 500px;
		background: #1a1a1a;
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.header-title {
		font-size: 16px;
		font-weight: 600;
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
	}

	.close-btn {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.1);
	}

	.chat-content {
		flex: 1;
		min-height: 0;
	}

	.chat-toggle-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		background: #007AFF;
		color: white;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(0, 122, 255, 0.4);
		transition: all 0.2s ease;
	}

	.chat-toggle-btn:hover {
		background: #0066DD;
		transform: scale(1.05);
		box-shadow: 0 6px 20px rgba(0, 122, 255, 0.5);
	}

	.chat-toggle-btn:active {
		transform: scale(0.95);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.chat-popup-wrapper.bottom-right,
		.chat-popup-wrapper.bottom-left {
			bottom: 16px;
			right: 16px;
			left: 16px;
		}

		.chat-window {
			width: calc(100vw - 32px);
			height: calc(100vh - 120px);
			max-height: 500px;
		}

		.chat-toggle-btn {
			width: 48px;
			height: 48px;
		}
	}
</style>
