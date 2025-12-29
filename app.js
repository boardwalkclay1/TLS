// =========================
// TLS CONFIG
// =========================
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51SYxMTPS3k29a4g70j938gENXp03jYIEG7TOJ4SKq5GEy76sJ1eNzdjoebMnTH5HZNTKfnyHBhf9vDVApEB7rD8400RZjUbwsn";

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = "6951de6d0001f322b541";

const DB_ID = "tls";
const COL_PROFILES = "profiles";
const COL_REQUESTS = "requests";
const COL_PAYMENTS = "payments";

const FUNC_CREATE_CONNECT = "createConnectAccount";
const FUNC_ONBOARD = "createOnboardingLink";
const FUNC_PAYMENT = "createPaymentSession";

// =========================
// APPWRITE CLIENT
// =========================
const client = new Appwrite.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const functions = new Appwrite.Functions(client);

// =========================
// STATE
// =========================
let currentUser = null;
let currentProfile = null;
let requests = [];

// =========================
// UTIL
// =========================
const qs = (id) => document.getElementById(id);

function openModal(key) {
  qs(`modal-${key}`).classList.remove("ls-hidden");
}

function closeModal(key) {
  qs(`modal-${key}`).classList.add("ls-hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
  bindUI();
  loadSession();
});

// =========================
// UI BINDINGS
// =========================
function bindUI() {
  qs("btn-login").addEventListener("click", () => openModal("auth"));
  qs("btn-signup").addEventListener("click", () => openModal("auth"));

  qs("btn-auth-login").addEventListener("click", onAuthLogin);
  qs("btn-auth-signup").addEventListener("click", onAuthSignup);

  qs("btn-edit-profile").addEventListener("click", () => {
    if (!currentUser) return openModal("auth");
    fillProfileForm();
    openModal("profile");
  });

  qs("btn-profile-save").addEventListener("click", onProfileSave);

  qs("btn-new-request").addEventListener("click", () => {
    if (!currentUser) return openModal("auth");
    if (!currentProfile || currentProfile.role !== "customer") {
      alert("Only customers can post laundry requests.");
      return;
    }
    openModal("request");
  });

  qs("btn-request-save").addEventListener("click", onRequestSave);

  qs("btn-create-stripe").addEventListener("click", onCreateStripeAccount);
  qs("btn-onboard").addEventListener("click", onStartOnboarding);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-close-modal");
      closeModal(key);
    });
  });
}

// =========================
// AUTH
// =========================
async function loadSession() {
  try {
    const user = await account.get();
    currentUser = user;
    await loadProfile();
    await loadRequests();
    renderAll();
  } catch {
    currentUser = null;
    currentProfile = null;
    renderAll();
  }
}

async function onAuthSignup() {
  const email = qs("auth-email").value.trim();
  const password = qs("auth-password").value.trim();
  if (!email || !password) return alert("Email and password required.");

  try {
    await account.create("unique()", email, password);
    await account.createEmailPasswordSession(email, password);
    closeModal("auth");
    await loadSession();
  } catch (e) {
    console.error(e);
    alert("Signup failed.");
  }
}

async function onAuthLogin() {
  const email = qs("auth-email").value.trim();
  const password = qs("auth-password").value.trim();
  if (!email || !password) return alert("Email and password required.");

  try {
    await account.createEmailPasswordSession(email, password);
    closeModal("auth");
    await loadSession();
  } catch (e) {
    console.error(e);
    alert("Login failed.");
  }
}

// =========================
// PROFILE
// =========================
async function loadProfile() {
  if (!currentUser) return (currentProfile = null);
  try {
    const res = await databases.listDocuments(DB_ID, COL_PROFILES, [
      Appwrite.Query.equal("userId", currentUser.$id),
    ]);
    currentProfile = res.documents[0] || null;
  } catch (e) {
    console.error("loadProfile failed", e);
    currentProfile = null;
  }
}

function fillProfileForm() {
  if (!currentProfile) {
    qs("profile-name").value = currentUser.email;
    qs("profile-role").value = "customer";
    qs("profile-bio").value = "";
    qs("profile-lat").value = "";
    qs("profile-lng").value = "";
    return;
  }

  qs("profile-name").value = currentProfile.displayName || "";
  qs("profile-role").value = currentProfile.role || "customer";
  qs("profile-bio").value = currentProfile.bio || "";
  qs("profile-lat").value = currentProfile.lat ?? "";
  qs("profile-lng").value = currentProfile.lng ?? "";
}

async function onProfileSave() {
  if (!currentUser) return alert("Log in first.");

  const displayName = qs("profile-name").value.trim();
  const role = qs("profile-role").value;
  const bio = qs("profile-bio").value.trim();
  const lat = parseFloat(qs("profile-lat").value);
  const lng = parseFloat(qs("profile-lng").value);

  const data = {
    userId: currentUser.$id,
    displayName,
    role,
    bio,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    stripeAccountId: currentProfile ? currentProfile.stripeAccountId || null : null,
  };

  try {
    if (currentProfile) {
      currentProfile = await databases.updateDocument(
        DB_ID,
        COL_PROFILES,
        currentProfile.$id,
        data
      );
    } else {
      currentProfile = await databases.createDocument(
        DB_ID,
        COL_PROFILES,
        "unique()",
        data
      );
    }
    closeModal("profile");
    renderAll();
  } catch (e) {
    console.error(e);
    alert("Failed to save profile.");
  }
}

// =========================
// STRIPE CONNECT (HELPER)
// =========================
async function onCreateStripeAccount() {
  if (!currentUser) return openModal("auth");
  if (!currentProfile || currentProfile.role !== "helper") {
    return alert("Only helpers can create Stripe accounts.");
  }
  if (currentProfile.stripeAccountId) {
    return alert("Stripe account already linked.");
  }

  try {
    const exec = await functions.createExecution(
      FUNC_CREATE_CONNECT,
      JSON.stringify({ userId: currentUser.$id })
    );
    const data = JSON.parse(exec.responseBody || "{}");

    if (!data.accountId) {
      console.error("No accountId in response", data);
      return alert("Failed to create Stripe account.");
    }

    // Save Stripe account ID into profile
    currentProfile.stripeAccountId = data.accountId;
    await databases.updateDocument(DB_ID, COL_PROFILES, currentProfile.$id, {
      stripeAccountId: data.accountId,
    });

    alert("Stripe account created and linked.");
    renderAll();
  } catch (e) {
    console.error(e);
    alert("Failed to create Stripe account.");
  }
}

async function onStartOnboarding() {
  if (!currentUser) return openModal("auth");
  if (!currentProfile || currentProfile.role !== "helper") {
    return alert("Only helpers can onboard with Stripe.");
  }
  if (!currentProfile.stripeAccountId) {
    return alert("No Stripe account found. Create one first.");
  }

  try {
    const exec = await functions.createExecution(
      FUNC_ONBOARD,
      JSON.stringify({ accountId: currentProfile.stripeAccountId })
    );
    const data = JSON.parse(exec.responseBody || "{}");

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Onboarding link unavailable.");
    }
  } catch (e) {
    console.error(e);
    alert("Failed to start onboarding.");
  }
}

// =========================
// REQUESTS
// =========================
async function loadRequests() {
  try {
    const res = await databases.listDocuments(DB_ID, COL_REQUESTS, [
      Appwrite.Query.orderDesc("$createdAt"),
    ]);
    requests = res.documents;
  } catch (e) {
    console.error("loadRequests failed", e);
    requests = [];
  }
}

async function onRequestSave() {
  if (!currentUser) return alert("Log in first.");
  if (!currentProfile || currentProfile.role !== "customer")
    return alert("Only customers can post requests.");

  const title = qs("request-title").value.trim();
  const description = qs("request-description").value.trim();
  const budgetRaw = qs("request-budget").value.trim();
  const budget = budgetRaw ? Number(budgetRaw) : null;

  if (!title || !description) return alert("Title and description required.");

  try {
    const doc = await databases.createDocument(DB_ID, COL_REQUESTS, "unique()", {
      userId: currentUser.$id,
      title,
      description,
      budget: budget && budget > 0 ? budget : null,
      status: "open",
    });

    requests.unshift(doc);
    closeModal("request");
    renderFeed();
  } catch (e) {
    console.error(e);
    alert("Failed to create request.");
  }
}

// =========================
// PAYMENT FLOW (Stripe Checkout)
// =========================
async function startPayment(requestId) {
  if (!currentUser) return openModal("auth");

  const req = requests.find((r) => r.$id === requestId);
  if (!req) return alert("Request not found.");

  const amount = req.budget || 20;

  // naive: pick first helper with Stripe account
  const helper = await findHelperWithStripe();
  if (!helper || !helper.stripeAccountId)
    return alert("No helper with Stripe account is available yet.");

  try {
    const exec = await functions.createExecution(
      FUNC_PAYMENT,
      JSON.stringify({
        amount,
        helperAccountId: helper.stripeAccountId,
        requestId: req.$id,
      })
    );
    const data = JSON.parse(exec.responseBody || "{}");
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert("Payment link unavailable.");
    }
  } catch (e) {
    console.error(e);
    alert("Payment failed.");
  }
}

async function findHelperWithStripe() {
  try {
    const res = await databases.listDocuments(DB_ID, COL_PROFILES, [
      Appwrite.Query.equal("role", "helper"),
      Appwrite.Query.notEqual("stripeAccountId", null),
    ]);
    return res.documents[0] || null;
  } catch (e) {
    console.error("findHelperWithStripe failed", e);
    return null;
  }
}

// =========================
// RENDERING
// =========================
function renderProfileView() {
  const container = qs("profile-view");
  container.innerHTML = "";

  if (!currentUser) {
    container.className = "ls-profile-empty";
    container.innerHTML = `<p>Not logged in.</p>`;
    return;
  }

  if (!currentProfile) {
    container.className = "ls-profile-empty";
    container.innerHTML = `<p>No profile yet. Click "Edit Profile".</p>`;
    return;
  }

  const tagClass =
    currentProfile.role === "helper"
      ? "ls-tag ls-tag--helper"
      : "ls-tag ls-tag--customer";

  const roleLabel =
    currentProfile.role === "helper" ? "Laundry Helper" : "Needs Laundry";

  const stripeStatus = currentProfile.stripeAccountId
    ? `Stripe linked (${currentProfile.stripeAccountId.slice(0, 8)}...)`
    : "Stripe not linked";

  container.className = "ls-profile-card";
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-weight:600;">${escapeHtml(
          currentProfile.displayName || ""
        )}</div>
        <div class="${tagClass}">${roleLabel}</div>
      </div>
    </div>
    <p>${escapeHtml(currentProfile.bio || "")}</p>
    <p class="ls-muted">${stripeStatus}</p>
  `;
}

function renderFeed() {
  const container = qs("feed-list");
  container.innerHTML = "";

  if (!requests.length) {
    container.innerHTML = `<p class="ls-muted">No laundry requests yet.</p>`;
    return;
  }

  requests.forEach((r) => {
    const card = document.createElement("article");
    card.className = "ls-feed-card";

    const budgetText = r.budget
      ? `$${Number(r.budget).toFixed(2)}`
      : "No budget set";

    card.innerHTML = `
      <div class="ls-feed-header">
        <div>
          <div class="ls-feed-title">${escapeHtml(r.title)}</div>
          <div class="ls-feed-meta">
            Budget: ${budgetText} • Status: ${escapeHtml(r.status || "open")}
          </div>
        </div>
        <button class="ls-btn ls-btn-small ls-btn-primary" data-pay="${r.$id}">
          Offer / Pay
        </button>
      </div>
      <div class="ls-feed-body">${escapeHtml(r.description)}</div>
      <div class="ls-feed-footer">
        <span class="ls-pill-stat">ID: ${r.$id.slice(-6)}</span>
      </div>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll("[data-pay]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-pay");
      startPayment(id);
    });
  });
}

function renderAll() {
  renderProfileView();
  renderFeed();
}
