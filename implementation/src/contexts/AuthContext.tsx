import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser)
      
      if (firebaseUser) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUser(userDoc.data() as User)
        }
      } else {
        setUser(null)
      }
      
      setLoading(false)
    })

    return unsubscribe
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
    
    // For now, directly create the user document since Cloud Functions might not be deployed yet
    // This is temporary until functions are deployed
    const userDoc = {
      uid: userCredential.user.uid,
      email: email,
      displayName: displayName,
      role: role,
      createdAt: new Date(),
      settings: {
        notifications: {
          email: true,
          lessonReminders: true,
        },
      },
    }
    
    await setDoc(doc(db, 'users', userCredential.user.uid), userDoc)
    
    // If CFI, create workspace
    if (role === 'CFI') {
      const workspaceRef = await addDoc(collection(db, 'workspaces'), {
        cfiUid: userCredential.user.uid,
        name: `${displayName}'s Flight School`,
        createdAt: new Date(),
        studentCount: 0,
        settings: {
          defaultLessonDuration: {
            ground: 60,
            flight: 1.5,
          },
        },
      })
      
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        cfiWorkspaceId: workspaceRef.id,
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
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
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}