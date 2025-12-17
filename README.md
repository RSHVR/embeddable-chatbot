# embeddable-chatbot

AI chatbot widget powered by Claude. Features a beautiful liquid glass UI with video background support.

<p align="center">
  <img src="docs/container-mode.png" alt="Container Mode" width="48%">
  <img src="docs/popup-mode.png" alt="Popup Mode" width="48%">
</p>

## Features

- **Dual Mode** - Full-page container or floating popup widget
- **Streaming Responses** - Real-time message streaming from Claude
- **Liquid Glass UI** - iOS-style glassmorphism effects
- **Video Background** - Animated wave background support
- **Persistent Sessions** - Chat history via configurable endpoints
- **RAG Support** - Vector search with Cohere embeddings
- **Mobile Responsive** - Works on all screen sizes
- **Edge Compatible** - Cloudflare Workers ready

## Installation

```bash
npm install embeddable-chatbot
```

## Quick Start

### Container Mode (Full Page)

```svelte
<script>
  import { Chat } from 'embeddable-chatbot';
</script>

<Chat
  mode="container"
  apiEndpoint="/api/chat"
  loadEndpoint="/api/chat/load"
  videoSrc="/wave-background.mp4"
/>
```

### Popup Mode (Floating Widget)

```svelte
<script>
  import { ChatPopup } from 'embeddable-chatbot';
</script>

<ChatPopup
  apiEndpoint="/api/chat"
  loadEndpoint="/api/chat/load"
/>
```

## Server Setup

The package exports `createChatHandler` for SvelteKit API routes.

**Basic usage:**

```typescript
import { createChatHandler } from 'embeddable-chatbot/server';

const handler = createChatHandler({
  apiKey: env.ANTHROPIC_API_KEY,
  systemPrompt: 'You are a helpful assistant.',
  onSave: async (sessionId, messages) => { /* save to DB */ }
});
```

**Full examples with RAG:** See [`examples/api-chat-server.ts`](examples/api-chat-server.ts)

### Handler Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Anthropic API key |
| `systemPrompt` | `string` | Generic prompt | System prompt for Claude |
| `model` | `string` | `claude-sonnet-4-5-20250929` | Claude model |
| `maxTokens` | `number` | `1024` | Max response tokens |
| `onSave` | `function` | - | Callback to persist chat |

## Supabase Integration

### Chat Persistence Schema

```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_session_id ON chats(session_id);
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
```

**TypeScript helpers:** See [`examples/supabase.ts`](examples/supabase.ts)

## RAG Setup

Add knowledge retrieval using Cohere embeddings + reranking.

### How It Works

1. Embed your content with Cohere `embed-v4.0`
2. Store in Supabase pgvector
3. At query time: vector search → rerank → inject into Claude context

### Vector Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE site_embeddings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  page_url TEXT NOT NULL,
  page_title TEXT,
  section_heading TEXT,
  chunk_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX site_embeddings_embedding_idx
  ON site_embeddings USING hnsw (embedding vector_cosine_ops);

ALTER TABLE site_embeddings ENABLE ROW LEVEL SECURITY;
```

### Search Function

```sql
CREATE OR REPLACE FUNCTION match_site_content(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT, content TEXT, page_url TEXT,
  page_title TEXT, section_heading TEXT, similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT se.id, se.content, se.page_url, se.page_title, se.section_heading,
         1 - (se.embedding <=> query_embedding) AS similarity
  FROM site_embeddings se
  WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Full implementation:** See [`examples/rag.ts`](examples/rag.ts) and [`examples/embed-site-content.ts`](examples/embed-site-content.ts)

## Examples

Complete working examples in the [`examples/`](examples/) directory:

| File | Description |
|------|-------------|
| `supabase.ts` | Supabase client + chat save/load |
| `rag.ts` | RAG retrieval with Cohere embed + rerank |
| `embed-site-content.ts` | Script to embed your content |
| `api-chat-server.ts` | Chat endpoint with RAG |
| `api-chat-load-server.ts` | Chat history endpoint |
| `chat-page.svelte` | Example chat page |

## Components

### `<Chat>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'container' \| 'popup'` | `'container'` | Display mode |
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API URL |
| `loadEndpoint` | `string` | `''` | History load URL |
| `welcomeText` | `string` | `"Hi! How can I help?"` | Initial message |
| `placeholder` | `string` | `'Type a message...'` | Input placeholder |
| `videoSrc` | `string` | - | Video background URL |
| `videoPoster` | `string` | `''` | Video poster image |
| `glassContrast` | `'dark' \| 'light'` | `'light'` | Glass color scheme |
| `glassRoundness` | `number` | `24` | Border radius (px) |
| `glassBlur` | `number` | `8` | Backdrop blur (px) |
| `glassOpacity` | `number` | `0.3` | Background opacity |

### `<ChatPopup>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiEndpoint` | `string` | `'/api/chat'` | Chat API URL |
| `loadEndpoint` | `string` | `''` | History load URL |
| `welcomeText` | `string` | `"Hi! How can I help?"` | Initial message |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Button position |
| `headerTitle` | `string` | `'Chat'` | Header text |
| `bodyBg` | `string` | `'transparent'` | Background (color/video) |
| `buttonBg` | `string` | `'transparent'` | Toggle button bg |
| `buttonIconColor` | `string` | `'#ffffff'` | Button icon color |

### `<LiquidGlass>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `contrast` | `'dark' \| 'light'` | `'dark'` | Color scheme |
| `roundness` | `number` | `32` | Border radius (px) |
| `blur` | `number` | `20` | Backdrop blur (px) |
| `opacity` | `number` | `0.6` | Background opacity |

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...     # Required
SUPABASE_URL=https://...         # For persistence
SUPABASE_SECRET_KEY=...          # For persistence
COHERE_API_KEY=...               # For RAG
```

Use `$env/dynamic/private` for Cloudflare Workers compatibility.

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

// Server
import { createChatHandler } from 'embeddable-chatbot/server';
import type { ChatMessage, ChatHandlerOptions } from 'embeddable-chatbot/server';
```

## Requirements

- Svelte 5 / SvelteKit 2
- Node.js 18+
- Anthropic API key

## License

MIT
