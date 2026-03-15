import React, { createContext, useContext } from 'react'

interface CIContextValue {
  /** True when running in non-interactive mode (CI=1 or --batch) */
  isCI: boolean
}

const CIContext = createContext<CIContextValue>({ isCI: false })

export function useCIMode(): boolean {
  return useContext(CIContext).isCI
}

interface Props {
  isCI: boolean
  children: React.ReactNode
}

export function CIProvider({ isCI, children }: Props) {
  return (
    <CIContext.Provider value={{ isCI }}>
      {children}
    </CIContext.Provider>
  )
}
