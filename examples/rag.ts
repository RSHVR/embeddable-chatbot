/**
 * RAG (Retrieval-Augmented Generation) module for embeddable-chatbot
 *
 * This module provides two-stage retrieval:
 * 1. Vector similarity search using Cohere embed-v4.0
 * 2. Reranking using Cohere rerank-v4.0-fast
 *
 * Copy this file to your project: src/lib/server/rag.ts
 */

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
	matchCount: number = 10, // Retrieve more initially for reranking
	matchThreshold: number = 0.3, // Lower threshold since we'll rerank
	topK: number = 5 // Final number of results after reranking
): Promise<RankedContext[]> {
	// Dynamic import for Cloudflare Workers compatibility
	const { CohereClient } = await import('cohere-ai');
	const cohere = new CohereClient({ token: cohereApiKey });

	// Step 1: Generate query embedding with search_query input type
	const embeddingResponse = await cohere.v2.embed({
		texts: [query],
		model: 'embed-v4.0',
		inputType: 'search_query',
		embeddingTypes: ['float']
	});

	const queryEmbedding = embeddingResponse.embeddings?.float?.[0];
	if (!queryEmbedding) return [];

	// Step 2: Vector similarity search in Supabase
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

	// Step 3: Rerank results using rerank-v4.0-fast
	const rerankResponse = await cohere.v2.rerank({
		model: 'rerank-v4.0-fast',
		query: query,
		documents: contexts.map((ctx) => ctx.content),
		topN: topK
	});

	// Step 4: Map reranked results back to context objects
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

	return `
<retrieved_context>
The following information is relevant to the user's question:

${formatted}
</retrieved_context>`;
}
