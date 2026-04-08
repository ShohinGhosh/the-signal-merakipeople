import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICarouselSlide {
  slideNumber: number;
  content: string;
  type: 'hook' | 'content' | 'cta';
}

export interface IPostPerformance {
  likes: number;
  comments: number;
  shares: number;
  dms: number;
  reach: number;
  saves: number;
  engagementRate: number;
}

export interface IPost extends Document {
  signalFeedId: Types.ObjectId | null;
  campaignId: Types.ObjectId | null;
  author: 'shohini' | 'sanjoy';
  platform: 'linkedin' | 'instagram' | 'facebook' | 'both';
  format: 'text_post' | 'carousel' | 'poll' | 'document' | 'video_caption' | 'reel' | 'story';
  contentPillar: string;
  draftContent: string;
  draftCarouselOutline: ICarouselSlide[];
  finalContent: string;
  cta: string;
  hashtags: string[];
  linkedinHook: string;
  instagramHook: string;
  imageType: 'post_graphic' | 'thumbnail' | 'carousel_cover' | 'carousel_pdf' | 'quote_card' | null;
  imagePrompt: string;
  imageUrl: string;
  imageVariations: string[];
  carouselPdfUrl: string;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  approvedAt: Date | null;
  status: 'draft' | 'scheduled' | 'ready' | 'published' | 'archived';
  performance: IPostPerformance | null;
  notes: string;
  aiEvidence: {
    strategyReferences: string[];
    dataPoints: string[];
    signalFeedSources: string[];
    confidenceScore: number;
    critiqueIterations: number;
    finalCritiqueScore: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    signalFeedId: { type: Schema.Types.ObjectId, ref: 'SignalFeed', default: null },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', default: null },
    author: { type: String, required: true, enum: ['shohini', 'sanjoy'] },
    platform: { type: String, required: true, enum: ['linkedin', 'instagram', 'facebook', 'both'] },
    format: {
      type: String,
      enum: ['text_post', 'carousel', 'poll', 'document', 'video_caption', 'reel', 'story'],
    },
    contentPillar: { type: String, default: '' },
    draftContent: { type: String, default: '' },
    draftCarouselOutline: [
      {
        slideNumber: Number,
        content: String,
        type: { type: String, enum: ['hook', 'content', 'cta'] },
      },
    ],
    finalContent: { type: String, default: '' },
    cta: { type: String, default: '' },
    hashtags: [{ type: String }],
    linkedinHook: { type: String, default: '' },
    instagramHook: { type: String, default: '' },
    imageType: {
      type: String,
      enum: ['post_graphic', 'thumbnail', 'carousel_cover', 'carousel_pdf', 'quote_card', null],
      default: null,
    },
    imagePrompt: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    imageVariations: [{ type: String }],
    carouselPdfUrl: { type: String, default: '' },
    scheduledAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    status: {
      type: String,
      default: 'draft',
      enum: ['draft', 'scheduled', 'ready', 'published', 'archived'],
    },
    performance: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      dms: { type: Number, default: 0 },
      reach: { type: Number, default: 0 },
      saves: { type: Number, default: 0 },
      engagementRate: { type: Number, default: 0 },
    },
    notes: { type: String, default: '' },
    aiEvidence: {
      strategyReferences: [String],
      dataPoints: [String],
      signalFeedSources: [String],
      confidenceScore: Number,
      critiqueIterations: Number,
      finalCritiqueScore: Number,
    },
  },
  { timestamps: true }
);

export const Post = mongoose.model<IPost>('Post', PostSchema);
