import assert from "node:assert/strict";
import test from "node:test";
import {
  PhonePeConfigurationError,
  PhonePeService,
  isValidShaWebhookAuthorization,
} from "../services/phonePeService.js";

const now = 1_800_000_000_000;

const createEnvironment = (overrides = {}) => ({
  PHONEPE_ENV: "SANDBOX",
  PHONEPE_CLIENT_ID: "client-id",
  PHONEPE_CLIENT_SECRET: "client-secret",
  PHONEPE_CLIENT_VERSION: "1",
  PHONEPE_ORDER_EXPIRY_SECONDS: "900",
  PHONEPE_WEBHOOK_USERNAME: "webhook-user",
  PHONEPE_WEBHOOK_PASSWORD: "webhook-password",
  ...overrides,
});

test("creates a V2 checkout and reuses the cached OAuth token", async () => {
  const tokenRequests = [];
  const apiRequests = [];
  const httpClient = {
    async post(url, body, config) {
      tokenRequests.push({ url, body, config });
      return {
        data: {
          access_token: "oauth-token",
          expires_at: now / 1000 + 600,
        },
      };
    },
    async request(config) {
      apiRequests.push(config);
      if (config.method === "POST") {
        return {
          data: {
            orderId: "OMO-1",
            state: "PENDING",
            redirectUrl: "https://mercury.phonepe.test/checkout",
          },
        };
      }

      return { data: { state: "COMPLETED", amount: 1000 } };
    },
  };
  const service = new PhonePeService({
    env: createEnvironment(),
    httpClient,
    now: () => now,
  });

  const payment = await service.createPayment({
    merchantOrderId: "APPT-1",
    amount: 1000,
    redirectUrl: "https://merchant.test/payment/redirect",
    message: "Appointment payment",
  });
  const status = await service.getOrderStatus("APPT-1");

  assert.equal(payment.state, "PENDING");
  assert.equal(status.state, "COMPLETED");
  assert.equal(tokenRequests.length, 1);
  assert.equal(
    tokenRequests[0].url,
    "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
  );
  assert.match(tokenRequests[0].body, /grant_type=client_credentials/);
  assert.equal(apiRequests.length, 2);
  assert.equal(apiRequests[0].headers.Authorization, "O-Bearer oauth-token");
  assert.equal(
    apiRequests[0].url,
    "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
  );
  assert.deepEqual(apiRequests[0].data.paymentFlow, {
    type: "PG_CHECKOUT",
    message: "Appointment payment",
    merchantUrls: {
      redirectUrl: "https://merchant.test/payment/redirect",
    },
  });
  assert.equal(
    apiRequests[1].url,
    "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/APPT-1/status",
  );
});

test("refreshes the OAuth token once after a 401 response", async () => {
  let tokenNumber = 0;
  let apiRequestNumber = 0;
  const httpClient = {
    async post() {
      tokenNumber += 1;
      return {
        data: {
          access_token: `token-${tokenNumber}`,
          expires_at: now / 1000 + 600,
        },
      };
    },
    async request(config) {
      apiRequestNumber += 1;
      if (apiRequestNumber === 1) {
        const error = new Error("Unauthorized");
        error.response = { status: 401 };
        throw error;
      }

      assert.equal(config.headers.Authorization, "O-Bearer token-2");
      return { data: { state: "PENDING" } };
    },
  };
  const service = new PhonePeService({
    env: createEnvironment(),
    httpClient,
    now: () => now,
  });

  const response = await service.getOrderStatus("APPT-2");

  assert.equal(response.state, "PENDING");
  assert.equal(tokenNumber, 2);
  assert.equal(apiRequestNumber, 2);
});

test("validates SHA webhook credentials using a timing-safe comparison", () => {
  const validHash =
    "c2b4f50b0906bc65db35021d9d61cdb7b91ba0a1e06257f5cb1b8a2f10318bd3";

  assert.equal(
    isValidShaWebhookAuthorization(
      "webhook-user",
      "webhook-password",
      validHash,
    ),
    true,
  );
  assert.equal(
    isValidShaWebhookAuthorization("webhook-user", "wrong-password", validHash),
    false,
  );
});

test("rejects an invalid PhonePe environment before making a request", () => {
  const service = new PhonePeService({
    env: createEnvironment({ PHONEPE_ENV: "LIVE" }),
  });

  assert.throws(() => service.getApiConfig(), PhonePeConfigurationError);
});
