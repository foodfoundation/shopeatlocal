// on-site-checkout.js
// -------------------
// On-site Checkout page controllers

import { wCreate } from "../../InvcShopOnsite.js";
import {
  wConnNew,
  wAdd_Transact,
  wDel_ItsCartOnsitePend,
  wDel_CartOnsitePend,
  wCartOnsitePend,
  wMembFromID,
  wItsCartOnsitePend,
  getProductRow,
} from "../../Db.js";
import {
  Add_CkExcludeConsumerFee,
  TtlsCart,
  CtDigitCurrAcct,
  Add_CkTaxSaleEff,
} from "../../Util.js";
import { CoopParams, Site } from "../../Site.js";

import _ from "lodash";
const { round } = _;

export async function wHandGet(aReq, aResp) {
  const oIDSess = aReq.session.id;
  const oDataCartPend = await wDataCartPend(oIDSess);
  if (!oDataCartPend.Cart || !oDataCartPend.Producers.length) {
    aResp.redirect(303, "/on-site-cart");
    return;
  }

  aResp.locals.MembShop = oDataCartPend.MembShop;
  aResp.locals.CkEBTElig = oDataCartPend.CkEligEBT;
  aResp.locals.CdCartType = oDataCartPend.CdCartType;
  aResp.locals.Producers = oDataCartPend.Producers;
  aResp.locals.Ttls = oDataCartPend.Ttls;

  aResp.locals.Title = aReq.t("common:pageTitles.onSiteCheckout", { name: CoopParams.CoopNameShort });
  aResp.render("Onsite/on-site-checkout");
}

export async function wHandPost(aReq, aResp) {
  const oIDSess = aReq.session.id;
  const oDataCartPend = await wDataCartPend(oIDSess);
  if (!oDataCartPend.Cart || !oDataCartPend.Producers.length) {
    aResp.redirect(303, "/on-site-cart");
    return;
  }

  let oIDInvc = null;

  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Insert on-site cart records
    // ---------------------------

    const oIDMembShop = oDataCartPend.MembShop ? oDataCartPend.MembShop.IDMemb : null;
    const oIDMembStaff = aReq.user.IDMemb;
    const oCdCartType = oDataCartPend.CdCartType;

    const oIDCart = await wIns_Cart(oConn, oIDMembShop, oIDMembStaff, oCdCartType);

    await wIns_ItsCart(oConn, oIDCart, oDataCartPend.Ttls.Its);

    // Insert invoice record and create invoice
    // ----------------------------------------

    const oCyc = aResp.locals.CycCurr;
    oIDInvc = await wCreate(
      oConn,
      oIDCart,
      oCyc,
      oDataCartPend.MembShop,
      oDataCartPend.CkEligEBT,
      oDataCartPend.Producers,
      oDataCartPend.Ttls,
      oCdCartType,
    );

    // Insert transaction record
    // -------------------------

    const oOptsTransact = {
      IDInvc: oIDInvc,
      FeeCoop: oDataCartPend.Ttls.FeeCoopShop,
      TaxSale: oDataCartPend.Ttls.TaxSale,
    };
    // The transaction isn't directly created by the user, so the 'create' user
    // should be left null:
    const oTransactionType =
      oCdCartType === "Wholesale" ? "ChargeInvcShopOnsiteWholesale" : "ChargeInvcShopOnsite";
    await wAdd_Transact(
      oIDMembShop,
      oTransactionType,
      oDataCartPend.Ttls.TtlMoney,
      oDataCartPend.Ttls.TtlEBT,
      null,
      oOptsTransact,
      oConn,
    );

    // Update on-site quantities
    // -------------------------

    await wUpd_QtysOnsite(oConn, oDataCartPend.Vtys);

    // Delete pending on-site cart records
    // -----------------------------------

    await wDel_ItsCartOnsitePend(oIDSess, oConn);
    await wDel_CartOnsitePend(oIDSess, oConn);

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }

  const oPage = "/on-site-checkout-summary/" + oIDInvc;
  aResp.redirect(303, oPage);
}

/** Returns an object containing the pending on-site cart for the specified
 *  session, the associated shopper, and the EBT eligibility flag, which
 *   accounts for non-member EBT use. */
async function wDataCartPend(aIDSess) {
  const oCartPend = await wCartOnsitePend(aIDSess);
  let oMembShop = null;
  let oCkEligEBT = null;
  let oVtys = null;
  let oProducers = null;
  let oIts = null;
  let oTtls = null;
  let oCdCartType = null;

  if (oCartPend) {
    oCdCartType = oCartPend.CdCartType;
    oMembShop = oCartPend.IDMembShop ? await wMembFromID(oCartPend.IDMembShop) : null;

    // Let's always calculate with Wholesale fee, even if there is no associated shopper member:
    const isShopMember = !!oMembShop;

    const oIsWholesaleElig =
      oCdCartType === "Wholesale" && (oMembShop?.CdRegWholesale === "Approv" || !isShopMember);
    oCkEligEBT =
      oCdCartType === "Retail" && (!!oCartPend.CkEBTNonMemb || oMembShop?.CdRegEBT === "Approv");

    const oMembTagIds = oMembShop?.TagIDs ?? [];

    oIts = await wItsCartOnsitePend(aIDSess);
    oIts = await Add_CkExcludeConsumerFee(oIts);
    oTtls = TtlsCart(
      oIts,
      "Qty",
      "PriceNomOnsite",
      oCkEligEBT,
      null,
      null,
      oIsWholesaleElig,
      oMembTagIds,
    );

    // TtlsCart does not add producer fees:
    for (const oIt of oTtls.Its) {
      const feeCheck = await getProductRow(oIt.IDProduct);
      const shouldExcludeProducerFee = !!feeCheck[0]?.CkExcludeProducerFee;

      if (shouldExcludeProducerFee) {
        oIt.FeeCoopProducer = round(0.0, CtDigitCurrAcct);
      } else {
        const oFracFeeCoopProducer =
          oIt.CdVtyType === "Wholesale"
            ? Site.FracFeeCoopWholesaleProducer
            : Site.FracFeeCoopProducer;
        oIt.FeeCoopProducer = round(oIt.SaleNom * oFracFeeCoopProducer, CtDigitCurrAcct);
      }

      oIt.FeeInvt = oIt.CkInvtMgd ? Site.FeeInvtIt * oIt.Qty : 0;
    }

    // We are deriving these records from oIts to avoid inconsistencies, should
    // Product or Subcat data happen to change during the checkout. It would be
    // better to use oTtls.Its, however, after changing the fee loop above to
    // target it. Then VtysFromIts can be simplified: [TO DO]
    if (oIsWholesaleElig) {
      oVtys = VtysFromIts(oTtls.Its, oCkEligEBT);
    } else {
      oVtys = VtysFromIts(oIts, oCkEligEBT);
    }
    oProducers = ProducersFromVtys(oVtys);
  }

  // It's confusing to return Its and Ttls (with its own, more detailed copy of
  // the items). Get rid of Its, and derive Vtys and Producers from the Ttls
  // items, as suggested above: [TO DO]
  return {
    Cart: oCartPend,
    MembShop: oMembShop,
    CkEligEBT: oCkEligEBT,
    CdCartType: oCdCartType,
    Vtys: oVtys,
    Producers: oProducers,
    Its: oIts,
    Ttls: oTtls,
  };
}

/** Returns the specified ItCartOnsitePend items grouped by variety, with
 *  SaleNom added to each record. */
function VtysFromIts(aIts, aCkEligEBT) {
  const oVtys = [];

  let oVtyLast;
  for (const oIt of aIts) {
    if (!oVtyLast || oIt.IDVty != oVtyLast.IDVty) {
      oVtyLast = {
        IDVty: oIt.IDVty,
        Kind: oIt.Kind,
        Size: oIt.Size,
        WgtMin: oIt.WgtMin,
        WgtMax: oIt.WgtMax,
        CkInvtMgd: oIt.CkInvtMgd,
        PriceNomOnsite: oIt.PriceNomOnsite,
        CkPriceVar: oIt.CkPriceVar,
        IDProduct: oIt.IDProduct,
        NameProduct: oIt.NameProduct,
        CkTaxSale: oIt.CkTaxSale,
        CkEBT: oIt.CkEBT,
        IDProducer: oIt.IDProducer,
        NameBus: oIt.NameBus,
        Sub: oIt.Sub,
        FeeCoopShop: oIt.FeeCoopShop,
        TaxSale: oIt.TaxSale,

        WgtTtl: 0,
        Qty: 0,
        SaleNom: 0,

        Its: [],
      };
      Add_CkTaxSaleEff(oVtyLast, aCkEligEBT);

      oVtys.push(oVtyLast);
    }

    oVtyLast.Qty += oIt.Qty;
    // This total is displayed in the invoice, but the subtotal is derived from
    // WgtPer, so there is no need to worry about rounding discrepancies:
    oVtyLast.WgtTtl += oIt.WgtPer * oIt.Qty;
    // Why isn't something in 'Util' being used?: [TO DO]
    oVtyLast.SaleNom += oIt.CkPriceVar
      ? // These varieties are sale-priced by individual weight. As usual, we
        // round before multiplying by the quantity to ensure that the total price
        // equals the some of the individual prices:
        oIt.Qty * round(oIt.WgtPer * oIt.PriceNomOnsite, 2)
      : oIt.Qty * oIt.PriceNomOnsite;

    oVtyLast.Its.push(oIt);
  }
  return oVtys;
}

/** Returns the specified varieties grouped by producer, after adding SaleNom to
 *  each variety record. */
function ProducersFromVtys(aVtys) {
  const oProducers = [];

  let oProducerLast;
  for (const oVty of aVtys) {
    if (!oProducerLast || oVty.IDProducer != oProducerLast.IDProducer) {
      oProducerLast = {
        IDProducer: oVty.IDProducer,
        NameBus: oVty.NameBus,
        Vtys: [],
      };
      oProducers.push(oProducerLast);
    }

    oProducerLast.Vtys.push(oVty);
  }
  return oProducers;
}

async function wIns_Cart(aConn, aIDMembShop, aIDMembStaffCreate, aCdCartType) {
  const oSQL = `INSERT INTO CartOnsite (
			IDCyc, IDMembShop, IDMembStaffCreate, CdCartType
		)
		VALUES (
			(SELECT IDCyc FROM StApp), :IDMembShop, :IDMembStaffCreate, :CdCartType
		)`;
  const oParams = {
    IDMembShop: aIDMembShop,
    IDMembStaffCreate: aIDMembStaffCreate,
    CdCartType: aCdCartType,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows < 1)
    throw Error("on-site-cart wIns_Cart: Cannot insert on-site cart record");
  return oRows.insertId;
}

async function wIns_ItsCart(aConn, aIDCart, aIts) {
  // Structure quantity and weight data by variety
  // ---------------------------------------------

  const oVtys = [];

  let oVtyLast = null;
  for (const oIt of aIts) {
    if (!oVtyLast || oVtyLast.IDVty !== oIt.IDVty) {
      oVtyLast = {
        IDVty: oIt.IDVty,
        CkPriceVar: oIt.CkPriceVar,
        Qty: 0,
        WgtTtl: oIt.CkPriceVar ? 0 : null,
        PriceNom: oIt.PriceNomOnsite,
        SaleNom: 0,
        FeeCoopProducer: 0,
        FeeCoopShop: 0,
        FeeCoopShopForgiv: 0,
        FeeInvt: 0,
        TaxSale: 0,
      };
      if (oIt.CkPriceVar) oVtyLast.Wgts = [];

      oVtys.push(oVtyLast);
    }

    oVtyLast.Qty += oIt.Qty;
    oVtyLast.SaleNom += oIt.SaleNom;
    oVtyLast.FeeCoopProducer += oIt.FeeCoopProducer;
    oVtyLast.FeeCoopShop += oIt.FeeCoopShop;
    oVtyLast.FeeCoopShopForgiv += oIt.FeeCoopShopForgiv;
    oVtyLast.FeeInvt += oIt.FeeInvt;
    oVtyLast.TaxSale += oIt.TaxSale;

    if (oIt.CkPriceVar) {
      oVtyLast.WgtTtl += oIt.WgtPer * oIt.Qty;

      oVtyLast.Wgts.push({
        WgtPer: oIt.WgtPer,
        Qty: oIt.Qty,
      });
    }
  }

  // Insert items and weights
  // ------------------------

  const oSQLVty = `INSERT INTO ItCartOnsite (
			IDCartOnsite, IDVty, Qty, WgtTtl, PriceNom, SaleNom,
			FeeCoopProducer, FeeInvt, FeeCoopShop, FeeCoopShopForgiv, TaxSale
		)
		VALUES (
			:IDCartOnsite, :IDVty, :Qty, :WgtTtl, :PriceNom, :SaleNom,
			:FeeCoopProducer, :FeeInvt, :FeeCoopShop, :FeeCoopShopForgiv, :TaxSale
		)`;
  const oSQLWgt = `INSERT INTO WgtItCartOnsite (
			IDItCartOnsite, WgtPer, Qty
		)
		VALUES (
			:IDItCartOnsite, :WgtPer, :Qty
		)`;

  for (const oVty of oVtys) {
    const oParamsVty = {
      IDCartOnsite: aIDCart,
      IDVty: oVty.IDVty,
      Qty: oVty.Qty,
      WgtTtl: oVty.WgtTtl,
      PriceNom: oVty.PriceNom,
      SaleNom: oVty.SaleNom,
      FeeCoopProducer: oVty.FeeCoopProducer,
      FeeCoopShop: oVty.FeeCoopShop,
      FeeCoopShopForgiv: oVty.FeeCoopShopForgiv,
      FeeInvt: oVty.FeeInvt,
      TaxSale: oVty.TaxSale,
    };
    const [oRowsVty] = await aConn.wExecPrep(oSQLVty, oParamsVty);
    if (oRowsVty.affectedRows < 1)
      throw Error("on-site-cart wIns_ItsCart: Cannot insert cart item record");
    const oIDItCart = oRowsVty.insertId;

    if (!oVty.CkPriceVar) continue;

    for (const oWgt of oVty.Wgts) {
      const oParamsWgt = {
        IDItCartOnsite: oIDItCart,
        WgtPer: oWgt.WgtPer,
        Qty: oWgt.Qty,
      };
      const [oRowsWgt] = await aConn.wExecPrep(oSQLWgt, oParamsWgt);
      if (oRowsWgt.affectedRows < 1)
        throw Error("on-site-cart wIns_ItsCart: Cannot insert cart item weight record");
    }
  }
}

async function wUpd_QtysOnsite(aConn, aVtys) {
  const oSQL = `UPDATE Vty
		SET QtyOnsite = GREATEST((CAST(QtyOnsite AS SIGNED) - :Qty), 0)
		WHERE IDVty = :IDVty`;

  // 'Promise.all' doesn't seem worth the bother here:
  for (const oVty of aVtys) {
    const oParams = {
      IDVty: oVty.IDVty,
      Qty: oVty.Qty,
    };
    const [oRows] = await aConn.wExecPrep(oSQL, oParams);
    if (oRows.affectedRows < 1)
      throw Error("on-site-cart wUpd_QtysOffer: Cannot update on-site quantity");
  }
}
