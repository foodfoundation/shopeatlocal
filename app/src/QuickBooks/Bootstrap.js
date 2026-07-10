// QuickBooks/Bootstrap.js
// -----------------------
// Idempotent setup of the QuickBooks company: chart-of-accounts entries,
// channel Classes, the producer service item, and the generic member A/R
// customer. Every step queries before creating, stores QuickBooks IDs in the
// entity map, never deletes or renames existing accounting data, and records
// audit events. Shared by the admin UI and the bootstrap CLI.

import { Conn } from "../Db.js";
import { wCreate, wQueryOne, wCompanyInfo } from "./Client.js";
import {
  wConnection,
  wEntityMap,
  wEntityMaps,
  wUpsert_EntityMap,
  wUpd_ConnectionSettings,
  wAdd_Event,
} from "./Db.js";
import { EnvironmentName } from "./Config.js";

/** The full setup: role, QBO entity type, display name, and creation body.
 *  Payment-method clearing accounts are Bank accounts so they can also fund
 *  BillPayments. */
export const SetupPlan = [
  {
    CdRole: "AcctMembAR",
    Type: "Account",
    Name: "ShopEatLocal Member A/R",
    Body: { AccountType: "Accounts Receivable", AccountSubType: "AccountsReceivable" },
  },
  {
    CdRole: "AcctAP",
    Type: "Account",
    Name: "ShopEatLocal Producer A/P",
    Body: { AccountType: "Accounts Payable", AccountSubType: "AccountsPayable" },
  },
  {
    CdRole: "AcctIncomeSales",
    Type: "Account",
    Name: "ShopEatLocal Product Sales",
    Body: { AccountType: "Income", AccountSubType: "SalesOfProductIncome" },
  },
  {
    CdRole: "AcctIncomeFeeCoopShop",
    Type: "Account",
    Name: "ShopEatLocal Shopper Co-op Fees",
    Body: { AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
  },
  {
    CdRole: "AcctIncomeMembership",
    Type: "Account",
    Name: "ShopEatLocal Membership Fees",
    Body: { AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
  },
  {
    CdRole: "AcctIncomeDeliv",
    Type: "Account",
    Name: "ShopEatLocal Delivery & Transfer Fees",
    Body: { AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
  },
  {
    CdRole: "AcctIncomeFeeCoopProducer",
    Type: "Account",
    Name: "ShopEatLocal Producer Co-op Fees",
    Body: { AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
  },
  {
    CdRole: "AcctIncomeFeeInvt",
    Type: "Account",
    Name: "ShopEatLocal Managed Inventory Fees",
    Body: { AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
  },
  {
    CdRole: "AcctLiabTaxSale",
    Type: "Account",
    Name: "ShopEatLocal Sales Tax Payable",
    Body: { AccountType: "Other Current Liability", AccountSubType: "SalesTaxPayable" },
  },
  {
    CdRole: "AcctCOGSProducer",
    Type: "Account",
    Name: "ShopEatLocal Producer Purchases",
    Body: { AccountType: "Cost of Goods Sold", AccountSubType: "SuppliesMaterialsCogs" },
  },
  {
    CdRole: "AcctLiabGiftCert",
    Type: "Account",
    Name: "ShopEatLocal Gift Certificates",
    Body: { AccountType: "Other Current Liability", AccountSubType: "OtherCurrentLiabilities" },
  },
  {
    CdRole: "AcctContraCoupon",
    Type: "Account",
    Name: "ShopEatLocal Coupons & Discounts",
    Body: { AccountType: "Income", AccountSubType: "DiscountsRefundsGiven" },
  },
  {
    CdRole: "AcctSuspenseAdj",
    Type: "Account",
    Name: "ShopEatLocal Adjustment Suspense",
    Body: { AccountType: "Other Current Liability", AccountSubType: "OtherCurrentLiabilities" },
  },
  {
    CdRole: "AcctClearingCash",
    Type: "Account",
    Name: "ShopEatLocal Clearing - Cash",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingCheck",
    Type: "Account",
    Name: "ShopEatLocal Clearing - Check",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingCredit",
    Type: "Account",
    Name: "ShopEatLocal Clearing - Credit Card",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingDebit",
    Type: "Account",
    Name: "ShopEatLocal Clearing - Debit Card",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingPayPal",
    Type: "Account",
    Name: "ShopEatLocal Clearing - PayPal",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingSquare",
    Type: "Account",
    Name: "ShopEatLocal Clearing - Square",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingEBTElec",
    Type: "Account",
    Name: "ShopEatLocal Clearing - EBT Electronic",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  {
    CdRole: "AcctClearingEBTVouch",
    Type: "Account",
    Name: "ShopEatLocal Clearing - EBT Voucher",
    Body: { AccountType: "Bank", AccountSubType: "Checking" },
  },
  { CdRole: "ClassWeb", Type: "Class", Name: "Web", Body: {} },
  { CdRole: "ClassOnsiteRetail", Type: "Class", Name: "On-site Retail", Body: {} },
  { CdRole: "ClassWholesale", Type: "Class", Name: "Wholesale", Body: {} },
  { CdRole: "CustomerMembAR", Type: "Customer", Name: "ShopEatLocal Members", Body: {} },
  { CdRole: "ItemProducerGoods", Type: "Item", Name: "ShopEatLocal Producer Goods", Body: {} },
];

function queryFieldOfType(aType) {
  return aType === "Customer" || aType === "Vendor" ? "DisplayName" : "Name";
}

function createBody(aStep, aRoleIDs) {
  switch (aStep.Type) {
    case "Account":
      return { Name: aStep.Name, ...aStep.Body };
    case "Class":
      return { Name: aStep.Name };
    case "Customer":
      return { DisplayName: aStep.Name };
    case "Item":
      return {
        Name: aStep.Name,
        Type: "Service",
        IncomeAccountRef: { value: aRoleIDs.AcctIncomeSales },
        ExpenseAccountRef: { value: aRoleIDs.AcctCOGSProducer },
      };
    default:
      throw Error(`Unknown setup entity type '${aStep.Type}'.`);
  }
}

/** Runs the idempotent bootstrap. Options: CkDryRun (report without
 *  creating), IDMembStaff (for audit). Returns
 *  { RealmID, CompanyName, Steps: [{ CdRole, Name, Action, QuickBooksID }],
 *  CkComplete }. Throws on a realm/environment mismatch or API failure. */
export async function wBootstrap(aOpts = {}) {
  const oConnection = await wConnection();
  if (!oConnection) throw Error("QuickBooks is not connected; authorize the realm first.");
  if (oConnection.CdStatusQuickBooksConnection !== "Connected")
    throw Error(
      `QuickBooks connection is ${oConnection.CdStatusQuickBooksConnection}; reauthorize first.`,
    );
  if (oConnection.EnvironmentName !== EnvironmentName)
    throw Error(
      `Realm/environment mismatch: connection is '${oConnection.EnvironmentName}' but the ` +
        `runtime is configured for '${EnvironmentName}'. Refusing to bootstrap.`,
    );

  const oCompany = await wCompanyInfo();
  if (oCompany?.CompanyName && oCompany.CompanyName !== oConnection.CompanyName)
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      CompanyName: oCompany.CompanyName,
    });

  const oRealmID = oConnection.RealmID;
  const oSteps = [];
  const oRoleIDs = {};
  let oCkComplete = true;

  for (const oStep of SetupPlan) {
    // 1. A stored mapping wins; never rename or replace what it points to:
    const oMap = await wEntityMap(oRealmID, oStep.CdRole, "");
    if (oMap) {
      oRoleIDs[oStep.CdRole] = oMap.QuickBooksID;
      oSteps.push({
        CdRole: oStep.CdRole,
        Name: oMap.Name || oStep.Name,
        Action: "Mapped",
        QuickBooksID: oMap.QuickBooksID,
      });
      continue;
    }

    // 2. An entity with the expected name is adopted, not duplicated:
    const oExisting = await wQueryOne(oStep.Type, queryFieldOfType(oStep.Type), oStep.Name);
    if (oExisting) {
      if (
        oStep.Type === "Account" &&
        oStep.Body.AccountType &&
        oExisting.AccountType !== oStep.Body.AccountType
      )
        throw Error(
          `QuickBooks already has an account named '${oStep.Name}' of type ` +
            `'${oExisting.AccountType}', expected '${oStep.Body.AccountType}'. ` +
            "Resolve the conflict manually, then rerun bootstrap.",
        );
      if (!aOpts.CkDryRun)
        await wUpsert_EntityMap({
          RealmID: oRealmID,
          CdRole: oStep.CdRole,
          CdTypeQuickBooksEntity: oStep.Type,
          QuickBooksID: oExisting.Id,
          Name: oStep.Name,
        });
      oRoleIDs[oStep.CdRole] = oExisting.Id;
      oSteps.push({
        CdRole: oStep.CdRole,
        Name: oStep.Name,
        Action: "Adopted",
        QuickBooksID: oExisting.Id,
      });
      continue;
    }

    // 3. Otherwise create it (or report that we would):
    if (aOpts.CkDryRun) {
      oCkComplete = false;
      oSteps.push({
        CdRole: oStep.CdRole,
        Name: oStep.Name,
        Action: "WouldCreate",
        QuickBooksID: null,
      });
      continue;
    }
    const oCreated = await wCreate(
      oStep.Type,
      createBody(oStep, oRoleIDs),
      `bootstrap-${oStep.CdRole}`,
    );
    await wUpsert_EntityMap({
      RealmID: oRealmID,
      CdRole: oStep.CdRole,
      CdTypeQuickBooksEntity: oStep.Type,
      QuickBooksID: oCreated.Id,
      Name: oStep.Name,
    });
    oRoleIDs[oStep.CdRole] = oCreated.Id;
    oSteps.push({
      CdRole: oStep.CdRole,
      Name: oStep.Name,
      Action: "Created",
      QuickBooksID: oCreated.Id,
    });
  }

  if (!aOpts.CkDryRun && oCkComplete)
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, { CkBootstrapped: true });

  await wAdd_Event({
    CdTypeQuickBooksEvent: aOpts.CkDryRun ? "BootstrapDryRun" : "Bootstrap",
    RealmID: oRealmID,
    IDMembStaffCreate: aOpts.IDMembStaff || null,
    Detail: {
      CkComplete: oCkComplete,
      Steps: oSteps.map(o => ({
        CdRole: o.CdRole,
        Action: o.Action,
        QuickBooksID: o.QuickBooksID,
      })),
    },
  });

  return {
    RealmID: oRealmID,
    EnvironmentName: oConnection.EnvironmentName,
    CompanyName: oCompany?.CompanyName || oConnection.CompanyName || null,
    CkDryRun: Boolean(aOpts.CkDryRun),
    CkComplete: oCkComplete,
    Steps: oSteps,
  };
}

/** Validates that every setup role is mapped. Returns { CkValid, Missing }. */
export async function wValidateSetup() {
  const oConnection = await wConnection();
  if (!oConnection) return { CkValid: false, Missing: ["Connection"] };
  const oMaps = await wEntityMaps(oConnection.RealmID);
  const oMapped = new Set(oMaps.map(o => o.CdRole));
  const oMissing = SetupPlan.filter(o => !oMapped.has(o.CdRole)).map(o => o.CdRole);
  return { CkValid: !oMissing.length, Missing: oMissing };
}

// -------
// Vendors
// -------

async function wProducerWithMemb(aIDProducer) {
  const oSQL = `SELECT Producer.IDProducer, Producer.NameBus AS NameBusProducer,
			Producer.Addr1, Producer.Addr2, Producer.City, Producer.St, Producer.Zip,
			Producer.Phone1, Producer.Email,
			Memb.NameBus AS NameBusMemb, Memb.Name1First, Memb.Name1Last
		FROM Producer
		JOIN Memb USING (IDMemb)
		WHERE Producer.IDProducer = :IDProducer`;
  const [oRows] = await Conn.wExecPrep(oSQL, { IDProducer: aIDProducer });
  return oRows.length ? oRows[0] : null;
}

export function NameVendor(aProducer) {
  const oNameBase =
    aProducer.NameBusProducer ||
    aProducer.NameBusMemb ||
    `${aProducer.Name1First || ""} ${aProducer.Name1Last || ""}`.trim();
  // The producer ID suffix keeps DisplayName unique within QuickBooks:
  return `${oNameBase} (SEL-P${aProducer.IDProducer})`.slice(0, 100);
}

/** Ensures a QuickBooks Vendor exists and is mapped for the producer.
 *  Identity/contact data is set on create only; existing vendors are not
 *  mutated unless aCkUpdate (an explicit staff retry) is passed. */
export async function wEnsureVendor(aIDProducer, aCkUpdate = false) {
  const oConnection = await wConnection();
  if (!oConnection) throw Error("QuickBooks is not connected.");
  const oRealmID = oConnection.RealmID;

  const oMap = await wEntityMap(oRealmID, "Vendor", String(aIDProducer));
  if (oMap && !aCkUpdate) return oMap;

  const oProducer = await wProducerWithMemb(aIDProducer);
  if (!oProducer) throw Error(`Producer ${aIDProducer} not found.`);
  const oName = NameVendor(oProducer);

  let oVendor = await wQueryOne("Vendor", "DisplayName", oName);
  if (!oVendor) {
    oVendor = await wCreate(
      "Vendor",
      {
        DisplayName: oName,
        CompanyName: oProducer.NameBusProducer || oProducer.NameBusMemb || undefined,
        GivenName: oProducer.Name1First || undefined,
        FamilyName: oProducer.Name1Last || undefined,
        PrimaryEmailAddr: oProducer.Email ? { Address: oProducer.Email } : undefined,
        PrimaryPhone: oProducer.Phone1 ? { FreeFormNumber: oProducer.Phone1 } : undefined,
        BillAddr: {
          Line1: oProducer.Addr1 || undefined,
          Line2: oProducer.Addr2 || undefined,
          City: oProducer.City || undefined,
          CountrySubDivisionCode: oProducer.St || undefined,
          PostalCode: oProducer.Zip || undefined,
        },
      },
      `vendor-${oRealmID.slice(0, 20)}-${aIDProducer}`,
    );
    await wAdd_Event({
      CdTypeQuickBooksEvent: "VendorCreate",
      RealmID: oRealmID,
      Detail: { IDProducer: aIDProducer, QuickBooksID: oVendor.Id },
    });
  }

  await wUpsert_EntityMap({
    RealmID: oRealmID,
    CdRole: "Vendor",
    LocalKey: String(aIDProducer),
    CdTypeQuickBooksEntity: "Vendor",
    QuickBooksID: oVendor.Id,
    Name: oName,
  });
  return await wEntityMap(oRealmID, "Vendor", String(aIDProducer));
}
