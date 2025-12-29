// ===== TLS CONFIG =====
const APPWRITE_ENDPOINT = "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT = "6951de6d0001f322b541";

const DB_ID = "tls";                     // renamed for TLS
const COL_PROFILES = "profiles";
const COL_REQUESTS = "requests";
const COL_PAYMENTS = "payments";

const FUNC_PAYMENT = "createPaymentSession"; // Appwrite function ID

const client = new Appwrite.Client();
client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const functions = new Appwrite.Functions(client);
