# embeddable-chatbot

AI chatbot widget powered by Claude. Features a beautiful liquid glass UI with video background support.

## Features

- **Dual Mode** - Full-page container or floating popup widget
- **Streaming Responses** - Real-time message streaming from Claude
- **Liquid Glass UI** - iOS-style glassmorphism effects
- **Video Background** - Animated wave background support in both modes
- **Persistent Sessions** - Chat history saved to Supabase
- **Auto-scroll** - Messages scroll to bottom automatically
- **Typing Indicator** - Animated dots while waiting for response
- **Mobile Responsive** - Works on all screen sizes
- **Svelte 5** - Built with latest Svelte runes

## Installation

```bash
npm install embeddable-chatbot
```

## Quick Start

### Container Mode (Full Page)

For dedicated chat pages with video background:

```svelte
<script>
  import { Chat } from 'embeddable-chatbot';
</script>

<Chat mode="container" />
```

### Popup Mode (Floating Widget)

For adding chat to any page as a floating button:

```svelte
<script>
  import { ChatPopup } from 'embeddable-chatbot';
</script>

<ChatPopup />
```

## Components

### `<Chat>`

The core chat component. Can render as a full container or compact popup content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'container' \| 'popup'` | `'container'` | Display mode |
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API endpoint URL |
| `welcomeText` | `string` | `"Hi! How can I help you today?"` | Initial bot message |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder text |
| `videoSrc` | `string` | `'/wave-background.mp4'` | Video background URL (container mode) |
| `videoPreload` | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | Video preload strategy for performance |
| `videoPoster` | `string` | `''` | Poster image URL shown while video loads |
| `glassContrast` | `'dark' \| 'light'` | `'light'` | LiquidGlass color scheme |
| `glassRoundness` | `number` | `24` | LiquidGlass border radius in px |
| `glassBlur` | `number` | `8` | LiquidGlass backdrop blur in px |
| `glassOpacity` | `number` | `0.3` | LiquidGlass background opacity |
| `containerRoundness` | `number` | `32` | Container wrapper border radius in px |
| `chatBodyGlass` | `boolean` | `false` | Enable LiquidGlass on chat body |
| `inputTextColor` | `string` | `'#ffffff'` | Input text color |
| `sendIconColor` | `string` | `'#007AFF'` | Send button icon color |

### `<ChatPopup>`

Floating chat button with expandable chat window.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API endpoint URL |
| `welcomeText` | `string` | `"Hi! How can I help you today?"` | Initial bot message |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder text |
| `headerTitle` | `string` | `'Chat'` | Popup window header title |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Button position |
| `headerBg` | `string` | `'transparent'` | Header background color |
| `bodyBg` | `string` | `'transparent'` | Body background (color, image URL, or video URL) |
| `inputBg` | `string` | `'transparent'` | Input area background color |
| `inputTextColor` | `string` | `'#ffffff'` | Input text color |
| `sendIconColor` | `string` | `'#007AFF'` | Send icon color |
| `buttonBg` | `string` | `'transparent'` | Toggle button background color |
| `buttonIconColor` | `string` | `'#ffffff'` | Toggle button icon color |
| `buttonIcon` | `Snippet` | `null` | Custom SVG snippet for closed state |
| `videoPreload` | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | Video preload strategy for performance |
| `videoPoster` | `string` | `''` | Poster image URL shown while video loads |

### `<ChatWidget>`

Message display component with auto-scroll and typing indicator.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `messages` | `ChatMessage[]` | `[]` | Array of messages |
| `isLoading` | `boolean` | `false` | Show typing indicator |

### `<ChatInput>`

Text input with send button. Auto-focuses after sending.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSend` | `(text: string) => void` | - | Callback when message sent |
| `placeholder` | `string` | `'Type a message...'` | Placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `textColor` | `string` | `'#ffffff'` | Input text color |
| `iconColor` | `string` | `'#007AFF'` | Send icon color |

### `<LiquidGlass>`

Glassmorphism container with blur and transparency effects.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `contrast` | `'dark' \| 'light'` | `'dark'` | Color scheme |
| `roundness` | `number` | `32` | Border radius in px |
| `blur` | `number` | `20` | Backdrop blur in px |
| `opacity` | `number` | `0.6` | Background opacity |

## Setup

### 1. Environment Variables

Create a `.env` file:

```bash
# Required for Claude AI
ANTHROPIC_API_KEY=sk-ant-...

# Optional for chat persistence
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 2. API Endpoint

Create a streaming API endpoint in your SvelteKit app:

```typescript
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import Anthropic from '@anthropic-ai/sdk';
import type { RequestHandler } from './$types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly and concise.`;

export const POST: RequestHandler = async ({ request }) => {
  const { message, sessionId, history } = await request.json();

  // Convert history to Claude format
  const messages = (history || []).map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.text
  }));
  messages.push({ role: 'user', content: message });

  // Stream response
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
```

### 3. Video Background (Container Mode)

Place a video file at `static/wave-background.mp4` for the container mode background.

### 4. Supabase Setup (Optional)

For persistent chat history:

```sql
-- Create table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index
CREATE INDEX idx_chats_session_id ON chats(session_id);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access
CREATE POLICY "Allow anonymous access" ON chats
  FOR ALL USING (true) WITH CHECK (true);
```

## Types

```typescript
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatSession {
  id: string;
  session_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}
```

## Exports

```typescript
// Components
import { Chat, ChatPopup, ChatWidget, ChatInput, LiquidGlass } from 'embeddable-chatbot';

// Supabase utilities
import { supabase, saveChat, loadChat } from 'embeddable-chatbot';

// Types
import type { ChatMessage, ChatSession } from 'embeddable-chatbot';
```

## Customization

### Custom Styling

Override styles using `:global()`:

```svelte
<div class="my-wrapper">
  <ChatPopup />
</div>

<style>
  /* Change toggle button color */
  .my-wrapper :global(.chat-toggle-btn) {
    background: #ff6b6b;
  }

  /* Change chat window size */
  .my-wrapper :global(.chat-window) {
    width: 420px;
    height: 600px;
  }
</style>
```

### Custom Messages

```svelte
<Chat
  welcomeText="Hi! How can I help you today?"
  placeholder="Type your question..."
/>
```

### Custom API Endpoint

```svelte
<ChatPopup apiEndpoint="https://api.example.com/chat" />
```

### Position

```svelte
<ChatPopup position="bottom-left" />
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build package
npm run package

# Preview production build
npm run preview
```

### Demo Pages

- `/` - Container mode demo
- `/popup` - Popup mode demo

## Architecture

```
src/lib/
├── components/
│   ├── Chat.svelte        # Core chat (container + popup modes)
│   ├── ChatPopup.svelte   # Floating button wrapper
│   ├── ChatWidget.svelte  # Message display
│   ├── ChatInput.svelte   # Text input
│   └── LiquidGlass.svelte # Glassmorphism effect
├── supabase.ts            # Supabase client & utilities
└── index.ts               # Package exports
```

## Requirements

- Svelte 5
- SvelteKit 2
- Node.js 18+
- Anthropic API key
- Supabase account (optional)

## License

MIT
