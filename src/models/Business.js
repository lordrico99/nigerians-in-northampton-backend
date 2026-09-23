import mongoose from 'mongoose';

const businessImageSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      trim: true,
      default: '',
    },
    url: {
      type: String,
      trim: true,
      default: '',
    },
    originalName: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    /*
      Links the public business record back to the original
      business submission that was approved.
    */
    submissionReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /*
      Public URL identifier, e.g.
      /businesses/northampton-nigerian-kitchen
    */
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    /*
      Public directory controls.
    */
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    reviewCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    /*
      Business details.
    */
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
      index: true,
    },

    areaKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
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

    /*
      Public contact information.
    */
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

    /*
      Public location information.
    */
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

    /*
      PRIVATE OWNER / ADMINISTRATION DETAILS

      These fields remain stored in MongoDB so administrators
      can contact the business owner, but select: false prevents
      them from being returned by normal Business.find() queries.

      Admin code can explicitly request them with:
      .select('+ownerName +ownerPhone +ownerEmail +ownerNote')
    */
    ownerName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
      select: false,
    },

    ownerPhone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
      select: false,
    },

    ownerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      select: false,
    },

    ownerNote: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: '',
      select: false,
    },

    /*
      Uploaded business imagery.
    */
    coverImage: {
      type: businessImageSchema,
      default: null,
    },

    galleryImages: {
      type: [businessImageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/*
  Text search index for the public directory.
*/
businessSchema.index({
  businessName: 'text',
  description: 'text',
  services: 'text',
  town: 'text',
});

export const Business = mongoose.model('Business', businessSchema);

