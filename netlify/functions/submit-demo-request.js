// Netlify Function: submit-demo-request
// Receives the "Schedule a Demo" popup submission from the Appraisal Academy
// wizard's Contact Us button and creates a record in the Demo Requests table
// using the same write-only, base-scoped Personal Access Token
// (AIRTABLE_TOKEN) already used by submit-dealer-profile.js.

const AIRTABLE_BASE_ID = "appFbuGvhQAVK9ixz";
const AIRTABLE_TABLE_ID = "tblnIps62LA55owtO"; // Demo Requests

const FIELDS = {
  fullName: "fldiKglizMtSdUB2D", // singleLineText
  dealershipName: "fldnrOo2mJxyazklX", // singleLineText
  phone: "fldcDpuNFtBvrPjxn", // phoneNumber
  email: "fldNOJkm4XN3nHb1S", // email
  productInterest: "fldPESYOaO2ckt34L", // singleSelect
  textMeOk: "fldIXr4HLGa37JPiQ", // checkbox
  source: "fldnVXOvEm1AL0DS8", // singleLineText
};

const REQUIRED = ["fullName", "dealershipName", "phone"];

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const missing = REQUIRED.filter((key) => !payload[key] || String(payload[key]).trim() === "");
  if (missing.length) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Missing required field(s): ${missing.join(", ")}` }),
    };
  }

  // Simple honeypot check (field must stay empty if present in payload)
  if (payload._hp) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Rejected" }) };
  }

  const fields = {};
  if (payload.fullName) fields[FIELDS.fullName] = String(payload.fullName).trim();
  if (payload.dealershipName) fields[FIELDS.dealershipName] = String(payload.dealershipName).trim();
  if (payload.phone) fields[FIELDS.phone] = String(payload.phone).trim();
  if (payload.email) fields[FIELDS.email] = String(payload.email).trim();
  if (payload.productInterest) fields[FIELDS.productInterest] = payload.productInterest;
  fields[FIELDS.textMeOk] = !!payload.textMeOk;
  fields[FIELDS.source] = "Appraisal Academy Wizard — Contact Us";

  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{ fields }],
          typecast: false,
        }),
      }
    );

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Airtable error:", JSON.stringify(data));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "Could not save your request. Please try again." }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, id: data.records?.[0]?.id }),
    };
  } catch (err) {
    console.error("Submit error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Unexpected server error. Please try again." }),
    };
  }
};
