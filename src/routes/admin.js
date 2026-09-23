import express from 'express';
import mongoose from 'mongoose';
import { BusinessSubmission } from '../models/BusinessSubmission.js';
import { Business } from '../models/Business.js';
import { uniqueSlug } from '../utils/slug.js';

export const adminRouter = express.Router();

const allowedStatuses = new Set([
  'pending',
  'approved',
  'rejected',
  'changes_requested',
]);

const allowedTransitions = {
  pending: new Set([
    'pending',
    'approved',
    'rejected',
    'changes_requested',
  ]),

  changes_requested: new Set([
    'pending',
    'approved',
    'rejected',
    'changes_requested',
  ]),

  rejected: new Set([
    'pending',
    'approved',
    'rejected',
    'changes_requested',
  ]),

  approved: new Set([
    'approved',
  ]),
};

function cleanReviewNote(value) {
  return String(value ?? '').trim().slice(0, 2000);
}

/*
  GET /api/business-submissions

  Admin list of submissions with optional status filtering.

  Examples:
  /api/business-submissions
  /api/business-submissions?status=pending
  /api/business-submissions?status=rejected&limit=20
*/
adminRouter.get('/business-submissions', async (req, res) => {
  const filter = {};

  if (req.query.status) {
    const status = String(req.query.status).trim();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status filter.',
      });
    }

    filter.status = status;
  }

  const requestedLimit = Number(req.query.limit);
  const requestedSkip = Number(req.query.skip);

  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1),
    100
  );

  const skip = Math.max(
    Number.isFinite(requestedSkip) ? requestedSkip : 0,
    0
  );

  const [submissions, total] = await Promise.all([
    BusinessSubmission.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    BusinessSubmission.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    total,
    skip,
    limit,
    submissions,
  });
});


/*
  GET /api/business-submissions/:reference

  Get one complete submission for admin review.
*/
adminRouter.get('/business-submissions/:reference', async (req, res) => {
  const reference = String(req.params.reference).trim();

  const submission = await BusinessSubmission
    .findOne({ reference })
    .lean();

  if (!submission) {
    return res.status(404).json({
      success: false,
      message: 'Submission not found.',
    });
  }

  return res.json({
    success: true,
    submission,
  });
});


/*
  PATCH /api/business-submissions/:reference/status

  Change review status.

  Body:
  {
    "status": "approved",
    "note": "Approved for publication."
  }

  Approval workflow:

  BusinessSubmission
        ↓
      approved
        ↓
  Business document created
        ↓
  Public directory
*/
adminRouter.patch(
  '/business-submissions/:reference/status',
  async (req, res) => {
    const reference = String(req.params.reference).trim();

    const requestedStatus = String(
      req.body?.status || ''
    ).trim();

    const note = cleanReviewNote(req.body?.note);

    if (!allowedStatuses.has(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review status.',
      });
    }

    /*
      A MongoDB transaction ensures that when approving a submission,
      both the submission status and Business document are committed
      together.

      This prevents:
        submission = approved
        business = missing

      or:

        business = created
        submission = still pending
    */
    const session = await mongoose.startSession();

    let responsePayload = null;

    try {
      await session.withTransaction(async () => {
        const submission = await BusinessSubmission
          .findOne({ reference })
          .session(session);

        if (!submission) {
          const error = new Error('Submission not found.');
          error.statusCode = 404;
          throw error;
        }

        const currentStatus = submission.status;

        /*
          Prevent an already-published submission from being changed
          to rejected/changes_requested without a separate unpublish
          workflow.

          This protects the public Business collection from becoming
          inconsistent with the submission record.
        */
        if (
          !allowedTransitions[currentStatus]?.has(requestedStatus)
        ) {
          const error = new Error(
            `Cannot change submission from "${currentStatus}" to "${requestedStatus}".`
          );

          error.statusCode = 409;
          throw error;
        }

        /*
          APPROVAL
        */
        if (requestedStatus === 'approved') {
          let business = await Business
            .findOne({
              submissionReference: submission.reference,
            })
            .session(session);

          /*
            If the business already exists, do not create a duplicate.
            This also allows an accidentally repeated approval request
            to be handled safely.
          */
          if (!business) {
            /*
              Generate the public slug before creating the Business.
            */
            const slug = await uniqueSlug(
              Business,
              submission.businessName
            );

            business = new Business({
              submissionReference: submission.reference,

              slug,

              featured: false,
              rating: 0,
              reviewCount: 0,

              businessName: submission.businessName,
              categoryKey: submission.categoryKey,
              areaKey: submission.areaKey,
              description: submission.description,
              services: submission.services,

              phone: submission.phone,
              whatsappNumber: submission.whatsappNumber,
              email: submission.email,
              website: submission.website,

              hasWhatsApp: submission.hasWhatsApp,
              hasOnline: submission.hasOnline,
              hasBooking: submission.hasBooking,

              address: submission.address,
              postcode: submission.postcode,
              town: submission.town,
              lat: submission.lat,
              lng: submission.lng,

              hours: submission.hours,

              /*
                These fields are private and are protected by
                select: false in Business.js.
              */
              ownerName: submission.ownerName,
              ownerPhone: submission.ownerPhone,
              ownerEmail: submission.ownerEmail,
              ownerNote: submission.ownerNote,

              coverImage: submission.coverImage,
              galleryImages: submission.galleryImages,
            });

            await business.save({ session });
          }

          /*
            Only mark the submission approved after the Business
            document exists successfully.
          */
          submission.status = 'approved';
          submission.reviewNote = note;
          submission.reviewedAt = new Date();

          await submission.save({ session });

          responsePayload = {
            success: true,
            message: business
              ? 'Submission approved and published.'
              : 'Submission approved.',
            business,
          };

          return;
        }

        /*
          NON-APPROVAL STATUS

          Normally a pending/rejected/changes_requested submission
          should not already have a Business document.

          Protect against an inconsistent database state.
        */
        const existingBusiness = await Business
          .findOne({
            submissionReference: submission.reference,
          })
          .session(session);

        if (existingBusiness) {
          const error = new Error(
            'This submission already has a published business record. Use a separate unpublish workflow before changing its review status.'
          );

          error.statusCode = 409;
          throw error;
        }

        submission.status = requestedStatus;
        submission.reviewNote = note;
        submission.reviewedAt = new Date();

        await submission.save({ session });

        responsePayload = {
          success: true,
          message: `Submission marked as ${requestedStatus}.`,
          submission,
        };
      });

      return res.json(responsePayload);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      console.error(
        'Admin submission status update failed:',
        error
      );

      return res.status(statusCode).json({
        success: false,
        message:
          statusCode === 500
            ? 'Unable to update submission status.'
            : error.message,
      });
    } finally {
      await session.endSession();
    }
  }
);

