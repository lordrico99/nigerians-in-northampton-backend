import mongoose from 'mongoose';

const businessRemovalRequestSchema = new mongoose.Schema(
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
      enum: [
        'pending',
        'approved',
        'rejected',
        'changes_requested',
      ],
      default: 'pending',
      index: true,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
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
  },
  {
    timestamps: true,
  }
);

businessRemovalRequestSchema.index({
  businessId: 1,
  status: 1,
});

export const BusinessRemovalRequest =
  mongoose.model(
    'BusinessRemovalRequest',
    businessRemovalRequestSchema
  );