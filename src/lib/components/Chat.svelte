<script>
	import { onMount } from 'svelte';
	import ChatWidget from './ChatWidget.svelte';
	import ChatInput from './ChatInput.svelte';
	import LiquidGlass from './LiquidGlass.svelte';
	import { loadChat } from '$lib/supabase';

	let {
		mode = 'container',
		apiEndpoint = '/api/chat',
		welcomeText = "Hi! How can I help you today?",
		placeholder = 'Type a message...',
		videoSrc = '/wave-background.mp4',
		// Popup mode styling props
		inputBg = 'rgba(0, 0, 0, 0.3)',
		inputTextColor = '#ffffff',
		sendIconColor = '#007AFF'
	} = $props();

	const welcomeMessage = {
		sender: 'bot',
		text: welcomeText
	};

	let messages = $state([welcomeMessage]);
	let isLoading = $state(false);
	let sessionId = $state('');

	onMount(async () => {
		// Generate or retrieve session ID
		let storedSessionId = sessionStorage.getItem('chat_session_id');
		if (!storedSessionId) {
			storedSessionId = crypto.randomUUID();
			sessionStorage.setItem('chat_session_id', storedSessionId);
		}
		sessionId = storedSessionId;

		// Load existing chat history from Supabase
		const savedMessages = await loadChat(storedSessionId);
		if (savedMessages && savedMessages.length > 0) {
			messages = savedMessages;
		}
	});

	async function handleSend(text) {
		// Add user message
		messages = [...messages, { sender: 'user', text }];
		isLoading = true;

		try {
			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: text,
					sessionId,
					history: messages.slice(0, -1)
				})
			});

			if (!response.ok) {
				throw new Error('Failed to get response');
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No reader available');

			const decoder = new TextDecoder();
			let botMessage = '';
			let botMessageIndex = messages.length;

			messages = [...messages, { sender: 'bot', text: '' }];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') break;
						try {
							const parsed = JSON.parse(data);
							if (parsed.text) {
								botMessage += parsed.text;
								messages = messages.map((msg, i) =>
									i === botMessageIndex ? { ...msg, text: botMessage } : msg
								);
							}
						} catch {
							// Ignore parse errors
						}
					}
				}
			}
		} catch (error) {
			console.error('Error sending message:', error);
			messages = [
				...messages,
				{
					sender: 'bot',
					text: "Sorry, I'm having trouble connecting right now. Please try again in a moment!"
				}
			];
		} finally {
			isLoading = false;
		}
	}
</script>

{#if mode === 'container'}
	<div class="chat-container-mode">
		<div class="video-wrapper">
			<video class="video-bg" autoplay muted loop playsinline>
				<source src={videoSrc} type="video/mp4" />
			</video>

			<div class="chat-container">
				<div class="chat-body">
					<div class="chat-body-inner">
						<ChatWidget {messages} {isLoading} />
					</div>
				</div>

				<div class="textbox-dock">
					<LiquidGlass contrast="light" roundness={24} blur={8} opacity={0.3}>
						<div class="textbox-inner">
							<ChatInput onSend={handleSend} {placeholder} disabled={isLoading} />
						</div>
					</LiquidGlass>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="chat-popup-mode">
		<div class="popup-chat-body">
			<ChatWidget {messages} {isLoading} />
		</div>
		<div class="popup-input" style:background={inputBg}>
			<ChatInput onSend={handleSend} {placeholder} disabled={isLoading} textColor={inputTextColor} iconColor={sendIconColor} />
		</div>
	</div>
{/if}

<style>
	/* Container Mode Styles */
	.chat-container-mode {
		width: 100%;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 10px 20px 5px;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.video-wrapper {
		position: relative;
		width: 100%;
		max-width: 600px;
		min-height: fit-content;
		border-radius: 32px;
		overflow: hidden;
	}

	.video-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		z-index: 0;
	}

	.chat-container {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 20px;
		width: 100%;
		height: 100%;
		padding: 25px;
		box-sizing: border-box;
	}

	.chat-body {
		height: 500px;
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
	}

	.chat-body-inner {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.chat-body :global(.liquid-glass-wrap) {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
	}

	.textbox-dock {
		flex-shrink: 0;
		position: relative;
		z-index: 1;
	}

	.textbox-inner {
		width: 100%;
	}

	/* Popup Mode Styles */
	.chat-popup-mode {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		gap: 16px;
		padding: 16px;
		box-sizing: border-box;
	}

	.popup-chat-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.popup-input {
		flex-shrink: 0;
		border-radius: 9999px;
	}

	/* Responsive - Container Mode */
	@media (max-width: 480px) {
		.chat-container-mode {
			padding: 20px;
		}

		.chat-container {
			height: 75vh;
			max-height: none;
		}
	}

	@media (min-width: 481px) and (max-width: 768px) {
		.chat-container-mode {
			padding: 30px;
		}

		.chat-container {
			max-width: 500px;
		}
	}
</style>
