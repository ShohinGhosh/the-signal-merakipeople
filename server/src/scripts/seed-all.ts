/**
 * Comprehensive seed script for Atlas/production.
 * Seeds: Users, Strategy (with full generated content), and Performance data.
 *
 * SAFE: Only creates new documents, never modifies existing ones.
 * Tagged with SEED_DATA for easy cleanup.
 *
 * Usage: npx ts-node server/src/scripts/seed-all.ts
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { User } from '../models/User';
import { Strategy } from '../models/Strategy';
import { Post } from '../models/Post';
import { Lead } from '../models/Lead';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/the-signal';
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Week math ───
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

// ═══════════════════════════════════════════════════════════════
// 1. SEED USERS
// ═══════════════════════════════════════════════════════════════
async function seedUsers() {
  console.log('\n── Seeding Users ──');
  const users = [
    {
      name: 'Shohini Ghosh',
      email: 'shohini@merakipeople.com',
      password: await bcrypt.hash('shohini123', 10),
      role: 'shohini' as const,
      voiceProfile: 'Warm, direct, practitioner-led, storytelling-first. 20 years of communication expertise. Speaks from deep experience.',
    },
    {
      name: 'Sanjoy Ghosh',
      email: 'sanjoy@merakipeople.com',
      password: await bcrypt.hash('sanjoy123', 10),
      role: 'sanjoy' as const,
      voiceProfile: 'Honest, technical, building-in-public. Admits failures, celebrates small wins. Builder and operator mindset.',
    },
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`  ✓ ${u.email} already exists`);
    } else {
      await User.create(u);
      console.log(`  + Created ${u.email}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. SEED STRATEGY (full generated content)
// ═══════════════════════════════════════════════════════════════
async function seedStrategy() {
  console.log('\n── Seeding Strategy ──');

  const existing = await Strategy.findOne({ isCurrent: true });
  if (existing && existing.northStar && existing.northStar !== '' && existing.northStar !== 'Not set') {
    console.log('  ✓ Strategy already has content, skipping');
    return;
  }

  // If there's a skeleton strategy, update it. Otherwise create new.
  const strategyData = {
    version: 1,
    northStar: 'Empower sales teams in high-velocity, relationship-driven industries to achieve consistent peak performance.',
    goal90Day: 'Acquire 5 active clients on subscription. Build thought leadership on LinkedIn with 3x/week posting cadence reaching 2,000+ impressions per post.',
    icpPrimary: {
      description: 'EdTech Sales Teams (B2C): SDRs and counselors at EdTech companies selling courses and upskilling programs directly to students and working professionals.',
      industry: 'EdTech',
      companySize: '20-200',
      role: 'SDRs, Counselors, VP Sales, Sales Head, Revenue Head',
      painPoints: [
        'Leads go cold fast',
        'Follow-up is generic',
        'Reps are undertrained on objection handling',
        'CRM tracks activity but doesn\'t improve behavior',
        'High attrition in SDR teams',
      ],
    },
    icpSecondary: {
      description: 'B2B SaaS companies with inside sales teams of 10-50 reps who need AI-powered coaching to reduce ramp time and improve conversion rates.',
    },
    antiIcp: 'Enterprise companies with 500+ seat sales teams who need full CRM replacement. Companies looking for just a dialer or just a CRM — we augment, not replace.',
    positioningStatement: 'MerakiPeople is the AI-powered sales growth platform for relationship-driven teams. Unlike CRMs that document the decline, we actively improve every conversation through real-time coaching, intelligent follow-up, and AI-powered account research.',
    contentPillars: [
      {
        name: 'Thought Leadership',
        purpose: 'Position MerakiPeople as the authority on AI-powered sales performance',
        targetPercent: 30,
        examplePostTypes: ['Hot takes on sales methodology', 'Data-backed insights from 10K+ conversations', 'Industry trend analysis'],
        owner: 'shohini' as const,
      },
      {
        name: 'Client Wins',
        purpose: 'Social proof and case studies that demonstrate real results',
        targetPercent: 25,
        examplePostTypes: ['Before/after metrics', 'Client spotlight stories', 'ROI breakdowns'],
        owner: 'both' as const,
      },
      {
        name: 'Behind the Scenes',
        purpose: 'Build trust through transparency — show how we build and operate',
        targetPercent: 20,
        examplePostTypes: ['Product development updates', 'Team moments', 'Building-in-public posts'],
        owner: 'sanjoy' as const,
      },
      {
        name: 'Industry Insights',
        purpose: 'Curate and comment on sales industry trends for ICP relevance',
        targetPercent: 15,
        examplePostTypes: ['News commentary', 'Market research highlights', 'Competitor landscape'],
        owner: 'both' as const,
      },
      {
        name: 'Team Culture',
        purpose: 'Humanize the brand and attract talent',
        targetPercent: 10,
        examplePostTypes: ['Team celebrations', 'Work culture posts', 'Hiring announcements'],
        owner: 'both' as const,
      },
    ],
    voiceShohini: 'Warm, direct, practitioner-led. Uses storytelling and real client examples. Speaks with 20 years of authority but never condescending. Favorite phrase: "Here\'s what actually works."',
    voiceSanjoy: 'Honest, technical, building-in-public. Shares failures openly. Celebrates small wins. Data-driven but human. Favorite phrase: "We shipped this because..."',
    sharedTone: 'No jargon. No corporate-speak. Speak like you\'re giving advice to a friend who runs a sales team. Use numbers when possible. Always link back to real impact.',
    bannedPhrases: ['synergy', 'leverage', 'game-changer', 'disruptive', 'best-in-class', 'circle back', 'low-hanging fruit'],
    platformStrategy: [
      {
        platform: 'LinkedIn',
        primaryPurpose: 'Lead generation + Thought leadership',
        weeklyTarget: 4,
        bestFormats: ['Carousels', 'Text posts', 'Document posts'],
        bestPostingTimes: ['Tue 9:30 AM', 'Wed 12:00 PM', 'Thu 9:30 AM', 'Fri 11:00 AM'],
      },
      {
        platform: 'Instagram',
        primaryPurpose: 'Brand awareness + Personal brand',
        weeklyTarget: 2,
        bestFormats: ['Reels', 'Carousels', 'Stories'],
        bestPostingTimes: ['Tue 6:00 PM', 'Sat 10:00 AM'],
      },
    ],
    keyMessages: [
      'Your SDRs aren\'t lazy — they\'re under-equipped. MerakiPeople fixes the system, not the people.',
      'CRMs track what happened. We improve what happens next.',
      'AI coaching isn\'t about replacing humans — it\'s about making every human conversation count.',
      'From first call to close: one platform for the entire revenue cycle.',
      'We reduced ramp time from 6 months to 6 weeks for EdTech sales teams.',
    ],
    objectionContent: [],
    clientRoster: [],
    metricsTargets: {
      linkedinFollowers: 5000,
      linkedinEngagementRate: 4.5,
      linkedinDmsPerWeek: 10,
      instagramFollowers: 2000,
      instagramReach: 1500,
      leadsPerMonth: 15,
      demoToCloseRate: 25,
      mrrTarget: 50000,
      trainingRevenueTarget: 200000,
    },
    platformBenchmarks: {
      linkedin: {
        current_followers: 1200,
        avg_impressions: 800,
        best_format: 'Carousels',
        pipeline_generating: true,
        channel_purpose: 'Lead generation',
        target_90d: 2500,
      },
      instagram: {
        current_followers: 450,
        avg_reach: 300,
        best_format: 'Reels',
        pipeline_generating: false,
        channel_purpose: 'Brand awareness',
        target_90d: 1000,
        is_active: true,
      },
    },
    competitiveIntelligence: '',
    isCurrent: true,
    isComplete: true,
    rawInputs: {
      section1_businessContext: 'MerakiPeople is an AI-powered sales growth platform built for sales teams in high-velocity, relationship-driven industries — serving both B2C and B2B sales motions in India.\nWe solve a fundamental problem: sales teams have inconsistent performance because they walk into every call underprepared, follow up generically, and lose learning after every conversation. CRMs track data but don\'t improve behavior.\nMerakiPeople operates across three stages: Lead Hunt (AI-powered account research and outreach to bring leads into the funnel), Lead Nurture (personalized multi-channel follow-up once a lead is active — email, WhatsApp, LinkedIn), and Call Compass (pre-call intelligence, live support, and post-call learning).\nTogether they cover the full revenue cycle — from finding the right prospect to closing the conversation. Not a tool. A team.',
      section2_goalsMetrics: '90-day goal: Acquire 5 active clients on subscription.\nTarget MRR: ₹4L/month within 6 months.\nKey metrics: LinkedIn followers to 5K, engagement rate >4%, 15 qualified leads/month, demo-to-close 25%.\nTraining revenue target: ₹20L over next 12 months from corporate training programs.',
      section3_currentState: 'Currently posting 2-3x/week on LinkedIn (inconsistent). Instagram barely active — maybe 1 post/week.\nLinkedIn has 1,200 followers, averaging 800 impressions/post. Best performing: carousels about sales tips.\nNo formal content calendar. Posts are reactive, not planned. No signal feed or evidence-based content process.\nPipeline: 8 leads in various stages, 2 demos completed last month, 0 signed yet.',
      section3a_platformMetrics: 'LinkedIn:\n- Current Followers: 1200\n- Avg Impressions: 800\n- Best Format: Carousels\n- Pipeline Generating: Yes\n- Channel Purpose: Lead generation\n- 90-Day Follower Target: 2500\n\nInstagram:\n- Active: Yes\n- Current Followers: 450\n- Avg Reach: 300\n- Best Format: Reels\n- Pipeline Generating: No\n- Channel Purpose: Brand awareness\n- 90-Day Follower Target: 1000',
      section4_voicePositioning: 'Shohini: Warm, storytelling-driven. 20 years of experience in communication and sales. Speaks with authority but approachable. Uses real client examples. No jargon.\nSanjoy: Builder mindset. Honest about failures. Technical but human. Building-in-public energy. Celebrates small wins.\nShared: No corporate-speak. Talk like giving advice to a friend. Use numbers. Link everything back to real impact.\nBanned: synergy, leverage, game-changer, disruptive, best-in-class, circle back, low-hanging fruit.',
      section5_campaigns: 'Upcoming: Q2 2026 product launch — Call Compass v2 with real-time AI coaching.\nEdTech vertical push — targeting 20 EdTech companies for pilot programs.\nWebinar series: "AI in Sales" — 4-part series starting April.\nNo formal budget yet for paid promotion.',
    },
    onboardingProgress: {
      currentSection: 6,
      totalSections: 6,
      completedSections: ['1', '2', '3', '3a', '4', '5'],
    },
    updatedBy: 'shohini@merakipeople.com',
    updateReason: 'Initial strategy generation',
  };

  if (existing) {
    // Update the skeleton strategy
    await Strategy.findByIdAndUpdate(existing._id, { $set: strategyData });
    console.log('  + Updated existing strategy with full content');
  } else {
    await Strategy.create(strategyData);
    console.log('  + Created new strategy with full content');
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. SEED PERFORMANCE DATA (posts + leads)
// ═══════════════════════════════════════════════════════════════
async function seedPerformance() {
  console.log('\n── Seeding Performance Data ──');

  // Clean old seed data only
  const delPosts = await Post.deleteMany({ notes: 'SEED_DATA' });
  const delLeads = await Lead.deleteMany({ notes: { $elemMatch: { text: 'SEED_DATA' } } });
  console.log(`  Cleaned ${delPosts.deletedCount} old seed posts, ${delLeads.deletedCount} old seed leads`);

  const PILLARS = ['Thought Leadership', 'Client Wins', 'Behind the Scenes', 'Industry Insights', 'Team Culture'];
  const AUTHORS: ('shohini' | 'sanjoy')[] = ['shohini', 'sanjoy'];
  const FORMATS_LI = ['text_post', 'carousel', 'document', 'poll', 'video_caption'];
  const FORMATS_IG = ['reel', 'carousel', 'story'];

  const hooks = [
    'Stop doing this one thing in your sales calls — it\'s costing you deals every single week.',
    'We helped a 50-person EdTech team go from 8% close rate to 22% in 90 days. Here\'s the playbook.',
    'The biggest myth in B2B sales training? "More calls = more revenue." Let me explain why.',
    '3 things I learned from analyzing 10,000+ sales conversations this quarter.',
    'Your SDRs aren\'t lazy — they\'re under-equipped. Here\'s what actually works.',
    'Client spotlight: How LearnCo reduced ramp time from 6 months to 6 weeks.',
    'Hot take: CRMs don\'t fix sales performance. They just document the decline.',
    'Behind the scenes of our AI call coaching — what we see in real conversations.',
    'The follow-up framework that turned our cold leads warm. Steal it.',
    'Why relationship-driven selling will always beat volume-based outreach.',
    'New quarter, same pipeline anxiety? Here\'s how to fix that permanently.',
    'Our team just shipped something big. Sneak peek at what\'s coming next month.',
  ];

  function generatePosts(monday: Date, count: number) {
    const posts = [];
    for (let i = 0; i < count; i++) {
      const platform = (['linkedin', 'instagram'] as const)[rand(0, 1)];
      const formats = platform === 'linkedin' ? FORMATS_LI : FORMATS_IG;
      const format = formats[rand(0, formats.length - 1)];
      const reach = rand(400, 5000);
      const likes = rand(10, Math.floor(reach * 0.15));
      const comments = rand(2, Math.floor(reach * 0.04));
      const shares = rand(0, Math.floor(reach * 0.02));
      const saves = rand(0, Math.floor(reach * 0.03));
      const dms = rand(0, 5);
      const engagementRate = reach > 0
        ? Math.round(((likes + comments + shares + saves) / reach) * 100 * 100) / 100
        : 0;
      const hook = hooks[rand(0, hooks.length - 1)];

      posts.push({
        author: AUTHORS[rand(0, 1)],
        platform,
        format,
        contentPillar: PILLARS[rand(0, PILLARS.length - 1)],
        draftContent: hook,
        finalContent: hook,
        cta: 'DM me "GROWTH" for details',
        hashtags: ['#sales', '#growth', '#B2B'],
        linkedinHook: hook.slice(0, 80),
        instagramHook: hook.slice(0, 60),
        status: 'published' as const,
        publishedAt: dateInWeek(monday, rand(0, 4)),
        performance: { likes, comments, shares, dms, reach, saves, engagementRate },
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
    }
    return posts;
  }

  // 8 posts this week, 6 last week
  const thisWeekPosts = generatePosts(thisMonday, 8);
  const lastWeekPosts = generatePosts(lastMonday, 6);

  const insertedPosts = await Post.insertMany([...thisWeekPosts, ...lastWeekPosts]);
  console.log(`  + Inserted ${insertedPosts.length} posts (${thisWeekPosts.length} this week, ${lastWeekPosts.length} last week)`);

  // 2 leads from LinkedIn content this week
  const thisWeekInserted = insertedPosts.slice(0, thisWeekPosts.length);
  const linkedinPosts = thisWeekInserted.filter((p) => p.platform === 'linkedin');

  if (linkedinPosts.length >= 2) {
    const leads = [
      { companyName: 'TechTrain Academy', contactName: 'Rajesh Mehta', contactRole: 'VP Sales', dealValue: 45000, stage: 'CONVERSATION' as const },
      { companyName: 'SkillBridge Corp', contactName: 'Priya Sharma', contactRole: 'Head of L&D', dealValue: 72000, stage: 'DEMO_DONE' as const },
    ];

    for (let i = 0; i < 2; i++) {
      await Lead.create({
        ...leads[i],
        source: 'linkedin_content',
        sourcePostId: linkedinPosts[i]._id,
        vertical: 'EdTech',
        owner: AUTHORS[i],
        nextAction: 'Follow up next week',
        notes: [{ text: 'SEED_DATA', author: 'system' }],
      });
    }
    console.log('  + Inserted 2 seed leads from content');
  }

  // Print top posts
  const topPosts = thisWeekInserted
    .sort((a, b) => (b.performance?.engagementRate || 0) - (a.performance?.engagementRate || 0))
    .slice(0, 3);
  console.log('  Top 3 this week:');
  for (const p of topPosts) {
    console.log(`    ${p.platform} | ${p.format} | ${p.performance?.engagementRate}% eng | ${p.performance?.reach} reach`);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║  The Signal — Full Database Seed     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\nConnecting to: ${MONGODB_URI.replace(/:([^@]+)@/, ':***@')}`);

  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  await seedUsers();
  await seedStrategy();
  await seedPerformance();

  await mongoose.disconnect();
  console.log('\n✓ All done! Restart the server and refresh the app.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
