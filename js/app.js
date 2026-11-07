/* ==========================================================================
   maidMod — interaction layer
   Vanilla JS. No build step, no dependencies.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const root = document.documentElement;
  const body = document.body;
  const STORAGE_KEY = "etternalize.prefs";

  const DEFAULT_PREFS = Object.freeze({
    theme: "dark",
    accent: "sky",
    blur: "on",
    motion: "on",
    brightness: 100,
    wallpaper: "image",
  });

  let prefs = { ...DEFAULT_PREFS };
  let lastFocus = null;

  /* ---------------------------------------------------------------------
     Preferences
     --------------------------------------------------------------------- */

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      prefs = { ...DEFAULT_PREFS, ...saved };
    } catch {
      prefs = { ...DEFAULT_PREFS };
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* private mode, file://, or storage disabled — settings just don't persist */
    }
  }

  function applyPrefs() {
    root.dataset.theme = prefs.theme;
    root.dataset.accent = prefs.accent;
    body.dataset.blur = prefs.blur;
    body.dataset.motion = prefs.motion;
    body.dataset.wallpaper = prefs.wallpaper;

    const dim = ((100 - prefs.brightness) / 100) * 0.72;
    root.style.setProperty("--screen-dim", dim.toFixed(3));

    $$("[data-set-theme]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.setTheme === prefs.theme));
    });
    $$("[data-set-accent]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.setAccent === prefs.accent));
    });
    $$("[data-set-wallpaper]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.setWallpaper === prefs.wallpaper));
    });
    $$("[data-toggle]").forEach((btn) => {
      btn.setAttribute("aria-checked", String(prefs[btn.dataset.toggle] === "on"));
    });

    const themeToggle = $("[data-theme-toggle]");
    if (themeToggle) {
      const next = prefs.theme === "dark" ? "light" : "dark";
      const icon = themeToggle.querySelector(".ms");
      if (icon) icon.textContent = next === "light" ? "light_mode" : "dark_mode";
      themeToggle.setAttribute("aria-label", `Switch to ${next} theme`);
    }

    const slider = $("#brightness");
    if (slider) {
      slider.value = String(prefs.brightness);
      slider.style.setProperty("--fill", `${prefs.brightness}%`);
    }
    const brightnessLabel = $("#brightness-value");
    if (brightnessLabel) brightnessLabel.textContent = `${prefs.brightness}%`;

    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = prefs.theme === "dark" ? "#0f1417" : "#f5fafd";

    savePrefs();
  }

  function updatePrefs(patch) {
    prefs = { ...prefs, ...patch };
    applyPrefs();
  }

  function toggleTheme() {
    updatePrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
  }

  /* ---------------------------------------------------------------------
     Clock
     --------------------------------------------------------------------- */

  const clockEl = $("#clock");
  const clockDateEl = $("#clock-date");
  const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  function tickClock() {
    const now = new Date();
    if (clockEl) clockEl.textContent = timeFormat.format(now);
    if (clockDateEl) clockDateEl.textContent = dateFormat.format(now).toUpperCase();
  }

  /* ---------------------------------------------------------------------
     Overlays (launcher / settings / wallpaper)
     --------------------------------------------------------------------- */

  const overlays = $$(".overlay");

  function openOverlay(overlay) {
    if (!overlay) return;

    if (!lastFocus) lastFocus = document.activeElement;

    const panel = overlay.dataset.panel;
    overlay.hidden = false;

    overlays.forEach((other) => {
      if (other !== overlay && !other.hidden) closeOverlay(other, { restoreFocus: false });
    });

    body.style.overflow = "hidden";

    if (panel === "launcher") {
      const input = $("#launcher-input");
      if (input) input.value = "";
      renderLauncher("");
    }

    const focusTarget =
      (panel === "launcher" && $("#launcher-input")) ||
      overlay.querySelector("[data-close]") ||
      overlay.querySelector("button, input, a[href]");

    requestAnimationFrame(() => focusTarget && focusTarget.focus({ preventScroll: true }));
  }

  function closeOverlay(overlay, { restoreFocus = true } = {}) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (!overlays.some((other) => !other.hidden)) {
      body.style.overflow = "";
      if (restoreFocus && lastFocus instanceof HTMLElement) {
        lastFocus.focus({ preventScroll: true });
      }
      lastFocus = null;
    }
  }

  function openPanel(name) {
    openOverlay(overlays.find((overlay) => overlay.dataset.panel === name));
  }

  function openOverlayEntry() {
    return overlays.find((overlay) => !overlay.hidden) || null;
  }

  function toggleLauncher() {
    const open = openOverlayEntry();
    if (open && open.dataset.panel === "launcher") closeOverlay(open);
    else openPanel("launcher");
  }

  /* ---------------------------------------------------------------------
     Launcher
     --------------------------------------------------------------------- */

  const launcherInput = $("#launcher-input");
  const launcherResults = $("#launcher-results");
  const launcherPanel = $("#panel-launcher");

  let launcherItems = [];
  let launcherMatches = [];
  let launcherIndex = 0;

  function sectionItems() {
    return $$("[data-section]").map((section) => ({
      title: section.dataset.title || section.id,
      sub: section.dataset.sub || "Section",
      icon: section.dataset.icon || "arrow_outward",
      kind: "Section",
      run: () => {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        try {
          history.replaceState(null, "", `#${section.id}`);
        } catch {
          /* some file:// contexts refuse history updates — scrolling still works */
        }
      },
    }));
  }

  function projectItems() {
    return $$(".project").map((card) => ({
      title: card.dataset.title || "Project",
      sub: card.dataset.sub || "Project",
      icon: "code",
      kind: "Project",
      run: () => {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("is-flash");
        window.setTimeout(() => card.classList.remove("is-flash"), 1400);
        card.focus({ preventScroll: true });
      },
    }));
  }

  function actionItems() {
    return [
      {
        title: "Toggle theme",
        sub: "Switch between dark and light",
        icon: "brightness_6",
        kind: "Action",
        keywords: "appearance dark light night mode",
        run: toggleTheme,
      },
      {
        title: "Appearance settings",
        sub: "Theme, accent, blur, brightness",
        icon: "tune",
        kind: "Action",
        keywords: "settings theme accent colour blur brightness",
        run: () => openPanel("settings"),
      },
      {
        title: "Change wallpaper",
        sub: "Wallpaper, aurora, ember, mono",
        icon: "brush",
        kind: "Action",
        keywords: "wallpaper background backdrop",
        run: () => openPanel("wallpaper"),
      },
      {
        title: "Copy email address",
        sub: "hello@example.com",
        icon: "content_copy",
        kind: "Action",
        keywords: "email contact copy mail",
        run: () => copyText(getEmail(), "Email copied to clipboard"),
      },
      {
        title: "Back to top",
        sub: "Scroll to the hero",
        icon: "expand_less",
        kind: "Action",
        keywords: "top home start scroll",
        run: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
    ];
  }

  function scoreItem(item, query) {
    if (!query) return 1;
    const title = item.title.toLowerCase();
    const haystack = `${item.title} ${item.sub} ${item.keywords || ""}`.toLowerCase();

    if (title.startsWith(query)) return 100;
    if (title.includes(query)) return 60;
    if (haystack.includes(query)) return 30;

    const words = query.split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every((word) => haystack.includes(word))) return 20;
    return 0;
  }

  function renderLauncher(query) {
    if (!launcherResults) return;

    const q = query.trim().toLowerCase();
    launcherItems = [...sectionItems(), ...projectItems(), ...actionItems()];
    launcherMatches = launcherItems
      .map((item) => ({ item, score: scoreItem(item, q) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 9)
      .map((entry) => entry.item);

    launcherIndex = 0;
    launcherResults.replaceChildren();

    if (launcherMatches.length === 0) {
      const empty = document.createElement("li");
      empty.className = "palette__empty";
      empty.textContent = "Nothing matches that. Try “work”, “theme”, or “wallpaper”.";
      launcherResults.append(empty);
      return;
    }

    launcherMatches.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "palette__item";
      li.dataset.index = String(index);
      li.id = `launcher-option-${index}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(index === launcherIndex));

      const icon = document.createElement("span");
      icon.className = "ms";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon;

      const text = document.createElement("span");
      text.className = "palette__text";

      const title = document.createElement("span");
      title.className = "palette__title";
      title.textContent = item.title;

      const sub = document.createElement("span");
      sub.className = "palette__sub";
      sub.textContent = item.sub;

      text.append(title, sub);

      const kind = document.createElement("span");
      kind.className = "palette__kind";
      kind.textContent = item.kind;

      li.append(icon, text, kind);
      launcherResults.append(li);
    });

    launcherInput?.setAttribute("aria-controls", "launcher-results");
    launcherInput?.setAttribute("aria-activedescendant", "launcher-option-0");
  }

  function setLauncherIndex(next) {
    if (!launcherMatches.length) return;
    launcherIndex = (next + launcherMatches.length) % launcherMatches.length;

    $$(".palette__item", launcherResults).forEach((li, index) => {
      li.setAttribute("aria-selected", String(index === launcherIndex));
    });

    if (launcherInput) {
      launcherInput.setAttribute("aria-activedescendant", `launcher-option-${launcherIndex}`);
    }

    const active = $('.palette__item[aria-selected="true"]', launcherResults);
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function runLauncherItem(item) {
    if (!item) return;
    closeOverlay(launcherPanel);
    requestAnimationFrame(() => item.run());
  }

  if (launcherInput) {
    launcherInput.addEventListener("input", () => renderLauncher(launcherInput.value));

    launcherInput.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLauncherIndex(launcherIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setLauncherIndex(launcherIndex - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        runLauncherItem(launcherMatches[launcherIndex]);
      }
    });
  }

  if (launcherResults) {
    launcherResults.addEventListener("click", (event) => {
      const li = event.target.closest(".palette__item");
      if (!li) return;
      runLauncherItem(launcherMatches[Number(li.dataset.index)]);
    });

    launcherResults.addEventListener("mouseover", (event) => {
      const li = event.target.closest(".palette__item");
      if (!li) return;
      const index = Number(li.dataset.index);
      if (index !== launcherIndex) setLauncherIndex(index);
    });
  }

  /* ---------------------------------------------------------------------
     Clipboard & toast
     --------------------------------------------------------------------- */

  let toastTimer = 0;

  function toast(message, icon = "check") {
    const el = $("#toast");
    const iconEl = $("#toast-icon");
    const messageEl = $("#toast-message");
    if (!el || !iconEl || !messageEl) return;

    iconEl.textContent = icon;
    messageEl.textContent = message;
    el.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  function getEmail() {
    const el = $("[data-copy-email]") || $("[data-email]");
    return el?.dataset.copyEmail || el?.dataset.email || "hello@example.com";
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      try {
        document.execCommand("copy");
      } catch {
        toast("Couldn't copy automatically", "clear");
        return;
      } finally {
        helper.remove();
      }
    }
    toast(message || "Copied to clipboard", "check");
  }

  /* ---------------------------------------------------------------------
     Project filters
     --------------------------------------------------------------------- */

  const workCount = $("#work-count");
  const projectCards = $$(".project");

  function applyFilter(filter) {
    $$("[data-filter]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.filter === filter));
    });

    let visible = 0;
    projectCards.forEach((card) => {
      const show = filter === "all" || card.dataset.category === filter;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (workCount) workCount.textContent = `${visible} project${visible === 1 ? "" : "s"}`;
  }

  $$("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => applyFilter(btn.dataset.filter || "all"));
  });

  /* ---------------------------------------------------------------------
     Global click delegation
     --------------------------------------------------------------------- */

  document.addEventListener("click", (event) => {
    const target = event.target;

    const openTrigger = target.closest("[data-open]");
    if (openTrigger) {
      openPanel(openTrigger.dataset.open);
      return;
    }

    const closeTrigger = target.closest("[data-close]");
    if (closeTrigger) {
      closeOverlay(closeTrigger.closest(".overlay"));
      return;
    }

    if (target.classList.contains("overlay")) {
      closeOverlay(target);
      return;
    }

    const themeBtn = target.closest("[data-set-theme]");
    if (themeBtn) {
      updatePrefs({ theme: themeBtn.dataset.setTheme });
      return;
    }

    const accentBtn = target.closest("[data-set-accent]");
    if (accentBtn) {
      updatePrefs({ accent: accentBtn.dataset.setAccent });
      return;
    }

    const wallpaperBtn = target.closest("[data-set-wallpaper]");
    if (wallpaperBtn) {
      updatePrefs({ wallpaper: wallpaperBtn.dataset.setWallpaper });
      return;
    }

    const toggleBtn = target.closest("[data-toggle]");
    if (toggleBtn) {
      const key = toggleBtn.dataset.toggle;
      updatePrefs({ [key]: prefs[key] === "on" ? "off" : "on" });
      return;
    }

    if (target.closest("[data-theme-toggle]")) {
      toggleTheme();
      return;
    }

    const copyBtn = target.closest("[data-copy-email]");
    if (copyBtn) {
      copyText(copyBtn.dataset.copyEmail, "Email copied to clipboard");
      return;
    }

    if (target.closest("[data-reset]")) {
      prefs = { ...DEFAULT_PREFS };
      applyPrefs();
      toast("Defaults restored", "refresh");
      return;
    }

    const placeholder = target.closest('a[href="#"]');
    if (placeholder) {
      event.preventDefault();
      toast("Placeholder link — point it at your real URL", "info");
    }
  });

  /* ---------------------------------------------------------------------
     Keyboard
     --------------------------------------------------------------------- */

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    const isTyping =
      /^(input|textarea|select)$/i.test(active?.tagName || "") || Boolean(active?.isContentEditable);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggleLauncher();
      return;
    }

    if (event.key === "/" && !isTyping && !openOverlayEntry()) {
      event.preventDefault();
      openPanel("launcher");
      return;
    }

    if (event.key === "Escape") {
      const open = openOverlayEntry();
      if (open) {
        event.preventDefault();
        closeOverlay(open);
      }
      return;
    }

    if (event.key === "Tab") {
      const open = openOverlayEntry();
      if (!open) return;

      const focusable = $$(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        open
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------------------------------------------------------------------
     Brightness slider
     --------------------------------------------------------------------- */

  const brightnessSlider = $("#brightness");
  if (brightnessSlider) {
    brightnessSlider.addEventListener("input", () => {
      updatePrefs({ brightness: Number(brightnessSlider.value) });
    });
  }

  /* ---------------------------------------------------------------------
     Nav highlighting
     --------------------------------------------------------------------- */

  const navLinks = $$("[data-nav]");
  const sections = $$("[data-section]");

  function setActiveNav(id) {
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.nav === id);
    });
  }

  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveNav(entry.target.id);
        });
      },
      { rootMargin: "-42% 0px -52% 0px", threshold: 0 }
    );

    sections.forEach((section) => navObserver.observe(section));
  } else {
    setActiveNav("home");
  }

  /* ---------------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------------- */

  const revealables = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );

    revealables.forEach((el) => revealObserver.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */

  loadPrefs();
  applyPrefs();
  tickClock();
  window.setInterval(tickClock, 10000);

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  renderLauncher("");
})();
