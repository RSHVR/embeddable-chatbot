<script>
	let {
		onSend = () => {},
		placeholder = "Type a message...",
		disabled = false,
		textColor = '#ffffff',
		iconColor = '#007AFF'
	} = $props();

	let inputValue = $state('');
	let inputElement = $state();
	let wasDisabled = $state(false);
	let originalViewport = '';

	function handleFocus() {
		// Temporarily disable zoom on mobile by modifying viewport meta
		const viewport = document.querySelector('meta[name="viewport"]');
		if (viewport) {
			originalViewport = viewport.getAttribute('content') || '';
			if (!originalViewport.includes('maximum-scale')) {
				viewport.setAttribute('content', originalViewport + ', maximum-scale=1');
			}
		}
	}

	function handleBlur() {
		// Restore original viewport meta
		const viewport = document.querySelector('meta[name="viewport"]');
		if (viewport && originalViewport) {
			viewport.setAttribute('content', originalViewport);
		}
	}

	// Re-focus input when loading completes
	$effect(() => {
		if (wasDisabled && !disabled) {
			inputElement?.focus({ preventScroll: true });
		}
		wasDisabled = disabled;
	});

	function handleSubmit(e) {
		e.preventDefault();
		if (inputValue.trim() && !disabled) {
			onSend(inputValue.trim());
			inputValue = '';
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}
</script>

<form class="chat-input" onsubmit={handleSubmit}>
	<input
		bind:this={inputElement}
		type="text"
		bind:value={inputValue}
		{placeholder}
		onkeydown={handleKeydown}
		onfocus={handleFocus}
		onblur={handleBlur}
		{disabled}
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck="false"
		style:color={textColor}
		style:--placeholder-color={textColor}
	/>
	<button type="submit" disabled={!inputValue.trim() || disabled}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} stroke-width="2">
			<path d="M22 2L11 13" stroke-linecap="round" stroke-linejoin="round"/>
			<path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
</form>

<style>
	.chat-input {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		width: 100%;
		box-sizing: border-box;
		outline: none;
	}

	.chat-input:focus,
	.chat-input:focus-within,
	.chat-input:focus-visible {
		outline: none;
	}

	input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		font-size: 16px;
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
		padding: 0;
	}

	input:focus,
	input:focus-visible {
		outline: none;
		box-shadow: none;
	}

	input::placeholder {
		color: var(--placeholder-color, rgba(255, 255, 255, 0.5));
		opacity: 0.5;
	}

	button {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	button:hover:not(:disabled) {
		transform: scale(1.1);
	}

	button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.chat-input {
			padding: 12px 16px;
		}

		input {
			font-size: 16px; /* Must be >= 16px to prevent iOS zoom on focus */
		}

		button {
			width: 32px;
			height: 32px;
		}

		button svg {
			width: 16px;
			height: 16px;
		}
	}
</style>
