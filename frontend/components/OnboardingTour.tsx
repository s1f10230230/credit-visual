"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePlan } from "../context/PlanContext";
import { getOnboardingSteps, hasNewFeatures, type OnboardingStep } from "../lib/onboarding";

interface OnboardingTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { plan } = usePlan();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);

  useEffect(() => {
    const shouldShowTour = searchParams.get('tour') === '1';
    const fromPlan = searchParams.get('from-plan');
    
    if (shouldShowTour) {
      const onboardingSteps = getOnboardingSteps(plan, fromPlan || undefined);
      setSteps(onboardingSteps);
      setIsVisible(true);
      setCurrentStep(0);
    }
  }, [searchParams, plan]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete?.();
    
    // Remove tour parameter from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('tour');
    newUrl.searchParams.delete('from-plan');
    router.replace(newUrl.toString());
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip?.();
    
    // Remove tour parameter from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('tour');
    newUrl.searchParams.delete('from-plan');
    router.replace(newUrl.toString());
  };

  if (!isVisible || steps.length === 0) {
    return null;
  }

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
      
      {/* Tour Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-line rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {currentStepData.isNew && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                    ✨ NEW
                  </div>
                )}
                <div className="text-sm text-muted">
                  {currentStep + 1} / {steps.length}
                </div>
              </div>
              <button
                onClick={handleSkip}
                className="text-muted hover:text-text text-sm"
              >
                スキップ
              </button>
            </div>
            
            <h2 className="text-heading-md text-text mb-3">
              {currentStepData.title}
            </h2>
            
            <p className="text-body text-muted whitespace-pre-line">
              {currentStepData.description}
            </p>
          </div>

          {/* Action Button */}
          {currentStepData.action && currentStepData.actionLabel && (
            <div className="px-6 pb-4">
              <button
                onClick={() => {
                  // Simulate action
                  console.log(`Action: ${currentStepData.action}`);
                  setTimeout(handleNext, 1000); // Auto-advance after action
                }}
                className="btn btn-primary w-full"
              >
                {currentStepData.actionLabel}
              </button>
            </div>
          )}

          {/* Progress Bar */}
          <div className="px-6 pb-4">
            <div className="w-full bg-line rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              戻る
            </button>
            
            <button
              onClick={handleNext}
              className="btn btn-primary"
            >
              {isLastStep ? "完了" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}