import crypto from "crypto";
import axios from "axios";

const PHONEPE_ENVIRONMENTS = Object.freeze({
  SANDBOX: {
    authUrl: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    apiBaseUrl: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  },
  PRODUCTION: {
    authUrl: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
    apiBaseUrl: "https://api.phonepe.com/apis/pg",
  },
});

export class PhonePeConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PhonePeConfigurationError";
  }
}

const required = (env, key) => {
  const value = env[key]?.trim();

  if (!value) {
    throw new PhonePeConfigurationError(`${key} is not configured`);
  }

  return value;
};

const normaliseEnvironment = (value) => {
  const environment = (value || "SANDBOX").trim().toUpperCase();

  if (!PHONEPE_ENVIRONMENTS[environment]) {
    throw new PhonePeConfigurationError(
      "PHONEPE_ENV must be either SANDBOX or PRODUCTION",
    );
  }

  return environment;
};

const normaliseExpiry = (expiresAt, now) => {
  const parsed = Number(expiresAt);

  if (!Number.isFinite(parsed)) {
    return now + 5 * 60 * 1000;
  }

  // PhonePe documents expires_at in epoch seconds. This also tolerates an
  // epoch-millisecond value should one be returned by a future API version.
  return parsed > 10_000_000_000 ? parsed : parsed * 1000;
};

export const isValidShaWebhookAuthorization = (
  username,
  password,
  authorization,
) => {
  if (!username || !password || !authorization) return false;

  const expected = crypto
    .createHash("sha256")
    .update(`${username}:${password}`)
    .digest("hex");
  const supplied = authorization.trim().replace(/^SHA256\s+/i, "");

  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(supplied, "hex"),
  );
};

export class PhonePeService {
  constructor({ env = process.env, httpClient = axios, now = Date.now } = {}) {
    this.env = env;
    this.httpClient = httpClient;
    this.now = now;
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    this.tokenRequest = null;
  }

  getApiConfig() {
    const environment = normaliseEnvironment(this.env.PHONEPE_ENV);
    const urls = PHONEPE_ENVIRONMENTS[environment];

    return {
      environment,
      ...urls,
      clientId: required(this.env, "PHONEPE_CLIENT_ID"),
      clientSecret: required(this.env, "PHONEPE_CLIENT_SECRET"),
      clientVersion: required(this.env, "PHONEPE_CLIENT_VERSION"),
    };
  }

  getOrderExpirySeconds() {
    const value = Number(this.env.PHONEPE_ORDER_EXPIRY_SECONDS || 900);

    if (!Number.isInteger(value) || value < 300 || value > 3600) {
      throw new PhonePeConfigurationError(
        "PHONEPE_ORDER_EXPIRY_SECONDS must be between 300 and 3600",
      );
    }

    return value;
  }

  async getAccessToken(forceRefresh = false) {
    const now = this.now();

    if (
      !forceRefresh &&
      this.accessToken &&
      this.accessTokenExpiresAt > now + 60_000
    ) {
      return this.accessToken;
    }

    if (!forceRefresh && this.tokenRequest) return this.tokenRequest;

    const config = this.getApiConfig();

    this.tokenRequest = (async () => {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_version: config.clientVersion,
        client_secret: config.clientSecret,
        grant_type: "client_credentials",
      });

      const response = await this.httpClient.post(
        config.authUrl,
        body.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10_000,
        },
      );

      if (!response.data?.access_token) {
        throw new Error(
          "PhonePe authorization response did not include a token",
        );
      }

      this.accessToken = response.data.access_token;
      this.accessTokenExpiresAt = normaliseExpiry(
        response.data.expires_at,
        this.now(),
      );

      return this.accessToken;
    })();

    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = null;
    }
  }

  async authenticatedRequest(request, retryOnUnauthorized = true) {
    const token = await this.getAccessToken();

    try {
      return await this.httpClient.request({
        ...request,
        headers: {
          "Content-Type": "application/json",
          ...request.headers,
          Authorization: `O-Bearer ${token}`,
        },
        timeout: request.timeout || 10_000,
      });
    } catch (error) {
      if (retryOnUnauthorized && error.response?.status === 401) {
        this.accessToken = null;
        this.accessTokenExpiresAt = 0;
        const refreshedToken = await this.getAccessToken(true);

        return this.httpClient.request({
          ...request,
          headers: {
            "Content-Type": "application/json",
            ...request.headers,
            Authorization: `O-Bearer ${refreshedToken}`,
          },
          timeout: request.timeout || 10_000,
        });
      }

      throw error;
    }
  }

  async createPayment({ merchantOrderId, amount, redirectUrl, message }) {
    const config = this.getApiConfig();
    const response = await this.authenticatedRequest({
      method: "POST",
      url: `${config.apiBaseUrl}/checkout/v2/pay`,
      data: {
        merchantOrderId,
        amount,
        expireAfter: this.getOrderExpirySeconds(),
        paymentFlow: {
          type: "PG_CHECKOUT",
          message,
          merchantUrls: { redirectUrl },
        },
      },
    });

    return response.data;
  }

  async createSdkOrder({ merchantOrderId, amount, metaInfo }) {
    const config = this.getApiConfig();
    const data = {
      merchantOrderId,
      amount,
      expireAfter: this.getOrderExpirySeconds(),
      paymentFlow: {
        type: "PG_CHECKOUT",
      },
    };

    if (metaInfo && Object.keys(metaInfo).length > 0) {
      data.metaInfo = metaInfo;
    }

    const response = await this.authenticatedRequest({
      method: "POST",
      url: `${config.apiBaseUrl}/checkout/v2/sdk/order`,
      data,
    });

    return response.data;
  }

  async getOrderStatus(merchantOrderId) {
    const config = this.getApiConfig();
    const response = await this.authenticatedRequest({
      method: "GET",
      url: `${config.apiBaseUrl}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
      params: { details: false, errorContext: true },
    });

    return response.data;
  }

  verifyWebhookAuthorization(authorization) {
    return isValidShaWebhookAuthorization(
      required(this.env, "PHONEPE_WEBHOOK_USERNAME"),
      required(this.env, "PHONEPE_WEBHOOK_PASSWORD"),
      authorization,
    );
  }
}

export const phonePeService = new PhonePeService();
