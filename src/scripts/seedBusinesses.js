import mongoose from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { Business } from '../models/Business.js';
import { uniqueSlug } from '../utils/slug.js';

const demoBusinesses = [
  {
    reference: 'DEMO-001',
    businessName: 'Northampton Nigerian Kitchen',

    categoryKey: 'food',
    areaKey: 'northampton',

    rating: 4.8,
    reviewCount: 24,
    featured: true,

    description:
      'Nigerian meals, takeaway and catering services for individuals, families and events across Northampton.',

    services: [
      'Nigerian meals',
      'Takeaway',
      'Catering',
      'Event catering',
    ],

    phone: '+44 7000 000001',
    whatsappNumber: '+447000000001',
    email: 'hello@example.com',
    website: 'https://example.com',

    hasWhatsApp: true,
    hasOnline: false,
    hasBooking: true,

    address: 'Northampton, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2400,
    lng: -0.8990,

    hours: {
      monday: '09:00 - 20:00',
      tuesday: '09:00 - 20:00',
      wednesday: '09:00 - 20:00',
      thursday: '09:00 - 20:00',
      friday: '09:00 - 21:00',
      saturday: '10:00 - 21:00',
      sunday: '12:00 - 18:00',
    },

    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-002',
    businessName: 'Kora Beauty Studio',

    categoryKey: 'beauty',
    areaKey: 'abington',

    rating: 4.9,
    reviewCount: 18,
    featured: false,

    description:
      'Beauty and hair services with appointment-based sessions for clients in Northampton and surrounding areas.',

    services: [
      'Hair styling',
      'Braiding',
      'Beauty treatments',
      'Appointments',
    ],

    phone: '+44 7000 000002',
    whatsappNumber: '+447000000002',
    email: 'hello@example.com',
    website: '',

    hasWhatsApp: true,
    hasOnline: false,
    hasBooking: true,

    address: 'Abington, Northampton, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2390,
    lng: -0.8735,

    hours: {
      monday: '09:00 - 18:00',
      tuesday: '09:00 - 18:00',
      wednesday: '09:00 - 18:00',
      thursday: '09:00 - 18:00',
      friday: '09:00 - 19:00',
      saturday: '10:00 - 18:00',
      sunday: 'Closed',
    },

    image:
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-003',
    businessName: "RICO's Property Services",

    categoryKey: 'property',
    areaKey: 'northampton',

    rating: 4.7,
    reviewCount: 11,
    featured: true,

    description:
      'Property maintenance and related services for homeowners, landlords and businesses across Northampton.',

    services: [
      'Property maintenance',
      'Repairs',
      'Landlord services',
      'Property inspections',
    ],

    phone: '+44 7000 000003',
    whatsappNumber: '+447000000003',
    email: 'hello@example.com',
    website: 'https://example.com',

    hasWhatsApp: true,
    hasOnline: false,
    hasBooking: true,

    address: 'Northampton, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2360,
    lng: -0.9010,

    hours: {
      monday: '08:00 - 17:00',
      tuesday: '08:00 - 17:00',
      wednesday: '08:00 - 17:00',
      thursday: '08:00 - 17:00',
      friday: '08:00 - 17:00',
      saturday: '09:00 - 13:00',
      sunday: 'Closed',
    },

    image:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-004',
    businessName: 'Northampton Tech Support',

    categoryKey: 'professional',
    areaKey: 'town-centre',

    rating: 4.6,
    reviewCount: 9,
    featured: false,

    description:
      'IT support for individuals and small businesses, including remote and on-site technical assistance.',

    services: [
      'IT support',
      'Computer repairs',
      'Microsoft 365',
      'Remote support',
      'Business IT',
    ],

    phone: '+44 7000 000004',
    whatsappNumber: '+447000000004',
    email: 'hello@example.com',
    website: 'https://example.com',

    hasWhatsApp: true,
    hasOnline: true,
    hasBooking: true,

    address: 'Northampton Town Centre, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2407,
    lng: -0.8952,

    hours: {
      monday: '08:30 - 17:30',
      tuesday: '08:30 - 17:30',
      wednesday: '08:30 - 17:30',
      thursday: '08:30 - 17:30',
      friday: '08:30 - 17:30',
      saturday: '10:00 - 14:00',
      sunday: 'Closed',
    },

    image:
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-005',
    businessName: 'Naija Bites Catering',

    categoryKey: 'food',
    areaKey: 'northampton',

    rating: 4.8,
    reviewCount: 15,
    featured: false,

    description:
      'Nigerian catering for birthdays, weddings, celebrations, community events and private functions.',

    services: [
      'Event catering',
      'Party food',
      'Nigerian dishes',
      'Buffet catering',
    ],

    phone: '+44 7000 000005',
    whatsappNumber: '+447000000005',
    email: 'hello@example.com',
    website: '',

    hasWhatsApp: true,
    hasOnline: false,
    hasBooking: true,

    address: 'Northampton, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2430,
    lng: -0.9060,

    hours: {
      monday: '09:00 - 18:00',
      tuesday: '09:00 - 18:00',
      wednesday: '09:00 - 18:00',
      thursday: '09:00 - 18:00',
      friday: '09:00 - 19:00',
      saturday: '09:00 - 19:00',
      sunday: '10:00 - 16:00',
    },

    image:
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-006',
    businessName: 'Sapphire Events & Decor',

    categoryKey: 'events',
    areaKey: 'northampton',

    rating: 4.7,
    reviewCount: 13,
    featured: false,

    description:
      'Event decoration and planning services for birthdays, weddings, celebrations and community events.',

    services: [
      'Event decoration',
      'Wedding decor',
      'Birthday decor',
      'Event planning',
    ],

    phone: '+44 7000 000006',
    whatsappNumber: '+447000000006',
    email: 'hello@example.com',
    website: 'https://example.com',

    hasWhatsApp: true,
    hasOnline: false,
    hasBooking: true,

    address: 'Northampton, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2382,
    lng: -0.8855,

    hours: {
      monday: '09:00 - 17:00',
      tuesday: '09:00 - 17:00',
      wednesday: '09:00 - 17:00',
      thursday: '09:00 - 17:00',
      friday: '09:00 - 18:00',
      saturday: '09:00 - 18:00',
      sunday: '10:00 - 16:00',
    },

    image:
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
  },

  {
    reference: 'DEMO-007',
    businessName: 'Ecanset Group Ltd',

    categoryKey: 'professional',
    areaKey: 'town-centre',

    rating: 5.0,
    reviewCount: 9,
    featured: true,

    description:
      'System Administration and IT support services for individuals and businesses, including remote and on-site technical assistance.',

    services: [
      'IT support',
      'Computer repairs',
      'Microsoft 365',
      'Remote support',
      'Business IT',
    ],

    phone: '+44 7000 000004',
    whatsappNumber: '+447000000004',
    email: 'hello@example.com',
    website: 'https://example.com',

    hasWhatsApp: true,
    hasOnline: true,
    hasBooking: true,

    address: 'Northampton Town Centre, UK',
    postcode: '',
    town: 'Northampton',

    lat: 52.2407,
    lng: -0.8952,

    hours: {
      monday: '08:30 - 17:30',
      tuesday: '08:30 - 17:30',
      wednesday: '08:30 - 17:30',
      thursday: '08:30 - 17:30',
      friday: '08:30 - 17:30',
      saturday: '10:00 - 14:00',
      sunday: 'Closed',
    },

    image:
      'https://images.unsplash.com/photo-1780037190608-1d871be1fe41?auto=format&fit=crop&w=1200&q=80',
  },
];


function buildImage(imageURL, businessName) {
  if (!imageURL) {
    return null;
  }

  const safeName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    filename: `demo-${safeName}.jpg`,
    url: imageURL,
    originalName: `${businessName} demo image`,
    mimeType: 'image/jpeg',
    size: 0,
  };
}


async function seedBusinesses() {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'Demo business seeding is disabled when NODE_ENV=production.'
    );
  }

  console.log('Connecting to MongoDB...');

  await connectDatabase();

  console.log('Removing existing demo businesses...');

  await Business.deleteMany({
    submissionReference: /^DEMO-/,
  });

  console.log('Creating demo businesses...');

  let created = 0;

  for (const demo of demoBusinesses) {
    const slug = await uniqueSlug(
      Business,
      demo.businessName
    );

    const business = await Business.create({
      submissionReference: demo.reference,

      slug,

      featured: demo.featured,
      rating: demo.rating,
      reviewCount: demo.reviewCount,

      businessName: demo.businessName,
      categoryKey: demo.categoryKey,
      areaKey: demo.areaKey,
      description: demo.description,
      services: demo.services,

      phone: demo.phone,
      whatsappNumber: demo.whatsappNumber,
      email: demo.email,
      website: demo.website,

      hasWhatsApp: demo.hasWhatsApp,
      hasOnline: demo.hasOnline,
      hasBooking: demo.hasBooking,

      address: demo.address,
      postcode: demo.postcode,
      town: demo.town,
      lat: demo.lat,
      lng: demo.lng,
      hours: demo.hours,

      /*
        Demo records do not have real owners.
      */
      ownerName: '',
      ownerPhone: '',
      ownerEmail: '',
      ownerNote: 'Development/demo listing.',

      coverImage: buildImage(
        demo.image,
        demo.businessName
      ),

      galleryImages: [],
    });

    created += 1;

    console.log(
      `Created: ${business.businessName} → ${business.slug}`
    );
  }

  console.log('');
  console.log(`Demo seed complete. Created ${created} businesses.`);

  const total =
    await Business.countDocuments();

  console.log(`Total businesses currently in collection: ${total}`);
}


try {
  await seedBusinesses();
} catch (error) {
  console.error('');
  console.error('Demo seed failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}