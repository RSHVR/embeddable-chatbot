<!--
  Example chat page using embeddable-chatbot

  Copy this file to your project: src/routes/contact/+page.svelte
  (or any route where you want a full-page chat)

  Customize the text, video, and styling to match your brand.
-->

<script>
	import { Chat } from 'embeddable-chatbot';
</script>

<svelte:head>
	<title>Contact - Your Website</title>
	<meta
		name="description"
		content="Chat with our AI assistant about our products, services, and more"
	/>
	<!-- Prevent mobile zoom on input focus -->
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
	/>
</svelte:head>

<!--
  Container mode: Full-page chat experience

  Props to customize:
  - videoSrc: Background video URL (optional)
  - videoPoster: Poster image while video loads
  - welcomeText: Initial greeting message
  - placeholder: Input field placeholder text
  - apiEndpoint: Your chat API endpoint
  - loadEndpoint: Your chat history load endpoint

  See README for full list of customization options including:
  - glassContrast, glassRoundness, glassBlur, glassOpacity
  - inputTextColor, sendIconColor
  - containerRoundness, chatBodyGlass
-->
<Chat
	mode="container"
	videoSrc="/wave-background.mp4"
	videoPoster="/wave-background-poster.jpg"
	welcomeText="Hi! I'm your AI assistant. How can I help you today?"
	placeholder="Type a message..."
	apiEndpoint="/api/chat"
	loadEndpoint="/api/chat/load"
/>
