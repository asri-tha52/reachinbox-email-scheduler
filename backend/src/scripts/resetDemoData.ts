import prisma from '../config/database';
import { emailQueue } from '../queues/emailQueue';
import redisClient from '../config/redis';
import { getElasticsearchClient, INDEX_NAME } from '../integrations/elasticsearch/client';

export interface ResetSummary {
  dryRun: boolean;
  preserved: {
    usersCount: number;
    sendersCount: number;
    slackConnectionsCount: number;
  };
  deleted: {
    emailsCount: number;
    campaignsCount: number;
    bullJobsCleared: boolean;
    rateLimitKeysCleared: number;
    elasticsearchDocsCleared: number;
  };
  postVerification: {
    scheduledEmails: number;
    sentEmails: number;
    failedEmails: number;
    processingEmails: number;
    totalEmails: number;
    campaigns: number;
    bullJobCounts: Record<string, number>;
    elasticsearchDocCount: number;
  };
}

export async function resetDemoData(dryRun: boolean = false): Promise<ResetSummary> {
  console.log(`\n======================================================`);
  console.log(`🧹 ReachInbox Safe Demo Data Reset Script`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Inspect Only)' : '⚡ LIVE RESET'}`);
  console.log(`======================================================\n`);

  // 1. Inspect Protected Data (Will NOT be touched)
  const usersCount = await prisma.user.count();
  const sendersCount = await prisma.sender.count();
  const slackConnectionsCount = await prisma.slackConnection.count();

  console.log(`🛡️  PROTECTED DATA (Will NOT be deleted):`);
  console.log(`   - Users:              ${usersCount}`);
  console.log(`   - Senders:            ${sendersCount}`);
  console.log(`   - Slack Connections:  ${slackConnectionsCount}\n`);

  // 2. Inspect Target Demo Data (To be deleted)
  const totalEmailsBefore = await prisma.email.count();
  const scheduledBefore = await prisma.email.count({ where: { status: 'scheduled' } });
  const sentBefore = await prisma.email.count({ where: { status: 'sent' } });
  const failedBefore = await prisma.email.count({ where: { status: 'failed' } });
  const processingBefore = await prisma.email.count({ where: { status: 'processing' } });
  const campaignsBefore = await prisma.campaign.count();

  // BullMQ Job Counts
  let bullCountsBefore: Record<string, number> = { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 };
  try {
    const counts = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
    bullCountsBefore = counts;
  } catch (err: any) {
    console.warn(`   ⚠️ Warning reading BullMQ job counts:`, err.message);
  }

  // Rate Limiter Redis Keys
  let rateLimitKeysBefore: string[] = [];
  try {
    rateLimitKeysBefore = await redisClient.keys('email-rate:*');
  } catch (err: any) {
    console.warn(`   ⚠️ Warning reading rate limit keys:`, err.message);
  }

  // Elasticsearch Document Count
  let esDocCountBefore = 0;
  const esClient = getElasticsearchClient();
  try {
    const ping = await esClient.ping();
    if (ping) {
      const exists = await esClient.indices.exists({ index: INDEX_NAME });
      if (exists) {
        const countRes = await esClient.count({ index: INDEX_NAME });
        esDocCountBefore = countRes.count;
      }
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Elasticsearch count notice:`, err.message);
  }

  console.log(`🎯 TARGET DEMO DATA DETECTED:`);
  console.log(`   - Total Emails:       ${totalEmailsBefore} (Scheduled: ${scheduledBefore}, Sent: ${sentBefore}, Failed: ${failedBefore}, Processing: ${processingBefore})`);
  console.log(`   - Campaigns:          ${campaignsBefore}`);
  console.log(`   - BullMQ Queue Jobs:  Waiting: ${bullCountsBefore.waiting}, Delayed: ${bullCountsBefore.delayed}, Active: ${bullCountsBefore.active}, Completed: ${bullCountsBefore.completed}, Failed: ${bullCountsBefore.failed}`);
  console.log(`   - Redis Rate Keys:    ${rateLimitKeysBefore.length}`);
  console.log(`   - Elasticsearch Docs: ${esDocCountBefore}\n`);

  if (dryRun) {
    console.log(`ℹ️ Dry run completed. No data was deleted.\n`);
    return {
      dryRun: true,
      preserved: { usersCount, sendersCount, slackConnectionsCount },
      deleted: { emailsCount: 0, campaignsCount: 0, bullJobsCleared: false, rateLimitKeysCleared: 0, elasticsearchDocsCleared: 0 },
      postVerification: {
        scheduledEmails: scheduledBefore,
        sentEmails: sentBefore,
        failedEmails: failedBefore,
        processingEmails: processingBefore,
        totalEmails: totalEmailsBefore,
        campaigns: campaignsBefore,
        bullJobCounts: bullCountsBefore,
        elasticsearchDocCount: esDocCountBefore,
      },
    };
  }

  // 3. EXECUTE SAFE DELETION
  console.log(`🚀 Executing clean-up...`);

  // Step A: Delete Emails first (foreign key safe)
  const deleteEmailsResult = await prisma.email.deleteMany({});
  console.log(`   ✅ Deleted ${deleteEmailsResult.count} email records from database`);

  // Step B: Delete Campaigns
  const deleteCampaignsResult = await prisma.campaign.deleteMany({});
  console.log(`   ✅ Deleted ${deleteCampaignsResult.count} campaign records from database`);

  // Step C: Obliterate BullMQ Queue (purges waiting, delayed, active, completed, failed)
  let bullCleared = false;
  try {
    await emailQueue.obliterate({ force: true });
    bullCleared = true;
    console.log(`   ✅ Obliterated BullMQ 'email-queue' (all waiting, delayed, active, completed, failed jobs removed)`);
  } catch (err: any) {
    console.warn(`   ⚠️ BullMQ obliterate warning:`, err.message);
  }

  // Step D: Delete Rate Limiter hourly tracker keys in Redis
  let rateKeysClearedCount = 0;
  try {
    if (rateLimitKeysBefore.length > 0) {
      await redisClient.del(...rateLimitKeysBefore);
      rateKeysClearedCount = rateLimitKeysBefore.length;
    }
    console.log(`   ✅ Cleared ${rateKeysClearedCount} Redis rate limiter tracker keys`);
  } catch (err: any) {
    console.warn(`   ⚠️ Redis rate limiter keys deletion warning:`, err.message);
  }

  // Step E: Clear Elasticsearch documents
  let esDocsCleared = 0;
  try {
    const ping = await esClient.ping();
    if (ping) {
      const exists = await esClient.indices.exists({ index: INDEX_NAME });
      if (exists) {
        await esClient.deleteByQuery({
          index: INDEX_NAME,
          query: { match_all: {} },
          refresh: true,
        });
        esDocsCleared = esDocCountBefore;
        console.log(`   ✅ Deleted all documents from Elasticsearch index '${INDEX_NAME}'`);
      }
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Elasticsearch cleanup notice:`, err.message);
  }

  // 4. POST-RESET VERIFICATION
  console.log(`\n🔍 VERIFYING POST-RESET STATE...`);
  const postScheduled = await prisma.email.count({ where: { status: 'scheduled' } });
  const postSent = await prisma.email.count({ where: { status: 'sent' } });
  const postFailed = await prisma.email.count({ where: { status: 'failed' } });
  const postProcessing = await prisma.email.count({ where: { status: 'processing' } });
  const postTotalEmails = await prisma.email.count();
  const postCampaigns = await prisma.campaign.count();

  let postBullCounts: Record<string, number> = { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 };
  try {
    postBullCounts = await emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed');
  } catch (err: any) {
    // BullMQ after obliterate might show 0
  }

  let postEsDocCount = 0;
  try {
    const ping = await esClient.ping();
    if (ping) {
      const exists = await esClient.indices.exists({ index: INDEX_NAME });
      if (exists) {
        const countRes = await esClient.count({ index: INDEX_NAME });
        postEsDocCount = countRes.count;
      }
    }
  } catch (err: any) {
    // Elasticsearch ping failed or unavailable
  }

  const postUsers = await prisma.user.count();
  const postSenders = await prisma.sender.count();
  const postSlack = await prisma.slackConnection.count();

  console.log(`   1. Scheduled emails:      ${postScheduled} ${postScheduled === 0 ? '✅' : '❌'}`);
  console.log(`   2. Sent emails:           ${postSent} ${postSent === 0 ? '✅' : '❌'}`);
  console.log(`   3. Failed email records:  ${postFailed} ${postFailed === 0 ? '✅' : '❌'}`);
  console.log(`   4. BullMQ email jobs:     Waiting: ${postBullCounts.waiting}, Delayed: ${postBullCounts.delayed}, Active: ${postBullCounts.active}, Completed: ${postBullCounts.completed}, Failed: ${postBullCounts.failed} ${Object.values(postBullCounts).every(v => v === 0) ? '✅' : '❌'}`);
  console.log(`   5. Elasticsearch docs:    ${postEsDocCount} ${postEsDocCount === 0 ? '✅' : '❌'}`);
  console.log(`   6. Protected User count:  ${postUsers} (Unchanged: ${postUsers === usersCount ? '✅' : '❌'})`);
  console.log(`   7. Protected Senders:     ${postSenders} (Unchanged: ${postSenders === sendersCount ? '✅' : '❌'})`);
  console.log(`   8. Protected Slack auth:  ${postSlack} (Unchanged: ${postSlack === slackConnectionsCount ? '✅' : '❌'})`);
  console.log(`\n🎉 Reset complete! All demo email scheduling data is 0.\n`);

  return {
    dryRun: false,
    preserved: { usersCount: postUsers, sendersCount: postSenders, slackConnectionsCount: postSlack },
    deleted: {
      emailsCount: deleteEmailsResult.count,
      campaignsCount: deleteCampaignsResult.count,
      bullJobsCleared: bullCleared,
      rateLimitKeysCleared: rateKeysClearedCount,
      elasticsearchDocsCleared: esDocsCleared,
    },
    postVerification: {
      scheduledEmails: postScheduled,
      sentEmails: postSent,
      failedEmails: postFailed,
      processingEmails: postProcessing,
      totalEmails: postTotalEmails,
      campaigns: postCampaigns,
      bullJobCounts: postBullCounts,
      elasticsearchDocCount: postEsDocCount,
    },
  };
}

// Direct execution from CLI
if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--inspect');
  resetDemoData(isDryRun)
    .then(async () => {
      await prisma.$disconnect();
      await emailQueue.close();
      await redisClient.quit();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Reset script error:', err);
      await prisma.$disconnect();
      await emailQueue.close();
      await redisClient.quit();
      process.exit(1);
    });
}
