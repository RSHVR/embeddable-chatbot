<script>
	import Chat from './Chat.svelte';
	import LiquidGlass from './LiquidGlass.svelte';

	let {
		apiEndpoint = '/api/chat',
		welcomeText = "Hi! How can I help you today?",
		placeholder = 'Type a message...',
		headerTitle = 'Chat',
		position = 'bottom-right',
		// Styling props
		headerBg = 'transparent', // prev: 'rgba(0, 0, 0, 0.3)'
		bodyBg = 'transparent',
		inputBg = 'transparent', // prev: 'rgba(0, 0, 0, 0.3)'
		inputTextColor = '#ffffff',
		sendIconColor = '#007AFF',
		// Button props
		buttonBg = 'transparent',
		buttonIconColor = '#ffffff',
		buttonIcon = null, // Custom SVG snippet for closed state
		// Video performance props
		videoPreload = 'metadata', // 'none' | 'metadata' | 'auto'
		videoPoster = '' // Poster image URL for video backgrounds
	} = $props();

	let isOpen = $state(false);

	// Determine if bodyBg is a video
	let isBodyBgVideo = $derived(
		bodyBg.endsWith('.mp4') ||
		bodyBg.endsWith('.webm') ||
		bodyBg.endsWith('.mov')
	);

	// Determine if bodyBg is an image/gif URL or a color
	let isBodyBgImage = $derived(
		!isBodyBgVideo && (
			bodyBg.startsWith('http') ||
			bodyBg.startsWith('/') ||
			bodyBg.startsWith('url(') ||
			bodyBg.endsWith('.gif') ||
			bodyBg.endsWith('.png') ||
			bodyBg.endsWith('.jpg') ||
			bodyBg.endsWith('.jpeg') ||
			bodyBg.endsWith('.webp')
		)
	);

	function toggle() {
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}
</script>

<div class="chat-popup-wrapper" class:bottom-right={position === 'bottom-right'} class:bottom-left={position === 'bottom-left'}>
	{#if isOpen}
		<div class="chat-window-container">
			{#if isBodyBgVideo}
				<video
					class="body-bg-video"
					autoplay
					muted
					loop
					playsinline
					preload={videoPreload}
					poster={videoPoster || undefined}
				>
					{#if bodyBg.endsWith('.mp4')}
						<source src={bodyBg.replace('.mp4', '.webm')} type="video/webm" />
					{/if}
					<source src={bodyBg} type="video/mp4" />
				</video>
			{:else}
				<div
					class="body-bg"
					style:background={isBodyBgImage ? `url(${bodyBg.startsWith('url(') ? bodyBg.slice(4, -1) : bodyBg}) center/cover no-repeat` : bodyBg}
				></div>
			{/if}
			<div class="chat-window">
				<LiquidGlass contrast="light" roundness={24} blur={12} opacity={0.5}>
					<div class="chat-window-inner">
						<div class="chat-header" style:background={headerBg}>
							<span class="header-title">{headerTitle}</span>
							<button class="close-btn" onclick={close} aria-label="Close chat">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
						</div>
						<div class="chat-content">
							<Chat mode="popup" {apiEndpoint} {welcomeText} {placeholder} {inputBg} {inputTextColor} {sendIconColor} />
						</div>
					</div>
				</LiquidGlass>
			</div>
		</div>
	{/if}

	<button class="chat-toggle-btn" onclick={toggle} aria-label={isOpen ? 'Close chat' : 'Open chat'} style:background={buttonBg} style:color={buttonIconColor}>
		{#if isOpen}
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		{:else if buttonIcon}
			{@render buttonIcon()}
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

	.chat-window-container {
		position: relative;
		width: 380px;
		height: 520px;
		border-radius: 24px;
		overflow: hidden;
		animation: slideUp 0.3s ease-out;
	}

	.body-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.body-bg-video {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
	}

	.chat-window {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
	}

	.chat-window :global(.liquid-glass-wrap) {
		width: 100%;
		height: 100%;
	}

	.chat-window-inner {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
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
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.header-title {
		font-size: 16px;
		font-weight: 600;
		color: #fff;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
	}

	.close-btn {
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		padding: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.2);
	}

	.chat-content {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.chat-toggle-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		transition: all 0.2s ease;
	}

	.chat-toggle-btn:hover {
		filter: brightness(0.9);
		transform: scale(1.05);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
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

		.chat-window-container {
			width: calc(100vw - 32px);
			height: calc(100vh - 120px);
			max-height: 520px;
		}

		.chat-toggle-btn {
			width: 48px;
			height: 48px;
		}
	}
</style>
