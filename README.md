# secQRypt

secQRypt is a cross-platform QR payment security application for checking whether a merchant QR code belongs to an approved merchant record before completing a payment.

The project contains:

- An Expo and React Native client for Android, iOS, and web.
- An Express API for authentication, merchant verification, QR checks, and administrative review.
- A MongoDB data layer implemented with Mongoose.

## Features

### Consumers

- Create an account and sign in as a consumer.
- Scan a merchant QR code with the device camera.
- Generate a SHA-256 fingerprint for the scanned QR payload.
- Check the QR payload against approved merchant records.
- View verified merchant details including merchant ID, UPI ID, and shop location.
- Report an unregistered or suspicious merchant QR code.

### Merchants

- Create a merchant account with a merchant ID.
- Submit merchant name, UPI ID, shop location, government ID, and QR data for review.
- Use location suggestions while entering the shop location.
- Scan the merchant QR code in the app.
- Submit the QR payload together with its SHA-256 fingerprint.
- Track whether the application is pending, approved, or rejected.

### Government and administrators

- Create or use an administrator account.
- View verification counts and open consumer reports.
- Review merchant verification requests.
- Approve or reject merchant applications.
- Move reports through reviewing, resolved, or dismissed states.

## Project Structure

```text
secQRypt/
├── client/                 Expo React Native application
│   ├── src/app/             File-based routes and screens
│   ├── src/components/      Shared UI components
│   ├── src/services/        API and authentication clients
│   ├── app.json              Expo configuration
│   └── package.json
├── server/                 Express and MongoDB API
│   ├── src/index.js          Server entry point
│   ├── src/routes/           Auth, merchant, and admin routes
│   ├── src/models/           Mongoose models
│   ├── src/middleware/       Authentication middleware
│   ├── .env.example          Server environment template
│   └── package.json
└── README.md
```

## Prerequisites

Install the following before starting development:

- Node.js 20 or newer.
- npm.
- MongoDB, either a local instance or a MongoDB Atlas database.
- Expo Go, an Android emulator, an iOS simulator, or a development build for native testing.
- A device or emulator with camera support when testing QR scanning.

For iOS native builds, macOS and Xcode are required. Android native builds require Android Studio and an Android SDK.

## Installation

Clone the repository and install dependencies for both applications:

```bash
git clone <repository-url>
cd secQRypt

cd server
npm install

cd ../client
npm install
```

The repository also contains a root `package.json` with shared QR-related dependencies, but the runnable application scripts are located in `client/package.json` and `server/package.json`.

## Server Configuration

Create `server/.env` from the provided template:

```bash
cd server
cp .env.example .env
```

Set values appropriate for your environment:

```env
MONGODB_URI=mongodb://localhost:27017/secqrypt
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
```

Configuration values:

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Secret used to sign seven-day JWT access tokens. Use a long, random value. |
| `PORT` | No | API port. Defaults to `4000`. |

Do not commit `server/.env`. The API exits at startup if `MONGODB_URI` or `JWT_SECRET` is missing.

## Client Configuration

The client can infer the API host from the Expo host when running on a local network. Set `EXPO_PUBLIC_API_URL` when you need to override that behavior.

Create `client/.env` when required:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

Use the correct URL for the environment:

| Environment | Example |
| --- | --- |
| Web or local desktop simulator | `http://localhost:4000` |
| Android emulator | `http://10.0.2.2:4000` |
| Physical phone on the same Wi-Fi network | `http://<computer-lan-ip>:4000` |
| Deployed API | `https://api.example.com` |

The API must be reachable from the device. `localhost` on a physical phone points to the phone itself, not the development computer.

## Running the Project

Start MongoDB first, then start the API:

```bash
cd server
npm run dev
```

For a normal Node process, use:

```bash
npm start
```

In a second terminal, start the Expo client:

```bash
cd client
npm start
```

Expo will show shortcuts for opening the project in a web browser, Android emulator, iOS simulator, or Expo Go. You can also use the dedicated scripts:

```bash
npm run web
npm run android
npm run ios
```

Confirm that the API is running before using the client:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{"status":"ok"}
```

## Typical Workflows

### Verify a merchant QR code

1. Open the client and choose `Consumer`.
2. Register or sign in.
3. Open the scanner and grant camera access.
4. Scan a merchant QR code.
5. Review the verification result and displayed merchant details.
6. Report the merchant if the QR is unregistered or suspicious.

Only QR data belonging to an approved merchant verification record is returned as verified.

### Submit a merchant verification request

1. Choose `Merchant` and register with a merchant ID.
2. Sign in and open the merchant verification form.
3. Enter the merchant, UPI, location, and government ID details.
4. Scan the merchant QR code from the form.
5. Submit the application.
6. Wait for an administrator to approve or reject it.

The client calculates a SHA-256 fingerprint from the scanned QR payload. The server recalculates the fingerprint and rejects the application if the values do not match.

### Review applications and reports

1. Choose `Government / Admin` and sign in.
2. Open the admin dashboard.
3. Review pending merchant applications and consumer reports.
4. Approve or reject applications and update report statuses.

## API Reference

The default API base URL is `http://localhost:4000`.

### Health

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Check that the API process is running. |

### Authentication

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register a consumer, merchant, or admin account. |
| `POST` | `/api/auth/login` | No | Sign in and receive a JWT. |
| `GET` | `/api/auth/me` | Bearer token | Return the current user. |

Registration accepts `role`, `email`, `password`, and role-specific fields. Passwords must contain at least eight characters. Merchant registration requires `merchantId` and `username`; admin registration requires `govId`.

### Merchant and QR operations

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/merchant/report` | Bearer token | Submit a consumer report about a merchant or QR code. |
| `GET` | `/api/merchant/status` | Merchant token | Get the current merchant verification status. |
| `POST` | `/api/merchant/apply` | Merchant token | Create or resubmit a merchant verification application. |
| `POST` | `/api/verify/qr` | No | Check scanned QR data against approved records. |

Example QR verification request:

```bash
curl -X POST http://localhost:4000/api/verify/qr \
	-H 'Content-Type: application/json' \
	-d '{"qrData":"example-qr-payload"}'
```

### Administrative operations

All admin endpoints require a bearer token belonging to an admin account.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/overview` | Return pending, approved, rejected, and open-report counts. |
| `GET` | `/api/admin/verification-queue` | List merchant verification records. |
| `POST` | `/api/admin/verification/:id/decision` | Approve or reject a verification record. |
| `GET` | `/api/admin/reports` | List consumer reports. |
| `POST` | `/api/admin/reports/:id/resolve` | Set a report to reviewing, resolved, or dismissed. |

Protected requests use this header:

```http
Authorization: Bearer <jwt>
```

## Data Model

The server stores three main document types in MongoDB:

- `User`: role, email, username, merchant ID, government ID, and a bcrypt password hash.
- `MerchantVerification`: merchant details, UPI ID, location, QR payload, QR SHA-256 hash, status, and review notes.
- `MerchantReport`: reporter, merchant details, QR payload, reason, details, status, and admin notes.

Merchant IDs, QR data, and QR hashes have database indexes intended to prevent duplicate registrations.

## Available Scripts

### Client

| Command | Description |
| --- | --- |
| `npm start` | Start the Expo development server. |
| `npm run web` | Start Expo for web. |
| `npm run android` | Build and run the Android app. |
| `npm run ios` | Build and run the iOS app. |
| `npm run lint` | Run ESLint. |
| `npm run reset-project` | Move the starter example and reset the app directory. |

### Server

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with nodemon. |
| `npm start` | Start the API with Node.js. |
| `npm test` | Placeholder command; automated server tests are not configured yet. |

## Troubleshooting

### The API does not start

Check that MongoDB is running and that `server/.env` contains both `MONGODB_URI` and `JWT_SECRET`.

### The client cannot connect to the API

Check `EXPO_PUBLIC_API_URL`, confirm the API port, and make sure the phone or emulator can reach the computer. Use the computer's LAN IP for a physical device.

### QR scanning does not open

Grant camera permission. On Android, verify that the app has camera permission in system settings. On web, use a browser context that allows camera access and serves the app from a secure origin when required by the browser.

### A QR code is not verified

The QR payload must match an approved merchant verification record. A merchant application that is pending or rejected cannot be used for a successful verification result.

## Security Notes

- Passwords are hashed with bcrypt before storage.
- Authentication uses JWT bearer tokens with a seven-day expiry.
- Client tokens are stored in Expo SecureStore on native platforms and browser local storage on web.
- Merchant QR fingerprints use SHA-256 and are checked again by the server.
- Never commit real database credentials, JWT secrets, government IDs, or production QR payloads.
- The current API enables CORS globally and does not yet include rate limiting, refresh tokens, audit logging, or production-grade admin provisioning. Add those controls before deploying publicly.

## Development Notes

The client uses Expo Router for file-based navigation, React Native with TypeScript, NativeWind for styling, and Expo Camera for QR scanning. The server uses Express 5, Mongoose, dotenv, bcryptjs, and jsonwebtoken.

Location suggestions in the merchant form are supplied by the public Photon geocoding API. Network availability and that service's usage policies should be considered for production deployments.

## License

This project includes license files in the repository. Review `secQRypt/LICENSE` and the component-specific license files before redistributing the application.
