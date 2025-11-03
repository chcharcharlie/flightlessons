# FlightLessons Implementation

## Setup Instructions

### Prerequisites
- Node.js 18 or higher
- Firebase CLI (`npm install -g firebase-tools`)

### Installation

Due to npm cache permission issues, you may need to fix permissions first:
```bash
sudo chown -R $(whoami) ~/.npm
```

Then install dependencies:
```bash
npm install --legacy-peer-deps
cd functions
npm install
```

### Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com

2. Enable the following services:
   - Authentication (Email/Password)
   - Cloud Firestore
   - Cloud Functions
   - Cloud Storage
   - Hosting

3. Copy `.env.example` to `.env` and fill in your Firebase config:
   ```bash
   cp .env.example .env
   ```

4. Initialize Firebase in the project:
   ```bash
   firebase login
   firebase use --add
   ```

### Running Locally

Start the Firebase emulators and development server:

```bash
# Terminal 1: Start Firebase emulators
npm run emulators

# Terminal 2: Start the development server
npm run dev
```

The app will be available at http://localhost:3000
The Firebase Emulator UI will be at http://localhost:4000

### Deployment

Build and deploy to Firebase:
```bash
npm run deploy
```

## Project Structure

```
implementation/
├── src/                    # React application source
│   ├── components/         # Reusable components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── lib/               # Firebase configuration
│   ├── pages/             # Page components
│   └── types/             # TypeScript types
├── functions/             # Cloud Functions
│   └── src/               # Functions source code
├── firebase.json          # Firebase configuration
├── firestore.rules        # Security rules
└── storage.rules          # Storage security rules
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run emulators` - Start Firebase emulators
- `npm run deploy` - Deploy to Firebase
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier