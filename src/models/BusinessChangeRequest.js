import mongoose from 'mongoose';

const businessChangeRequestSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
      index: true,
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    proposedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

businessChangeRequestSchema.index({
  businessId: 1,
  status: 1,
});

export const BusinessChangeRequest =
  mongoose.model(
    'BusinessChangeRequest',
    businessChangeRequestSchema
  );