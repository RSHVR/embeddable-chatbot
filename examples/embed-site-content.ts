/**
 * One-time script to embed website content into Supabase pgvector
 *
 * Run with: npx tsx scripts/embed-site-content.ts
 *
 * Required environment variables:
 * - COHERE_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY
 *
 * Copy this file to your project: scripts/embed-site-content.ts
 */

import { CohereClient } from 'cohere-ai';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration
const CHUNK_SIZE = 500; // Characters per chunk
const CHUNK_OVERLAP = 100; // Overlap between chunks
const BATCH_SIZE = 96; // Cohere's max batch size

interface SiteContent {
	url: string;
	title: string;
	sections: Array<{
		heading: string;
		content: string;
	}>;
}

interface Chunk {
	content: string;
	pageUrl: string;
	pageTitle: string;
	sectionHeading: string;
	chunkIndex: number;
}

// =============================================================================
// CUSTOMIZE THIS: Add your website content here
// =============================================================================
const SITE_CONTENT: SiteContent[] = [
	{
		url: '/',
		title: 'Home',
		sections: [
			{
				heading: 'Welcome',
				content: `Welcome to our website. Add your homepage content here.`
			},
			{
				heading: 'About',
				content: `Information about your company or project.`
			}
		]
	},
	{
		url: '/about',
		title: 'About',
		sections: [
			{
				heading: 'Our Story',
				content: `Add your about page content here.`
			}
		]
	},
	{
		url: '/contact',
		title: 'Contact',
		sections: [
			{
				heading: 'Contact Information',
				content: `Add your contact information here. Email: example@example.com`
			}
		]
	}
	// Add more pages as needed...
];
// =============================================================================

/**
 * Chunk content with overlap for better retrieval
 */
function chunkContent(pages: SiteContent[]): Chunk[] {
	const chunks: Chunk[] = [];

	for (const page of pages) {
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

					// Keep overlap for context continuity
					const overlapWords = Math.floor(currentChunk.length * (CHUNK_OVERLAP / CHUNK_SIZE));
					currentChunk = currentChunk.slice(-overlapWords);
					currentLength = currentChunk.join(' ').length;
				}
			}

			// Add remaining content
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

	return chunks;
}

/**
 * Generate embeddings using Cohere embed-v4.0
 */
async function generateEmbeddings(
	cohere: CohereClient,
	texts: string[]
): Promise<number[][]> {
	const response = await cohere.v2.embed({
		texts,
		model: 'embed-v4.0',
		inputType: 'search_document', // For documents being indexed
		embeddingTypes: ['float']
	});

	return response.embeddings?.float || [];
}

/**
 * Main embedding function
 */
async function embedSiteContent() {
	// Validate environment variables
	const cohereApiKey = process.env.COHERE_API_KEY;
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SECRET_KEY;

	if (!cohereApiKey) {
		throw new Error('COHERE_API_KEY environment variable is required');
	}
	if (!supabaseUrl || !supabaseKey) {
		throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY environment variables are required');
	}

	console.log('Initializing clients...');
	const cohere = new CohereClient({ token: cohereApiKey });
	const supabase = createClient(supabaseUrl, supabaseKey);

	// Chunk content
	console.log('Chunking site content...');
	const chunks = chunkContent(SITE_CONTENT);
	console.log(`Created ${chunks.length} chunks from ${SITE_CONTENT.length} pages`);

	// Generate embeddings in batches
	console.log('Generating embeddings...');
	const embeddings: number[][] = [];

	for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
		const batch = chunks.slice(i, i + BATCH_SIZE);
		const batchTexts = batch.map((c) => c.content);

		console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);
		const batchEmbeddings = await generateEmbeddings(cohere, batchTexts);
		embeddings.push(...batchEmbeddings);

		// Rate limiting - wait 100ms between batches
		if (i + BATCH_SIZE < chunks.length) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	console.log(`Generated ${embeddings.length} embeddings`);

	// Clear existing embeddings
	console.log('Clearing existing embeddings...');
	const { error: deleteError } = await supabase.from('site_embeddings').delete().neq('id', 0);

	if (deleteError) {
		console.error('Warning: Could not clear existing embeddings:', deleteError.message);
	}

	// Insert new embeddings
	console.log('Inserting embeddings into Supabase...');
	const records = chunks.map((chunk, idx) => ({
		content: chunk.content,
		embedding: embeddings[idx],
		page_url: chunk.pageUrl,
		page_title: chunk.pageTitle,
		section_heading: chunk.sectionHeading,
		chunk_index: chunk.chunkIndex
	}));

	// Insert in batches of 100
	const insertBatchSize = 100;
	for (let i = 0; i < records.length; i += insertBatchSize) {
		const batch = records.slice(i, i + insertBatchSize);
		const { error: insertError } = await supabase.from('site_embeddings').insert(batch);

		if (insertError) {
			throw new Error(`Failed to insert embeddings: ${insertError.message}`);
		}

		console.log(`  Inserted ${Math.min(i + insertBatchSize, records.length)}/${records.length} records`);
	}

	console.log('\nEmbedding complete!');
	console.log(`  Total chunks: ${chunks.length}`);
	console.log(`  Total embeddings: ${embeddings.length}`);
	console.log(`  Pages processed: ${SITE_CONTENT.length}`);
}

// Run the script
embedSiteContent().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
