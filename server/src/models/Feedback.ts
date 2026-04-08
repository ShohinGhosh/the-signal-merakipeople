import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFeedback extends Document {
  postId: Types.ObjectId;
  field: 'content' | 'image' | 'carousel' | 'thumbnail';
  rating: 'up' | 'down';
  feedbackText: string;
  quickFixUsed?: string;
  contentBefore: string;
  contentAfter?: string;
  format: string;
  platform: string;
  contentPillar: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    field: {
      type: String,
      enum: ['content', 'image', 'carousel', 'thumbnail'],
      required: true,
    },
    rating: { type: String, enum: ['up', 'down'], required: true },
    feedbackText: { type: String, default: '' },
    quickFixUsed: { type: String },
    contentBefore: { type: String, default: '' },
    contentAfter: { type: String },
    format: { type: String, default: '' },
    platform: { type: String, default: '' },
    contentPillar: { type: String, default: '' },
    author: { type: String, default: '' },
  },
  { timestamps: true }
);

// Index for intelligence queries
FeedbackSchema.index({ rating: 1, field: 1, format: 1, platform: 1 });
FeedbackSchema.index({ createdAt: -1 });

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
