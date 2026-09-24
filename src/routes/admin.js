import express from 'express';
import mongoose from 'mongoose';

import { BusinessSubmission } from '../models/BusinessSubmission.js';
import { Business } from '../models/Business.js';
import { BusinessChangeRequest } from '../models/BusinessChangeRequest.js';
import { BusinessRemovalRequest } from '../models/BusinessRemovalRequest.js';

import { uniqueSlug } from '../utils/slug.js';

export const adminRouter = express.Router();

/*
  ============================================================
  CONSTANTS
  ============================================================
*/

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

const changeRequestTransitions = {
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

const removalRequestTransitions = {
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


/*
  ============================================================
  HELPERS
  ============================================================
*/

function cleanReviewNote(value) {
  return String(value ?? '')
    .trim()
    .slice(0, 2000);
}

function getReviewNote(req) {
  /*
    Supports both:
      { note: "..." }
    and:
      { reviewNote: "..." }

    Your current admin frontend sends reviewNote.
  */
  return cleanReviewNote(
    req.body?.reviewNote ??
    req.body?.note ??
    ''
  );
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(
    String(value || '')
  );
}

function getListPagination(req) {
  const requestedLimit = Number(req.query.limit);
  const requestedSkip = Number(req.query.skip);

  const limit = Math.min(
    Math.max(
      Number.isFinite(requestedLimit)
        ? requestedLimit
        : 50,
      1
    ),
    100
  );

  const skip = Math.max(
    Number.isFinite(requestedSkip)
      ? requestedSkip
      : 0,
    0
  );

  return {
    limit,
    skip,
  };
}

/*
  Only these fields may be changed by a business owner.
  Administrative/public directory controls such as featured,
  rating, reviewCount and slug remain under admin control.
*/
const editableBusinessFields = [
  'businessName',
  'categoryKey',
  'areaKey',
  'description',
  'services',
  'phone',
  'whatsappNumber',
  'email',
  'website',
  'hasWhatsApp',
  'hasOnline',
  'hasBooking',
  'address',
  'postcode',
  'town',
  'lat',
  'lng',
  'hours',
  'ownerName',
  'ownerPhone',
  'ownerEmail',
  'ownerNote',
  'coverImage',
  'galleryImages',
];

function applyProposedBusinessData(
  business,
  proposedData = {}
) {
  for (
    const field of editableBusinessFields
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        proposedData,
        field
      )
    ) {
      business[field] =
        proposedData[field];
    }
  }

  return business;
}


/*
  ============================================================
  BUSINESS SUBMISSIONS
  ============================================================
*/

/*
  GET /api/business-submissions

  Admin list of submissions.

  Examples:
    /api/business-submissions
    /api/business-submissions?status=pending
    /api/business-submissions?status=rejected&limit=20
*/
adminRouter.get(
  '/business-submissions',
  async (req, res) => {
    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      ).trim();

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid status filter.',
        });
      }

      filter.status = status;
    }

    const { limit, skip } =
      getListPagination(req);

    const [
      submissions,
      total,
    ] = await Promise.all([
      BusinessSubmission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      BusinessSubmission.countDocuments(
        filter
      ),
    ]);

    return res.json({
      success: true,
      total,
      skip,
      limit,
      submissions,
    });
  }
);


/*
  GET /api/business-submissions/:reference

  Get one complete submission for admin review.
*/
adminRouter.get(
  '/business-submissions/:reference',
  async (req, res) => {
    const reference = String(
      req.params.reference
    ).trim();

    const submission =
      await BusinessSubmission
        .findOne({ reference })
        .lean();

    if (!submission) {
      return res.status(404).json({
        success: false,
        message:
          'Submission not found.',
      });
    }

    return res.json({
      success: true,
      submission,
    });
  }
);


/*
  PATCH /api/business-submissions/:reference/status

  Change submission review status.

  Body may contain:
  {
    "status": "approved",
    "reviewNote": "Approved for publication."
  }

  or:

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
    const reference = String(
      req.params.reference
    ).trim();

    const requestedStatus = String(
      req.body?.status || ''
    ).trim();

    const note = getReviewNote(req);

    if (
      !allowedStatuses.has(
        requestedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid review status.',
      });
    }

    const session =
      await mongoose.startSession();

    let responsePayload = null;

    try {
      await session.withTransaction(
        async () => {
          const submission =
            await BusinessSubmission
              .findOne({ reference })
              .session(session);

          if (!submission) {
            const error = new Error(
              'Submission not found.'
            );

            error.statusCode = 404;
            throw error;
          }

          const currentStatus =
            submission.status;

          if (
            !allowedTransitions[
              currentStatus
            ]?.has(requestedStatus)
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
          if (
            requestedStatus ===
            'approved'
          ) {
            let business =
              await Business.findOne({
                submissionReference:
                  submission.reference,
              }).session(session);

            /*
              Existing published business:
              do not create a duplicate.

              If the old record does not yet have
              a userId and this submission does,
              backfill ownership.

              If the existing business belongs
              to another account, stop.
            */
            if (business) {
              if (
                business.userId &&
                submission.userId &&
                String(
                  business.userId
                ) !== String(
                  submission.userId
                )
              ) {
                const error =
                  new Error(
                    'This submission is already linked to a different business owner.'
                  );

                error.statusCode = 409;
                throw error;
              }

              if (
                !business.userId &&
                submission.userId
              ) {
                business.userId =
                  submission.userId;

                await business.save({
                  session,
                });
              }
            } else {
              /*
                Generate a public slug.
              */
              const slug =
                await uniqueSlug(
                  Business,
                  submission.businessName
                );

              business =
                new Business({
                  /*
                    IMPORTANT:
                    Preserve account ownership.
                  */
                  userId:
                    submission.userId ||
                    null,

                  submissionReference:
                    submission.reference,

                  slug,

                  featured: false,
                  rating: 0,
                  reviewCount: 0,

                  businessName:
                    submission.businessName,

                  categoryKey:
                    submission.categoryKey,

                  areaKey:
                    submission.areaKey,

                  description:
                    submission.description,

                  services:
                    submission.services,

                  phone:
                    submission.phone,

                  whatsappNumber:
                    submission.whatsappNumber,

                  email:
                    submission.email,

                  website:
                    submission.website,

                  hasWhatsApp:
                    submission.hasWhatsApp,

                  hasOnline:
                    submission.hasOnline,

                  hasBooking:
                    submission.hasBooking,

                  address:
                    submission.address,

                  postcode:
                    submission.postcode,

                  town:
                    submission.town,

                  lat:
                    submission.lat,

                  lng:
                    submission.lng,

                  hours:
                    submission.hours,

                  /*
                    Private owner details.
                  */
                  ownerName:
                    submission.ownerName,

                  ownerPhone:
                    submission.ownerPhone,

                  ownerEmail:
                    submission.ownerEmail,

                  ownerNote:
                    submission.ownerNote,

                  coverImage:
                    submission.coverImage,

                  galleryImages:
                    submission.galleryImages,
                });

              await business.save({
                session,
              });
            }

            /*
              Only mark the submission approved
              after the Business exists successfully.
            */
            submission.status =
              'approved';

            submission.reviewNote =
              note;

            submission.reviewedAt =
              new Date();

            await submission.save({
              session,
            });

            responsePayload = {
              success: true,
              message:
                'Submission approved and published.',
              business,
            };

            return;
          }

          /*
            NON-APPROVAL STATUS

            An already published business cannot be
            switched into rejected/changes_requested
            through this endpoint.
          */
          const existingBusiness =
            await Business.findOne({
              submissionReference:
                submission.reference,
            }).session(session);

          if (existingBusiness) {
            const error =
              new Error(
                'This submission already has a published business record. Use the business management workflow instead.'
              );

            error.statusCode = 409;
            throw error;
          }

          submission.status =
            requestedStatus;

          submission.reviewNote =
            note;

          submission.reviewedAt =
            new Date();

          await submission.save({
            session,
          });

          responsePayload = {
            success: true,
            message:
              `Submission marked as ${requestedStatus}.`,
            submission,
          };
        }
      );

      return res.json(
        responsePayload
      );
    } catch (error) {
      const statusCode =
        error.statusCode || 500;

      console.error(
        'Admin submission status update failed:',
        error
      );

      return res.status(
        statusCode
      ).json({
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


/*
  ============================================================
  BUSINESS CHANGE REQUESTS
  ============================================================
*/

/*
  GET /api/business-change-requests

  Admin list of member-requested changes.
*/
adminRouter.get(
  '/business-change-requests',
  async (req, res) => {
    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      ).trim();

      if (
        !allowedStatuses.has(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid status filter.',
        });
      }

      filter.status = status;
    }

    const { limit, skip } =
      getListPagination(req);

    const [
      requests,
      total,
    ] = await Promise.all([
      BusinessChangeRequest.find(
        filter
      )
        .populate(
          'businessId',
          'businessName slug submissionReference'
        )
        .populate(
          'userId',
          'name email role status'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      BusinessChangeRequest.countDocuments(
        filter
      ),
    ]);

    return res.json({
      success: true,
      total,
      skip,
      limit,
      changeRequests: requests,
    });
  }
);


/*
  GET /api/business-change-requests/:id

  Get one complete change request.
*/
adminRouter.get(
  '/business-change-requests/:id',
  async (req, res) => {
    const id = String(
      req.params.id
    ).trim();

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid change request identifier.',
      });
    }

    const request =
      await BusinessChangeRequest.findById(
        id
      )
        .populate(
          'businessId'
        )
        .populate(
          'userId',
          'name email role status'
        )
        .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Change request not found.',
      });
    }

    return res.json({
      success: true,
      changeRequest: request,
    });
  }
);


/*
  PATCH /api/business-change-requests/:id/status

  Admin action on a member change request.

  Approved:
      proposedData → Business
      proposedData → BusinessSubmission
      request → approved
*/
adminRouter.patch(
  '/business-change-requests/:id/status',
  async (req, res) => {
    const id = String(
      req.params.id
    ).trim();

    const requestedStatus =
      String(
        req.body?.status || ''
      ).trim();

    const note =
      getReviewNote(req);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid change request identifier.',
      });
    }

    if (
      !allowedStatuses.has(
        requestedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid review status.',
      });
    }

    const session =
      await mongoose.startSession();

    try {
      let responsePayload = null;

      await session.withTransaction(
        async () => {
          const request =
            await BusinessChangeRequest
              .findById(id)
              .session(session);

          if (!request) {
            const error = new Error(
              'Change request not found.'
            );

            error.statusCode = 404;
            throw error;
          }

          const currentStatus =
            request.status;

          if (
            !changeRequestTransitions[
              currentStatus
            ]?.has(requestedStatus)
          ) {
            const error = new Error(
              `Cannot change request from "${currentStatus}" to "${requestedStatus}".`
            );

            error.statusCode = 409;
            throw error;
          }

          /*
            Once approved, do not apply it again.
          */
          if (
            requestedStatus ===
            'approved'
          ) {
            const business =
              await Business.findOne({
                _id: request.businessId,
                userId: request.userId,
              }).session(session);

            if (!business) {
              const error =
                new Error(
                  'The business associated with this change request could not be found or does not belong to the requesting member.'
                );

              error.statusCode = 404;
              throw error;
            }

            /*
              Apply only the permitted
              business-owner fields.
            */
            applyProposedBusinessData(
              business,
              request.proposedData
            );

            await business.save({
              session,
            });

            /*
              Keep the approved submission
              record synchronized with the
              published Business record.
            */
            const submission =
              await BusinessSubmission
                .findOne({
                  reference:
                    business.submissionReference,
                })
                .session(session);

            if (submission) {
              applyProposedBusinessData(
                submission,
                request.proposedData
              );

              /*
                The submission remains approved.
              */
              submission.status =
                'approved';

              submission.reviewNote =
                note;

              submission.reviewedAt =
                new Date();

              await submission.save({
                session,
              });
            }

            request.status =
              'approved';

            request.reviewNote =
              note;

            request.reviewedAt =
              new Date();

            await request.save({
              session,
            });

            responsePayload = {
              success: true,
              message:
                'Business changes approved and published.',
              business,
              changeRequest: request,
            };

            return;
          }

          /*
            Request still pending / rejected /
            changes requested.
          */
          request.status =
            requestedStatus;

          request.reviewNote =
            note;

          request.reviewedAt =
            new Date();

          await request.save({
            session,
          });

          responsePayload = {
            success: true,
            message:
              `Change request marked as ${requestedStatus}.`,
            changeRequest: request,
          };
        }
      );

      return res.json(
        responsePayload
      );
    } catch (error) {
      const statusCode =
        error.statusCode || 500;

      console.error(
        'Admin business change request update failed:',
        error
      );

      return res.status(
        statusCode
      ).json({
        success: false,
        message:
          statusCode === 500
            ? 'Unable to update the business change request.'
            : error.message,
      });
    } finally {
      await session.endSession();
    }
  }
);


/*
  ============================================================
  BUSINESS REMOVAL REQUESTS
  ============================================================
*/

/*
  GET /api/business-removal-requests

  Admin list of member removal requests.
*/
adminRouter.get(
  '/business-removal-requests',
  async (req, res) => {
    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      ).trim();

      if (
        !allowedStatuses.has(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid status filter.',
        });
      }

      filter.status = status;
    }

    const { limit, skip } =
      getListPagination(req);

    const [
      requests,
      total,
    ] = await Promise.all([
      BusinessRemovalRequest.find(
        filter
      )
        .populate(
          'businessId',
          'businessName slug submissionReference'
        )
        .populate(
          'userId',
          'name email role status'
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      BusinessRemovalRequest.countDocuments(
        filter
      ),
    ]);

    return res.json({
      success: true,
      total,
      skip,
      limit,
      removalRequests: requests,
    });
  }
);


/*
  GET /api/business-removal-requests/:id

  Get one complete removal request.
*/
adminRouter.get(
  '/business-removal-requests/:id',
  async (req, res) => {
    const id = String(
      req.params.id
    ).trim();

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid removal request identifier.',
      });
    }

    const request =
      await BusinessRemovalRequest
        .findById(id)
        .populate(
          'businessId'
        )
        .populate(
          'userId',
          'name email role status'
        )
        .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message:
          'Removal request not found.',
      });
    }

    return res.json({
      success: true,
      removalRequest: request,
    });
  }
);


/*
  PATCH /api/business-removal-requests/:id/status

  Admin action on a member removal request.

  Approved:
      Business is removed
      Removal request becomes approved
*/
adminRouter.patch(
  '/business-removal-requests/:id/status',
  async (req, res) => {
    const id = String(
      req.params.id
    ).trim();

    const requestedStatus =
      String(
        req.body?.status || ''
      ).trim();

    const note =
      getReviewNote(req);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid removal request identifier.',
      });
    }

    if (
      !allowedStatuses.has(
        requestedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid review status.',
      });
    }

    const session =
      await mongoose.startSession();

    try {
      let responsePayload = null;

      await session.withTransaction(
        async () => {
          const request =
            await BusinessRemovalRequest
              .findById(id)
              .session(session);

          if (!request) {
            const error = new Error(
              'Removal request not found.'
            );

            error.statusCode = 404;
            throw error;
          }

          const currentStatus =
            request.status;

          if (
            !removalRequestTransitions[
              currentStatus
            ]?.has(requestedStatus)
          ) {
            const error = new Error(
              `Cannot change removal request from "${currentStatus}" to "${requestedStatus}".`
            );

            error.statusCode = 409;
            throw error;
          }

          /*
            APPROVE REMOVAL
          */
          if (
            requestedStatus ===
            'approved'
          ) {
            const business =
              await Business.findOne({
                _id: request.businessId,
                userId: request.userId,
              }).session(session);

            if (!business) {
              const error =
                new Error(
                  'The business associated with this removal request could not be found or does not belong to the requesting member.'
                );

              error.statusCode = 404;
              throw error;
            }

            const submission =
              await BusinessSubmission
                .findOne({
                  reference:
                    business.submissionReference,
                })
                .session(session);

            /*
              Remove the public business.
            */
            await Business.deleteOne({
              _id: business._id,
            }).session(session);

            /*
              Keep the approved submission record
              for history/account ownership.

              We deliberately do not change its status
              to rejected because the original listing
              really was approved.
            */
            if (submission) {
              submission.reviewNote =
                note ||
                'Public listing removed after owner request.';

              submission.reviewedAt =
                new Date();

              await submission.save({
                session,
              });
            }

            /*
              Any outstanding change requests against
              the deleted business can no longer be applied.
            */
            await BusinessChangeRequest.updateMany(
              {
                businessId:
                  business._id,
                status: {
                  $in: [
                    'pending',
                    'changes_requested',
                  ],
                },
              },
              {
                $set: {
                  status: 'rejected',
                  reviewNote:
                    'The business listing was removed.',
                  reviewedAt: new Date(),
                },
              }
            ).session(session);

            request.status =
              'approved';

            request.reviewNote =
              note;

            request.reviewedAt =
              new Date();

            await request.save({
              session,
            });

            responsePayload = {
              success: true,
              message:
                'Business listing removed successfully.',
              removalRequest:
                request,
            };

            return;
          }

          /*
            NON-APPROVAL STATUS
          */
          request.status =
            requestedStatus;

          request.reviewNote =
            note;

          request.reviewedAt =
            new Date();

          await request.save({
            session,
          });

          responsePayload = {
            success: true,
            message:
              `Removal request marked as ${requestedStatus}.`,
            removalRequest:
              request,
          };
        }
      );

      return res.json(
        responsePayload
      );
    } catch (error) {
      const statusCode =
        error.statusCode || 500;

      console.error(
        'Admin business removal request update failed:',
        error
      );

      return res.status(
        statusCode
      ).json({
        success: false,
        message:
          statusCode === 500
            ? 'Unable to update the business removal request.'
            : error.message,
      });
    } finally {
      await session.endSession();
    }
  }
);