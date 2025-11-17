import React, { createContext, useState, useContext } from 'react'
import { Certificate } from '@/types'

interface CurriculumContextType {
  selectedCertificate: Certificate
  setSelectedCertificate: (cert: Certificate) => void
}

const CurriculumContext = createContext<CurriculumContextType | undefined>(undefined)

export const CurriculumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')

  return (
    <CurriculumContext.Provider value={{ selectedCertificate, setSelectedCertificate }}>
      {children}
    </CurriculumContext.Provider>
  )
}

export const useCurriculum = () => {
  const context = useContext(CurriculumContext)
  if (context === undefined) {
    throw new Error('useCurriculum must be used within a CurriculumProvider')
  }
  return context
}