import mongoose, { Schema, Document } from 'mongoose';

export interface IContentHistory extends Document {
  userId: mongoose.Types.ObjectId;
  author: 'shohini' | 'sanjoy';
  platform: string;
  topic: string;
  hook: string;
  format: string;
  contentPillar: string;
  publishedDate: Date;
  performanceNotes: string;
  source: 'upload' | 'system'; // 'upload' = from CSV, 'system' = auto-logged from published posts
  createdAt: Date;
  updatedAt: Date;
}

const ContentHistorySchema = new Schema<IContentHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    author: { type: String, enum: ['shohini', 'sanjoy'], required: true },
    platform: { type: String, default: 'linkedin' },
    topic: { type: String, required: true },
    hook: { type: String, default: '' },
    format: { type: String, default: 'text_post' },
    contentPillar: { type: String, default: '' },
    publishedDate: { type: Date, required: true },
    performanceNotes: { type: String, default: '' },
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    source: { type: String, enum: ['upload', 'system'], default: 'upload' },
  },
  { timestamps: true }
);

ContentHistorySchema.index({ publishedDate: -1 });
ContentHistorySchema.index({ postId: 1 }, { sparse: true });
ContentHistorySchema.index({ topic: 'text', hook: 'text' });

export const ContentHistory = mongoose.model<IContentHistory>('ContentHistory', ContentHistorySchema);
