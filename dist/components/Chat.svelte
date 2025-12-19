<script>
	import { onMount } from "svelte";
	import ChatWidget from "./ChatWidget.svelte";
	import ChatInput from "./ChatInput.svelte";
	import LiquidGlass from "./LiquidGlass.svelte";

	let {
		mode = "container",
		apiEndpoint = "/api/chat",
		loadEndpoint = "", // Optional endpoint for loading chat history
		welcomeText = "Hi! How can I help you today?",
		placeholder = "Type a message...",
		videoSrc = "/wave-background.mp4",
		videoPreload = "metadata", // 'none' | 'metadata' | 'auto'
		videoPoster = "", // Poster image URL
		// Container mode styling props
		glassContrast = "light", // 'dark' | 'light'
		glassRoundness = 24,
		glassBlur = 8,
		glassOpacity = 0.3,
		containerRoundness = 32,
		chatBodyGlass = false, // Enable LiquidGlass on chat body
		// Shared styling props (both modes)
		inputTextColor = "#ffffff",
		sendIconColor = "#007AFF",
		// Popup mode only
		inputBg = "rgba(0, 0, 0, 0.3)",
		inputGlass = false, // Enable LiquidGlass on input (popup mode)
	} = $props();

	// Lazy loading for container video
	let videoVisible = $state(false);
	let containerRef = $state();

	const welcomeMessage = {
		sender: "bot",
		text: welcomeText,
	};

	let messages = $state([welcomeMessage]);
	let isLoading = $state(false);
	let isWaiting = $state(false);
	let waitingMessage = $state('');
	let sessionId = $state("");

	onMount(async () => {
		// Generate or retrieve session ID
		let storedSessionId = sessionStorage.getItem("chat_session_id");
		if (!storedSessionId) {
			storedSessionId = crypto.randomUUID();
			sessionStorage.setItem("chat_session_id", storedSessionId);
		}
		sessionId = storedSessionId;

		// Load existing chat history if loadEndpoint is provided
		if (loadEndpoint) {
			try {
				const response = await fetch(loadEndpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sessionId: storedSessionId }),
				});
				if (response.ok) {
					const data = await response.json();
					if (data.messages && data.messages.length > 0) {
						messages = data.messages;
					}
				}
			} catch (error) {
				console.error("Error loading chat history:", error);
			}
		}

		// Lazy load video when container becomes visible (container mode only)
		if (mode === "container" && containerRef) {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) {
						videoVisible = true;
						observer.disconnect();
					}
				},
				{ threshold: 0.1 },
			);
			observer.observe(containerRef);

			return () => observer.disconnect();
		}
	});

	async function handleSend(text) {
		// Add user message
		messages = [...messages, { sender: "user", text }];
		isLoading = true;

		try {
			const response = await fetch(apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: text,
					sessionId,
					history: messages.slice(0, -1),
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to get response");
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error("No reader available");

			const decoder = new TextDecoder();
			let botMessage = "";
			let botMessageIndex = messages.length;

			messages = [...messages, { sender: "bot", text: "" }];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (data === "[DONE]") break;
						try {
							const parsed = JSON.parse(data);
							if (parsed.type === 'waiting') {
								isWaiting = true;
								waitingMessage = parsed.message || 'Checking with a team member...';
							} else if (parsed.text) {
								// Clear waiting state when actual text arrives
								if (isWaiting) {
									isWaiting = false;
									waitingMessage = '';
								}
								botMessage += parsed.text;
								messages = messages.map((msg, i) =>
									i === botMessageIndex
										? { ...msg, text: botMessage }
										: msg,
								);
							}
						} catch {
							// Ignore parse errors
						}
					}
				}
			}
		} catch (error) {
			console.error("Error sending message:", error);
			messages = [
				...messages,
				{
					sender: "bot",
					text: "Sorry, I'm having trouble connecting right now. Please try again in a moment!",
				},
			];
		} finally {
			isLoading = false;
			isWaiting = false;
			waitingMessage = '';
		}
	}
</script>

{#if mode === "container"}
	<div class="chat-container-mode" bind:this={containerRef}>
		<div class="video-wrapper" style:border-radius="{containerRoundness}px">
			{#if videoVisible}
				<video
					class="video-bg"
					autoplay
					muted
					loop
					playsinline
					preload={videoPreload}
					poster={videoPoster || undefined}
				>
					{#if videoSrc.endsWith(".mp4")}
						<source
							src={videoSrc.replace(".mp4", ".webm")}
							type="video/webm"
						/>
					{/if}
					<source src={videoSrc} type="video/mp4" />
				</video>
			{:else if videoPoster}
				<img class="video-bg" src={videoPoster} alt="" />
			{/if}

			<div class="chat-container">
				<div class="chat-body">
					{#if chatBodyGlass}
						<LiquidGlass
							contrast={glassContrast}
							roundness={glassRoundness}
							blur={glassBlur}
							opacity={glassOpacity}
						>
							<div class="chat-body-inner">
								<ChatWidget {messages} {isLoading} {isWaiting} {waitingMessage} />
							</div>
						</LiquidGlass>
					{:else}
						<div class="chat-body-inner">
							<ChatWidget {messages} {isLoading} {isWaiting} {waitingMessage} />
						</div>
					{/if}
				</div>

				<div class="textbox-dock">
					<LiquidGlass
						contrast={glassContrast}
						roundness={glassRoundness}
						blur={glassBlur}
						opacity={glassOpacity}
					>
						<div class="textbox-inner">
							<ChatInput
								onSend={handleSend}
								{placeholder}
								disabled={isLoading}
								textColor={inputTextColor}
								iconColor={sendIconColor}
							/>
						</div>
					</LiquidGlass>
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="chat-popup-mode">
		<div class="popup-chat-body">
			<ChatWidget {messages} {isLoading} {isWaiting} {waitingMessage} />
		</div>
		{#if inputGlass}
			<div class="popup-input-wrapper">
				<LiquidGlass
					contrast="light"
					roundness={25}
					blur={8}
					opacity={0.3}
				>
					<div class="popup-input">
						<ChatInput
							onSend={handleSend}
							{placeholder}
							disabled={isLoading}
							textColor={inputTextColor}
							iconColor={sendIconColor}
						/>
					</div>
				</LiquidGlass>
			</div>
		{:else}
			<div class="popup-input" style:background={inputBg}>
				<ChatInput
					onSend={handleSend}
					{placeholder}
					disabled={isLoading}
					textColor={inputTextColor}
					iconColor={sendIconColor}
				/>
			</div>
		{/if}
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
		outline: none;
	}

	.textbox-dock:focus,
	.textbox-dock:focus-within,
	.textbox-dock:focus-visible {
		outline: none;
	}

	.textbox-inner {
		width: 100%;
		outline: none;
	}

	.textbox-inner:focus,
	.textbox-inner:focus-within,
	.textbox-inner:focus-visible {
		outline: none;
	}

	/* Popup Mode Styles */
	.chat-popup-mode {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		gap: 8px;
		padding: 8px;
		box-sizing: border-box;
	}

	.popup-chat-body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.popup-input-wrapper {
		flex-shrink: 0;
	}

	.popup-input {
		border-radius: 9999px;
	}

	/* Responsive - Container Mode */
	@media (max-width: 480px) {
		.chat-container-mode {
			padding: 20px;
		}

		.video-wrapper {
			height: 75vh;
		}

		.chat-container {
			height: 100%;
			max-height: none;
		}

		.chat-body {
			height: auto;
			flex: 1;
			min-height: 0;
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
