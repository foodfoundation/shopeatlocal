import * as Cfg from "../Cfg.js";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { SquareClient, SquareEnvironment } from "square";
import {
  wAdd_SquareCheckout,
  wAdd_SquareMemberPaymentProfileEvent,
  wAdd_SquareTerminal,
  wAdd_SquareWebhookEvent,
  wFinalize_SquareCheckout,
  wMembFromID,
  wMark_SquareWebhookEventProcessed,
  wSquareCheckoutFromID,
  wSquareCheckoutFromSquarePaymentID,
  wSquareCheckoutFromSquareTerminalCheckoutID,
  wSquareMemberPaymentProfileFromIDMemb,
  wSquareTerminalFromID,
  wSquareTerminalsActive,
  wUpd_SquareCheckout,
  wUpd_SquareTerminal,
  wUpsert_SquareMemberPaymentProfile,
} from "./Db.js";
import { TextCurr, TextIDMemb } from "./Util.js";

const squareAccessToken = Cfg.SquareAccessToken || process.env.SQUARE_ACCESS_TOKEN;
const squareLocationId = Cfg.SquareLocationId || process.env.SQUARE_LOCATION_ID;
const squareEnvironmentName = (
  Cfg.SquareEnvironmentName ||
  process.env.SQUARE_ENVIRONMENT ||
  "sandbox"
).toLowerCase();
const squareEnvironment =
  squareEnvironmentName === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
const squareWebhookSignatureKey =
  Cfg.SquareWebhookSignatureKey || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
const squareWebhookNotificationUrl =
  Cfg.SquareWebhookNotificationUrl || process.env.SQUARE_WEBHOOK_NOTIFICATION_URL;

function squareClient() {
  if (!squareAccessToken || !squareLocationId) {
    throw Error("Square API credentials are missing. Configure SquareAccessToken and SquareLocationId.");
  }
  return new SquareClient({
    token: squareAccessToken,
    environment: squareEnvironment,
  });
}

function amtCents(aAmt) {
  const oAmt = Number(aAmt);
  if (!Number.isFinite(oAmt) || oAmt <= 0) throw Error("Invalid payment amount.");
  return Math.round(oAmt * 100);
}

function jsonString(aVal) {
  return JSON.stringify(aVal, (_Key, aValInner) =>
    typeof aValInner === "bigint" ? aValInner.toString() : aValInner,
  );
}

function jsonData(aVal) {
  return JSON.parse(jsonString(aVal));
}

function squareBody(aResp) {
  return aResp?.data || aResp || {};
}

function localStatusFromTerminal(aStatus) {
  switch (aStatus) {
    case "PAIRED":
      return "Paired";
    case "EXPIRED":
      return "Expired";
    default:
      return "Pending";
  }
}

function localStatusFromSquareCheckout(aStatus) {
  switch (aStatus) {
    case "COMPLETED":
      return "Completed";
    case "CANCELED":
    case "CANCEL_REQUESTED":
      return "Canceled";
    case "IN_PROGRESS":
    case "APPROVED":
      return "InProgress";
    case "FAILED":
      return "Failed";
    default:
      return "Pending";
  }
}

/** Checkout status after Square accepts a payment; finalization waits for webhook. */
function checkoutStatusUntilWebhook(aSquareStatus) {
  switch (aSquareStatus) {
    case "CANCELED":
    case "CANCEL_REQUESTED":
      return "Canceled";
    case "FAILED":
      return "Failed";
    default:
      return "InProgress";
  }
}

function squareRef(aIDSquareCheckout) {
  return `SquareCheckout:${aIDSquareCheckout}`;
}

/** Builds a Square note for a payment, tolerating a missing member (e.g. an
 *  on-site non-member cart). */
function paymentNote(aIDMemb, aSuffix) {
  return aIDMemb ? `Member ${TextIDMemb(aIDMemb)} ${aSuffix}` : `On-site ${aSuffix}`;
}

function squareCustomerRequest(aMemb) {
  return {
    givenName: aMemb.Name1First || undefined,
    familyName: aMemb.Name1Last || undefined,
    companyName: aMemb.NameBus || undefined,
    emailAddress: aMemb.Email1 || undefined,
    referenceId: String(aMemb.IDMemb),
    note: `ShopEatLocal member ${TextIDMemb(aMemb.IDMemb)}`,
  };
}

function idFromSquareRef(aReferenceId) {
  const oMatch = /^SquareCheckout:(\d+)$/.exec(aReferenceId || "");
  return oMatch ? Number(oMatch[1]) : null;
}

function squareField(aObj, aCamel, aSnake) {
  if (!aObj) return null;
  if (aObj[aCamel] !== undefined && aObj[aCamel] !== null) return aObj[aCamel];
  return aObj[aSnake] ?? null;
}

/** Square webhooks use snake_case; API responses use camelCase. */
function squareWebhookPayment(aPayment) {
  if (!aPayment) return null;
  return {
    id: aPayment.id || null,
    status: aPayment.status || null,
    referenceId: squareField(aPayment, "referenceId", "reference_id"),
    terminalCheckoutId: squareField(aPayment, "terminalCheckoutId", "terminal_checkout_id"),
    orderId: squareField(aPayment, "orderId", "order_id"),
    receiptUrl: squareField(aPayment, "receiptUrl", "receipt_url"),
    raw: aPayment,
  };
}

function squareWebhookTerminalCheckout(aCheckout) {
  if (!aCheckout) return null;
  return {
    id: aCheckout.id || null,
    status: aCheckout.status || null,
    paymentIds: squareField(aCheckout, "paymentIds", "payment_ids") || [],
    orderId: squareField(aCheckout, "orderId", "order_id"),
    referenceId: squareField(aCheckout, "referenceId", "reference_id"),
    raw: aCheckout,
  };
}

function paymentPayload(aPayment) {
  const oPayment = squareWebhookPayment(aPayment) || {};
  return {
    SquarePaymentID: oPayment.id || null,
    SquareOrderID: oPayment.orderId || null,
    SquareReceiptURL: oPayment.receiptUrl || null,
    SquareStatus: oPayment.status || null,
    SquareResponseJSON: jsonString(oPayment.raw || aPayment || {}),
  };
}

export function squarePublicConfig() {
  return {
    SquareLocationId: squareLocationId || "",
    SquareEnvironmentName: squareEnvironmentName,
  };
}

export async function wEnsureSquareCustomerForMember(aIDMemb, aIDMembStaffCreate = null) {
  const oMemb = await wMembFromID(aIDMemb);
  if (!oMemb) throw Error("Member not found.");

  let oProfile = await wSquareMemberPaymentProfileFromIDMemb(aIDMemb);
  if (oProfile?.SquareCustomerID) return oProfile;

  const oClient = squareClient();
  const oCustomerResp = await oClient.customers.search({
    limit: BigInt(1),
    query: {
      filter: {
        referenceId: { exact: String(oMemb.IDMemb) },
      },
    },
  });
  let oSquareCustomerID = squareBody(oCustomerResp).customers?.[0]?.id;
  let oCkCreatedCustomer = false;

  if (!oSquareCustomerID) {
    const oCreateResp = await oClient.customers.create({
      idempotencyKey: `shopeatlocal-member-${oMemb.IDMemb}`,
      ...squareCustomerRequest(oMemb),
    });
    oSquareCustomerID = squareBody(oCreateResp).customer?.id;
    oCkCreatedCustomer = true;
  }
  if (!oSquareCustomerID)
    throw Error(`Square did not return a customer ID for member ${TextIDMemb(oMemb.IDMemb)}.`);

  oProfile = await wUpsert_SquareMemberPaymentProfile({
    ...(oProfile || {}),
    IDMemb: aIDMemb,
    SquareCustomerID: oSquareCustomerID,
  });

  if (oCkCreatedCustomer) {
    await wAdd_SquareMemberPaymentProfileEvent({
      IDSquareMemberPaymentProfile: oProfile.IDSquareMemberPaymentProfile,
      IDMemb: aIDMemb,
      CdEventSquareMemberPaymentProfile: "CustomerCreate",
      SquareCustomerID: oSquareCustomerID,
      IDMembStaffCreate: aIDMembStaffCreate || null,
    });
  }

  return oProfile;
}

export async function wCreateSquareTerminalCode(aName, aIDMembStaffCreate) {
  if (!aName || !aName.trim()) throw Error("Terminal name is required.");

  const oClient = squareClient();
  const oResp = await oClient.devices.codes.create({
    idempotencyKey: randomUUID(),
    deviceCode: {
      name: aName.trim(),
      productType: "TERMINAL_API",
      locationId: squareLocationId,
    },
  });
  const oCode = squareBody(oResp).deviceCode;
  if (!oCode?.id || !oCode?.code) throw Error("Square did not return a device code.");

  const oID = await wAdd_SquareTerminal({
    Name: aName.trim(),
    SquareLocationID: oCode.locationId || squareLocationId,
    SquareDeviceCodeID: oCode.id,
    SquareDeviceCode: oCode.code,
    SquareDeviceID: oCode.deviceId || null,
    CdStatusSquareTerminal: localStatusFromTerminal(oCode.status),
    IDMembStaffCreate: aIDMembStaffCreate,
  });
  return await wSquareTerminalFromID(oID);
}

export async function wRefreshSquareTerminal(aIDSquareTerminal, aIDMembStaffUpdate) {
  const oTerminal = await wSquareTerminalFromID(aIDSquareTerminal);
  if (!oTerminal) throw Error("Square terminal not found.");
  if (!oTerminal.SquareDeviceCodeID) return oTerminal;

  const oClient = squareClient();
  const oResp = await oClient.devices.codes.get({ id: oTerminal.SquareDeviceCodeID });
  const oCode = squareBody(oResp).deviceCode;
  await wUpd_SquareTerminal(oTerminal.IDSquareTerminal, {
    SquareDeviceCode: oCode?.code || oTerminal.SquareDeviceCode,
    SquareDeviceID: oCode?.deviceId || oTerminal.SquareDeviceID,
    CdStatusSquareTerminal: localStatusFromTerminal(oCode?.status),
    IDMembStaffUpdate: aIDMembStaffUpdate,
  });
  return await wSquareTerminalFromID(aIDSquareTerminal);
}

export async function wDisableSquareTerminal(aIDSquareTerminal, aIDMembStaffUpdate) {
  await wUpd_SquareTerminal(aIDSquareTerminal, {
    CkActive: 0,
    CdStatusSquareTerminal: "Disabled",
    IDMembStaffUpdate: aIDMembStaffUpdate,
  });
}

export async function wSaveSquareMemberCard(aIDMemb, aSourceId, aCkAutoCharge, aIDMembStaffCreate) {
  if (!aSourceId) throw Error("Missing Square payment token.");

  const oMemb = await wMembFromID(aIDMemb);
  if (!oMemb) throw Error("Member not found.");

  const oClient = squareClient();
  let oProfile = await wEnsureSquareCustomerForMember(aIDMemb, aIDMembStaffCreate);
  const oSquareCustomerID = oProfile.SquareCustomerID;

  const oCardResp = await oClient.cards.create({
    idempotencyKey: randomUUID(),
    sourceId: aSourceId,
    card: {
      customerId: oSquareCustomerID,
      referenceId: String(oMemb.IDMemb),
      cardholderName: `${oMemb.Name1First || ""} ${oMemb.Name1Last || ""}`.trim() || undefined,
    },
  });
  const oCard = squareBody(oCardResp).card;
  if (!oCard?.id) throw Error(`Square did not return a card ID: ${jsonString(squareBody(oCardResp))}`);

  if (oProfile?.SquareCardID && oProfile.SquareCardID !== oCard.id) {
    try {
      await oClient.cards.disable({ cardId: oProfile.SquareCardID });
    } catch (aErr) {
      console.warn("square_card_disable_old_failed", oProfile.SquareCardID, aErr);
    }
  }

  const oCkReplacingCard = Boolean(oProfile?.SquareCardID && oProfile.SquareCardID !== oCard.id);

  oProfile = await wUpsert_SquareMemberPaymentProfile({
    IDMemb: aIDMemb,
    SquareCustomerID: oSquareCustomerID,
    SquareCardID: oCard.id,
    CardBrand: oCard.cardBrand || null,
    CardLast4: oCard.last4 || null,
    CardExpMonth: oCard.expMonth === null || oCard.expMonth === undefined ? null : Number(oCard.expMonth),
    CardExpYear: oCard.expYear === null || oCard.expYear === undefined ? null : Number(oCard.expYear),
    CkAutoCharge: aCkAutoCharge ? 1 : 0,
    WhenAutoChargeConsent: aCkAutoCharge ? new Date() : null,
    WhenAutoChargeDisable: aCkAutoCharge ? null : new Date(),
    WhenCardCreate: new Date(),
    WhenCardDisable: null,
  });

  await wAdd_SquareMemberPaymentProfileEvent({
    IDSquareMemberPaymentProfile: oProfile.IDSquareMemberPaymentProfile,
    IDMemb: aIDMemb,
    CdEventSquareMemberPaymentProfile: oCkReplacingCard ? "CardReplace" : "CardSave",
    SquareCustomerID: oSquareCustomerID,
    SquareCardID: oCard.id,
    IDMembStaffCreate: aIDMembStaffCreate || null,
    Note: aCkAutoCharge ? "Saved card and opted in to auto charge." : "Saved card without auto charge.",
  });

  if (aCkAutoCharge) {
    await wAdd_SquareMemberPaymentProfileEvent({
      IDSquareMemberPaymentProfile: oProfile.IDSquareMemberPaymentProfile,
      IDMemb: aIDMemb,
      CdEventSquareMemberPaymentProfile: "AutoChargeOptIn",
      SquareCustomerID: oSquareCustomerID,
      SquareCardID: oCard.id,
      IDMembStaffCreate: aIDMembStaffCreate || null,
    });
  }

  return oProfile;
}

export async function wDisableSquareMemberAutoCharge(aIDMemb, aIDMembStaffCreate) {
  const oProfile = await wSquareMemberPaymentProfileFromIDMemb(aIDMemb);
  if (!oProfile) return null;

  const oUpdated = await wUpsert_SquareMemberPaymentProfile({
    ...oProfile,
    CkAutoCharge: 0,
    WhenAutoChargeDisable: new Date(),
  });

  await wAdd_SquareMemberPaymentProfileEvent({
    IDSquareMemberPaymentProfile: oUpdated.IDSquareMemberPaymentProfile,
    IDMemb: aIDMemb,
    CdEventSquareMemberPaymentProfile: "AutoChargeOptOut",
    SquareCustomerID: oUpdated.SquareCustomerID,
    SquareCardID: oUpdated.SquareCardID,
    IDMembStaffCreate: aIDMembStaffCreate || null,
  });

  return oUpdated;
}

export async function wEnableSquareMemberAutoCharge(aIDMemb, aIDMembStaffCreate) {
  const oProfile = await wSquareMemberPaymentProfileFromIDMemb(aIDMemb);
  if (!oProfile?.SquareCardID) throw Error("No saved Square payment method is available.");

  const oUpdated = await wUpsert_SquareMemberPaymentProfile({
    ...oProfile,
    CkAutoCharge: 1,
    WhenAutoChargeConsent: new Date(),
    WhenAutoChargeDisable: null,
  });

  await wAdd_SquareMemberPaymentProfileEvent({
    IDSquareMemberPaymentProfile: oUpdated.IDSquareMemberPaymentProfile,
    IDMemb: aIDMemb,
    CdEventSquareMemberPaymentProfile: "AutoChargeOptIn",
    SquareCustomerID: oUpdated.SquareCustomerID,
    SquareCardID: oUpdated.SquareCardID,
    IDMembStaffCreate: aIDMembStaffCreate || null,
  });

  return oUpdated;
}

export async function wStartSquareTerminalCheckout(aData) {
  const oAmountCents = amtCents(aData.AmtMoney);
  const oTerminal = await wSquareTerminalFromID(aData.IDSquareTerminal);
  if (!oTerminal?.SquareDeviceID || !oTerminal.CkActive)
    throw Error("Select an active paired Square terminal.");
  const oProfile = aData.IDMemb
    ? await wEnsureSquareCustomerForMember(aData.IDMemb, aData.IDMembStaffCreate)
    : null;

  const oIDCheckout = await wAdd_SquareCheckout({
    IDMemb: aData.IDMemb ?? null,
    IDMembStaffCreate: aData.IDMembStaffCreate ?? null,
    IDInvc: aData.IDInvc ?? null,
    IDSquareTerminal: oTerminal.IDSquareTerminal,
    IDSquareMemberPaymentProfile: oProfile?.IDSquareMemberPaymentProfile ?? null,
    CdTypeSquareCheckout: "Terminal",
    CdStatusSquareCheckout: "Pending",
    AmtMoney: aData.AmtMoney,
    SquareLocationID: oTerminal.SquareLocationID || squareLocationId,
    SquareIdempotencyKey: randomUUID(),
  });
  const oCheckout = await wSquareCheckoutFromID(oIDCheckout);

  const oClient = squareClient();
  try {
    const oResp = await oClient.terminal.checkouts.create({
      idempotencyKey: oCheckout.SquareIdempotencyKey,
      checkout: {
        amountMoney: {
          amount: BigInt(oAmountCents),
          currency: "USD",
        },
        referenceId: squareRef(oCheckout.IDSquareCheckout),
        note: aData.Note || paymentNote(aData.IDMemb, "payment"),
        customerId: oProfile?.SquareCustomerID,
        deviceOptions: {
          deviceId: oTerminal.SquareDeviceID,
        },
      },
    });
    const oSquareCheckout = squareBody(oResp).checkout;
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: localStatusFromSquareCheckout(oSquareCheckout?.status),
      SquareTerminalCheckoutID: oSquareCheckout?.id || null,
      SquareStatus: oSquareCheckout?.status || null,
      SquareResponseJSON: jsonString(oSquareCheckout || {}),
    });
  } catch (aErr) {
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: "Failed",
      SquareErrorJSON: jsonString(aErr?.body || { error: aErr.message }),
    });
    throw aErr;
  }

  return await wSquareCheckoutFromID(oCheckout.IDSquareCheckout);
}

export async function wCreateSquareCashCheckout(aData) {
  const oAmountCents = amtCents(aData.AmtMoney);
  const oCashCents = amtCents(aData.AmtCashTendered || aData.AmtMoney);
  if (oCashCents < oAmountCents) throw Error("Cash tendered must be at least the payment amount.");
  const oProfile = aData.IDMemb
    ? await wEnsureSquareCustomerForMember(aData.IDMemb, aData.IDMembStaffCreate)
    : null;

  const oIDCheckout = await wAdd_SquareCheckout({
    IDMemb: aData.IDMemb ?? null,
    IDMembStaffCreate: aData.IDMembStaffCreate ?? null,
    IDInvc: aData.IDInvc ?? null,
    IDSquareMemberPaymentProfile: oProfile?.IDSquareMemberPaymentProfile ?? null,
    CdTypeSquareCheckout: "Cash",
    CdStatusSquareCheckout: "Pending",
    AmtMoney: aData.AmtMoney,
    AmtCashTendered: aData.AmtCashTendered || aData.AmtMoney,
    SquareLocationID: squareLocationId,
    SquareIdempotencyKey: randomUUID(),
  });
  const oCheckout = await wSquareCheckoutFromID(oIDCheckout);
  const oClient = squareClient();

  try {
    const oResp = await oClient.payments.create({
      sourceId: "CASH",
      idempotencyKey: oCheckout.SquareIdempotencyKey,
      locationId: squareLocationId,
      customerId: oProfile?.SquareCustomerID,
      amountMoney: {
        amount: BigInt(oAmountCents),
        currency: "USD",
      },
      cashDetails: {
        buyerSuppliedMoney: {
          amount: BigInt(oCashCents),
          currency: "USD",
        },
      },
      referenceId: squareRef(oCheckout.IDSquareCheckout),
      note: aData.Note || paymentNote(aData.IDMemb, "cash payment"),
    });
    const oPayment = squareBody(oResp).payment;
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: checkoutStatusUntilWebhook(oPayment?.status),
      ...paymentPayload(oPayment),
    });
  } catch (aErr) {
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: "Failed",
      SquareErrorJSON: jsonString(aErr?.body || { error: aErr.message }),
    });
    throw aErr;
  }

  return await wSquareCheckoutFromID(oCheckout.IDSquareCheckout);
}

export async function wCreateSquareWebCardCheckout(aData) {
  if (!aData.SourceId) throw Error("Missing Square payment token.");

  const oAmountCents = amtCents(aData.AmtMoney);
  const oProfile = await wEnsureSquareCustomerForMember(aData.IDMemb, aData.IDMembStaffCreate);

  const oIDCheckout = await wAdd_SquareCheckout({
    IDMemb: aData.IDMemb,
    IDMembStaffCreate: aData.IDMembStaffCreate || aData.IDMemb,
    IDSquareMemberPaymentProfile: oProfile.IDSquareMemberPaymentProfile,
    CdTypeSquareCheckout: "WebCard",
    CdStatusSquareCheckout: "Pending",
    AmtMoney: aData.AmtMoney,
    SquareLocationID: squareLocationId,
    SquareIdempotencyKey: randomUUID(),
  });
  const oCheckout = await wSquareCheckoutFromID(oIDCheckout);
  const oClient = squareClient();

  try {
    const oResp = await oClient.payments.create({
      sourceId: aData.SourceId,
      idempotencyKey: oCheckout.SquareIdempotencyKey,
      locationId: squareLocationId,
      customerId: oProfile.SquareCustomerID,
      amountMoney: {
        amount: BigInt(oAmountCents),
        currency: "USD",
      },
      referenceId: squareRef(oCheckout.IDSquareCheckout),
      note: aData.Note || `Member ${TextIDMemb(aData.IDMemb)} web payment`,
    });
    const oPayment = squareBody(oResp).payment;
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: checkoutStatusUntilWebhook(oPayment?.status),
      ...paymentPayload(oPayment),
    });
  } catch (aErr) {
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: "Failed",
      SquareErrorJSON: jsonString(aErr?.body || { error: aErr.message }),
    });
    throw aErr;
  }

  return await wSquareCheckoutFromID(oCheckout.IDSquareCheckout);
}

export async function wCreateSquareAutoCharge(aData) {
  const oAmountCents = amtCents(aData.AmtMoney);
  const oProfile = await wSquareMemberPaymentProfileFromIDMemb(aData.IDMemb);
  if (!oProfile?.CkAutoCharge || !oProfile.SquareCardID || !oProfile.SquareCustomerID)
    throw Error("This member has not opted in to auto charge.");

  const oIDCheckout = await wAdd_SquareCheckout({
    IDMemb: aData.IDMemb,
    IDMembStaffCreate: aData.IDMembStaffCreate,
    IDInvc: aData.IDInvc ?? null,
    IDSquareMemberPaymentProfile: oProfile.IDSquareMemberPaymentProfile,
    CdTypeSquareCheckout: "AutoCharge",
    CdStatusSquareCheckout: "Pending",
    AmtMoney: aData.AmtMoney,
    SquareLocationID: squareLocationId,
    SquareIdempotencyKey: randomUUID(),
  });
  const oCheckout = await wSquareCheckoutFromID(oIDCheckout);
  const oClient = squareClient();

  try {
    const oResp = await oClient.payments.create({
      sourceId: oProfile.SquareCardID,
      customerId: oProfile.SquareCustomerID,
      idempotencyKey: oCheckout.SquareIdempotencyKey,
      locationId: squareLocationId,
      amountMoney: {
        amount: BigInt(oAmountCents),
        currency: "USD",
      },
      referenceId: squareRef(oCheckout.IDSquareCheckout),
      note: aData.Note || paymentNote(aData.IDMemb, "auto charge"),
    });
    const oPayment = squareBody(oResp).payment;
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: checkoutStatusUntilWebhook(oPayment?.status),
      ...paymentPayload(oPayment),
    });
  } catch (aErr) {
    await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
      CdStatusSquareCheckout: "Failed",
      SquareErrorJSON: jsonString(aErr?.body || { error: aErr.message }),
    });
    throw aErr;
  }

  return await wSquareCheckoutFromID(oCheckout.IDSquareCheckout);
}

async function wCheckoutFromSquarePayment(aPayment) {
  const oPayment = squareWebhookPayment(aPayment);
  if (!oPayment) return null;

  if (oPayment.id) {
    const oByPayment = await wSquareCheckoutFromSquarePaymentID(oPayment.id);
    if (oByPayment) return oByPayment;
  }
  if (oPayment.terminalCheckoutId) {
    const oByTerminal = await wSquareCheckoutFromSquareTerminalCheckoutID(oPayment.terminalCheckoutId);
    if (oByTerminal) return oByTerminal;
  }
  const oID = idFromSquareRef(oPayment.referenceId);
  return oID ? await wSquareCheckoutFromID(oID) : null;
}

async function wHandleCompletedSquarePayment(aPayment, aSquareEventID) {
  const oPayment = squareWebhookPayment(aPayment);
  if (!oPayment) return;

  const oCheckout = await wCheckoutFromSquarePayment(aPayment);
  if (!oCheckout) return;

  await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
    CdStatusSquareCheckout:
      oPayment.status === "COMPLETED" ? "Completed" : localStatusFromSquareCheckout(oPayment.status),
    LastSquareWebhookEventID: aSquareEventID,
    ...paymentPayload(aPayment),
  });

  if (oPayment.status === "COMPLETED") {
    await wFinalize_SquareCheckout(oCheckout.IDSquareCheckout, {
      Note: `Square payment ${oPayment.id}`,
      SquareStatus: oPayment.status,
      SquareEventID: aSquareEventID,
    });
  }
}

async function wHandleTerminalCheckoutEvent(aTerminalCheckout, aSquareEventID) {
  const oTerminal = squareWebhookTerminalCheckout(aTerminalCheckout);
  if (!oTerminal?.id) return;

  let oCheckout = await wSquareCheckoutFromSquareTerminalCheckoutID(oTerminal.id);
  if (!oCheckout && oTerminal.referenceId) {
    const oID = idFromSquareRef(oTerminal.referenceId);
    if (oID) oCheckout = await wSquareCheckoutFromID(oID);
  }
  if (!oCheckout) return;

  const oPaymentID = oTerminal.paymentIds[0] || oCheckout.SquarePaymentID || null;
  await wUpd_SquareCheckout(oCheckout.IDSquareCheckout, {
    CdStatusSquareCheckout: localStatusFromSquareCheckout(oTerminal.status),
    SquarePaymentID: oPaymentID,
    SquareOrderID: oTerminal.orderId || oCheckout.SquareOrderID,
    SquareStatus: oTerminal.status || null,
    SquareResponseJSON: jsonString(oTerminal.raw),
    LastSquareWebhookEventID: aSquareEventID,
  });

  if (oTerminal.status === "COMPLETED" && oPaymentID) {
    const oPaymentResp = await squareClient().payments.get({ paymentId: oPaymentID });
    await wHandleCompletedSquarePayment(squareBody(oPaymentResp).payment, aSquareEventID);
  }
}

async function wProcessSquareWebhookEvent(aEvent) {
  const oType = aEvent?.type;
  const oObject = aEvent?.data?.object || {};
  const oTerminalCheckout = oObject.terminal_checkout || oObject.checkout;
  if (oObject.payment) await wHandleCompletedSquarePayment(oObject.payment, aEvent.event_id);
  else if (oTerminalCheckout) await wHandleTerminalCheckoutEvent(oTerminalCheckout, aEvent.event_id);
  else if (oType === "device.code.paired") console.log("square_device_code_paired", oObject.device_code?.id);
}

function verifySquareSignature(aReq, aRawBody) {
  if (!squareWebhookSignatureKey) throw Error("SquareWebhookSignatureKey is not configured.");
  const oSignature = aReq.get("x-square-hmacsha256-signature");
  if (!oSignature) return false;

  const oUrl =
    squareWebhookNotificationUrl || `${aReq.protocol}://${aReq.get("host")}${aReq.originalUrl}`;
  const oExpected = createHmac("sha256", squareWebhookSignatureKey)
    .update(oUrl + aRawBody)
    .digest("base64");
  const oSigBuf = Buffer.from(oSignature);
  const oExpectedBuf = Buffer.from(oExpected);
  return oSigBuf.length === oExpectedBuf.length && timingSafeEqual(oSigBuf, oExpectedBuf);
}

export async function wHandleSquareWebhook(aReq, aResp) {
  const oRawBody = Buffer.isBuffer(aReq.body) ? aReq.body.toString("utf8") : String(aReq.body || "");

  if (!verifySquareSignature(aReq, oRawBody)) {
    aResp.status(403).json({ error: "Invalid Square webhook signature." });
    return;
  }

  const oEvent = JSON.parse(oRawBody);
  const oEventID = oEvent.event_id;
  const oObject = oEvent?.data?.object || {};
  const oSquareObjectID =
    oObject.payment?.id ||
    oObject.terminal_checkout?.id ||
    oObject.checkout?.id ||
    oObject.device_code?.id ||
    null;

  await wAdd_SquareWebhookEvent({
    SquareEventID: oEventID,
    CdTypeSquareWebhookEvent: oEvent.type,
    SquareMerchantID: oEvent.merchant_id || null,
    SquareEnvironment: aReq.get("square-environment") || squareEnvironmentName,
    SquareObjectID: oSquareObjectID,
    PayloadJSON: jsonString(oEvent),
    WhenEvent: oEvent.created_at ? new Date(oEvent.created_at) : null,
  });

  try {
    await wProcessSquareWebhookEvent(oEvent);
    await wMark_SquareWebhookEventProcessed(oEventID, {});
    aResp.status(200).json({ ok: true });
  } catch (aErr) {
    await wMark_SquareWebhookEventProcessed(oEventID, { Error: aErr.message || String(aErr) });
    throw aErr;
  }
}

function handleSquareError(aResp, aErr) {
  console.error("square_error", aErr);
  const oStatus = aErr?.statusCode || 500;
  aResp.status(oStatus).json(aErr?.body || { error: aErr.message || "Square request failed." });
}

export async function wHandleSquareSaveMemberCard(aReq, aResp) {
  try {
    const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
    const oProfile = await wSaveSquareMemberCard(
      oIDMemb,
      aReq.body.sourceId,
      Boolean(aReq.body.autoCharge),
      aResp.locals.CredUser?.IDMemb,
    );
    aResp.status(200).json({ profile: jsonData(oProfile) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareDisableMemberAutoCharge(aReq, aResp) {
  try {
    const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
    const oProfile = await wDisableSquareMemberAutoCharge(oIDMemb, aResp.locals.CredUser?.IDMemb);
    aResp.status(200).json({ profile: jsonData(oProfile) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareEnableMemberAutoCharge(aReq, aResp) {
  try {
    const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
    const oProfile = await wEnableSquareMemberAutoCharge(oIDMemb, aResp.locals.CredUser?.IDMemb);
    aResp.status(200).json({ profile: jsonData(oProfile) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

/** Reads the payment context prepared by a page's PayCtx middleware. The
 *  context resolves the paying member (which may be null for an on-site
 *  non-member cart), the staff member recording the payment, and the invoice
 *  the payment should be linked to (which may be null on the member payment
 *  page). */
function payCtx(aResp) {
  const oCtx = aResp.locals.PayCtx;
  if (!oCtx) throw Error("Payment context is not available for this request.");
  return oCtx;
}

/** Default amount for the payment section: member balance when a member is
 *  present, otherwise the invoice total. */
export function wPaymentAmtDefault(aOpts) {
  if (aOpts.IDMemb && aOpts.Bal !== null && aOpts.Bal !== undefined)
    return Math.max(aOpts.Bal, 0);
  return Math.max(aOpts.AmtInvc ?? 0, 0);
}

/** Builds the locals consumed by the reusable payment section partial
 *  (Misc/pPaymentSection). Auto charge and the balance line are only shown when
 *  a member is present. */
export async function wPaymentSectionLocals(aOpts) {
  const oTerminals = await wSquareTerminalsActive();
  let oProfile = null;
  let oCkAutoCharge = false;
  if (aOpts.IDMemb) {
    oProfile = await wSquareMemberPaymentProfileFromIDMemb(aOpts.IDMemb);
    oCkAutoCharge = Boolean(oProfile?.CkAutoCharge) && Boolean(oProfile?.SquareCardID);
  }
  const oCkShowBalance = aOpts.Bal !== null && aOpts.Bal !== undefined;
  return {
    URL: aOpts.URL,
    AmtDefault: aOpts.AmtDefault,
    CkShowBalance: oCkShowBalance,
    Bal: oCkShowBalance ? aOpts.Bal : null,
    CkPollBalance: oCkShowBalance,
    CkShowAutoCharge: Boolean(aOpts.IDMemb),
    CkAutoCharge: oCkAutoCharge,
    SquarePaymentProfile: oProfile,
    SquareTerminals: oTerminals,
  };
}

/** Returns the current member balance for pages that use the shared payment
 *  section. Optionally includes Square checkout status when polling after a
 *  charge is initiated. */
export async function wHandleSquarePaymentBalance(aReq, aResp) {
  try {
    const oCtx = payCtx(aResp);
    if (!oCtx.IDMemb) {
      aResp.status(200).json({ CkHasBalance: false });
      return;
    }

    const oMemb = await wMembFromID(oCtx.IDMemb);
    const oBalMoney = Number(oMemb.BalMoney);
    const oBalEBT = Number(oMemb.BalEBT);
    const oBal = oBalMoney + oBalEBT;

    let oCheckoutInfo = null;
    const oIDCheckout = Number(aReq.query.IDSquareCheckout);
    if (Number.isFinite(oIDCheckout) && oIDCheckout > 0) {
      const oCheckout = await wSquareCheckoutFromID(oIDCheckout);
      if (!oCheckout) throw Error("Square checkout not found.");
      if ((oCheckout.IDMemb ?? null) !== oCtx.IDMemb)
        throw Error("Square checkout does not match this member.");
      if (oCtx.IDInvc && oCheckout.IDInvc !== oCtx.IDInvc)
        throw Error("Square checkout does not match this invoice.");

      const oStatus = oCheckout.CdStatusSquareCheckout;
      oCheckoutInfo = {
        IDSquareCheckout: oCheckout.IDSquareCheckout,
        CdStatusSquareCheckout: oStatus,
        IDTransact: oCheckout.IDTransact,
        CkComplete: oStatus === "Completed" || oStatus === "Failed" || oStatus === "Canceled",
      };
    }

    aResp.status(200).json({
      CkHasBalance: true,
      BalMoney: oBalMoney,
      BalEBT: oBalEBT,
      Bal: oBal,
      TextBal: TextCurr(oBal),
      TextBalMoney: TextCurr(oBalMoney),
      TextBalEBT: TextCurr(oBalEBT),
      checkout: oCheckoutInfo,
    });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareTerminalCheckout(aReq, aResp) {
  try {
    const oCtx = payCtx(aResp);
    const oCheckout = await wStartSquareTerminalCheckout({
      IDMemb: oCtx.IDMemb,
      IDMembStaffCreate: oCtx.IDMembStaffCreate,
      IDInvc: oCtx.IDInvc,
      IDSquareTerminal: Number(aReq.body.IDSquareTerminal),
      AmtMoney: Number(aReq.body.AmtMoney),
    });
    aResp.status(200).json({ checkout: jsonData(oCheckout) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareCashCheckout(aReq, aResp) {
  try {
    const oCtx = payCtx(aResp);
    const oCheckout = await wCreateSquareCashCheckout({
      IDMemb: oCtx.IDMemb,
      IDMembStaffCreate: oCtx.IDMembStaffCreate,
      IDInvc: oCtx.IDInvc,
      AmtMoney: Number(aReq.body.AmtMoney),
      AmtCashTendered: Number(aReq.body.AmtCashTendered || aReq.body.AmtMoney),
    });
    aResp.status(200).json({ checkout: jsonData(oCheckout) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareAutoChargeCheckout(aReq, aResp) {
  try {
    const oCtx = payCtx(aResp);
    if (!oCtx.IDMemb) throw Error("Auto charge requires a member.");
    const oCheckout = await wCreateSquareAutoCharge({
      IDMemb: oCtx.IDMemb,
      IDMembStaffCreate: oCtx.IDMembStaffCreate,
      IDInvc: oCtx.IDInvc,
      AmtMoney: Number(aReq.body.AmtMoney),
    });
    aResp.status(200).json({ checkout: jsonData(oCheckout) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}

export async function wHandleSquareCreatePayment(aReq, aResp) {
  try {
    const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
    const oAmount = Number(aReq.body.amount);
    if (!Number.isFinite(oAmount) || oAmount <= 0) throw Error("Invalid amount.");

    const oCheckout = await wCreateSquareWebCardCheckout({
      IDMemb: oIDMemb,
      IDMembStaffCreate: aResp.locals.CredUser?.IDMemb || oIDMemb,
      SourceId: aReq.body.sourceId,
      AmtMoney: oAmount,
      Note: aReq.body.description,
    });
    aResp.status(200).json({ checkout: jsonData(oCheckout) });
  } catch (aErr) {
    handleSquareError(aResp, aErr);
  }
}
