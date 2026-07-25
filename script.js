const API_URL = "http://127.0.0.1:8000/predict";
const SCALE_MAX = 10; 

const form = document.getElementById("predict-form");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");

const states = {
  idle: document.getElementById("state-idle"),
  loading: document.getElementById("state-loading"),
  result: document.getElementById("state-result"),
  error: document.getElementById("state-error"),
};

const scoreValueEl = document.getElementById("score-value");
const gaugeFillEl = document.getElementById("gauge-fill");
const gaugeNeedleEl = document.getElementById("gauge-needle");
const resultLabelEl = document.getElementById("result-label");
const resultCopyEl = document.getElementById("result-copy");
const errorCopyEl = document.getElementById("error-copy");

const GAUGE_LENGTH = 314; // matches stroke-dasharray in CSS, ~ pi * r(100)
const GAUGE_CENTER = { x: 120, y: 130 };
const GAUGE_RADIUS = 100;

function showState(name) {
  Object.values(states).forEach((el) => (el.hidden = true));
  states[name].hidden = false;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.querySelector(".btn-label").textContent = isLoading
    ? "Reading…"
    : "Read my balance";
}

function bandFor(score) {
  const pct = score / SCALE_MAX;
  if (pct >= 0.66) {
    return {
      color: "var(--sage)",
      label: "Feeling grounded",
      copy: "Your inputs point to a healthy rhythm between screen time and everything else in your day.",
    };
  }
  if (pct >= 0.4) {
    return {
      color: "var(--amber)",
      label: "A little off balance",
      copy: "There's some tension between your online habits and your rest, study, or activity time worth keeping an eye on.",
    };
  }
  return {
    color: "var(--rose)",
    label: "Worth paying attention to",
    copy: "The pattern here suggests real strain. Consider adjusting sleep, activity, or screen time — or talking to someone you trust.",
  };
}

function animateGauge(score) {
  const clamped = Math.max(0, Math.min(SCALE_MAX, score));
  const fraction = clamped / SCALE_MAX;

  // Fill: dashoffset goes from full length (0%) to 0 (100%)
  const offset = GAUGE_LENGTH * (1 - fraction);
  gaugeFillEl.style.strokeDashoffset = String(offset);

  // Needle: sweep from 180deg (left) to 0deg (right) across the semicircle
  const angleDeg = 180 * (1 - fraction);
  const angleRad = (angleDeg * Math.PI) / 180;
  const nx = GAUGE_CENTER.x + GAUGE_RADIUS * Math.cos(angleRad);
  const ny = GAUGE_CENTER.y - GAUGE_RADIUS * Math.sin(angleRad);
  gaugeNeedleEl.setAttribute("cx", nx.toFixed(1));
  gaugeNeedleEl.setAttribute("cy", ny.toFixed(1));

  const { color, label, copy } = bandFor(clamped);
  gaugeFillEl.style.stroke = color;
  resultLabelEl.textContent = label;
  resultLabelEl.style.color = color;
  resultCopyEl.textContent = copy;
}

function readFormData() {
  const fd = new FormData(form);
  return {
    age: Number(fd.get("age")),
    gender: fd.get("gender"),
    country: fd.get("country"),
    academic_level: fd.get("academic_level"),
    most_used_platform: fd.get("most_used_platform"),
    purpose_of_use: fd.get("purpose_of_use"),
    avg_daily_usage_hours: Number(fd.get("avg_daily_usage_hours")),
    daily_unlocks: Number(fd.get("daily_unlocks")),
    study_hours: Number(fd.get("study_hours")),
    physical_activity_hours: Number(fd.get("physical_activity_hours")),
    sleep_hours_per_night: Number(fd.get("sleep_hours_per_night")),
    stress_level: fd.get("stress_level"),
  };
}

async function submitForm(e) {
  e.preventDefault();
  formError.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = readFormData();

  setLoading(true);
  showState("loading");

  // reset gauge to zero before animating in, so repeat checks feel fresh
  gaugeFillEl.style.transition = "none";
  gaugeNeedleEl.style.transition = "none";
  animateGauge(0);
  // force reflow so the transition re-enables cleanly on next frame
  void gaugeFillEl.offsetWidth;
  gaugeFillEl.style.transition = "";
  gaugeNeedleEl.style.transition = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = `Server responded with ${res.status}.`;
      try {
        const errBody = await res.json();
        if (errBody?.detail) {
          detail = Array.isArray(errBody.detail)
            ? errBody.detail.map((d) => d.msg).join(" ")
            : String(errBody.detail);
        }
      } catch (_) {
        /* ignore parse errors on error body */
      }
      throw new Error(detail);
    }

    const data = await res.json();
    const score = Number(data.predicted_mental_health_score);

    scoreValueEl.textContent = score.toFixed(1);
    animateGauge(score);
    showState("result");
  } catch (err) {
    errorCopyEl.textContent =
      err instanceof TypeError
        ? "Couldn't reach the prediction server. Make sure the FastAPI backend is running on 127.0.0.1:8000."
        : err.message || "Something went wrong while reading your score.";
    showState("error");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", submitForm);

document.getElementById("reset-btn").addEventListener("click", () => {
  showState("idle");
});

document.getElementById("retry-btn").addEventListener("click", () => {
  submitForm(new Event("submit"));
});