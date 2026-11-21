document.addEventListener("DOMContentLoaded", () => {
  function markFlowEvent(name, details) {
    if (window.performance && typeof window.performance.mark === "function") {
      try {
        window.performance.mark(name);
      } catch (error) {
        // Keep logging even if the mark API rejects a duplicate or malformed name.
      }
    }

    if (window.console && typeof window.console.log === "function") {
      console.log(`[wayoki-flow] ${name}`, details || {});
    }
  }

  const intro = document.querySelector(".intro");
  const introContent = document.querySelector(".intro-content");
  const typing = document.querySelector(".typing");
  const loading = document.querySelector(".loading");
  const startButton = document.querySelector(".start-button");
  const languagePicker = document.querySelector(".language-picker");
  const languageOptions = document.querySelectorAll(".language-option");
  const cursor = document.querySelector(".cursor");
  const siteTarget = document.getElementById("site");
  const loadingTarget = document.getElementById("loading");
  const mediaLink = document.querySelector(".media-link");
  const content = document.querySelector(".content");

  const siteText = "WAYOKI.COM";
  const loadingText = "Loading";
  const typingSpeed = 200;
  const loadingFrameDelay = 800;
  const jitterResetDelay = 130;
  const dotCycleDuration = loadingFrameDelay * 4;
  const initialTransitionDelay =
    (siteText.length + loadingText.length) * typingSpeed +
    dotCycleDuration;
  let isPhotoMode = false;
  let isReadyToStart = false;
  let hasEnteredMainScreen = false;

  let hasShownMediaLink = false;
  let jitterTimeoutId = null;
  let loadingTimeoutId = null;
  let startTapTimeoutId = null;
  let languageTapTimeoutId = null;

  function armStartHover() {
    document.body.classList.add("start-hover-enabled");
  }

  function clearStartTapState() {
    if (startTapTimeoutId) {
      clearTimeout(startTapTimeoutId);
      startTapTimeoutId = null;
    }

    startButton.classList.remove("tap-hover-active");
  }

  function clearLanguageTapState() {
    if (languageTapTimeoutId) {
      clearTimeout(languageTapTimeoutId);
      languageTapTimeoutId = null;
    }

    languageOptions.forEach((option) => {
      option.classList.remove("tap-hover-active");
    });
  }

  function isTouchLikeInteraction() {
    return (
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    );
  }

  if (
    !intro ||
    !introContent ||
    !typing ||
    !loading ||
    !startButton ||
    !languagePicker ||
    !languageOptions.length ||
    !cursor ||
    !siteTarget ||
    !loadingTarget ||
    !mediaLink ||
    !content
  ) {
    return;
  }

  siteTarget.textContent = "";
  siteTarget.dataset.text = "";
  loadingTarget.textContent = "";
  startButton.hidden = true;
  languagePicker.hidden = true;
  content.setAttribute("aria-hidden", "true");

  function isIntroAnimating() {
    return !isReadyToStart && !hasEnteredMainScreen;
  }

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
    if (isPhotoMode || !isIntroAnimating()) {
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
    if (isPhotoMode || !isIntroAnimating()) {
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
    if (!isIntroAnimating()) {
      return;
    }

    siteTarget.classList.remove("photo-glitch-split");
    void siteTarget.offsetWidth;
    siteTarget.classList.add("photo-glitch-split");
    setTimeout(() => {
      siteTarget.classList.remove("photo-glitch-split");
    }, 220);
  }

  function triggerPhotoJitter() {
    if (!isIntroAnimating()) {
      return;
    }

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

  function scheduleJitter() {
    if (!isIntroAnimating()) {
      return;
    }

    const nextDelay = 1100 + Math.random() * 1800;
    jitterTimeoutId = setTimeout(() => {
      if (!isIntroAnimating()) {
        return;
      }

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
    if (!isIntroAnimating()) {
      return;
    }

    const dots = ".".repeat(frameIndex);
    loadingTarget.textContent = loadingText + dots;

    loadingTimeoutId = setTimeout(() => {
      startLoadingAnimation((frameIndex + 1) % 4);
    }, loadingFrameDelay);
  }

  function stopIntroTimers() {
    if (jitterTimeoutId) {
      clearTimeout(jitterTimeoutId);
      jitterTimeoutId = null;
    }

    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }
  }

  function showStartButton() {
    isReadyToStart = true;
    stopIntroTimers();
    setPhotoMode(true);
    loadingTarget.textContent = "";
    clearStartTapState();
    clearLanguageTapState();
    loading.classList.add("ready");
    startButton.hidden = false;
    document.body.classList.add("intro-ready");
    document.body.classList.remove("start-hover-enabled");
    window.addEventListener("pointermove", armStartHover, { once: true });
    markFlowEvent("wayoki_intro_finished", {
      path: window.location.pathname
    });
  }

  function showLanguagePicker() {
    if (hasEnteredMainScreen) {
      return;
    }

    hasEnteredMainScreen = true;
    stopIntroTimers();
    resetJitter();
    setPhotoMode(true);
    clearStartTapState();
    clearLanguageTapState();
    window.removeEventListener("pointermove", armStartHover);
    startButton.hidden = true;
    languagePicker.hidden = false;
    loading.classList.add("language-mode");
    markFlowEvent("wayoki_language_picker_shown", {
      path: window.location.pathname
    });
  }

  function navigateToLanguage(languageCode) {
    const targetUrl = languageCode === "ru" ? "/ru/" : "/en/";
    window.location.assign(targetUrl);
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

  startButton.addEventListener("click", (event) => {
    if (!isTouchLikeInteraction()) {
      showLanguagePicker();
      return;
    }

    event.preventDefault();

    if (hasEnteredMainScreen || startTapTimeoutId) {
      return;
    }

    startButton.classList.add("tap-hover-active");
    startTapTimeoutId = setTimeout(() => {
      startTapTimeoutId = null;
      showLanguagePicker();
    }, 500);
  });
  languageOptions.forEach((option) => {
    option.addEventListener("click", (event) => {
      if (!isTouchLikeInteraction()) {
        navigateToLanguage(option.dataset.lang);
        return;
      }

      event.preventDefault();

      if (languageTapTimeoutId) {
        return;
      }

      clearLanguageTapState();
      option.classList.add("tap-hover-active");
      languageTapTimeoutId = setTimeout(() => {
        languageTapTimeoutId = null;
        navigateToLanguage(option.dataset.lang);
      }, 500);
    });
  });

  typeText(siteTarget, siteText, () => {
    typeText(loadingTarget, loadingText, () => {
      setTimeout(() => startLoadingAnimation(1), loadingFrameDelay);
    });
  });

  setTimeout(showStartButton, initialTransitionDelay);
});
