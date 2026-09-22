import { Request, Response } from 'express';
import prisma from '../config/database';
import redisClient from '../config/redis';
import { getElasticsearchClient, isElasticsearchHealthy } from '../integrations/elasticsearch/client';
import { sendSuccess } from '../utils/response';

export async function getHealthStatus(req: Request, res: Response): Promise<void> {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';
  let esStatus = 'healthy';

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = `unhealthy: ${err.message}`;
  }

  // Check Redis
  try {
    const pong = await redisClient.ping();
    if (pong !== 'PONG') {
      redisStatus = 'unresponsive';
    }
  } catch (err: any) {
    redisStatus = `unhealthy: ${err.message}`;
  }

  // Check Elasticsearch
  try {
    const esClient = getElasticsearchClient();
    const esPing = await esClient.ping();
    if (!esPing) {
      esStatus = 'degraded';
    }
  } catch (err: any) {
    esStatus = `degraded: ${err.message}`;
  }

  const overall =
    dbStatus === 'healthy' && redisStatus === 'healthy' ? 'healthy' : 'degraded';

  sendSuccess(res, {
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      database: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
    },
    uptime: process.uptime(),
  });
}
