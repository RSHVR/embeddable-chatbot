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

## Complete Setup with Supabase

A step-by-step guide to set up the chatbot with Supabase for chat persistence.

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **service_role secret** (not the anon key)

### 2. Create Database Table

Run this SQL in the Supabase SQL Editor (**SQL Editor → New Query**):

```sql
-- Chats table for storing conversation history
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chats_session_id ON chats(session_id);

-- Enable Row Level Security (blocks public access)
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
```

### 3. Create Supabase Helper

```typescript
// src/lib/server/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(env.SUPABASE_URL!, env.SUPABASE_SECRET_KEY!);
  }
  return supabaseInstance;
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

export async function saveChat(sessionId: string, messages: ChatMessage[]): Promise<void> {
  const { error } = await getSupabase()
    .from('chats')
    .upsert(
      {
        session_id: sessionId,
        messages: messages,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'session_id' }
    );

  if (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
}

export async function loadChat(sessionId: string): Promise<ChatMessage[] | null> {
  const { data, error } = await getSupabase()
    .from('chats')
    .select('messages')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('Error loading chat:', error);
    return null;
  }
  return data?.messages || null;
}
```

### 4. Create Chat API Endpoint

```typescript
// src/routes/api/chat/+server.ts
import { env } from '$env/dynamic/private';
import { createChatHandler } from 'embeddable-chatbot/server';
import { saveChat } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

const SYSTEM_PROMPT = `You are a helpful AI assistant. Be friendly and concise.`;

export const POST: RequestHandler = async ({ request }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Chat not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const handler = createChatHandler({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: SYSTEM_PROMPT,
    onSave: saveChat // Automatically saves after each response
  });

  return handler(request);
};
```

### 5. Create Chat Load Endpoint

```typescript
// src/routes/api/chat/load/+server.ts
import { json } from '@sveltejs/kit';
import { loadChat } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const { sessionId } = await request.json();

  if (!sessionId) {
    return json({ messages: null });
  }

  const messages = await loadChat(sessionId);
  return json({ messages });
};
```

### 6. Add Environment Variables

Create a `.env` file in your project root:

```bash
# Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-...

# Supabase (server-side only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-secret-key
```

For **Cloudflare Workers** deployment, add secrets:

```bash
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SECRET_KEY
```

### 7. Add to Your Website

**Container Mode** (full-page chat, e.g., `/contact` page):

```svelte
<!-- src/routes/contact/+page.svelte -->
<script>
  import { Chat } from 'embeddable-chatbot';
</script>

<Chat
  mode="container"
  apiEndpoint="/api/chat"
  loadEndpoint="/api/chat/load"
  welcomeText="Hi! How can I help you today?"
  placeholder="Type a message..."
  videoSrc="/wave-background.mp4"
/>
```

**Popup Mode** (floating widget on all pages):

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { ChatPopup } from 'embeddable-chatbot';
  import { page } from '$app/stores';

  // Hide on contact page if using container mode there
  $: isContactPage = $page.url.pathname === '/contact';
</script>

<slot />

{#if !isContactPage}
  <ChatPopup
    apiEndpoint="/api/chat"
    loadEndpoint="/api/chat/load"
    welcomeText="Hi! How can I help?"
    bodyBg="/wave-background.mp4"
  />
{/if}
```

### 8. Install Dependencies

```bash
npm install embeddable-chatbot @supabase/supabase-js
```

That's it! Your chatbot now persists conversations across page reloads and sessions.

## Adding RAG (Retrieval-Augmented Generation)

Make your chatbot smarter by giving it knowledge about your website content. RAG retrieves relevant information from your content and injects it into the conversation context.

### How RAG Works

1. **Embed your content** - Convert website content into vector embeddings using Cohere
2. **Store in pgvector** - Save embeddings in Supabase with vector similarity search
3. **Query time** - When a user asks a question:
   - Generate embedding for the question
   - Find similar content via vector search
   - Rerank results for relevance
   - Inject top results into Claude's context

### 1. Enable pgvector Extension

Run in Supabase SQL Editor:

```sql
-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### 2. Create Embeddings Table

```sql
-- Table for storing content embeddings
CREATE TABLE site_embeddings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),  -- Cohere embed-v4.0 dimensions
  page_url TEXT NOT NULL,
  page_title TEXT,
  section_heading TEXT,
  chunk_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX site_embeddings_embedding_idx
  ON site_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE site_embeddings ENABLE ROW LEVEL SECURITY;
```

### 3. Create Search Function

```sql
-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_site_content(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  page_url TEXT,
  page_title TEXT,
  section_heading TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.content,
    se.page_url,
    se.page_title,
    se.section_heading,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM site_embeddings se
  WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 4. Create RAG Module

```typescript
// src/lib/server/rag.ts
import { getSupabase } from './supabase';

interface RetrievedContext {
  content: string;
  page_url: string;
  page_title: string;
  section_heading: string;
  similarity: number;
}

interface RankedContext extends RetrievedContext {
  relevanceScore: number;
}

export async function retrieveContext(
  query: string,
  cohereApiKey: string,
  matchCount: number = 10,
  matchThreshold: number = 0.3,
  topK: number = 5
): Promise<RankedContext[]> {
  // Dynamic import for edge runtime compatibility
  const { CohereClient } = await import('cohere-ai');
  const cohere = new CohereClient({ token: cohereApiKey });

  // Step 1: Generate query embedding
  const embeddingResponse = await cohere.v2.embed({
    texts: [query],
    model: 'embed-v4.0',
    inputType: 'search_query',
    embeddingTypes: ['float']
  });

  const queryEmbedding = embeddingResponse.embeddings?.float?.[0];
  if (!queryEmbedding) return [];

  // Step 2: Vector similarity search
  const { data, error } = await getSupabase().rpc('match_site_content', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount
  });

  if (error) {
    console.error('RAG retrieval error:', error);
    return [];
  }

  const contexts = data as RetrievedContext[];
  if (contexts.length === 0) return [];

  // Step 3: Rerank results for better relevance
  const rerankResponse = await cohere.v2.rerank({
    model: 'rerank-v4.0-fast',
    query: query,
    documents: contexts.map((ctx) => ctx.content),
    topN: topK
  });

  // Step 4: Map reranked results back to contexts
  const rankedContexts: RankedContext[] = rerankResponse.results.map((result) => ({
    ...contexts[result.index],
    relevanceScore: result.relevanceScore
  }));

  return rankedContexts;
}

export function formatContextForPrompt(contexts: RankedContext[]): string {
  if (contexts.length === 0) return '';

  const formatted = contexts
    .map(
      (ctx, i) =>
        `[Source ${i + 1}: ${ctx.page_title}${ctx.section_heading ? ` - ${ctx.section_heading}` : ''}]\n${ctx.content}`
    )
    .join('\n\n');

  return `\n<retrieved_context>\nThe following information is relevant to the user's question:\n\n${formatted}\n</retrieved_context>`;
}
```

### 5. Update Chat Handler with RAG

```typescript
// src/routes/api/chat/+server.ts
import { env } from '$env/dynamic/private';
import { createChatHandler } from 'embeddable-chatbot/server';
import { saveChat } from '$lib/server/supabase';
import { retrieveContext, formatContextForPrompt } from '$lib/server/rag';
import type { RequestHandler } from './$types';

const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant for [Your Website].

IMPORTANT INSTRUCTIONS:
- Answer questions based on the retrieved context when available
- If the context doesn't contain relevant information, say so honestly
- Be friendly, concise, and accurate
- Never make up information not in the context`;

export const POST: RequestHandler = async ({ request }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'Chat not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Clone request to read body for RAG while preserving original
  const clonedRequest = request.clone();
  let ragContext = '';

  try {
    const body = await clonedRequest.json();
    const messages = body.messages || [];
    const lastUserMessage = messages.filter((m: any) => m.sender === 'user').pop();

    if (lastUserMessage?.text && env.COHERE_API_KEY) {
      const contexts = await retrieveContext(lastUserMessage.text, env.COHERE_API_KEY);
      ragContext = formatContextForPrompt(contexts);
    }
  } catch (e) {
    console.error('RAG error:', e);
  }

  const handler = createChatHandler({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: BASE_SYSTEM_PROMPT + ragContext,
    onSave: saveChat
  });

  return handler(request);
};
```

### 6. Create Embedding Script

Create a script to embed your website content:

```typescript
// scripts/embed-site-content.ts
import { CohereClient } from 'cohere-ai';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

interface SiteContent {
  url: string;
  title: string;
  sections: Array<{ heading: string; content: string }>;
}

// Define your site content here
const SITE_CONTENT: SiteContent[] = [
  {
    url: '/',
    title: 'Home',
    sections: [
      {
        heading: 'Welcome',
        content: 'Your homepage content here...'
      }
    ]
  },
  {
    url: '/about',
    title: 'About',
    sections: [
      {
        heading: 'About Us',
        content: 'Your about page content here...'
      }
    ]
  }
  // Add more pages...
];

async function embedSiteContent() {
  const cohere = new CohereClient({ token: process.env.COHERE_API_KEY! });
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // Chunk content
  const chunks: Array<{
    content: string;
    pageUrl: string;
    pageTitle: string;
    sectionHeading: string;
    chunkIndex: number;
  }> = [];

  for (const page of SITE_CONTENT) {
    for (const section of page.sections) {
      const words = section.content.split(/\s+/);
      let currentChunk: string[] = [];
      let currentLength = 0;
      let chunkIndex = 0;

      for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1;

        if (currentLength >= CHUNK_SIZE) {
          chunks.push({
            content: currentChunk.join(' '),
            pageUrl: page.url,
            pageTitle: page.title,
            sectionHeading: section.heading,
            chunkIndex: chunkIndex++
          });
          const overlapWords = Math.floor(currentChunk.length * (CHUNK_OVERLAP / CHUNK_SIZE));
          currentChunk = currentChunk.slice(-overlapWords);
          currentLength = currentChunk.join(' ').length;
        }
      }

      if (currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.join(' '),
          pageUrl: page.url,
          pageTitle: page.title,
          sectionHeading: section.heading,
          chunkIndex: chunkIndex
        });
      }
    }
  }

  console.log(`Created ${chunks.length} chunks`);

  // Generate embeddings (batch size 96)
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 96) {
    const batch = chunks.slice(i, i + 96);
    const response = await cohere.v2.embed({
      texts: batch.map((c) => c.content),
      model: 'embed-v4.0',
      inputType: 'search_document',
      embeddingTypes: ['float']
    });
    embeddings.push(...(response.embeddings?.float || []));
    console.log(`Embedded ${Math.min(i + 96, chunks.length)}/${chunks.length}`);
  }

  // Clear existing and insert new
  await supabase.from('site_embeddings').delete().neq('id', 0);

  const records = chunks.map((chunk, idx) => ({
    content: chunk.content,
    embedding: embeddings[idx],
    page_url: chunk.pageUrl,
    page_title: chunk.pageTitle,
    section_heading: chunk.sectionHeading,
    chunk_index: chunk.chunkIndex
  }));

  const { error } = await supabase.from('site_embeddings').insert(records);
  if (error) throw error;

  console.log(`Inserted ${records.length} embeddings`);
}

embedSiteContent().catch(console.error);
```

### 7. Run the Embedding Script

```bash
# Install dependencies
npm install cohere-ai dotenv tsx

# Run the script
npx tsx scripts/embed-site-content.ts
```

### 8. Add Cohere API Key

Add to your `.env`:

```bash
COHERE_API_KEY=your-cohere-api-key
```

For Cloudflare Workers:

```bash
wrangler secret put COHERE_API_KEY
```

### RAG Tips

- **Chunk size**: 500 chars works well for most content. Smaller chunks = more precise retrieval, larger = more context
- **Overlap**: 100 chars helps maintain context across chunk boundaries
- **Reranking**: Dramatically improves relevance over pure vector search
- **Top K**: Start with 5 results, adjust based on your content density
- **Threshold**: 0.3 similarity is a good starting point, lower = more results

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
