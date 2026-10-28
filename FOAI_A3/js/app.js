/* ==========================================================
   SafeScan AI — app logic
   ========================================================== */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    }
  };

  const state = {
    lang: store.get("safescan.lang", null),
    result: null,       // last analysis result
    text: "",           // text that was analysed
    image: null,        // data URL of uploaded screenshot
    imageName: "",
    fromImage: false,
    fromExample: false, // scan started from a practice example
    scanTimer: null,
    tutStep: 0
  };

  // Demo text used when a screenshot is uploaded. A real build would run OCR / an AI vision model here.
  const SCREENSHOT_DEMO_TEXT =
    "This is a final notice from the Tax Office. You owe $1,240 in unpaid tax. Pay today to avoid legal action. Call 1800 000 000 immediately.";

  /* ---------------- i18n ---------------- */
  // Demo build: the language choice is remembered, but the site is always shown in English.
  // Set to false to use the translations in i18n.js.
  const DEMO_ENGLISH_ONLY = true;
  const DEMO_NOTE = "Demo version: all languages are shown in English for now.";

  function displayLang() {
    return DEMO_ENGLISH_ONLY ? "en" : (state.lang || "en");
  }

  function t(key, lang = displayLang()) {
    if (DEMO_ENGLISH_ONLY) lang = "en";
    const dict = I18N[lang] || I18N.en;
    return dict[key] ?? I18N.en[key] ?? key;
  }

  function applyLanguage(lang) {
    state.lang = lang;
    const shown = displayLang();
    document.documentElement.lang = shown;
    document.documentElement.dir = LANGS[shown].dir;
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$(".voice-lang").forEach(sel => { sel.value = lang; });
    renderTutorial();
    renderSigns();
    renderExamples();
    if (state.result) { renderResults(); renderSteps(); }
  }

  /* ---------------- Language modal ---------------- */
  const modal = $("#lang-modal");
  let lastFocus = null;

  function openLangModal() {
    lastFocus = document.activeElement;
    const current = state.lang || "en";
    $$('input[name="lang"]', modal).forEach(r => { r.checked = r.value === current; });
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $('input[name="lang"]:checked', modal).focus();
  }

  function closeLangModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  $("#lang-form").addEventListener("submit", e => {
    e.preventDefault();
    const lang = $('input[name="lang"]:checked', modal).value;
    const changed = lang !== state.lang;
    store.set("safescan.lang", lang);
    applyLanguage(lang);
    closeLangModal();
    if (DEMO_ENGLISH_ONLY && lang !== "en") toast(DEMO_NOTE);
    else if (changed) toast(t("toast.lang"));
  });

  // The first-visit modal can only be closed by choosing a language
  modal.addEventListener("click", e => {
    if (e.target === modal && store.get("safescan.lang", null)) closeLangModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!$("#lightbox").hidden) { $("#lightbox").hidden = true; return; }
      if (!modal.hidden && store.get("safescan.lang", null)) closeLangModal();
    }
    // Keep keyboard focus inside the modal
    if (e.key === "Tab" && !modal.hidden) {
      const focusables = $$("input, button", modal);
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- Router ---------------- */
  const ROUTES = ["home", "learn", "scan", "results", "next-steps"];
  const NAV_FOR = { results: "scan", "next-steps": "scan" };

  function route() {
    let page = location.hash.replace("#", "") || "home";
    if (!ROUTES.includes(page)) page = "home";
    if ((page === "results" || page === "next-steps") && !state.result) {
      history.replaceState(null, "", "#scan");
      page = "scan";
    }
    $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
    const navKey = NAV_FOR[page] || page;
    $$(".nav-links a").forEach(a => {
      const on = a.dataset.route === navKey;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("#nav-links").classList.remove("open");
    $(".nav-toggle").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" });
    document.title = page === "home" ? "SafeScan AI" : `${$("#page-" + page + " h1").textContent.trim()} · SafeScan AI`;
  }
  window.addEventListener("hashchange", route);

  // Report and Resources tabs are placeholders with no page behind them
  $$(".nav-placeholder").forEach(a => a.addEventListener("click", e => e.preventDefault()));

  $(".nav-toggle").addEventListener("click", e => {
    const open = $("#nav-links").classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", String(open));
  });

  /* ---------------- Toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ---------------- Scan: input ---------------- */
  const form = $("#scan-form");
  const textarea = $("#msg-input");
  const dropzone = $("#dropzone");
  const fileInput = $("#file-input");

  function selectTab(which) {
    $("#tab-text").setAttribute("aria-selected", String(which === "text"));
    $("#tab-upload").setAttribute("aria-selected", String(which === "upload"));
    dropzone.classList.toggle("active-tab", which === "upload");
  }
  $("#tab-text").addEventListener("click", () => { selectTab("text"); textarea.focus(); });
  $("#tab-upload").addEventListener("click", () => { selectTab("upload"); fileInput.click(); });
  textarea.addEventListener("focus", () => selectTab("text"));

  dropzone.addEventListener("click", e => {
    if (e.target.closest("#remove-file")) return;
    selectTab("upload");
    fileInput.click();
  });
  dropzone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  ["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.remove("drag");
  }));
  dropzone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });
  // Allow pasting an image straight from the clipboard
  textarea.addEventListener("paste", e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); handleFile(item.getAsFile()); }
  });

  function handleFile(file) {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { showError(t("scan.badFile")); return; }
    hideError();
    const reader = new FileReader();
    reader.onload = () => {
      state.image = reader.result;
      state.imageName = file.name || "screenshot.png";
      $("#preview-img").src = state.image;
      $("#preview-name").textContent = state.imageName;
      $("#drop-empty").hidden = true;
      $("#drop-preview").hidden = false;
      selectTab("upload");
    };
    reader.readAsDataURL(file);
  }

  function clearFile() {
    state.image = null;
    state.imageName = "";
    fileInput.value = "";
    $("#drop-empty").hidden = false;
    $("#drop-preview").hidden = true;
  }
  $("#remove-file").addEventListener("click", e => { e.stopPropagation(); clearFile(); });

  function showError(msg) { const el = $("#scan-error"); el.textContent = msg; el.hidden = false; }
  function hideError() { $("#scan-error").hidden = true; }
  textarea.addEventListener("input", hideError);

  /* ---------------- Scan: consent ---------------- */
  // Asked before every scan. The answer never affects the result.
  const consentAnswer = () => $('input[name="consent"]:checked', form)?.value || null;
  function clearConsent() {
    $$('input[name="consent"]', form).forEach(r => { r.checked = false; });
    $("#consent").classList.remove("needs-answer");
  }
  // Demo build: the answer is collected but no copy of the message is kept.
  const consentBox = $("#consent");
  $$('input[name="consent"]', form).forEach(r => r.addEventListener("change", () => {
    consentBox.classList.remove("needs-answer");
    hideError();
  }));

  form.addEventListener("submit", e => {
    e.preventDefault();
    const fromExample = state.fromExample;
    state.fromExample = false;
    const text = textarea.value.trim();
    if (!text && !state.image) { showError(t("scan.empty")); textarea.focus(); return; }
    // Practice examples are not the user's messages, so consent is not needed for them
    if (!fromExample && !consentAnswer()) {
      showError(t("scan.consentNeeded"));
      consentBox.classList.remove("needs-answer");
      void consentBox.offsetWidth; // restart the shake animation
      consentBox.classList.add("needs-answer");
      consentBox.scrollIntoView({ behavior: "smooth", block: "center" });
      $('input[name="consent"]', form).focus();
      return;
    }
    hideError();
    // Typed text wins over a screenshot if both are given
    state.fromImage = !text && !!state.image;
    state.text = state.fromImage ? SCREENSHOT_DEMO_TEXT : text;
    startScan();
  });

  /* ---------------- Scan: progress ---------------- */
  const SCAN_MS = 4200;

  function startScan() {
    const echo = $("#msg-echo");
    echo.innerHTML = "";
    if (state.fromImage) {
      const img = document.createElement("img");
      img.src = state.image;
      img.alt = state.imageName;
      echo.appendChild(img);
    } else {
      echo.textContent = state.text;
    }
    form.hidden = true;
    $("#scanning").hidden = false;
    setProgress(0);
    $("#cancel-scan").focus();

    const started = performance.now();
    clearInterval(state.scanTimer);
    state.scanTimer = setInterval(() => {
      const pct = Math.min(100, Math.round(((performance.now() - started) / SCAN_MS) * 100));
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(state.scanTimer);
        state.result = SafeScanAnalyzer.analyzeMessage(state.text);
        setTimeout(() => {
          resetScanUI();
          renderResults();
          renderSteps();
          location.hash = "#results";
        }, 350);
      }
    }, 80);
  }

  function setProgress(pct) {
    $("#progress-bar").style.width = pct + "%";
    $("#progress-pct").textContent = pct + " %";
    $("#progress").setAttribute("aria-valuenow", pct);
    $$("#checklist li").forEach((li, i) => {
      const start = i * 25, end = start + 25;
      const status = pct >= end ? "done" : pct >= start ? "current" : "todo";
      li.className = status;
      const icon = status === "done" ? "i-check" : status === "current" ? "i-clock" : "i-box";
      let svg = li.querySelector("svg");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "check-icon");
        svg.setAttribute("aria-hidden", "true");
        svg.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "use"));
        li.prepend(svg);
      }
      svg.firstChild.setAttribute("href", "#" + icon);
    });
  }

  function resetScanUI() {
    clearInterval(state.scanTimer);
    form.hidden = false;
    $("#scanning").hidden = true;
  }

  $("#cancel-scan").addEventListener("click", () => {
    resetScanUI();
    toast(t("toast.cancelled"));
    textarea.focus();
  });

  /* ---------------- Results ---------------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fillVerdict(root) {
    const r = state.result;
    $$('[data-slot="risk-badge"]', root).forEach(el => {
      el.textContent = t("risk." + r.risk);
      el.className = "risk-badge risk-" + r.risk;
    });
    $$('[data-slot="type"]', root).forEach(el => { el.textContent = t("type." + r.type); });
    $$('[data-slot="confidence"]', root).forEach(el => {
      el.textContent = `${t("res.confidence")}: ${t("conf." + r.confidence)}`;
    });
  }

  function renderResults() {
    const r = state.result;
    if (!r) return;
    const page = $("#page-results");
    fillVerdict(page);

    // Highlighted message
    let html = "";
    let pos = 0;
    for (const s of r.spans) {
      html += escapeHtml(state.text.slice(pos, s.start));
      const tip = s.flags.map(f => t(`flag.${f}.t`)).join(" · ");
      html += `<mark class="hl" tabindex="0" title="${escapeHtml(tip)}">${escapeHtml(state.text.slice(s.start, s.end))}</mark>`;
      pos = s.end;
    }
    html += escapeHtml(state.text.slice(pos));
    const box = $("#highlighted");
    box.innerHTML = (state.fromImage
      ? `<p class="label-sm" style="color:var(--muted)">${escapeHtml(t("res.shot"))}</p>` : "") + html;
    $("#hl-hint").hidden = !r.spans.length;

    // Tap a highlight to show its reason
    $$("mark.hl", box).forEach(m => m.addEventListener("click", () => toast(m.title)));

    // Flag cards
    const flags = $("#flags");
    if (!r.flags.length) {
      flags.outerHTML = `<p class="no-flags" id="flags">${escapeHtml(t("res.noFlags"))}</p>`;
    } else {
      const list = r.flags.map(f => `
        <div class="flag">
          <svg aria-hidden="true"><use href="#i-warn"/></svg>
          <div><h4>${escapeHtml(t(`flag.${f}.t`))}</h4><p>${escapeHtml(t(`flag.${f}.d`))}</p></div>
        </div>`).join("");
      if (flags.tagName === "P") flags.outerHTML = `<div class="flags" id="flags">${list}</div>`;
      else flags.innerHTML = list;
    }
  }

  function renderSteps() {
    const r = state.result;
    if (!r) return;
    fillVerdict($("#page-next-steps"));
    $("#steps").innerHTML = r.steps.map((s, i) =>
      `<li><span class="step-num">${i + 1}</span><div><h4>${escapeHtml(t(`step.${s}.t`))}</h4><p>${escapeHtml(t(`step.${s}.d`))}</p></div></li>`
    ).join("");
  }

  /* ---------------- Global actions ---------------- */
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "open-lang") openLangModal();
    if (action === "new-scan") {
      textarea.value = "";
      clearFile();
      clearConsent();
      resetScanUI();
      selectTab("text");
      location.hash = "#scan";
      setTimeout(() => textarea.focus(), 50);
    }
  });

  /* ---------------- Listen (demo) ---------------- */
  // Demo build: there is no audio. The language list only shows how a reader would be chosen.
  $$(".voice-lang").forEach(sel => {
    sel.innerHTML = Object.entries(LANGS).map(([code, l]) => `<option value="${code}">${l.name}</option>`).join("");
  });

  /* ---------------- Learn: tutorial ---------------- */
  const TUTORIAL = [
    "assets/tutorial/language.jpg",
    "assets/tutorial/home.jpg",
    "assets/tutorial/scan-input.jpg",
    "assets/tutorial/scanning.jpg",
    "assets/tutorial/results.jpg",
    "assets/tutorial/next-steps.jpg"
  ];

  function renderTutorial() {
    const i = state.tutStep, n = TUTORIAL.length;
    const img = $("#tut-img");
    img.src = TUTORIAL[i];
    img.alt = `${t("learn.step")} ${i + 1}: ${t(`tut.${i + 1}.t`)}`;
    $("#tut-counter").textContent = `${t("learn.step")} ${i + 1} / ${n}`;
    $("#tut-title").textContent = t(`tut.${i + 1}.t`);
    $("#tut-body").textContent = t(`tut.${i + 1}.d`);
    $("#tut-prev").disabled = i === 0;
    $("#tut-next").hidden = i === n - 1;
    $("#tut-start").hidden = i !== n - 1;
    $("#tut-dots").innerHTML = TUTORIAL.map((_, k) =>
      `<button type="button" class="dot" aria-label="${t("learn.step")} ${k + 1}" ${k === i ? 'aria-current="true"' : ""} data-step="${k}"></button>`
    ).join("");
  }

  function goTut(i) {
    state.tutStep = Math.max(0, Math.min(TUTORIAL.length - 1, i));
    renderTutorial();
  }
  $("#tut-prev").addEventListener("click", () => goTut(state.tutStep - 1));
  $("#tut-next").addEventListener("click", () => goTut(state.tutStep + 1));
  $("#tut-dots").addEventListener("click", e => {
    const d = e.target.closest(".dot");
    if (d) goTut(+d.dataset.step);
  });
  document.addEventListener("keydown", e => {
    if (!$("#page-learn").classList.contains("active") || !modal.hidden) return;
    if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
    const rtl = document.documentElement.dir === "rtl";
    if (e.key === "ArrowRight") goTut(state.tutStep + (rtl ? -1 : 1));
    if (e.key === "ArrowLeft") goTut(state.tutStep + (rtl ? 1 : -1));
  });

  // Lightbox for screenshots
  $(".shot").addEventListener("click", () => {
    const lb = $("#lightbox");
    $("img", lb).src = $("#tut-img").src;
    $("img", lb).alt = $("#tut-img").alt;
    lb.hidden = false;
  });
  $("#lightbox").addEventListener("click", e => { e.currentTarget.hidden = true; });

  /* ---------------- Learn: warning signs & examples ---------------- */
  const SIGN_EXAMPLES = {
    urgency: "“Your account will be closed TODAY unless you act now.”",
    payment: "“Pay the $2.99 redelivery fee to receive your parcel.”",
    threat: "“Failure to pay will result in legal action and arrest.”",
    number: "“Call 1800 000 000 immediately to resolve this.”",
    link: "“Verify your account here: http://secure-bank-login.xyz”",
    credentials: "“Reply with the 6-digit code we just sent you.”",
    prize: "“Congratulations! You’ve won a $1,000 gift card.”",
    impersonation: "“This is the Tax Office / your bank / Australia Post.”",
    secrecy: "“Install AnyDesk so our technician can fix your computer.”",
    family: "“Hi Mum, I lost my phone, this is my new number.”",
    invest: "“Guaranteed returns of 30% a month. Risk-free!”"
  };

  function renderSigns() {
    $("#signs").innerHTML = Object.keys(SIGN_EXAMPLES).map(id => `
      <button type="button" class="sign" aria-expanded="false" aria-controls="sign-ex-${id}">
        <h4><svg aria-hidden="true"><use href="#i-warn"/></svg>${escapeHtml(t(`flag.${id}.t`))}</h4>
        <p>${escapeHtml(t(`flag.${id}.d`))}</p>
        <div class="example" id="sign-ex-${id}" hidden lang="en">${escapeHtml(SIGN_EXAMPLES[id])}</div>
      </button>`).join("");
  }
  $("#signs").addEventListener("click", e => {
    const card = e.target.closest(".sign");
    if (!card) return;
    const open = card.getAttribute("aria-expanded") !== "true";
    card.setAttribute("aria-expanded", String(open));
    $(".example", card).hidden = !open;
  });

  const EXAMPLES = [
    { tag: "Government / tax", text: "This is a final notice from the Tax Office. You owe $1,240 in unpaid tax. Pay today to avoid legal action. Call 1800 000 000 immediately." },
    { tag: "Fake delivery", text: "AusPost: Your parcel is on hold due to an unpaid $2.99 fee. Update your details within 24 hours: http://auspost-redeliver.xyz/track" },
    { tag: "“Hi Mum”", text: "Hi Mum, I broke my phone so this is my new number. Can you transfer $850 for a bill today? Don't tell Dad yet x" },
    { tag: "Normal message", text: "Hi Sam, are we still on for lunch at 12:30 on Friday? Let me know if you'd like to change the place." }
  ];

  function renderExamples() {
    $("#examples").innerHTML = EXAMPLES.map((ex, i) => `
      <div class="example-card">
        <span class="tag" lang="en">${escapeHtml(ex.tag)}</span>
        <blockquote lang="en">${escapeHtml(ex.text)}</blockquote>
        <button type="button" class="btn btn-sm" data-example="${i}">${escapeHtml(t("learn.try"))}</button>
      </div>`).join("");
  }
  $("#examples").addEventListener("click", e => {
    const b = e.target.closest("[data-example]");
    if (!b) return;
    clearFile();
    resetScanUI();
    textarea.value = EXAMPLES[+b.dataset.example].text;
    state.fromExample = true;
    location.hash = "#scan";
    setTimeout(() => form.requestSubmit(), 300);
  });

  /* ---------------- Init ---------------- */
  const firstVisit = !state.lang;
  applyLanguage(state.lang || "en");
  route();
  if (firstVisit) openLangModal();
})();
