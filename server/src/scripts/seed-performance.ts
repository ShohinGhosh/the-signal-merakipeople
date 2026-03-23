/**
 * Seed script: Inserts dummy published posts with performance metrics
 * for this week and last week so the Analytics Performance tab has data.
 *
 * Usage: npx ts-node server/src/scripts/seed-performance.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { Post } from '../models/Post';
import { Lead } from '../models/Lead';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/the-signal';

// Helper: random integer between min and max (inclusive)
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Calculate week boundaries
const now = new Date();
const dayOfWeek = now.getDay();
const thisMonday = new Date(now);
thisMonday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
thisMonday.setHours(0, 0, 0, 0);

const lastMonday = new Date(thisMonday);
lastMonday.setDate(thisMonday.getDate() - 7);

function dateInWeek(monday: Date, dayOffset: number): Date {
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayOffset);
  d.setHours(9 + rand(0, 8), rand(0, 59), 0, 0);
  return d;
}

const PILLARS = ['Thought Leadership', 'Client Wins', 'Behind the Scenes', 'Industry Insights', 'Team Culture'];
const AUTHORS: ('shohini' | 'sanjoy')[] = ['shohini', 'sanjoy'];
const PLATFORMS: ('linkedin' | 'instagram')[] = ['linkedin', 'instagram'];
const FORMATS_LI = ['text_post', 'carousel', 'document', 'poll', 'video_caption'];
const FORMATS_IG = ['reel', 'carousel', 'story'];

interface PostSeed {
  platform: 'linkedin' | 'instagram';
  format: string;
  contentPillar: string;
  author: 'shohini' | 'sanjoy';
  draftContent: string;
  finalContent: string;
  publishedAt: Date;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  dms: number;
}

function generatePosts(monday: Date, count: number): PostSeed[] {
  const posts: PostSeed[] = [];
  for (let i = 0; i < count; i++) {
    const platform = PLATFORMS[rand(0, 1)];
    const formats = platform === 'linkedin' ? FORMATS_LI : FORMATS_IG;
    const format = formats[rand(0, formats.length - 1)];
    const pillar = PILLARS[rand(0, PILLARS.length - 1)];
    const author = AUTHORS[rand(0, 1)];
    const reach = rand(400, 5000);
    const likes = rand(10, Math.floor(reach * 0.15));
    const comments = rand(2, Math.floor(reach * 0.04));
    const shares = rand(0, Math.floor(reach * 0.02));
    const saves = rand(0, Math.floor(reach * 0.03));
    const dms = rand(0, 5);

    const hooks = [
      `Stop doing this one thing in your sales calls — it's costing you deals every single week.`,
      `We helped a 50-person EdTech team go from 8% close rate to 22% in 90 days. Here's the playbook.`,
      `The biggest myth in B2B sales training? "More calls = more revenue." Let me explain why.`,
      `3 things I learned from analyzing 10,000+ sales conversations this quarter.`,
      `Your SDRs aren't lazy — they're under-equipped. Here's what actually works.`,
      `Client spotlight: How LearnCo reduced ramp time from 6 months to 6 weeks.`,
      `Hot take: CRMs don't fix sales performance. They just document the decline.`,
      `Behind the scenes of our AI call coaching — what we see in real conversations.`,
      `The follow-up framework that turned our cold leads warm. Steal it.`,
      `Why relationship-driven selling will always beat volume-based outreach.`,
      `New quarter, same pipeline anxiety? Here's how to fix that permanently.`,
      `Our team just shipped something big. Sneak peek at what's coming next month.`,
    ];

    posts.push({
      platform,
      format,
      contentPillar: pillar,
      author,
      draftContent: hooks[rand(0, hooks.length - 1)],
      finalContent: hooks[rand(0, hooks.length - 1)],
      publishedAt: dateInWeek(monday, rand(0, 4)),
      reach,
      likes,
      comments,
      shares,
      saves,
      dms,
    });
  }
  return posts;
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // Clean existing dummy posts (tagged with notes field)
  const deleted = await Post.deleteMany({ notes: 'SEED_DATA' });
  console.log(`Cleaned ${deleted.deletedCount} old seed posts.`);

  const deletedLeads = await Lead.deleteMany({ notes: { $elemMatch: { text: 'SEED_DATA' } } });
  console.log(`Cleaned ${deletedLeads.deletedCount} old seed leads.`);

  // Generate this week's posts (8 posts)
  const thisWeekPosts = generatePosts(thisMonday, 8);
  // Generate last week's posts (6 posts — slightly less active)
  const lastWeekPosts = generatePosts(lastMonday, 6);

  const allPosts = [...thisWeekPosts, ...lastWeekPosts];

  const insertedPosts = [];
  for (const p of allPosts) {
    const engagementRate = p.reach > 0
      ? Math.round(((p.likes + p.comments + p.shares + p.saves) / p.reach) * 100 * 100) / 100
      : 0;

    const post = await Post.create({
      author: p.author,
      platform: p.platform,
      format: p.format,
      contentPillar: p.contentPillar,
      draftContent: p.draftContent,
      finalContent: p.finalContent,
      cta: 'DM me "GROWTH" for details',
      hashtags: ['#sales', '#growth', '#B2B'],
      linkedinHook: p.draftContent.slice(0, 80),
      instagramHook: p.draftContent.slice(0, 60),
      status: 'published',
      publishedAt: p.publishedAt,
      performance: {
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        dms: p.dms,
        reach: p.reach,
        saves: p.saves,
        engagementRate,
      },
      notes: 'SEED_DATA',
      aiEvidence: {
        strategyReferences: [],
        dataPoints: [],
        signalFeedSources: [],
        confidenceScore: 0,
        critiqueIterations: 0,
        finalCritiqueScore: 0,
      },
    });
    insertedPosts.push(post);
  }

  console.log(`Inserted ${insertedPosts.length} seed posts (${thisWeekPosts.length} this week, ${lastWeekPosts.length} last week).`);

  // Create 2 leads from content this week
  const thisWeekInserted = insertedPosts.slice(0, thisWeekPosts.length);
  const linkedinPosts = thisWeekInserted.filter((p) => p.platform === 'linkedin');

  if (linkedinPosts.length >= 2) {
    const companies = [
      { name: 'TechTrain Academy', contact: 'Rajesh Mehta', role: 'VP Sales', value: 45000, stage: 'CONVERSATION' as const },
      { name: 'SkillBridge Corp', contact: 'Priya Sharma', role: 'Head of L&D', value: 72000, stage: 'DEMO_DONE' as const },
    ];

    for (let i = 0; i < 2; i++) {
      await Lead.create({
        companyName: companies[i].name,
        contactName: companies[i].contact,
        contactRole: companies[i].role,
        source: 'linkedin_content',
        sourcePostId: linkedinPosts[i]._id,
        vertical: 'EdTech',
        dealValue: companies[i].value,
        owner: AUTHORS[i],
        stage: companies[i].stage,
        nextAction: 'Follow up next week',
        notes: [{ text: 'SEED_DATA', author: 'system' }],
      });
    }
    console.log('Inserted 2 seed leads from content.');
  }

  // Print summary
  console.log('\n--- Seed Summary ---');
  const topThisWeek = thisWeekInserted
    .sort((a, b) => (b.performance?.engagementRate || 0) - (a.performance?.engagementRate || 0))
    .slice(0, 3);
  console.log('Top 3 posts this week:');
  for (const p of topThisWeek) {
    console.log(`  ${p.platform} | ${p.format} | ${p.performance?.engagementRate}% eng | ${p.performance?.reach} reach`);
  }

  await mongoose.disconnect();
  console.log('\nDone! Refresh the Analytics > Performance tab to see data.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
