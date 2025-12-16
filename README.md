# embeddable-chatbot

AI chatbot widget powered by Claude. Features a beautiful liquid glass UI with video background support.

## Features

- **Dual Mode** - Full-page container or floating popup widget
- **Streaming Responses** - Real-time message streaming from Claude
- **Liquid Glass UI** - iOS-style glassmorphism effects
- **Video Background** - Animated wave background support in both modes
- **Persistent Sessions** - Chat history via configurable endpoints
- **Auto-scroll** - Messages scroll to bottom automatically
- **Typing Indicator** - Animated dots while waiting for response
- **Mobile Responsive** - Works on all screen sizes
- **Cloudflare Workers Compatible** - Works on edge runtimes
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

<Chat
  mode="container"
  apiEndpoint="/api/chat"
  loadEndpoint="/api/chat/load"
/>
```

### Popup Mode (Floating Widget)

For adding chat to any page as a floating button:

```svelte
<script>
  import { ChatPopup } from 'embeddable-chatbot';
</script>

<ChatPopup
  apiEndpoint="/api/chat"
  loadEndpoint="/api/chat/load"
/>
```

## Server-Side Setup

### Using `createChatHandler`

The package exports a server-side handler for SvelteKit:

```typescript
// src/routes/api/chat/+server.ts
import { env } from '$env/dynamic/private';
import { createChatHandler } from 'embeddable-chatbot/server';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly and concise.`;

export const POST: RequestHandler = async ({ request }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const handler = createChatHandler({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: SYSTEM_PROMPT,
    model: 'claude-sonnet-4-5-20250929', // optional, this is default
    maxTokens: 1024, // optional
    onSave: async (sessionId, messages) => {
      // Optional: save to your database
      await saveToDatabase(sessionId, messages);
    }
  });

  return handler(request);
};
```

### Handler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Anthropic API key |
| `systemPrompt` | `string` | Generic assistant prompt | System prompt for Claude |
| `model` | `string` | `'claude-sonnet-4-5-20250929'` | Claude model to use |
| `maxTokens` | `number` | `1024` | Max response tokens |
| `onSave` | `(sessionId, messages) => Promise<void>` | - | Callback to save chat history |

### Chat Load Endpoint (Optional)

To persist chats across page navigations:

```typescript
// src/routes/api/chat/load/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const { sessionId } = await request.json();

  // Load from your database
  const messages = await loadFromDatabase(sessionId);

  return json({ messages });
};
```

## Components

### `<Chat>`

The core chat component. Can render as a full container or compact popup content.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'container' \| 'popup'` | `'container'` | Display mode |
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API endpoint URL |
| `loadEndpoint` | `string` | `''` | Optional endpoint to load chat history |
| `welcomeText` | `string` | `"Hi! How can I help you today?"` | Initial bot message |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder text |
| `videoSrc` | `string` | `'/wave-background.mp4'` | Video background URL (container mode) |
| `videoPreload` | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | Video preload strategy |
| `videoPoster` | `string` | `''` | Poster image while video loads |
| `glassContrast` | `'dark' \| 'light'` | `'light'` | LiquidGlass color scheme |
| `glassRoundness` | `number` | `24` | LiquidGlass border radius in px |
| `glassBlur` | `number` | `8` | LiquidGlass backdrop blur in px |
| `glassOpacity` | `number` | `0.3` | LiquidGlass background opacity |
| `containerRoundness` | `number` | `32` | Container wrapper border radius |
| `chatBodyGlass` | `boolean` | `false` | Enable LiquidGlass on chat body |
| `inputTextColor` | `string` | `'#ffffff'` | Input text color |
| `sendIconColor` | `string` | `'#007AFF'` | Send button icon color |

### `<ChatPopup>`

Floating chat button with expandable chat window.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API endpoint URL |
| `loadEndpoint` | `string` | `''` | Optional endpoint to load chat history |
| `welcomeText` | `string` | `"Hi! How can I help you today?"` | Initial bot message |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder text |
| `headerTitle` | `string` | `'Chat'` | Popup window header title |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Button position |
| `headerBg` | `string` | `'transparent'` | Header background color |
| `bodyBg` | `string` | `'transparent'` | Body background (color, image, or video URL) |
| `inputBg` | `string` | `'transparent'` | Input area background color |
| `inputTextColor` | `string` | `'#ffffff'` | Input text color |
| `sendIconColor` | `string` | `'#007AFF'` | Send icon color |
| `buttonBg` | `string` | `'transparent'` | Toggle button background |
| `buttonIconColor` | `string` | `'#ffffff'` | Toggle button icon color |
| `buttonIcon` | `Snippet` | `null` | Custom SVG for closed state |
| `videoPreload` | `'none' \| 'metadata' \| 'auto'` | `'metadata'` | Video preload strategy |
| `videoPoster` | `string` | `''` | Poster image while video loads |

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

## Environment Variables

```bash
# Required for server-side handler
ANTHROPIC_API_KEY=sk-ant-...

# Optional for chat persistence (implement your own)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
```

**Important:** Use `$env/dynamic/private` for Cloudflare Workers compatibility:

```typescript
import { env } from '$env/dynamic/private'; // Works on Cloudflare
// NOT: import { ANTHROPIC_API_KEY } from '$env/static/private';
```

## Database Schema (Optional)

For chat persistence with Supabase or PostgreSQL:

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_session_id ON chats(session_id);
```

## Types

```typescript
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatHandlerOptions {
  apiKey: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  onSave?: (sessionId: string, history: ChatMessage[]) => Promise<void>;
}
```

## Exports

```typescript
// Components
import { Chat, ChatPopup, ChatWidget, ChatInput, LiquidGlass } from 'embeddable-chatbot';

// Server handler
import { createChatHandler } from 'embeddable-chatbot/server';

// Types
import type { ChatMessage, ChatHandlerOptions } from 'embeddable-chatbot/server';
```

## Cloudflare Workers / Edge Runtime

This package is fully compatible with Cloudflare Workers and other edge runtimes. Key considerations:

1. **Use dynamic env imports** - `$env/dynamic/private` instead of `$env/static/private`
2. **The `onSave` callback is awaited** - Ensures saves complete before Worker terminates
3. **SDK uses dynamic import** - Anthropic SDK is dynamically imported for edge compatibility

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Build package
pnpm run package

# Preview production build
pnpm run preview
```

## Architecture

```
src/lib/
├── components/
│   ├── Chat.svelte        # Core chat (container + popup modes)
│   ├── ChatPopup.svelte   # Floating button wrapper
│   ├── ChatWidget.svelte  # Message display
│   ├── ChatInput.svelte   # Text input
│   └── LiquidGlass.svelte # Glassmorphism effect
├── server/
│   └── index.ts           # createChatHandler for API endpoints
└── index.ts               # Component exports
```

## Requirements

- Svelte 5
- SvelteKit 2
- Node.js 18+
- Anthropic API key

## License

MIT
