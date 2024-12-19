import { PayPalClientId, PayPalClientSecret, PayPalBaseUrl } from "../Cfg.js";

/** PayPal API Integration Module
 *  @module Payment
 *  @requires PayPalClientId
 *  @requires PayPalClientSecret
 *  @requires PayPalBaseUrl
 *  @see {@link https://developer.paypal.com/docs/api}
 */

const payPalClientId = PayPalClientId;
const payPalClientSecret = PayPalClientSecret;
const payPalBaseUrl = PayPalBaseUrl;

/** OAuth2 token generation for PayPal API access
 *  @async
 *  @throws {Error} MISSING_API_CREDENTIALS if client credentials are not configured
 *  @returns {Promise<string>} Access token for API requests
 */
async function generateAccessToken() {
  try {
    if (!payPalClientId || !payPalClientSecret) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(payPalClientId + ":" + payPalClientSecret).toString("base64");
    const response = await fetch(`${payPalBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("paypal_error_auth", "Failed to generate Access Token:", error);
    throw error;
  }
}

/** PayPal order creation endpoint handler
 *  @async
 *  @param {Request} aReq - Express request object with amount and description
 *  @param {Response} aRes - Express response object
 *  @returns {Promise<void>} JSON response with order details or error
 */
export async function wHandlePaypalCreateOrder(aReq, aRes) {
  try {
    const { amount, description } = aReq.body;
    const { jsonResponse, httpStatusCode } = await paypalCreateOrder(amount, description);
    aRes.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("paypal_error_create_order", "Failed to create order:", error);
    aRes.status(500).json({ error: "Failed to create order." });
  }
}

/** PayPal order capture endpoint handler
 *  @async
 *  @param {Request} aReq - Express request object with orderID parameter
 *  @param {Response} aRes - Express response object
 *  @returns {Promise<void>} JSON response with capture details or error
 */
export async function wHandlePaypalCaptureOrder(aReq, aRes) {
  try {
    const { orderID } = aReq.params;
    const { jsonResponse, httpStatusCode } = await paypalCaptureOrder(orderID);
    aRes.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("paypal_error_capture_order", "Failed to capture order:", error);
    aRes.status(500).json({ error: "Failed to capture order." });
  }
}

/** PayPal order creation API request
 *  @async
 *  @param {number} amount - Order amount
 *  @param {string} description - Order description
 *  @returns {Promise<{jsonResponse: object, httpStatusCode: number}>} Order creation response
 */
async function paypalCreateOrder(amount, description) {
  console.log(new Date(), "paypal_create_order_start", amount, description);
  const accessToken = await generateAccessToken();
  const url = `${payPalBaseUrl}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        description,
        amount: {
          currency_code: "USD",
          value: amount,
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  const parsedResponse = handleResponse(response);
  console.log(new Date(), "paypal_create_order_end", amount, description);
  return parsedResponse;
}

/** PayPal order capture API request
 *  @async
 *  @param {string} orderID - Order ID to capture
 *  @returns {Promise<{jsonResponse: object, httpStatusCode: number}>} Order capture response
 */
async function paypalCaptureOrder(orderID) {
  console.log(new Date(), "paypal_capture_order_start", orderID);
  const accessToken = await generateAccessToken();
  const url = `${payPalBaseUrl}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PayPal-Request-Id": `capture-${orderID}`,
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  const parsedResponse = handleResponse(response);
  console.log(new Date(), "paypal_capture_order_end", orderID);
  return parsedResponse;
}

/** Generic API response handler
 *  @async
 *  @param {Response} response - API response object
 *  @returns {Promise<{jsonResponse: object, httpStatusCode: number}>} Parsed response
 */
async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}
