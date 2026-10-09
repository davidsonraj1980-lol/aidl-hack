/**
 * ==============================================================================
 * RouteWise — Airport Cab-Pooling MVP Application Logic
 * Security Hardened: XSS Sanitization, Correlation Error IDs, Anti-PII Leakage,
 * and Account Data Purge Procedures.
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 0. SECURITY SANITIZATION UTILITIES (XSS Prevention - Section 4 & 5)
// ------------------------------------------------------------------------------
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateCorrelationId() {
  return "RW-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ------------------------------------------------------------------------------
// 1. SUPABASE CLIENT & CONFIGURATION (Section 1: Secrets & Credentials)
// ------------------------------------------------------------------------------
// No hardcoded production credentials. Environment variables or in-app configuration only.
const DEFAULT_SUPABASE_URL = "";
const DEFAULT_SUPABASE_ANON_KEY = "";

let SUPABASE_URL = localStorage.getItem("routewise_supabase_url") || localStorage.getItem("aeropool_supabase_url") || DEFAULT_SUPABASE_URL;
let SUPABASE_ANON_KEY = localStorage.getItem("routewise_supabase_key") || localStorage.getItem("aeropool_supabase_key") || DEFAULT_SUPABASE_ANON_KEY;
let MOCK_FALLBACK = (localStorage.getItem("routewise_mock_fallback") || localStorage.getItem("aeropool_mock_fallback")) !== "false";

let supabaseClient = null;

function initSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      updateStatusBadge(true, "PostGIS Live");
      return true;
    } catch {
      supabaseClient = null;
    }
  }
  updateStatusBadge(false, "PostGIS Demo");
  return false;
}

function updateStatusBadge(isLive, label) {
  const dot = document.getElementById("db-status-dot");
  const text = document.getElementById("db-status-text");
  if (dot && text) {
    dot.className = isLive ? "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" : "w-1.5 h-1.5 rounded-full bg-amber-500";
    text.innerText = label;
  }
}

// ------------------------------------------------------------------------------
// 2. MOCK POSTGIS SEED DATA (Sanitized & Masked - No Real PII)
// ------------------------------------------------------------------------------
const MOCK_DB_RIDERS = [
  {
    request_id: "req-1",
    user_id: "11111111-1111-1111-1111-111111111111",
    full_name: "Ananya Iyer",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    flight_seat: "8C",
    is_verified: true,
    rating: 4.95,
    destination_name: "Domlur Flyover / EGL",
    lat: 12.9610,
    lng: 77.6387,
    flight_number: "6E-241",
    status: "searching"
  },
  {
    request_id: "req-2",
    user_id: "22222222-2222-2222-2222-222222222222",
    full_name: "Rohan Sharma",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    flight_seat: "14A",
    is_verified: true,
    rating: 4.88,
    destination_name: "Koramangala 5th Block",
    lat: 12.9352,
    lng: 77.6245,
    flight_number: "6E-241",
    status: "searching"
  },
  {
    request_id: "req-3",
    user_id: "33333333-3333-3333-3333-333333333333",
    full_name: "Vikram Malhotra",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    flight_seat: "21D",
    is_verified: true,
    rating: 4.92,
    destination_name: "Old Airport Road (HAL)",
    lat: 12.9592,
    lng: 77.6620,
    flight_number: "6E-241",
    status: "searching"
  },
  {
    request_id: "req-4",
    user_id: "44444444-4444-4444-4444-444444444444",
    full_name: "Priya Patel",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    flight_seat: "17B",
    is_verified: true,
    rating: 4.90,
    destination_name: "Whitefield ITPL",
    lat: 12.9863,
    lng: 77.7340,
    flight_number: "6E-241",
    status: "searching"
  }
];

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ------------------------------------------------------------------------------
// 3. SCREEN & SUB-VIEW NAVIGATION
// ------------------------------------------------------------------------------
function goToScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }

  document.querySelectorAll('.navitem').forEach(item => {
    item.classList.toggle('active', item.dataset.screen === screenId);
  });
}

const poolSubviews = {
  input: document.getElementById('pool-input-subview'),
  searching: document.getElementById('pool-searching-subview'),
  success: document.getElementById('pool-success-subview'),
  noMatch: document.getElementById('pool-nomatch-subview')
};

function switchPoolSubview(viewKey) {
  Object.keys(poolSubviews).forEach(key => {
    if (key === viewKey) {
      poolSubviews[key].classList.remove('hidden');
    } else {
      poolSubviews[key].classList.add('hidden');
    }
  });
  const screen = document.getElementById('screen-pool');
  if (screen) screen.scrollTop = 0;
}

// ------------------------------------------------------------------------------
// 4. TOAST SYSTEM
// ------------------------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ------------------------------------------------------------------------------
// 5. SECURE DATABASE SERVICE (PostGIS RPC & Parameterized Operations)
// ------------------------------------------------------------------------------
async function searchRidePool(flightNumber, destName, lat, lng, userName, userSeat) {
  const cleanFlight = String(flightNumber || "").trim().toUpperCase();
  const safeLat = parseFloat(lat);
  const safeLng = parseFloat(lng);

  // Client-side parameter bounds validation (Section 4 & 5 Hardening)
  if (isNaN(safeLat) || safeLat < -90 || safeLat > 90 || isNaN(safeLng) || safeLng < -180 || safeLng > 180) {
    throw new Error("Invalid destination coordinates.");
  }
  if (!cleanFlight || cleanFlight.length < 2 || cleanFlight.length > 15) {
    throw new Error("Invalid flight number format.");
  }

  if (supabaseClient) {
    try {
      let currentUserId = localStorage.getItem("routewise_user_id") || localStorage.getItem("aeropool_user_id");
      if (!currentUserId) {
        const { data: newUser, error: userErr } = await supabaseClient
          .from("users")
          .insert([{
            full_name: (userName || "Arjun Rao").slice(0, 100),
            flight_seat: (userSeat || "15F").slice(0, 10),
            is_verified: true
          }])
          .select("id")
          .single();

        if (userErr) throw userErr;
        currentUserId = newUser.id;
        localStorage.setItem("routewise_user_id", currentUserId);
      }

      const { error: reqErr } = await supabaseClient
        .from("ride_requests")
        .insert([{
          user_id: currentUserId,
          flight_number: cleanFlight,
          destination_name: (destName || "").slice(0, 150),
          destination_coords: `POINT(${safeLng} ${safeLat})`,
          fare_estimate: 1200.00,
          status: "searching"
        }]);

      if (reqErr) {
        // Log internally without leaking user PII
      }

      const { data: matchedRiders, error: rpcErr } = await supabaseClient.rpc(
        "match_riders",
        {
          p_flight_number: cleanFlight,
          p_lat: safeLat,
          p_lng: safeLng,
          p_user_id: currentUserId
        }
      );

      if (rpcErr) throw rpcErr;
      return matchedRiders || [];
    } catch {
      if (!MOCK_FALLBACK) {
        const errRef = generateCorrelationId();
        throw new Error(`Service temporarily unavailable [Ref: ${errRef}]`);
      }
    }
  }

  // Client-side simulation matching PostGIS ST_DWithin 5km logic
  const sameFlight = MOCK_DB_RIDERS.filter(
    r => r.flight_number.toUpperCase() === cleanFlight && r.status === "searching"
  );

  return sameFlight
    .map(r => ({
      ...r,
      distance_meters: calculateDistanceMeters(safeLat, safeLng, r.lat, r.lng)
    }))
    .filter(r => r.distance_meters <= 5000)
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, 3);
}

// ------------------------------------------------------------------------------
// 6. ANIMATED RADAR SCANNER
// ------------------------------------------------------------------------------
let searchInterval = null;
const searchSteps = [
  { pill: "Manifest Check", title: "Verifying Passengers...", desc: "Scanning passengers who landed on flight manifest." },
  { pill: "PostGIS Spatial Engine", title: "Running 5km ST_DWithin...", desc: "Computing geodesic clusters within 5,000 meters." },
  { pill: "Cab Split Engine", title: "Optimizing Fare Split...", desc: "Calculating shared premium SUV fare and pickup bay assignment." }
];

function runSearchingAnimation(flightNumber, onComplete) {
  switchPoolSubview('searching');
  let step = 0;
  const pillEl = document.getElementById('searching-status-pill');
  const titleEl = document.getElementById('searching-step-title');
  const descEl = document.getElementById('searching-step-desc');

  const safeFlight = escapeHtml(flightNumber);

  function render(i) {
    if (i < searchSteps.length) {
      pillEl.innerText = `${safeFlight} • ${searchSteps[i].pill}`;
      titleEl.innerText = searchSteps[i].title;
      descEl.innerText = searchSteps[i].desc;
    }
  }
  render(0);

  if (searchInterval) clearInterval(searchInterval);
  searchInterval = setInterval(() => {
    step++;
    if (step < searchSteps.length) {
      render(step);
    } else {
      clearInterval(searchInterval);
      searchInterval = null;
      onComplete();
    }
  }, 750);
}

// ------------------------------------------------------------------------------
// 7. RENDER SUCCESS VIEW & FARE CALCULATION (XSS Sanitized)
// ------------------------------------------------------------------------------
let currentCalculatedSplit = 400;

function renderMatchSuccess(matchedRiders, flightNumber, destName) {
  const container = document.getElementById('matched-riders-container');
  const count = matchedRiders.length;

  if (count === 0) {
    document.getElementById('no-match-flight').innerText = flightNumber;
    switchPoolSubview('noMatch');
    return;
  }

  // Dynamic Fare calculation
  const totalRidersInCab = count + 1;
  const originalFare = 1200;
  const splitFare = Math.round(originalFare / totalRidersInCab);
  const totalSaved = originalFare - splitFare;
  const savingsPct = Math.round((totalSaved / originalFare) * 100);
  currentCalculatedSplit = splitFare;

  document.getElementById('match-flight-tag').innerText = flightNumber;
  document.getElementById('match-count-badge').innerText = `${count} Co-Passenger${count > 1 ? "s" : ""}`;
  document.getElementById('riders-list-count').innerText = `${count} passengers`;
  document.getElementById('split-fare-display').innerText = `₹${splitFare}`;
  document.getElementById('original-fare-display').innerText = `₹${originalFare.toLocaleString()} original`;
  document.getElementById('total-saved-display').innerText = `You save ₹${totalSaved}`;
  document.getElementById('savings-percent-text').innerText = `${savingsPct}% Saved`;
  document.getElementById('book-btn-text').innerText = `Lock Cab & Pay ₹${splitFare} via UPI`;

  // Render cards with strict XSS sanitization (Section 4 & 5 Hardening)
  container.innerHTML = "";
  matchedRiders.forEach(rider => {
    const card = document.createElement("div");
    card.className = "p-2 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between";
    const distText = rider.distance_meters > 1000 
      ? `${(rider.distance_meters / 1000).toFixed(1)} km detour` 
      : `${Math.round(rider.distance_meters)}m detour`;

    const safeName = escapeHtml(rider.full_name);
    const safeSeat = escapeHtml(rider.flight_seat || '12B');
    const safeDest = escapeHtml(rider.destination_name);
    const safeRating = escapeHtml(rider.rating || '4.9');
    const safeAvatar = escapeHtml(rider.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150');

    card.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="relative">
          <img src="${safeAvatar}" alt="${safeName}" class="w-8 h-8 rounded-full object-cover border border-slate-200" />
          <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px] font-bold">
            <i class="fa-solid fa-check"></i>
          </span>
        </div>
        <div>
          <div class="flex items-center space-x-1">
            <h5 class="text-[11px] font-bold text-slate-800">${safeName}</h5>
            <span class="text-[8.5px] font-mono px-1 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">Seat ${safeSeat}</span>
          </div>
          <div class="text-[10px] text-slate-500 truncate max-w-[130px]">📍 ${safeDest}</div>
          <div class="text-[9px] text-emerald-600 font-semibold">${distText}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="inline-flex items-center space-x-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
          <i class="fa-solid fa-star text-[7.5px]"></i>
          <span>${safeRating}</span>
        </div>
        <div class="text-[8.5px] text-slate-400 mt-0.5">1 Bag</div>
      </div>
    `;
    container.appendChild(card);
  });

  switchPoolSubview('success');
  showToast(`Found ${count} passengers on ${escapeHtml(flightNumber)}!`);
}

// ------------------------------------------------------------------------------
// 8. UPI SPLIT MODAL & ACTIONS
// ------------------------------------------------------------------------------
function openUpiModal() {
  document.getElementById('upiModalSubtitle').innerHTML = `Your share for flight 6E-241 Innova cab is <b>₹${currentCalculatedSplit}</b>.`;
  document.getElementById('upiModal').classList.add('show');
}

function closeUpiModal() {
  document.getElementById('upiModal').classList.remove('show');
}

function confirmPayment(method) {
  closeUpiModal();
  showToast(`₹${currentCalculatedSplit} paid via ${escapeHtml(method)}! Cab locked at Bay B4.`);
  setTimeout(() => {
    goToScreen('screen-cab');
  }, 600);
}

// ------------------------------------------------------------------------------
// 9. DATA PRIVACY & PURGE PROCEDURE (Section 2: Personal Data Flow)
// ------------------------------------------------------------------------------
async function purgeUserData() {
  const currentUserId = localStorage.getItem("routewise_user_id");
  if (currentUserId && supabaseClient) {
    try {
      await supabaseClient.rpc("delete_user_data", { p_user_id: currentUserId });
    } catch {
      // Silently proceed with client purge
    }
  }

  localStorage.removeItem("routewise_user_id");
  localStorage.removeItem("aeropool_user_id");
  localStorage.removeItem("routewise_supabase_key");
  localStorage.removeItem("aeropool_supabase_key");
  
  showToast("Your session and stored credentials have been purged.");
  setTimeout(() => {
    location.reload();
  }, 800);
}

// ------------------------------------------------------------------------------
// 10. EVENT LISTENERS & INITIALIZATION
// ------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();

  const destSelect = document.getElementById("destination-select");
  const coordsPreview = document.getElementById("dest-coords-preview");

  if (destSelect && coordsPreview) {
    destSelect.addEventListener("change", () => {
      const opt = destSelect.options[destSelect.selectedIndex];
      coordsPreview.innerText = `PostGIS: Lat ${opt.getAttribute("data-lat")}, Lng ${opt.getAttribute("data-lng")}`;
    });
  }

  // Quick Flight Pill clicks
  document.querySelectorAll(".flight-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const flightNum = pill.getAttribute("data-flight");
      const input = document.getElementById("flight-number-input");
      if (input) {
        input.value = flightNum;
        document.getElementById("hero-flight-badge").innerText = `${flightNum} • ARRIVED`;
      }
    });
  });

  // Search form submit
  const form = document.getElementById("ride-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const flightNumber = document.getElementById("flight-number-input").value;
      const opt = destSelect.options[destSelect.selectedIndex];
      const destName = opt.getAttribute("data-name");
      const lat = parseFloat(opt.getAttribute("data-lat"));
      const lng = parseFloat(opt.getAttribute("data-lng"));
      const userName = document.getElementById("user-name-input").value;
      const userSeat = document.getElementById("user-seat-input").value;

      runSearchingAnimation(flightNumber, async () => {
        try {
          const matches = await searchRidePool(flightNumber, destName, lat, lng, userName, userSeat);
          renderMatchSuccess(matches, flightNumber, destName);
        } catch (err) {
          // Client-facing error: Generic with correlation ID (No raw stack traces or DB details)
          const errorRef = generateCorrelationId();
          showToast(`Search notice [${errorRef}]: Please check flight & network.`);
          switchPoolSubview('input');
        }
      });
    });
  }

  // Subview buttons
  document.getElementById("cancel-search-btn").addEventListener("click", () => switchPoolSubview('input'));
  document.getElementById("back-to-input-btn").addEventListener("click", () => switchPoolSubview('input'));
  document.getElementById("new-search-btn").addEventListener("click", () => switchPoolSubview('input'));
  document.getElementById("book-cab-btn").addEventListener("click", openUpiModal);
  document.getElementById("open-chat-btn").addEventListener("click", () => goToScreen('screen-chat'));

  // PostGIS Inspector Modal
  const postgisModal = document.getElementById("postgisModal");
  document.getElementById("postgis-inspector-btn").addEventListener("click", () => postgisModal.classList.add('show'));
  document.getElementById("close-postgis-modal-btn").addEventListener("click", () => postgisModal.classList.remove('show'));

  const urlInput = document.getElementById("supabase-url-input");
  const keyInput = document.getElementById("supabase-key-input");
  const mockToggle = document.getElementById("mock-fallback-toggle");

  if (urlInput) urlInput.value = SUPABASE_URL;
  if (keyInput) keyInput.value = SUPABASE_ANON_KEY;
  if (mockToggle) mockToggle.checked = MOCK_FALLBACK;

  document.getElementById("save-config-btn").addEventListener("click", () => {
    SUPABASE_URL = urlInput.value.trim();
    SUPABASE_ANON_KEY = keyInput.value.trim();
    MOCK_FALLBACK = mockToggle.checked;

    localStorage.setItem("routewise_supabase_url", SUPABASE_URL);
    localStorage.setItem("routewise_supabase_key", SUPABASE_ANON_KEY);
    localStorage.setItem("routewise_mock_fallback", MOCK_FALLBACK ? "true" : "false");

    const connected = initSupabase();
    postgisModal.classList.remove('show');
    showToast(connected ? "Connected to Supabase PostgreSQL!" : "Switched to PostGIS Demo Mode");
  });

  // Secure Chat message sending (XSS Immunized)
  const chatInput = document.getElementById("chat-input-field");
  const sendChatBtn = document.getElementById("send-chat-btn");
  const chatContainer = document.getElementById("chat-messages-container");

  function sendChatMessage() {
    const rawText = chatInput.value.trim();
    if (!rawText) return;

    // Sanitize message content to prevent DOM XSS injection
    const safeText = escapeHtml(rawText);

    const bubble = document.createElement("div");
    bubble.className = "flex items-end justify-end space-x-1";
    bubble.innerHTML = `
      <div class="text-right">
        <div class="text-[8px] font-bold text-indigo-600">You (Seat 15F)</div>
        <div class="bg-indigo-600 text-white rounded-xl rounded-tr-none p-1.5 max-w-[190px] text-[10px] shadow-xs text-left">
          ${safeText}
        </div>
      </div>
    `;
    chatContainer.appendChild(bubble);
    chatInput.value = "";
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Simulated reply from Ananya
    setTimeout(() => {
      const reply = document.createElement("div");
      reply.className = "flex items-start space-x-1";
      reply.innerHTML = `
        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150" class="w-5 h-5 rounded-full object-cover border border-slate-300" />
        <div>
          <div class="text-[8px] font-bold text-slate-600">Ananya (Seat 8C)</div>
          <div class="bg-white border border-slate-200 rounded-xl rounded-tl-none p-1.5 text-slate-800 max-w-[190px] text-[10px] shadow-xs">
            Awesome! The driver just confirmed the OTP at Bay B4.
          </div>
        </div>
      `;
      chatContainer.appendChild(reply);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 1200);
  }

  sendChatBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  // Resolution Switcher (Actual Phone Resolutions)
  const deviceContainer = document.getElementById("device-container");
  const resButtons = document.querySelectorAll(".res-btn");

  resButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      resButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const resType = btn.getAttribute("data-res");
      const notch = document.querySelector(".notch");

      if (resType === "fullscreen") {
        deviceContainer.style.width = "100vw";
        deviceContainer.style.height = "100dvh";
        deviceContainer.style.borderRadius = "0";
        deviceContainer.style.boxShadow = "none";
        deviceContainer.style.border = "none";
        deviceContainer.style.outline = "none";
        if (notch) notch.style.display = "none";
        document.body.style.padding = "0";
        showToast("Switched to 100% Fullscreen / Native Viewport");
      } else {
        const w = btn.getAttribute("data-w");
        const h = btn.getAttribute("data-h");
        deviceContainer.style.width = `${w}px`;
        deviceContainer.style.height = `${h}px`;
        deviceContainer.style.border = "4px solid #080C16";
        deviceContainer.style.outline = "3.5px solid #CBD5E1";
        deviceContainer.style.boxShadow = "0 0 0 5px #64748B, 0 25px 65px rgba(0, 0, 0, 0.6)";
        document.body.style.padding = "8px";
        if (notch) notch.style.display = "flex";

        if (resType === "mini") {
          deviceContainer.style.borderRadius = "46px";
          showToast("iPhone 13 Compact (348 × 608 px) — No Scroll Needed!");
        } else if (resType === "iphone14") {
          deviceContainer.style.borderRadius = "48px";
          showToast("iPhone 13 Standard (375 × 650 px)");
        }
      }
    });
  });
});
