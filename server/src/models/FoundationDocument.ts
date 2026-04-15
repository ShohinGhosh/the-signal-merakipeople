import mongoose from 'mongoose';

const foundationDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    docType: {
      type: String,
      enum: ['sales_deck', 'case_study', 'brand_guidelines', 'product_info', 'competitor_intel', 'process_doc', 'other'],
      default: 'other',
    },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    blobUrl: { type: String, default: '' },
    extractedText: { type: String, default: '' },
    intelligence: { type: mongoose.Schema.Types.Mixed, default: null },
    aiCost: {
      inputTokens: { type: Number },
      outputTokens: { type: Number },
      costUsd: { type: Number },
      model: { type: String },
    },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

foundationDocumentSchema.index({ isActive: 1 });

export const FoundationDocument = mongoose.model('FoundationDocument', foundationDocumentSchema);
