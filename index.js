// Half of this was also ai generated :)
document.addEventListener("DOMContentLoaded", () => {
  const intro = document.querySelector(".intro");
  const introContent = document.querySelector(".intro-content");
  const typing = document.querySelector(".typing");
  const loading = document.querySelector(".loading");
  const cursor = document.querySelector(".cursor");
  const siteTarget = document.getElementById("site");
  const loadingTarget = document.getElementById("loading");
  const mediaLink = document.querySelector(".media-link");

  const siteText = "WAYOKI.STORE";
  const loadingText = "Loading";
  const typingSpeed = 250;
  const loadingFrameDelay = 800;
  const jitterResetDelay = 130;
  const dotCycleDuration = loadingFrameDelay * 4;
  const repeatedTransitionDelay = dotCycleDuration * 2;
  const initialTransitionDelay =
    (siteText.length + loadingText.length) * typingSpeed +
    repeatedTransitionDelay;
  let isPhotoMode = false;

  let hasShownMediaLink = false;

  if (!intro || !introContent || !typing || !loading || !cursor || !siteTarget || !loadingTarget || !mediaLink) {
    return;
  }

  siteTarget.textContent = "";
  siteTarget.dataset.text = "";
  loadingTarget.textContent = "";

  function applyResponsiveLayout() {
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : window.innerWidth;
    const height = viewport ? viewport.height : window.innerHeight;
    const isMobile = width <= 768;

    intro.style.minHeight = `${height}px`;

    if (!isMobile) {
      introContent.style.transform = "translateY(-100%)";
      introContent.style.gap = "24px";
      introContent.style.padding = "";
      introContent.style.width = "";
      typing.style.fontSize = "56px";
      loading.style.fontSize = "24px";
      cursor.style.width = "12px";
      cursor.style.marginLeft = "8px";
      return;
    }

    const safeWidth = Math.max(280, width - 32);
    const titleSize = Math.max(30, Math.min(56, safeWidth * 0.12));
    const loadingSize = Math.max(16, Math.min(24, safeWidth * 0.05));

    introContent.style.transform = "translateY(-150%)";
    introContent.style.gap = "16px";
    introContent.style.padding = "0 16px";
    introContent.style.width = `${safeWidth}px`;
    typing.style.fontSize = `${titleSize}px`;
    loading.style.fontSize = `${loadingSize}px`;
    cursor.style.width = `${Math.max(8, Math.round(titleSize * 0.2))}px`;
    cursor.style.marginLeft = `${Math.max(6, Math.round(titleSize * 0.14))}px`;
  }

  function resetJitter() {
    typing.style.translate = "0 0";
    loading.style.translate = "0 0";
    typing.style.opacity = "1";
    loading.style.opacity = "1";
  }

  function triggerCrtJitter() {
    if (isPhotoMode) {
      return;
    }

    const x = (Math.random() - 0.5) * 4.8;
    const y = (Math.random() - 0.5) * 2.4;
    typing.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    loading.style.translate = `${(x * 0.55).toFixed(2)}px ${(y * 0.55).toFixed(2)}px`;
    typing.style.opacity = `${0.88 + Math.random() * 0.1}`;
    loading.style.opacity = `${0.84 + Math.random() * 0.12}`;
    setTimeout(() => {
      resetJitter();
    }, jitterResetDelay);
  }

  function triggerSplitGlitch() {
    if (isPhotoMode) {
      return;
    }

    siteTarget.classList.remove("glitch-split");
    void siteTarget.offsetWidth;
    siteTarget.classList.add("glitch-split");
    setTimeout(() => {
      siteTarget.classList.remove("glitch-split");
    }, 170);
  }

  function triggerPhotoSplitGlitch() {
    siteTarget.classList.remove("photo-glitch-split");
    void siteTarget.offsetWidth;
    siteTarget.classList.add("photo-glitch-split");
    setTimeout(() => {
      siteTarget.classList.remove("photo-glitch-split");
    }, 220);
  }

  function triggerPhotoJitter() {
    const x = (Math.random() - 0.5) * 4.2;
    const y = (Math.random() - 0.5) * 2.8;
    typing.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    loading.style.translate = `${(x * 0.82).toFixed(2)}px ${(y * 0.82).toFixed(2)}px`;
    typing.style.opacity = `${0.91 + Math.random() * 0.09}`;
    loading.style.opacity = `${0.88 + Math.random() * 0.1}`;

    setTimeout(() => {
      resetJitter();
    }, 260);
  }

  function setPhotoMode(nextPhotoMode) {
    isPhotoMode = nextPhotoMode;
    resetJitter();
    siteTarget.classList.remove("glitch-split");
    siteTarget.classList.remove("photo-glitch-split");
    document.body.classList.toggle("photo-mode", nextPhotoMode);

    if (nextPhotoMode && !hasShownMediaLink) {
      hasShownMediaLink = true;
      document.body.classList.add("media-link-visible");
    }
  }

  function scheduleModeCycle(delay) {
    setTimeout(() => {
      const nextPhotoMode = !isPhotoMode;
      setPhotoMode(nextPhotoMode);
      scheduleModeCycle(repeatedTransitionDelay);
    }, delay);
  }

  function scheduleJitter() {
    const nextDelay = 1100 + Math.random() * 1800;
    setTimeout(() => {
      if (isPhotoMode) {
        triggerPhotoJitter();
      } else {
        triggerCrtJitter();
      }

      if (!isPhotoMode && Math.random() > 0.45) {
        triggerSplitGlitch();
      }

      if (isPhotoMode && Math.random() > 0.35) {
        triggerPhotoSplitGlitch();
      }

      scheduleJitter();
    }, nextDelay);
  }

  function startLoadingAnimation(frameIndex = 0) {
    const dots = ".".repeat(frameIndex);
    loadingTarget.textContent = loadingText + dots;

    setTimeout(() => {
      startLoadingAnimation((frameIndex + 1) % 4);
    }, loadingFrameDelay);
  }

  function typeText(target, value, onComplete, charIndex = 0) {
    if (charIndex >= value.length) {
      if (onComplete) {
        onComplete();
      }
      return;
    }

    target.textContent += value[charIndex];
    if (target === siteTarget) {
      siteTarget.dataset.text = siteTarget.textContent;
    }

    setTimeout(() => {
      typeText(target, value, onComplete, charIndex + 1);
    }, typingSpeed);
  }

  applyResponsiveLayout();

  window.addEventListener("resize", applyResponsiveLayout);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyResponsiveLayout);
  }

  scheduleJitter();

  typeText(siteTarget, siteText, () => {
    typeText(loadingTarget, loadingText, () => {
      setTimeout(() => startLoadingAnimation(1), loadingFrameDelay);
    });
  });

  scheduleModeCycle(initialTransitionDelay);
});
