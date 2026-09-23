import express from 'express';
import mongoose from 'mongoose';
import { Business } from '../models/Business.js';

export const publicRouter = express.Router();

/*
  GET /api/businesses

  Public business directory endpoint.

  Supported query parameters:
    ?category=food
    ?area=northampton
    ?search=restaurant
    ?sort=featured
    ?sort=rating
    ?sort=recent
    ?sort=name
    ?limit=24
    ?skip=0
*/
publicRouter.get('/', async (req, res) => {
  const {
    category,
    area,
    search,
    sort = 'recent',
  } = req.query;

  const filter = {};

  /*
    Optional category filter.
  */
  if (category) {
    filter.categoryKey = String(category).trim();
  }

  /*
    Optional area filter.
  */
  if (area) {
    filter.areaKey = String(area).trim();
  }

  /*
    Optional text search.
  */
  const cleanSearch = String(search || '').trim();

  if (cleanSearch) {
    filter.$text = {
      $search: cleanSearch,
    };
  }

  /*
    Sorting options.
  */
  const sortMap = {
    featured: {
      featured: -1,
      createdAt: -1,
    },

    rating: {
      rating: -1,
      reviewCount: -1,
      businessName: 1,
    },

    recent: {
      createdAt: -1,
    },

    name: {
      businessName: 1,
    },
  };

  const sortOption =
    sortMap[String(sort)] || sortMap.recent;

  /*
    Pagination.

    Keep the public limit reasonably small so one request
    cannot return an unnecessarily large dataset.
  */
  const requestedLimit = Number(req.query.limit);
  const requestedSkip = Number(req.query.skip);

  const limit = Math.min(
    Math.max(
      Number.isFinite(requestedLimit)
        ? requestedLimit
        : 24,
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

  /*
    Count and retrieve in parallel.
  */
  const [businesses, total] = await Promise.all([
    Business.find(filter)
      /*
        These fields are already select:false in Business.js,
        but we explicitly exclude them here as an additional
        safeguard for public responses.
      */
      .select(
        '-ownerName -ownerPhone -ownerEmail -ownerNote'
      )
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean(),

    Business.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    total,
    count: businesses.length,
    skip,
    limit,
    businesses,
  });
});


/*
  GET /api/businesses/:id

  The identifier can be either:
    - MongoDB ObjectId
    - business slug
*/
publicRouter.get('/:id', async (req, res) => {
  const identifier = String(
    req.params.id || ''
  ).trim();

  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: 'Business identifier is required.',
    });
  }

  const filter = mongoose.isValidObjectId(identifier)
    ? { _id: identifier }
    : { slug: identifier };

  const business = await Business.findOne(filter)
    .select(
      '-ownerName -ownerPhone -ownerEmail -ownerNote'
    )
    .lean();

  if (!business) {
    return res.status(404).json({
      success: false,
      message: 'Business not found.',
    });
  }

  return res.json({
    success: true,
    business,
  });
});

