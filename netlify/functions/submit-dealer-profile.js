// Netlify Function: submit-dealer-profile
// Receives the Appraisal Academy Dealer Profile form POST and creates a
// record in Airtable using a write-only, base-scoped Personal Access Token
// (AIRTABLE_TOKEN) stored as a Netlify environment variable. The token is
// never exposed to the browser.

const AIRTABLE_BASE_ID = "appFbuGvhQAVK9ixz";
const AIRTABLE_TABLE_ID = "tblrn6VV3c8mDvVhQ"; // Dealerships

// Field IDs from the Dealerships table schema.
const FIELDS = {
  name: "fld817xRKl2JFBWJl", // Dealership Name (singleLineText)
  website: "fldM4JrEWVr7m2fi0", // Dealership Website (url)
  notes: "fldJLfqXKt6btObE0", // Anything else... (multilineText)
  appraisalTool: "fldBASajDTLiWNqDD", // singleSelect
  crm: "fldbEh2UL5ISRgB7v", // singleSelect
  dms: "fldLWDcBKwzUhLb4c", // singleSelect
  firstEntry: "fldaGeOVVlD5WAAFM", // singleSelect
  pricer: "fld4BUJzWeWx5mv7p", // singleSelect
  negotiator: "fldWmYRM1zzaFSias", // singleSelect
  stockIn: "fldrawfbiSxFjGIXE", // singleSelect
  keysPlacement: "fldqNNpVi0rpkUnQ2", // singleSelect
  contactName: "fldSgphtQ7adztzg0", // singleLineText
  contactEmail: "fldckDJtX94GKZwwS", // email
  contactPhone: "fld066OnwSUoWMcZO", // phoneNumber
};

const REQUIRED = ["name", "appraisalTool", "crm", "dms", "firstEntry", "pricer", "negotiator", "keysPlacement", "contactName", "contactEmail"];

// Human-readable labels for fields that offer an "Other" choice with a
// fill-in-the-blank follow-up (e.g. "<field>Other" in the payload). When the
// select value is "Other" and the follow-up text is present, we fold it into
// Notes (rather than writing the free text into the singleSelect field
// itself, which Airtable would reject since typecast is off).
const OTHER_LABELS = {
  appraisalTool: "Appraisal Tool",
  crm: "CRM",
  dms: "DMS",
  firstEntry: "Starts the Appraisal",
  pricer: "Prices the Trade",
  negotiator: "Negotiates with Customer",
  stockIn: "Moves It to the Boneyard",
  keysPlacement: "Keys Placed",
};

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

  // Fold any "Other" fill-in-the-blank text into Notes, labeled by question,
  // so the specific detail isn't lost even though the singleSelect field
  // itself just stores "Other".
  const extraNotes = [];
  Object.keys(OTHER_LABELS).forEach((key) => {
    if (payload[key] === "Other") {
      const custom = payload[key + "Other"];
      if (custom && String(custom).trim()) {
        extraNotes.push(OTHER_LABELS[key] + ": " + String(custom).trim());
      }
    }
  });
  let notesValue = payload.notes ? String(payload.notes).trim() : "";
  if (extraNotes.length) {
    notesValue = notesValue ? notesValue + "\n" + extraNotes.join("\n") : extraNotes.join("\n");
  }

  const fields = {};
  if (payload.name) fields[FIELDS.name] = String(payload.name).trim();
  if (payload.website) fields[FIELDS.website] = String(payload.website).trim();
  if (notesValue) fields[FIELDS.notes] = notesValue;
  if (payload.appraisalTool) fields[FIELDS.appraisalTool] = payload.appraisalTool;
  if (payload.crm) fields[FIELDS.crm] = payload.crm;
  if (payload.dms) fields[FIELDS.dms] = payload.dms;
  if (payload.firstEntry) fields[FIELDS.firstEntry] = payload.firstEntry;
  if (payload.pricer) fields[FIELDS.pricer] = payload.pricer;
  if (payload.negotiator) fields[FIELDS.negotiator] = payload.negotiator;
  if (payload.stockIn) fields[FIELDS.stockIn] = payload.stockIn;
  if (payload.keysPlacement) fields[FIELDS.keysPlacement] = payload.keysPlacement;
  if (payload.contactName) fields[FIELDS.contactName] = String(payload.contactName).trim();
  if (payload.contactEmail) fields[FIELDS.contactEmail] = String(payload.contactEmail).trim();
  if (payload.contactPhone) fields[FIELDS.contactPhone] = String(payload.contactPhone).trim();

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
        body: JSON.stringify({ error: "Could not save your submission. Please try again." }),
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
