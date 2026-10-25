/* ==========================================================
   SafeScan AI — PLACEHOLDER analyser
   This is NOT an AI. It is a simple keyword stub so the
   website flow works end to end. To connect a real model,
   replace analyzeMessage() with a call to your backend that
   returns the same shape:
     { risk: "high"|"medium"|"low", confidence: "high"|"medium"|"low",
       type: "tax"|"gov"|"bank"|..., flags: [flagId],
       spans: [{ start, end, flags: [flagId] }], steps: [stepId] }
   ========================================================== */
(function () {
  const RULES = {
    urgency: { w: 2, re: /\b(urgent(ly)?|immediately|right away|today|tonight|within \d+ ?(hours?|hrs?|minutes?|mins?|days?)|final (notice|warning|reminder)|last (chance|warning)|act now|asap|expires?|expiring|(pay|call|click|reply|respond) now|before it'?s too late)\b|urgente|immédiatement|inmediatamente|aujourd'hui|hoy|至急|今すぐ|本日中|तुरंत|فورا|عاجل/i },
    payment: { w: 2, re: /\b(pay(ment)?|owe|unpaid|outstanding|fee|fine|transfer|deposit|gift ?cards?|itunes|bitcoin|crypto|wire|western union|refund|invoice|debt)\b|[$£€¥₹]\s?\d[\d,.]*|\b\d[\d,.]*\s?(dollars|usd|aud|eur|euros?|pounds)\b|payer|pagar|pago|支払|振込|भुगतान|دفع/i },
    threat:  { w: 3, re: /\b(legal action|arrest(ed)?|police|warrant|suspend(ed)?|locked|blocked|court|penalt(y|ies)|deport(ed|ation)?|terminat(e|ed)|disconnect(ed)?|prosecut\w*|frozen|freeze|closed|legal proceedings)\b|poursuites|demanda|逮捕|停止|गिरफ्तार|اعتقال/i },
    number:  { w: 2, re: /(?:\+?\d[\d\s().-]{7,}\d)/ },
    link:    { w: 3, re: /\b(?:https?:\/\/|www\.)[^\s<>"]+|\b[a-z0-9-]+\.(?:ly|xyz|top|click|info|link|cc|ru|tk|io|co|me|site|online|live|vip|shop)(?:\/[^\s]*)?\b/i },
    credentials: { w: 3, re: /\b(password|passcode|pin|otp|one[- ]time (code|password)|verification code|security code|cvv|card (number|details)|bank details|login details|log ?in|sign ?in|verify your (account|identity|details)|confirm your (account|identity|details)|update your (details|account|payment))\b|mot de passe|contraseña|暗証番号|パスワード|पासवर्ड|كلمة المرور/i },
    prize:   { w: 2, re: /\b(you('ve| have)? won|winner|prize|lottery|jackpot|congratulations|free gift|reward|claim (your|now)|selected)\b|gagné|ganado|当選|इनाम|جائزة/i },
    impersonation: { w: 1, re: /\b(tax office|ato|irs|hmrc|tax|government|mygov|centrelink|medicare|police|bank|paypal|amazon|apple|microsoft|netflix|post office|australia post|auspost|usps|dhl|fedex|ups|courier|delivery|parcel|package|customs|telstra|optus)\b|impôts|hacienda|税務署|銀行|बैंक|مصرف|بنك/i },
    secrecy: { w: 3, re: /\b(don'?t tell|do not tell|keep (this|it) (a )?secret|between us|anydesk|teamviewer|remote access|install (this|the) app)\b/i },
    family:  { w: 3, re: /\b(hi (mum|mom|dad)|hey (mum|mom|dad)|new number|lost my phone|broke my phone|phone (is )?broken)\b|salut maman|hola mamá/i },
    invest:  { w: 3, re: /\b(guaranteed (return|profit|income)s?|investment opportunity|double your money|risk[- ]free|work from home|earn \$?\d+|passive income|trading platform)\b/i }
  };

  const TYPE_RULES = [
    ["family", (t, f) => f.has("family")],
    ["tax", (t) => /\b(tax|ato|irs|hmrc)\b|impôts|hacienda|税/i.test(t)],
    ["tech", (t, f) => f.has("secrecy") && /microsoft|apple|virus|computer|tech support|anydesk|teamviewer/i.test(t)],
    ["bank", (t) => /\bbank|paypal|card\b|銀行|बैंक|بنك|مصرف/i.test(t)],
    ["delivery", (t) => /deliver|parcel|package|courier|auspost|post office|usps|dhl|fedex|customs/i.test(t)],
    ["gov", (t) => /government|mygov|centrelink|medicare|police|court/i.test(t)],
    ["prize", (t, f) => f.has("prize")],
    ["invest", (t, f) => f.has("invest")],
    ["phishing", (t, f) => f.has("link") || f.has("credentials")]
  ];

  function splitSentences(text) {
    const out = [];
    // A sentence ends at punctuation followed by a space, or at a line break ("$2.99" is not split)
    const re = /[^\n]+?(?:[.!?]+(?=\s|$)|[。！？]+|(?=\n)|$)[^\S\n]*/g;
    let m;
    while ((m = re.exec(text))) {
      if (m[0].trim()) out.push({ start: m.index, end: m.index + m[0].replace(/\s+$/, "").length, text: m[0] });
      if (m[0] === "") re.lastIndex++;
    }
    return out;
  }

  function analyzeMessage(text) {
    const found = new Set();
    let score = 0;
    for (const [id, rule] of Object.entries(RULES)) {
      if (rule.re.test(text)) { found.add(id); score += rule.w; }
    }
    // Impersonation alone is not a scam; only count it with other signs
    if (found.size === 1 && found.has("impersonation")) { found.clear(); score = 0; }

    const spans = splitSentences(text)
      .map(s => ({ start: s.start, end: s.end, flags: [...found].filter(id => id !== "impersonation" && RULES[id].re.test(s.text)) }))
      .filter(s => s.flags.length);

    const risk = score >= 7 ? "high" : score >= 3 ? "medium" : "low";
    const confidence = found.size >= 4 || score === 0 ? "high" : found.size >= 2 ? "medium" : "low";
    let type = "safe";
    if (risk !== "low" || found.size) {
      type = (TYPE_RULES.find(([, test]) => test(text, found)) || ["generic"])[0];
    }

    // Order flags so the most serious appear first
    const order = ["threat", "credentials", "payment", "urgency", "link", "number", "secrecy", "family", "prize", "invest", "impersonation"];
    const flags = order.filter(id => found.has(id));

    const steps = [];
    if (risk === "low") {
      steps.push("careful", "official", "trust", "paid");
    } else {
      if (found.has("number")) steps.push("noCall");
      if (found.has("link")) steps.push("noClick");
      if (found.has("credentials")) steps.push("noShare");
      if (found.has("family")) steps.push("family");
      if (!steps.length) steps.push("noReply");
      if (found.has("payment") && steps.length < 2) steps.push("noPay");
      steps.push("block", "report", "paid");
    }

    return { risk, confidence, type, flags, spans, steps };
  }

  window.SafeScanAnalyzer = { analyzeMessage };
})();
