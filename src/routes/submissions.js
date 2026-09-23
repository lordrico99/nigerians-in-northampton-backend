import express from 'express';

import { z } from 'zod';

import { BusinessSubmission } from '../models/BusinessSubmission.js';

import { parseBoolean, parseList, parseNumber, parseObject } from '../utils/parse.js';

import { fileRecord } from '../utils/files.js';

import { makeReference } from '../utils/reference.js';

import { env } from '../config/env.js';

import { uploadBusinessImages } from '../middleware/upload.js';

import { requireUser } from '../middleware/requireUser.js';

export const submissionRouter = express.Router();

const submissionSchema = z.object({
  businessName: z.string().trim().min(2).max(120),

  categoryKey: z.string().trim().min(1).max(80),

  areaKey: z.string().trim().min(1).max(80),

  description: z.string().trim().min(20).max(4000),

  phone: z.string().trim().max(40).optional().default(''),

  whatsappNumber: z.string().trim().max(40).optional().default(''),

  email: z.string().trim().email().max(160).optional().or(z.literal('')).default(''),

  website: z.string().trim().url().max(500).optional().or(z.literal('')).default(''),

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

submissionRouter.post(
  '/',
  requireUser,
  uploadBusinessImages,
  async (req, res) => {
    const { coverImage, galleryImages } = getUploadedFiles(req.files);

    if (!coverImage) {
      return res.status(400).json({
        success: false,
        message: 'A cover image is required.',
      });
    }

    const parsed = submissionSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Please correct the highlighted submission fields.',
        errors: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const data = {
      ...parsed.data,

      // Link this submission to the logged-in member
      userId: req.user._id,

      services: parseList(req.body.services),

      hasWhatsApp: parseBoolean(req.body.hasWhatsApp),

      hasOnline: parseBoolean(req.body.hasOnline),

      hasBooking: parseBoolean(req.body.hasBooking),

      lat: parseNumber(req.body.lat),

      lng: parseNumber(req.body.lng),

      hours: parseObject(req.body.hours, {}),

      reference: makeReference(),

      coverImage: fileRecord(coverImage, env.publicBaseUrl),

      galleryImages: galleryImages.map((file) =>
        fileRecord(file, env.publicBaseUrl)
      ),
    };

    if (data.hasWhatsApp && !data.whatsappNumber) {
      return res.status(400).json({
        success: false,
        message:
          'WhatsApp number is required when WhatsApp is enabled.',
      });
    }

    const submission = await BusinessSubmission.create(data);

    res.status(201).json({
      success: true,
      message: 'Business submission received and is pending review.',
      submission: {
        id: submission._id,
        reference: submission.reference,
        status: submission.status,
        createdAt: submission.createdAt,
      },
    });
  }
);