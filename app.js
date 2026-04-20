import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// ── Config ──
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API = isLocal ? "http://localhost:8000" : "";

const configRes = await fetch(`${API}/config`);
const firebaseConfig = await configRes.json();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── DOM References ──
const $ = id => document.getElementById(id);
const loginView  = $("login-view");
const appView    = $("app-view");
const loginError = $("login-error");
const authMain   = $("auth-main");
const authOtp    = $("auth-otp");
const authEmail  = $("auth-email");
const drawerOverlay = $("drawer-overlay");
const drawerBody = $("drawer-body");

let currentToken = null;
let currentUid = null;

// ═══════ 1. AUTH STATE ═══════
onAuthStateChanged(auth, async user => {
  if (user) {
    currentToken = await user.getIdToken();
    currentUid = user.uid;
    authMain.classList.remove("hidden");
    authOtp.classList.add("hidden");
    authEmail.classList.add("hidden");
    loginError.innerText = "";
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    loadHistory();
  } else {
    currentToken = null;
    currentUid = null;
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }
});

$("logout-btn").addEventListener("click", () => signOut(auth));

// ═══════ 2. PHONE AUTH ═══════
window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
  size: "invisible"
});

let confirmationResult = null;

$("send-sms-btn").addEventListener("click", async () => {
  loginError.innerText = "";
  const phone = $("phone-number").value.trim();
  if (phone.length < 10) { loginError.innerText = "Enter a valid phone number."; return; }

  const fullPhone = $("phone-country").value + phone;
  const btn = $("send-sms-btn");
  btn.innerHTML = '<div class="spinner"></div>';

  try {
    confirmationResult = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
    authMain.classList.add("hidden");
    authOtp.classList.remove("hidden");
  } catch (err) {
    loginError.innerText = err.message || "Failed to send SMS.";
    if (window.recaptchaVerifier) window.recaptchaVerifier.render().then(id => grecaptcha.reset(id));
  } finally {
    btn.innerText = "Send OTP";
  }
});

$("phone-number").addEventListener("keydown", e => {
  if (e.key === "Enter") $("send-sms-btn").click();
});

$("verify-otp-btn").addEventListener("click", async () => {
  const code = $("otp-code").value.trim();
  loginError.innerText = "";
  const btn = $("verify-otp-btn");
  btn.innerHTML = '<div class="spinner"></div>';
  try { await confirmationResult.confirm(code); }
  catch { loginError.innerText = "Invalid OTP code."; }
  finally { btn.innerText = "Verify"; }
});

$("otp-code").addEventListener("keydown", e => {
  if (e.key === "Enter") $("verify-otp-btn").click();
});

$("cancel-otp-btn").addEventListener("click", () => {
  authOtp.classList.add("hidden");
  authMain.classList.remove("hidden");
  loginError.innerText = "";
  $("otp-code").value = "";
});

// ═══════ 3. GOOGLE AUTH ═══════
$("google-login-btn").addEventListener("click", async () => {
  loginError.innerText = "";
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { loginError.innerText = err.message || "Google sign-in failed."; }
});

// ═══════ 4. EMAIL AUTH ═══════
let isSignup = false;

$("show-email-btn").addEventListener("click", () => {
  authMain.classList.add("hidden");
  authEmail.classList.remove("hidden");
  loginError.innerText = "";
});

$("back-to-main-btn").addEventListener("click", () => {
  authEmail.classList.add("hidden");
  authMain.classList.remove("hidden");
  loginError.innerText = "";
  $("email").value = "";
  $("password").value = "";
});

$("toggle-email-mode-btn").addEventListener("click", e => {
  e.preventDefault();
  isSignup = !isSignup;
  $("login-btn").innerText = isSignup ? "Create Account" : "Sign In";
  $("toggle-email-mode-btn").innerText = isSignup ? "Already have an account?" : "Create account";
});

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  loginError.innerText = "";
  const email = $("email").value, password = $("password").value;
  const btn = $("login-btn");
  btn.innerHTML = '<div class="spinner"></div>';
  try {
    isSignup
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") loginError.innerText = "Account exists — sign in instead.";
    else if (err.code === "auth/weak-password") loginError.innerText = "Password too weak (min 6 characters).";
    else loginError.innerText = err.message;
  } finally {
    btn.innerText = isSignup ? "Create Account" : "Sign In";
  }
});

// ═══════ 5. RECORDING ═══════
let mediaRecorder, audioChunks = [], activeStream;
const recordBtn = $("recordBtn");
const statusEl  = $("status");
const resultEl  = $("result");

const startRecording = async e => {
  if (e.cancelable) e.preventDefault();
  if (!currentToken) return;

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(activeStream);
    audioChunks = [];

    mediaRecorder.ondataavailable = ev => audioChunks.push(ev.data);

    mediaRecorder.onstop = async () => {
      activeStream.getTracks().forEach(t => t.stop());
      currentToken = await auth.currentUser.getIdToken();

      statusEl.innerText = "Processing";
      statusEl.classList.add("processing-dots");

      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "recording.webm");

      try {
        const res = await fetch(`${API}/process_voice`, {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
          body: form
        });

        if (res.status === 401) { signOut(auth); return; }
        const data = await res.json();

        if (data.status === "success") {
          const results = data.results || [];
          const errors = data.errors || [];
          renderResults(results, errors);
          statusEl.innerText = "Done ✓";
        } else {
          resultEl.innerHTML = `<div class="error-item">❌ ${data.message || "Something went wrong."}</div>`;
          statusEl.innerText = "Error";
        }
      } catch {
        resultEl.innerHTML = '<div class="error-item">❌ Could not connect to the server.</div>';
        statusEl.innerText = "Offline";
      } finally {
        statusEl.classList.remove("processing-dots");
      }
    };

    mediaRecorder.start();
    statusEl.innerText = "Listening…";
    statusEl.classList.remove("processing-dots");
    resultEl.innerHTML = '';
    recordBtn.classList.add("recording");
  } catch {
    statusEl.innerText = "Microphone access denied.";
  }
};

const stopRecording = e => {
  if (e.cancelable) e.preventDefault();
  if (mediaRecorder?.state === "recording") {
    mediaRecorder.stop();
    recordBtn.classList.remove("recording");
  }
};

recordBtn.addEventListener("mousedown", startRecording);
recordBtn.addEventListener("mouseup", stopRecording);
recordBtn.addEventListener("mouseleave", stopRecording);
recordBtn.addEventListener("touchstart", startRecording, { passive: false });
recordBtn.addEventListener("touchend", stopRecording);
recordBtn.addEventListener("touchcancel", stopRecording);

// Spacebar to Record (Desktop)
window.addEventListener("keydown", e => {
  if (e.code === "Space" && !appView.classList.contains("hidden")) {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (!recordBtn.classList.contains("recording")) {
      startRecording(e);
    }
  }
});
window.addEventListener("keyup", e => {
  if (e.code === "Space" && !appView.classList.contains("hidden")) {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
    e.preventDefault();
    stopRecording(e);
  }
});

// ═══════ 6. TABLE RENDERER ═══════
const numericColumns = new Set(["#", "Stock", "Qty", "Sold", "Added", "Previous", "Current", "Current Stock", "Quantity Owed"]);

function buildResultHTML(results, errors) {
  let html = '';
  for (const group of results) {
    html += '<div class="result-card">';
    html += `<div class="result-card-header">
      <span class="result-card-icon">${group.icon}</span>
      <span class="result-card-title">${group.title}</span>
    </div>`;
    if (group.empty_message) {
      html += `<div class="result-card-empty">${group.empty_message}</div>`;
    } else if (group.rows && group.rows.length > 0) {
      html += '<div class="table-scroll"><table class="result-table"><thead><tr>';
      for (const col of group.columns) {
        const cls = numericColumns.has(col) ? ' class="cell-num"' : '';
        html += `<th${cls}>${col}</th>`;
      }
      html += '</tr></thead><tbody>';
      for (const row of group.rows) {
        html += '<tr>';
        for (const col of group.columns) {
          const cls = numericColumns.has(col) ? ' class="cell-num"' : '';
          html += `<td${cls}>${row[col] ?? '-'}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';
  }
  if (errors.length > 0) {
    html += '<ul class="error-list">';
    for (const err of errors) {
      html += `<li class="error-item">❌ ${err}</li>`;
    }
    html += '</ul>';
  }
  return html;
}

function renderResults(results, errors) {
  const html = buildResultHTML(results, errors);
  resultEl.innerHTML = html || '<div class="result-placeholder">No results</div>';
}

// ═══════ 7. HISTORY (Firestore-backed) ═══════
function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

async function loadHistory() {
  drawerBody.innerHTML = '<div class="history-empty">Loading...</div>';
  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API}/history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const history = data.history || [];

    if (history.length === 0) {
      drawerBody.innerHTML = '<div class="history-empty">No transactions yet.<br>Your history will appear here.</div>';
      return;
    }
    let html = '';
    for (const entry of history) {
      html += '<div class="history-entry">';
      html += `<div class="history-timestamp">${formatTime(entry.timestamp)}</div>`;
      html += buildResultHTML(entry.results || [], entry.errors || []);
      html += '</div>';
    }
    drawerBody.innerHTML = html;
  } catch {
    drawerBody.innerHTML = '<div class="history-empty">Could not load history.</div>';
  }
}

// Drawer controls
$("menu-btn").addEventListener("click", () => {
  loadHistory();
  drawerOverlay.classList.add("open");
});

$("drawer-close").addEventListener("click", () => {
  drawerOverlay.classList.remove("open");
});

drawerOverlay.addEventListener("click", e => {
  if (e.target === drawerOverlay) drawerOverlay.classList.remove("open");
});

$("clear-history-btn").addEventListener("click", async () => {
  try {
    const token = await auth.currentUser.getIdToken();
    await fetch(`${API}/history`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    loadHistory();
  } catch {
    // silently fail
  }
});

// ═══════ 8. PWA SERVICE WORKER ═══════
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
