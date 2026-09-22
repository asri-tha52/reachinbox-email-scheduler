import { Client } from '@elastic/elasticsearch';
import config from '../../config';
import { SearchEmailItem } from '../../types';

export const INDEX_NAME = 'reachinbox-emails';

let esClient: Client | null = null;
let isElasticAvailable = false;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: config.ELASTICSEARCH_URL,
      maxRetries: 3,
      requestTimeout: 5000,
    });
  }
  return esClient;
}

export async function initializeElasticsearchIndex(): Promise<boolean> {
  const client = getElasticsearchClient();
  try {
    const ping = await client.ping();
    if (!ping) {
      console.warn('⚠️ Elasticsearch is not reachable at:', config.ELASTICSEARCH_URL);
      isElasticAvailable = false;
      return false;
    }

    isElasticAvailable = true;
    const exists = await client.indices.exists({ index: INDEX_NAME });

    if (!exists) {
      await client.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            userId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index '${INDEX_NAME}' initialized`);
    } else {
      console.log(`✅ Elasticsearch index '${INDEX_NAME}' already exists`);
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ Elasticsearch initialization notice (will run with graceful fallback):', err.message);
    isElasticAvailable = false;
    return false;
  }
}

export async function indexEmailDocument(doc: SearchEmailItem): Promise<boolean> {
  try {
    const client = getElasticsearchClient();
    await client.index({
      index: INDEX_NAME,
      id: doc.id,
      document: {
        id: doc.id,
        userId: doc.userId,
        senderId: doc.senderId,
        campaignId: doc.campaignId || null,
        recipient: doc.recipient,
        subject: doc.subject,
        status: doc.status,
        scheduledAt: doc.scheduledAt,
        sentAt: doc.sentAt || null,
      },
      refresh: true,
    });
    return true;
  } catch (err: any) {
    console.warn(`⚠️ Failed to index email ${doc.id} in Elasticsearch:`, err.message);
    // Non-blocking: PostgreSQL is source of truth, do not crash
    return false;
  }
}

export async function searchEmailsIndex(
  query: string,
  userId: string
): Promise<SearchEmailItem[] | null> {
  try {
    const client = getElasticsearchClient();
    const cleanQuery = query.trim();

    if (!cleanQuery) return [];

    const result = await client.search<SearchEmailItem>({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            { term: { userId: userId } },
            {
              multi_match: {
                query: cleanQuery,
                fields: ['recipient^3', 'subject^2', 'status'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
    });

    return result.hits.hits.map((hit) => hit._source as SearchEmailItem);
  } catch (err: any) {
    console.warn('⚠️ Elasticsearch search query failed, fallback to DB search:', err.message);
    return null; // Signals controller to fallback to Postgres ILIKE
  }
}

export function isElasticsearchHealthy(): boolean {
  return isElasticAvailable;
}
