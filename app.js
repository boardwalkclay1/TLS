// ===== TLS CONFIG =====
const STRIPE_PUBLISHABLE_KEY = "pk_live_51SYxMTPS3k29a4g70j938gENXp03jYIEG7TOJ4SKq5GEy76sJ1eNzdjoebMnTH5HZNTKfnyHBhf9vDVApEB7rD8400RZjUbwsn";

const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = "6951de6d0001f322b541";

const DB_ID = "tls";
const COL_PROFILES = "profiles";
const COL_REQUESTS = "requests";
const COL_PAYMENTS = "payments";

const FUNC_PAYMENT = "createPaymentSession";

const client = new Appwrite.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const functions = new Appwrite.Functions(client);
