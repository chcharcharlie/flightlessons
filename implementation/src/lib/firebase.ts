import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

// Firebase configuration
// Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)
export const storage = getStorage(app)

// Initialize Analytics (only in production)
export const analytics = import.meta.env.PROD ? getAnalytics(app) : null

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider()
// Add scopes if needed
googleProvider.addScope('profile')
googleProvider.addScope('email')

// Configure auth settings
auth.useDeviceLanguage()

// Set persistence to LOCAL to maintain auth state across redirects
setPersistence(auth, browserLocalPersistence).catch(console.error)

// Enable emulators in development (commented out - using live Firebase)
// if (import.meta.env.DEV) {
//   connectAuthEmulator(auth, 'http://localhost:9099')
//   connectFirestoreEmulator(db, 'localhost', 8080)
//   connectFunctionsEmulator(functions, 'localhost', 5001)
//   connectStorageEmulator(storage, 'localhost', 9199)
// }