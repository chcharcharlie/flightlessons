import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db, googleProvider } from '@/lib/firebase'
import { User, UserRole } from '@/types'

interface AuthContextType {
  firebaseUser: FirebaseUser | null
  user: User | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithGoogleRedirect: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return
      
      setFirebaseUser(firebaseUser)

      if (firebaseUser) {
        // Fetch user data from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          setUser(userDoc.data() as User)
        } else {
          // Check if this is a new user with pending role
          const pendingRole = localStorage.getItem(
            `pending_role_${firebaseUser.uid}`
          )

          if (pendingRole) {
            try {
              // Create user document
              const newUserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || '',
                role: pendingRole as UserRole,
                createdAt: serverTimestamp(),
                settings: {
                  notifications: {
                    email: true,
                    lessonReminders: true,
                  },
                },
              }

              await setDoc(userDocRef, newUserData)

              // If CFI, create workspace
              if (pendingRole === 'CFI') {
                const workspaceRef = await addDoc(
                  collection(db, 'workspaces'),
                  {
                    cfiUid: firebaseUser.uid,
                    name: firebaseUser.displayName + "'s Flight School",
                    createdAt: serverTimestamp(),
                    studentCount: 0,
                    settings: {
                      defaultLessonDuration: {
                        ground: 60,
                        flight: 1.5,
                      },
                    },
                  }
                )

                // Update user with workspace ID
                await updateDoc(userDocRef, {
                  cfiWorkspaceId: workspaceRef.id,
                })

                // Update local user data with workspace ID
                setUser({
                  ...newUserData,
                  cfiWorkspaceId: workspaceRef.id,
                } as User)
              } else {
                setUser(newUserData as User)
              }

              localStorage.removeItem(`pending_role_${firebaseUser.uid}`)
            } catch (error) {
              // Sign out to reset state
              await signOut(auth)
              setUser(null)
            }
          } else {
            // User exists in Auth but not in Firestore and no pending role
            // Don't sign out - let the app redirect to role selection
            setUser(null)
          }
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    // Also check for redirect result on mount
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result) {
          // The onAuthStateChanged will handle the rest
        }
      } catch (error: any) {
        if (error.code !== 'auth/no-auth-event') {
          console.error('Error checking redirect result:', error)
        }
      }
    }
    
    checkRedirectResult()

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole
  ) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    )

    // Update display name
    await updateProfile(userCredential.user, { displayName })

    // Store the role temporarily in localStorage since Firestore might not be ready
    localStorage.setItem(`pending_role_${userCredential.user.uid}`, role)

    // Don't try to create Firestore documents here - let the onAuthStateChanged handle it
  }

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
      // The onAuthStateChanged listener will handle user creation/loading
    } catch (error: any) {
      // If popup fails, throw a descriptive error
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled')
      } else if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up blocked. Please allow pop-ups for this site.')
      } else if (error.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized for OAuth operations.')
      } else {
        throw new Error(error.message || 'Failed to sign in with Google')
      }
    }
  }

  const signInWithGoogleRedirect = async () => {
    // Use redirect method directly - better for avoiding COOP issues
    await signInWithRedirect(auth, googleProvider)
    // Browser will redirect - no return
  }

  const logout = async () => {
    await signOut(auth)
  }

  const value = {
    firebaseUser,
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithGoogleRedirect,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
