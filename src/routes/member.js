import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { Business } from '../models/Business.js';
import { BusinessSubmission } from '../models/BusinessSubmission.js';
import { BusinessChangeRequest } from '../models/BusinessChangeRequest.js';
import { BusinessRemovalRequest } from '../models/BusinessRemovalRequest.js';

import {
  parseBoolean,
  parseList,
  parseNumber,
  parseObject,
} from '../utils/parse.js';

import { fileRecord } from '../utils/files.js';
import { env } from '../config/env.js';
import { uploadBusinessImages } from '../middleware/upload.js';
import { requireUser } from '../middleware/requireUser.js';

export const memberRouter = express.Router();

const submissionSchema = z.object({
  businessName: z.string().trim().min(2).max(120),

  categoryKey: z.string().trim().min(1).max(80),

  areaKey: z.string().trim().min(1).max(80),

  description: z.string().trim().min(20).max(4000),

  phone: z.string().trim().max(40).optional().default(''),

  whatsappNumber: z.string().trim().max(40).optional().default(''),

  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .optional()
    .or(z.literal(''))
    .default(''),

  website: z
    .string()
    .trim()
    .url()
    .max(500)
    .optional()
    .or(z.literal(''))
    .default(''),

  address: z.string().trim().max(250).optional().default(''),

  postcode: z.string().trim().max(20).optional().default(''),

  town: z.string().trim().max(100).optional().default(''),

  ownerName: z.string().trim().min(2).max(120),

  ownerPhone: z.string().trim().min(5).max(40),

  ownerEmail: z.string().trim().email().max(160),

  ownerNote: z.string().trim().max(1500).optional().default(''),
});

function getUploadedFiles(files = {}) {
  return {
    coverImage: files.coverImage?.[0] || null,
    galleryImages: files.galleryImages || [],
  };
}

function validationErrorResponse(res, parsed) {
  return res.status(400).json({
    success: false,
    message: 'Please correct the highlighted submission fields.',
    errors: parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

function buildEditableData({
  parsedData,
  req,
  existingCoverImage = null,
  existingGalleryImages = [],
}) {
  const { coverImage, galleryImages } = getUploadedFiles(req.files);

  return {
    businessName: parsedData.businessName,
    categoryKey: parsedData.categoryKey,
    areaKey: parsedData.areaKey,
    description: parsedData.description,

    services: parseList(req.body.services),

    phone: parsedData.phone,
    whatsappNumber: parsedData.whatsappNumber,
    email: parsedData.email,
    website: parsedData.website,

    hasWhatsApp: parseBoolean(req.body.hasWhatsApp),
    hasOnline: parseBoolean(req.body.hasOnline),
    hasBooking: parseBoolean(req.body.hasBooking),

    address: parsedData.address,
    postcode: parsedData.postcode,
    town: parsedData.town,

    lat: parseNumber(req.body.lat),
    lng: parseNumber(req.body.lng),

    hours: parseObject(req.body.hours, {}),

    ownerName: parsedData.ownerName,
    ownerPhone: parsedData.ownerPhone,
    ownerEmail: parsedData.ownerEmail,
    ownerNote: parsedData.ownerNote,

    coverImage: coverImage
      ? fileRecord(coverImage, env.publicBaseUrl)
      : existingCoverImage,

    galleryImages: galleryImages.length
      ? galleryImages.map((file) =>
          fileRecord(file, env.publicBaseUrl)
        )
      : existingGalleryImages,
  };
}


/*
  GET /api/my/businesses

  Returns only businesses/submissions belonging to
  the currently authenticated member.
*/
/*
  GET /api/my/businesses

  Returns all businesses/submissions belonging to the
  currently authenticated member.

  Also recovers older records that were created before
  userId ownership was introduced, using the account
  email as a one-time ownership recovery mechanism.
*/
memberRouter.get(
  '/my/businesses',
  requireUser,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      const email = String(req.user.email || '')
        .trim()
        .toLowerCase();

      /*
        Current records already linked to this account.
      */
      const [
        currentSubmissions,
        currentBusinesses,
      ] = await Promise.all([
        BusinessSubmission.find({
          userId,
        })
          .sort({ createdAt: -1 })
          .lean(),

        Business.find({
          userId,
        })
          .select(
            '+ownerName +ownerPhone +ownerEmail +ownerNote'
          )
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      /*
        Recover legacy submissions that were created
        before userId was being stored.
      */
      const legacySubmissions = email
        ? await BusinessSubmission.find({
            ownerEmail: email,
            $or: [
              { userId: null },
              { userId: { $exists: false } },
            ],
          })
            .sort({ createdAt: -1 })
            .lean()
        : [];

      /*
        Recover legacy published businesses in the same way.
        ownerEmail is select:false in the Business model,
        so it must be explicitly selected.
      */
      const legacyBusinesses = email
        ? await Business.find({
            ownerEmail: email,
            $or: [
              { userId: null },
              { userId: { $exists: false } },
            ],
          })
            .select(
              '+ownerName +ownerPhone +ownerEmail +ownerNote'
            )
            .sort({ createdAt: -1 })
            .lean()
        : [];

      /*
        Permanently link recovered legacy records to the
        authenticated account.
      */
      if (legacySubmissions.length) {
        await BusinessSubmission.updateMany(
          {
            _id: {
              $in: legacySubmissions.map(
                (submission) => submission._id
              ),
            },
          },
          {
            $set: {
              userId,
            },
          }
        );
      }

      if (legacyBusinesses.length) {
        await Business.updateMany(
          {
            _id: {
              $in: legacyBusinesses.map(
                (business) => business._id
              ),
            },
          },
          {
            $set: {
              userId,
            },
          }
        );
      }

      /*
        Merge current + recovered records without duplicates.
      */
      const submissionMap = new Map();

      [
        ...currentSubmissions,
        ...legacySubmissions,
      ].forEach((submission) => {
        submissionMap.set(
          String(submission._id),
          {
            ...submission,
            userId,
          }
        );
      });

      const businessMap = new Map();

      [
        ...currentBusinesses,
        ...legacyBusinesses,
      ].forEach((business) => {
        businessMap.set(
          String(business._id),
          {
            ...business,
            userId,
          }
        );
      });

      const submissions = Array.from(
        submissionMap.values()
      );

      const businesses = Array.from(
        businessMap.values()
      );

      /*
        Match published businesses back to their submission
        using submissionReference.
      */
      const businessesByReference = new Map();

      businesses.forEach((business) => {
        const reference = String(
          business.submissionReference || ''
        ).trim();

        if (reference) {
          businessesByReference.set(
            reference,
            business
          );
        }
      });

      /*
        Build the member listing collection from submissions.
      */
      const items = submissions.map((submission) => {
        const business =
          businessesByReference.get(
            String(submission.reference || '').trim()
          ) || null;

        return {
          ...submission,

          businessId:
            business?._id || null,

          businessSlug:
            business?.slug || null,

          publishedBusiness:
            business,
        };
      });

      /*
        IMPORTANT:
        Also include published businesses that do not have a
        matching BusinessSubmission record.

        This is what prevents an existing published listing
        from disappearing from the member account page.
      */
      const representedBusinessIds = new Set(
        items
          .map((item) =>
            String(item.businessId || '')
          )
          .filter(Boolean)
      );

      businesses.forEach((business) => {
        const businessId = String(
          business._id || ''
        );

        if (
          businessId &&
          !representedBusinessIds.has(businessId)
        ) {
          items.push({
            ...business,

            status: 'approved',

            reference:
              business.submissionReference || '',

            businessId:
              business._id,

            businessSlug:
              business.slug || null,

            publishedBusiness:
              business,
          });
        }
      });

      /*
        Newest items first.
      */
      items.sort((a, b) => {
        const dateA = new Date(
          a.updatedAt ||
          a.createdAt ||
          0
        ).getTime();

        const dateB = new Date(
          b.updatedAt ||
          b.createdAt ||
          0
        ).getTime();

        return dateB - dateA;
      });

      return res.json({
        success: true,

        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          status: req.user.status,
        },

        listings: items,
      });
    } catch (error) {
      return next(error);
    }
  }
);


/*
  POST /api/business-submissions/:reference/resubmit

  Member edits a rejected / changes_requested submission
  and sends it back into the admin review queue.
*/
memberRouter.post(
  '/business-submissions/:reference/resubmit',
  requireUser,
  uploadBusinessImages,
  async (req, res) => {
    const reference = String(
      req.params.reference
    ).trim();

    const submission =
      await BusinessSubmission.findOne({
        reference,
        userId: req.user._id,
      });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Your business submission was not found.',
      });
    }

    if (
      ![
        'rejected',
        'changes_requested',
      ].includes(submission.status)
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Only rejected or changes-requested submissions can be resubmitted.',
      });
    }

    const existingPending =
      await BusinessSubmission.findOne({
        userId: req.user._id,
        status: 'pending',
        _id: { $ne: submission._id },
      }).lean();

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message:
          'You already have another business submission awaiting review.',
      });
    }

    const parsed =
      submissionSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationErrorResponse(
        res,
        parsed
      );
    }

    const uploaded = getUploadedFiles(req.files);

    if (
      parseBoolean(req.body.hasWhatsApp) &&
      !parsed.data.whatsappNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          'WhatsApp number is required when WhatsApp is enabled.',
      });
    }

    if (uploaded.coverImage) {
      submission.coverImage =
        fileRecord(
          uploaded.coverImage,
          env.publicBaseUrl
        );
    }

    if (uploaded.galleryImages.length) {
      submission.galleryImages =
        uploaded.galleryImages.map((file) =>
          fileRecord(
            file,
            env.publicBaseUrl
          )
        );
    }

    Object.assign(submission, {
      ...parsed.data,

      services: parseList(
        req.body.services
      ),

      hasWhatsApp: parseBoolean(
        req.body.hasWhatsApp
      ),

      hasOnline: parseBoolean(
        req.body.hasOnline
      ),

      hasBooking: parseBoolean(
        req.body.hasBooking
      ),

      lat: parseNumber(req.body.lat),

      lng: parseNumber(req.body.lng),

      hours: parseObject(
        req.body.hours,
        {}
      ),

      status: 'pending',

      reviewNote: '',

      reviewedAt: null,

      userId: req.user._id,
    });

    await submission.save();

    return res.json({
      success: true,
      message:
        'Your updated business listing has been resubmitted and is now pending review.',
      submission: {
        id: submission._id,
        reference: submission.reference,
        status: submission.status,
        updatedAt: submission.updatedAt,
      },
    });
  }
);


/*
  POST /api/business-submissions/:reference/withdraw

  A member may withdraw a submission that is
  still pending review.
*/
memberRouter.post(
  '/business-submissions/:reference/withdraw',
  requireUser,
  async (req, res) => {
    const reference = String(
      req.params.reference
    ).trim();

    const submission =
      await BusinessSubmission.findOne({
        reference,
        userId: req.user._id,
      });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Your business submission was not found.',
      });
    }

    if (submission.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message:
          'Only a pending submission can be withdrawn.',
      });
    }

    await BusinessSubmission.deleteOne({
      _id: submission._id,
      userId: req.user._id,
    });

    return res.json({
      success: true,
      message:
        'Your pending business submission has been withdrawn.',
    });
  }
);


/*
  POST /api/businesses/:id/change-requests

  A member proposes changes to an already-published
  business. The public Business document does NOT
  change until an administrator approves the request.
*/
memberRouter.post(
  '/businesses/:id/change-requests',
  requireUser,
  uploadBusinessImages,
  async (req, res) => {
    const businessId = String(
      req.params.id
    ).trim();

    if (!mongoose.Types.ObjectId.isValid(
      businessId
    )) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business identifier.',
      });
    }

    const business =
      await Business.findOne({
        _id: businessId,
        userId: req.user._id,
      });

    if (!business) {
      return res.status(404).json({
        success: false,
        message:
          'That business does not belong to your account.',
      });
    }

    const pendingRemoval =
      await BusinessRemovalRequest.findOne({
        businessId: business._id,
        userId: req.user._id,
        status: 'pending',
      }).lean();

    if (pendingRemoval) {
      return res.status(409).json({
        success: false,
        message:
          'A removal request is already awaiting review for this business.',
      });
    }

    const parsed =
      submissionSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationErrorResponse(
        res,
        parsed
      );
    }

    const { coverImage, galleryImages } =
      getUploadedFiles(req.files);

    if (
      parseBoolean(req.body.hasWhatsApp) &&
      !parsed.data.whatsappNumber
    ) {
      return res.status(400).json({
        success: false,
        message:
          'WhatsApp number is required when WhatsApp is enabled.',
      });
    }

    const proposedData = {
      ...parsed.data,

      services: parseList(
        req.body.services
      ),

      hasWhatsApp: parseBoolean(
        req.body.hasWhatsApp
      ),

      hasOnline: parseBoolean(
        req.body.hasOnline
      ),

      hasBooking: parseBoolean(
        req.body.hasBooking
      ),

      lat: parseNumber(req.body.lat),

      lng: parseNumber(req.body.lng),

      hours: parseObject(
        req.body.hours,
        {}
      ),

      coverImage: coverImage
        ? fileRecord(
            coverImage,
            env.publicBaseUrl
          )
        : business.coverImage,

      galleryImages:
        galleryImages.length
          ? galleryImages.map((file) =>
              fileRecord(
                file,
                env.publicBaseUrl
              )
            )
          : business.galleryImages,
    };

    const existingRequest =
      await BusinessChangeRequest.findOne({
        businessId: business._id,
        userId: req.user._id,
        status: {
          $in: [
            'pending',
            'changes_requested',
          ],
        },
      }).sort({
        createdAt: -1,
      });

    let changeRequest;

    if (existingRequest) {
      existingRequest.proposedData =
        proposedData;

      existingRequest.status =
        'pending';

      existingRequest.reviewNote = '';

      existingRequest.reviewedAt =
        null;

      changeRequest =
        await existingRequest.save();
    } else {
      changeRequest =
        await BusinessChangeRequest.create({
          businessId: business._id,
          userId: req.user._id,
          proposedData,
          status: 'pending',
        });
    }

    return res.status(201).json({
      success: true,
      message:
        'Your changes have been submitted and are awaiting admin approval.',
      changeRequest: {
        id: changeRequest._id,
        businessId: changeRequest.businessId,
        status: changeRequest.status,
        createdAt: changeRequest.createdAt,
      },
    });
  }
);


/*
  POST /api/businesses/:id/removal-request

  Request removal of a published business.
*/
memberRouter.post(
  '/businesses/:id/removal-request',
  requireUser,
  async (req, res) => {
    const businessId = String(
      req.params.id
    ).trim();

    if (!mongoose.Types.ObjectId.isValid(
      businessId
    )) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business identifier.',
      });
    }

    const business =
      await Business.findOne({
        _id: businessId,
        userId: req.user._id,
      });

    if (!business) {
      return res.status(404).json({
        success: false,
        message:
          'That business does not belong to your account.',
      });
    }

    const existingRequest =
      await BusinessRemovalRequest.findOne({
        businessId: business._id,
        userId: req.user._id,
        status: 'pending',
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message:
          'A removal request for this business is already awaiting review.',
      });
    }

    const reason = String(
      req.body?.reason || ''
    )
      .trim()
      .slice(0, 1500);

    const removalRequest =
      await BusinessRemovalRequest.create({
        businessId: business._id,
        userId: req.user._id,
        reason,
        status: 'pending',
      });

    return res.status(201).json({
      success: true,
      message:
        'Your removal request has been submitted for admin review.',
      removalRequest: {
        id: removalRequest._id,
        businessId:
          removalRequest.businessId,
        status:
          removalRequest.status,
        createdAt:
          removalRequest.createdAt,
      },
    });
  }
);