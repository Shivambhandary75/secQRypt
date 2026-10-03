# secQRypt API

## Setup

Add `JWT_SECRET` and `PORT` to `server/.env`. Keep the existing `MONGODB_URI` private.

```env
MONGODB_URI=your-existing-mongodb-url
JWT_SECRET=use-a-long-random-secret
PORT=4000
```

Run the API:

```bash
npm run dev
```

The client reads `EXPO_PUBLIC_API_URL`. Use `http://localhost:4000` for a web simulator, or the computer's LAN IP for a physical phone.