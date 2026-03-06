import mongoose, { Schema, Document } from 'mongoose';

export interface ICampaign extends Document {
  name: string;
  goal: 'new_clients' | 'vertical_push' | 'product_launch' | 'event_promotion' | 'brand_awareness' | 'training_launch';
  targetSegment: string;
  startDate: Date;
  endDate: Date;
  contentBrief: string;
  platforms: string[];
  budget: number;
  successMetric: string;
  status: 'draft' | 'active' | 'paused' | 'complete';
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true },
    goal: {
      type: String,
      required: true,
      enum: ['new_clients', 'vertical_push', 'product_launch', 'event_promotion', 'brand_awareness', 'training_launch'],
    },
    targetSegment: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    contentBrief: { type: String, default: '' },
    platforms: [{ type: String }],
    budget: { type: Number, default: 0 },
    successMetric: { type: String, default: '' },
    status: {
      type: String,
      default: 'draft',
      enum: ['draft', 'active', 'paused', 'complete'],
    },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
