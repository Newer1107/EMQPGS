interface Step {
  number: number;
  label: string;
  description: string;
}

const steps: Step[] = [
  { number: 1, label: "Academic Context", description: "Select batch, semester, and exam type" },
  { number: 2, label: "Subjects", description: "Review subjects from curriculum" },
  { number: 3, label: "Review", description: "Confirm and create exam cycle" },
];

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  currentStep > step.number
                    ? "bg-green-600 text-white"
                    : currentStep === step.number
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {currentStep > step.number ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-medium ${currentStep >= step.number ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>
                  {step.label}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">{step.description}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-4 h-px w-16 sm:w-24 ${currentStep > step.number ? "bg-green-600" : "bg-[var(--border)]"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
