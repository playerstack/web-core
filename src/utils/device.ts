/**
 * Device detection utilities.
 * Detects device type based on user agent and touch capabilities.
 */

let _isDesktop = false;
let _isMobile = false;
let _detected = false;

function detect(): void {
  if (_detected) return;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    _detected = true;
    return;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileDevice = /iphone|ipod|android.*mobile|windows phone|blackberry/.test(userAgent);
  const isTabletDevice = /ipad|android(?!.*mobile)|silk|kindle|tablet/.test(userAgent);
  const isLikelyDesktop = !hasTouchScreen && /mac|windows|linux|cros/.test(userAgent);

  if (isMobileDevice || isTabletDevice) {
    _isDesktop = false;
    _isMobile = true;
  } else {
    _isDesktop = isLikelyDesktop;
    _isMobile = !isLikelyDesktop;
  }
  _detected = true;
}

detect();

export const isDesktop: boolean = _isDesktop;
export const isMobile: boolean = _isMobile;
