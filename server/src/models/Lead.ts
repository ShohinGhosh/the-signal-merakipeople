import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ILeadNote {
  text: string;
  timestamp: Date;
  author: string;
}

export interface ILead extends Document {
  companyName: string;
  contactName: string;
  contactRole: string;
  source: 'linkedin_content' | 'instagram' | 'referral' | 'event' | 'direct' | 'webinar';
  sourcePostId: Types.ObjectId | null;
  vertical: string;
  dealValue: number;
  owner: 'shohini' | 'sanjoy';
  stage: 'RADAR' | 'CONTACTED' | 'CONVERSATION' | 'DEMO_DONE' | 'PROPOSAL' | 'NEGOTIATING' | 'SIGNED' | 'LOST';
  lastContactAt: Date | null;
  nextAction: string;
  nextActionAt: Date | null;
  notes: ILeadNote[];
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    companyName: { type: String, default: '' },
    contactName: { type: String, default: '' },
    contactRole: { type: String, default: '' },
    source: {
      type: String,
      enum: ['linkedin_content', 'instagram', 'referral', 'event', 'direct', 'webinar'],
      default: 'direct',
    },
    sourcePostId: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
    vertical: { type: String, default: '' },
    dealValue: { type: Number, default: 0 },
    owner: { type: String, enum: ['shohini', 'sanjoy'], default: 'shohini' },
    stage: {
      type: String,
      default: 'RADAR',
      enum: ['RADAR', 'CONTACTED', 'CONVERSATION', 'DEMO_DONE', 'PROPOSAL', 'NEGOTIATING', 'SIGNED', 'LOST'],
    },
    lastContactAt: { type: Date, default: null },
    nextAction: { type: String, default: '' },
    nextActionAt: { type: Date, default: null },
    notes: [
      {
        text: String,
        timestamp: { type: Date, default: Date.now },
        author: String,
      },
    ],
  },
  { timestamps: true }
);

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
