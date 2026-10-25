const API_URL = process.env.API_URL || "http://localhost:3000";

const COOKIE = process.env.TEST_COOKIE;
const SALON_ID = process.env.TEST_SALON_ID;
const SERVICE_ID = process.env.TEST_SERVICE_ID;
const SLOT_START = process.env.TEST_SLOT_START;

if (!COOKIE || !SALON_ID || !SERVICE_ID || !SLOT_START) {
  console.error(
    "Missing TEST_COOKIE, TEST_SALON_ID, TEST_SERVICE_ID, or TEST_SLOT_START.",
  );
  process.exit(1);
}

async function book(key) {
  const response = await fetch(`${API_URL}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: COOKIE,
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      salonId: SALON_ID,
      serviceId: SERVICE_ID,
      slotStart: SLOT_START,
    }),
  });

  const body = await response.json().catch(() => ({}));

  return { status: response.status, body };
}

async function main() {
  const key = `concurrency-test-${Date.now()}`;

  console.log("Sending 5 simultaneous requests with one key...");

  const results = await Promise.all(Array.from({ length: 5 }, () => book(key)));

  results.forEach((result, index) => {
    console.log(
      `Request ${index + 1}: HTTP ${result.status}`,
      JSON.stringify(result.body),
    );
  });

  const ids = results
    .map(({ body }) => body?._id || body?.booking?._id)
    .filter(Boolean);

  const uniqueIds = new Set(ids);

  console.log("\n--- Summary ---");
  console.log("Requests:", results.length);
  console.log("Booking IDs returned:", ids.length);
  console.log("Distinct booking IDs:", uniqueIds.size);

  if (ids.length === results.length && uniqueIds.size === 1) {
    console.log("PASS: all requests returned the same booking.");
  } else {
    console.log(
      "INCONCLUSIVE: inspect response shapes and verify booking records in the database.",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
