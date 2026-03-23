import { AgentRun } from '../../models/AgentRun';
import * as contentDrafter from './agents/contentDrafter';
import * as signalToContent from './agents/signalToContent';
import * as crossPlatformRepurpose from './agents/crossPlatformRepurpose';
import * as generateMondayBrief from './agents/generateMondayBrief';
import * as generateImages from './agents/generateImages';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'content' | 'pipeline' | 'analytics';
  platform?: string;
  format?: string;
  countEligible: () => Promise<number>;
  execute: (run: InstanceType<typeof AgentRun>, triggeredBy: string) => Promise<void>;
}

/**
 * Agent Registry — defines all available automation agents.
 * Content drafting agents are separated by platform + format.
 */

function createContentAgent(
  platform: string,
  format: string,
  displayName: string,
  icon: string
): AgentDefinition {
  return {
    id: `draft-${platform}-${format}`,
    name: displayName,
    description: `Generate full content for ${platform} ${format.replace('_', ' ')} posts with empty drafts`,
    icon,
    category: 'content',
    platform,
    format,
    countEligible: () => contentDrafter.countEligible(platform, format),
    execute: (run, triggeredBy) => contentDrafter.execute(platform, format, run, triggeredBy),
  };
}

export const AGENT_REGISTRY: Map<string, AgentDefinition> = new Map([
  // ============ LinkedIn Content Agents ============
  ['draft-linkedin-text_post', createContentAgent('linkedin', 'text_post', 'LinkedIn Text Post', 'FileText')],
  ['draft-linkedin-carousel', createContentAgent('linkedin', 'carousel', 'LinkedIn Carousel', 'Layers')],
  ['draft-linkedin-poll', createContentAgent('linkedin', 'poll', 'LinkedIn Poll', 'BarChart')],
  ['draft-linkedin-document', createContentAgent('linkedin', 'document', 'LinkedIn Document', 'FileText')],
  ['draft-linkedin-video_caption', createContentAgent('linkedin', 'video_caption', 'LinkedIn Video Caption', 'Video')],

  // ============ Instagram Content Agents ============
  ['draft-instagram-text_post', createContentAgent('instagram', 'text_post', 'Instagram Post', 'Image')],
  ['draft-instagram-carousel', createContentAgent('instagram', 'carousel', 'Instagram Carousel', 'Layers')],
  ['draft-instagram-reel', createContentAgent('instagram', 'reel', 'Instagram Reel', 'Film')],
  ['draft-instagram-story', createContentAgent('instagram', 'story', 'Instagram Story', 'Circle')],
  ['draft-instagram-video_caption', createContentAgent('instagram', 'video_caption', 'Instagram Video', 'Video')],

  // ============ Pipeline Agents ============
  ['signal-to-content', {
    id: 'signal-to-content',
    name: 'Signal to Content',
    description: 'Convert confirmed content seed signals into LinkedIn draft posts',
    icon: 'Zap',
    category: 'content',
    countEligible: signalToContent.countEligible,
    execute: signalToContent.execute,
  }],

  ['cross-platform-repurpose', {
    id: 'cross-platform-repurpose',
    name: 'Repurpose Content',
    description: 'Create Instagram versions of ready/published LinkedIn posts',
    icon: 'Repeat',
    category: 'content',
    countEligible: crossPlatformRepurpose.countEligible,
    execute: crossPlatformRepurpose.execute,
  }],

  // ============ Analytics Agents ============
  ['monday-brief', {
    id: 'monday-brief',
    name: 'Monday Brief',
    description: 'Generate weekly analytics brief with performance insights',
    icon: 'Calendar',
    category: 'analytics',
    countEligible: generateMondayBrief.countEligible,
    execute: generateMondayBrief.execute,
  }],

  ['generate-images', {
    id: 'generate-images',
    name: 'Generate Image Prompts',
    description: 'Generate image prompts for posts with content but no images',
    icon: 'ImagePlus',
    category: 'content',
    countEligible: generateImages.countEligible,
    execute: generateImages.execute,
  }],
]);

/**
 * Get all agents grouped by category.
 */
export function getAgentsByCategory(): Record<string, AgentDefinition[]> {
  const grouped: Record<string, AgentDefinition[]> = {};
  for (const agent of AGENT_REGISTRY.values()) {
    if (!grouped[agent.category]) grouped[agent.category] = [];
    grouped[agent.category].push(agent);
  }
  return grouped;
}
