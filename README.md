# Nigerians in Northampton Directory Backend

A Node.js + Express + MongoDB API for business submissions and the public Nigerian business directory.

## Submission flow

`List Your Business` → `POST /api/business-submissions` → MongoDB (`pending`) → Admin review → `approved` → public `Business` record → visible on directory pages.

## Requirements

- Node.js 20+
- MongoDB Atlas or another MongoDB deployment

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and set at least:

- `MONGODB_URI`
- `ADMIN_API_KEY`
- `FRONTEND_ORIGIN`
- `PUBLIC_BASE_URL`

Then run:

```powershell
npm run dev
```

Health check:

`GET http://localhost:5000/api/health`

## Public endpoints

- `GET /api/businesses`
- `GET /api/businesses/:id` (MongoDB ObjectId or slug)

Query parameters for the list endpoint:

- `category`
- `area`
- `search`
- `sort=featured|rating|recent|name`

## Business submission endpoint

`POST /api/business-submissions`

Content type: `multipart/form-data`.

Fields accepted from the current frontend:

`businessName`, `categoryKey`, `areaKey`, `description`, `services`, `phone`, `whatsappNumber`, `email`, `website`, `hasWhatsApp`, `hasOnline`, `hasBooking`, `address`, `postcode`, `town`, `lat`, `lng`, `hours`, `ownerName`, `ownerPhone`, `ownerEmail`, `ownerNote`.

Files:

- `coverImage` — required, 1 file
- `galleryImages` — optional, up to 5 files

Accepted image formats: JPG/JPEG, PNG, WebP.

Default maximum file size: 5 MB per image.

## Admin endpoints

Provide either:

- `Authorization: Bearer YOUR_ADMIN_API_KEY`
- `x-admin-api-key: YOUR_ADMIN_API_KEY`

Endpoints:

- `GET /api/business-submissions?status=pending`
- `GET /api/business-submissions/:reference`
- `PATCH /api/business-submissions/:reference/status`

Example approval body:

```json
{
  "status": "approved",
  "note": "Approved after review."
}
```

Allowed statuses:

`pending`, `approved`, `rejected`, `changes_requested`

Approving a submission automatically creates its public `Business` record.

## Frontend API base URL

The frontend can set:

```html
<script>
  window.NIN_API_BASE_URL = "http://localhost:5000/api";
</script>
```

For production, replace that with the public API URL.

## Production note

This version stores images on the local server filesystem, which is suitable for local development and a VPS with persistent storage. For ephemeral hosting, move uploads to object storage such as S3-compatible storage or Cloudinary.
