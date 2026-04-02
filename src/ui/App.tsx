import React, { useState } from 'react'
import { Box, useApp } from 'ink'
import CLISelector from './CLISelector.js'
import GhaggaToggle from './GhaggaToggle.js'
import KiteguardToggle from './KiteguardToggle.js'
import Confirmation from './Confirmation.js'
import Progress from './Progress.js'
import Summary from './Summary.js'
import Welcome from './Welcome.js'
import Header from './Header.js'
import { runSetup } from '../orchestrator/index.js'
import type { AI_CLI, SetupStep } from '../types/index.js'

type Stage = 'welcome' | 'select-cli' | 'select-ghagga' | 'select-kiteguard' | 'confirm' | 'installing' | 'done'

interface AppProps {
  dryRun?: boolean
  preselectedClis?: AI_CLI[]
  presetGhagga?: boolean
  presetKiteguard?: boolean
  skipTUI?: boolean
}

export default function App({ dryRun = false, preselectedClis, presetGhagga, presetKiteguard, skipTUI }: AppProps) {
  const { exit } = useApp()

  // Determine initial stage based on presets
  const getInitialStage = (): Stage => {
    if (skipTUI && preselectedClis) return 'installing'
    if (preselectedClis && presetGhagga !== undefined && presetKiteguard !== undefined) return 'confirm'
    if (preselectedClis && presetGhagga !== undefined) return 'select-kiteguard'
    if (preselectedClis) return 'select-ghagga'
    return 'welcome'
  }

  const [stage, setStage] = useState<Stage>(getInitialStage)
  const [selectedClis, setSelectedClis] = useState<AI_CLI[]>(preselectedClis ?? [])
  const [ghagga, setGhagga] = useState(presetGhagga ?? false)
  const [kiteguard, setKiteguard] = useState(presetKiteguard ?? false)
  const [steps, setSteps] = useState<SetupStep[]>([])
  const [startTime] = useState<number>(Date.now())

  const handleCLIConfirm = (clis: AI_CLI[]) => {
    setSelectedClis(clis)
    setStage('select-ghagga')
  }

  const handleGhaggaConfirm = (enabled: boolean) => {
    setGhagga(enabled)
    setStage('select-kiteguard')
  }

  const handleKiteguardConfirm = (enabled: boolean) => {
    setKiteguard(enabled)
    setStage('confirm')
  }

  const handleConfirm = async () => {
    setStage('installing')
    await runSetup(
      { clis: selectedClis, ghagga, kiteguard, dryRun },
      (step) => setSteps(prev => {
        const idx = prev.findIndex(s => s.id === step.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = step
          return next
        }
        return [...prev, step]
      })
    )
    setStage('done')
  }

  // Auto-start if skipTUI
  React.useEffect(() => {
    if (skipTUI && preselectedClis && stage === 'installing') {
      void handleConfirm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = () => {
    exit()
  }

  const subtitle =
    stage === 'installing' ? 'installing...' :
    stage === 'done'       ? 'complete'      :
    undefined

  return (
    <Box flexDirection="column" padding={1}>
      {stage !== 'welcome' && <Header subtitle={subtitle} dryRun={dryRun} />}

      {stage === 'welcome' && (
        <Welcome onDone={() => setStage('select-cli')} />
      )}
      {stage === 'select-cli' && (
        <CLISelector onConfirm={handleCLIConfirm} />
      )}
      {stage === 'select-ghagga' && (
        <GhaggaToggle onConfirm={handleGhaggaConfirm} />
      )}
      {stage === 'select-kiteguard' && (
        <KiteguardToggle onConfirm={handleKiteguardConfirm} />
      )}
      {stage === 'confirm' && (
        <Confirmation
          clis={selectedClis}
          ghagga={ghagga}
          kiteguard={kiteguard}
          dryRun={dryRun}
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
        />
      )}
      {stage === 'installing' && (
        <Progress
          steps={steps}
          selectedClis={selectedClis}
          onDone={() => setStage('done')}
        />
      )}
      {stage === 'done' && (
        <Summary
          steps={steps}
          dryRun={dryRun}
          selectedClis={selectedClis}
          elapsedMs={Date.now() - startTime}
          ghagga={ghagga}
          kiteguard={kiteguard}
        />
      )}
    </Box>
  )
}
