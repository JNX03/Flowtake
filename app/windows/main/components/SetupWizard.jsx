import { useState, useCallback } from "react"
import PropTypes from "prop-types"
import TitleBar from "../../../components/TitleBar"
import WelcomeStep from "./setup/WelcomeStep"
import PermissionsStep from "./setup/PermissionsStep"
import ExportPathStep from "./setup/ExportPathStep"
import AppearanceStep from "./setup/AppearanceStep"
import CompletionStep from "./setup/CompletionStep"

const STEPS = [
    { id: "welcome", label: "Welcome" },
    { id: "permissions", label: "Permissions" },
    { id: "export", label: "Export" },
    { id: "theme", label: "Theme" },
    { id: "done", label: "Done" },
]

export default function SetupWizard({ onComplete }) {
    const [currentStep, setCurrentStep] = useState(0)

    const next = useCallback(() => {
        if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1)
    }, [currentStep])

    const prev = useCallback(() => {
        if (currentStep > 0) setCurrentStep(s => s - 1)
    }, [currentStep])

    const renderStep = () => {
        switch (STEPS[currentStep].id) {
            case "welcome": return <WelcomeStep />
            case "permissions": return <PermissionsStep />
            case "export": return <ExportPathStep />
            case "theme": return <AppearanceStep />
            case "done": return <CompletionStep onComplete={onComplete} />
            default: return null
        }
    }

    const isFirst = currentStep === 0
    const isLast = currentStep === STEPS.length - 1

    return (<>
        <TitleBar title="Flowtake Setup" />

        <div className="flex flex-col h-full pt-8">
            {/* Step indicator */}
            <div className="px-8 pt-6 pb-2 flex-none">
                <ul className="steps steps-horizontal w-full">
                    {STEPS.map((step, i) => (
                        <li key={step.id} className={`step text-xs ${i <= currentStep ? "step-primary" : ""}`}>
                            {step.label}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-auto px-8 py-4">
                {renderStep()}
            </div>

            {/* Navigation */}
            <div className="flex-none px-8 py-4 border-t border-base-content/10 flex items-center justify-between">
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onComplete}
                >
                    Skip setup
                </button>

                <div className="flex gap-2">
                    {!isFirst && (
                        <button className="btn btn-ghost btn-sm" onClick={prev}>
                            Back
                        </button>
                    )}
                    {!isLast && (
                        <button className="btn btn-primary btn-sm" onClick={next}>
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    </>)
}

SetupWizard.propTypes = {
    onComplete: PropTypes.func.isRequired
}
