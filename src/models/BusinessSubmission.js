import mongoose from 'mongoose';

const businessSubmissionSchema = new mongoose.Schema(
  {
    // Member account that submitted this business
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },

    reference: { type: String, required: true, unique: true, index: true },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'changes_requested'],
      default: 'pending',
      index: true,
    },

    reviewNote: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },

    businessName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    categoryKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    areaKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },

    services: {
      type: [String],
      default: [],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    whatsappNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
    },

    website: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    hasWhatsApp: {
      type: Boolean,
      default: false,
    },

    hasOnline: {
      type: Boolean,
      default: false,
    },

    hasBooking: {
      type: Boolean,
      default: false,
    },

    address: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },

    postcode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    town: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },

    lat: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },

    lng: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },

    hours: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ownerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    ownerPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },

    ownerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },

    ownerNote: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
    },

    coverImage: {
      filename: String,
      url: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },

    galleryImages: [
      {
        filename: String,
        url: String,
        originalName: String,
        mimeType: String,
        size: Number,
      },
    ],
  },
  { timestamps: true }
);

export const BusinessSubmission = mongoose.model(
  'BusinessSubmission',
  businessSubmissionSchema
);