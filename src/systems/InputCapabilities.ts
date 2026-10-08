// Read-only device capabilities, independent of any platform SDK.
// Touch interaction shares the canonical BuildSystem and never forks rules.
export interface InputCapabilities {
  hasTouch: boolean;
  isCompactViewport: boolean;
}

export function detectInputCapabilities(): InputCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { hasTouch: false, isCompactViewport: false };
  }
  return {
    hasTouch: navigator.maxTouchPoints > 0 || 'ontouchstart' in window,
    isCompactViewport: window.innerWidth < 768,
  };
}
