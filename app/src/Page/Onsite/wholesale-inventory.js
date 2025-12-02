// wholesale-inventory.js
// ---------------------
// Wholesale Inventory page controllers
//

import { Unroll, wExec, Roll, CkFail, wUpdOne } from "../../Form.js";
import { wConnNew, wVtyFromID, CdsListVtyOnsiteOnly, CksFromCdListVty, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oWholesaleVtys = await wGetAllWholesaleVtys();

  aResp.locals.WholesaleVtys = oWholesaleVtys;

  aResp.locals.Title = aReq.t("common:pageTitles.wholesaleInventory", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("Onsite/wholesale-inventory");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  const oFlds = {
    QtyOnsite: { Collect: "Vtys" },
    FracFeeCoopWholesaleMemb: { Collect: "VtysCoopFee" },
    CdListVty: { Collect: "Vtys", Store: false },
  };

  const oFldsUnroll = Unroll(aReq.body, oFlds);
  await wExec(aReq.body, oFldsUnroll);
  const oFldsRoll = Roll(oFldsUnroll);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFldsUnroll)) {
    aResp.status(400);
    aResp.locals.Msg = aReq.t("common:wholesaleInventory.invalidDataSubmitted");
    aResp.render("Misc/400");
    return;
  }

  if (!oFldsRoll.Vtys) {
    aResp.status(400);
    aResp.locals.Msg = aReq.t("common:wholesaleInventory.noVarietiesToUpdate");
    aResp.render("Misc/400");
    return;
  }

  // Start verify/update transaction
  // -------------------------------
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // Check varieties
    // ···············
    for (const oIDVty in oFldsRoll.Vtys) {
      const oFldsVty = oFldsRoll.Vtys[oIDVty];

      const oVtyOrig = await wVtyFromID(oIDVty, oConn);
      if (!oVtyOrig) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:wholesaleInventory.invalidVarietyId", { id: oIDVty });
        aResp.render("Misc/400");
        return;
      }

      const oCdsListVtyValid = CdsListVtyOnsiteOnly;
      if (!oCdsListVtyValid[oFldsVty.CdListVty.ValCook]) {
        await oConn.wRollback();

        aResp.status(400);
        aResp.locals.Msg = aReq.t("common:wholesaleInventory.invalidListingStatus", {
          status: oFldsVty.CdListVty.ValCook,
        });
        aResp.render("Misc/400");
        return;
      }
    }

    // Update varieties
    // ----------------
    // We won't update the variety 'edit time', since only the on-site quantity or
    // listing status is changing.
    for (const oIDVty in oFldsRoll.Vtys) {
      const oFldsVty = oFldsRoll.Vtys[oIDVty];
      // Convert from CdListVty back to CkListWeb, CkListOnsite, and CkArchiv:
      const oParamsEx = CksFromCdListVty(oFldsVty.CdListVty.ValCook);
      await wUpdOne("Vty", "IDVty", oIDVty, oFldsVty, oParamsEx, oConn);
    }

    // Update wholesale coop fee
    // -------------------------
    for (const oIDVty in oFldsRoll.VtysCoopFee) {
      const oFldsVtyCoopFee = oFldsRoll.VtysCoopFee[oIDVty];
      const oValCook = oFldsVtyCoopFee.FracFeeCoopWholesaleMemb.ValCook;
      if (oValCook !== null) {
        await wUpSertWholesaleCoopFeeOne(oIDVty, oValCook);
      }
    }

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }

  // Return to Wholesale Inventory page
  // ---------------------------------
  aResp.Show_Flash("success", null, aReq.t("common:wholesaleInventory.inventoryUpdated"));

  // Can't decide where to go after Cancel or Save. Seems like the producer
  // might be saving their work incrementally, as they probably should do:
  aResp.redirect(303, "/wholesale-inventory");
}

async function wUpSertWholesaleCoopFeeOne(aVtyId, aFracFeeCoopWholesaleMemb) {
  const oSQL = `INSERT INTO FeeCoopVty (IDVty, FracFeeCoopWholesaleMemb)
		VALUES (:IDVty, :FracFeeCoopWholesaleMemb)
		ON DUPLICATE KEY UPDATE FracFeeCoopWholesaleMemb = :FracFeeCoopWholesaleMemb`;
  const oParams = {
    IDVty: aVtyId,
    FracFeeCoopWholesaleMemb: aFracFeeCoopWholesaleMemb,
  };
  await Conn.wExecPrep(oSQL, oParams);
}

async function wGetAllWholesaleVtys() {
  const oSQL = `SELECT 
			Vty.PriceNomOnsite, Vty.IDVty, Vty.Kind, Vty.Size, Vty.QtyOnsite,
			Vty.WgtMin, Vty.WgtMax, Vty.CkListWeb, Vty.CkListOnsite, Vty.CkArchiv,
			Vty.IDProduct,
			Product.IDProduct, Product.IDProducer as IDProducer,
			Product.NameProduct as NameProduct, Product.IDSubcat AS IDSubcat, Product.NameImgProduct,
			Producer.IDProducer, Producer.NameBus as NameProducer,
			Subcat.IDSubcat, Subcat.NameSubcat as NameSubCat, Subcat.IDCat as IDCat,
			Cat.IDCat, Cat.NameCat as NameCat,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb,
			IF(FeeCoopVty.FracFeeCoopWholesaleMemb IS NULL, 0, 1) AS CkFracFeeCoopWholesaleSet
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Subcat USING (IDSubcat)
		JOIN Cat USING (IDCat)
		LEFT JOIN FeeCoopVty USING (IDVty)
		WHERE Vty.CdVtyType = 'Wholesale'
		`;
  const [oVtys] = await Conn.wExecPrep(oSQL);

  const oRawVtys = oVtys.map(vty => ({
    ...vty,
    TextCatSubcat: `${vty.NameCat}: ${vty.NameSubCat}`,
    IdCatSubcat: `${vty.IDCat}-${vty.IDSubcat}`,
  }));

  // Group vtys by producer, category-subcategory, and product
  const groupedVtys = Object.values(
    oRawVtys.reduce((oAcc, oVty) => {
      const oProducer =
        oAcc[oVty.IDProducer] ??
        (oAcc[oVty.IDProducer] = {
          NameProducer: oVty.NameProducer,
          IDProducer: oVty.IDProducer,
          CatSubcats: {},
        });
      const oCatSubcat =
        oProducer.CatSubcats[oVty.IdCatSubcat] ??
        (oProducer.CatSubcats[oVty.IdCatSubcat] = {
          TextCatSubcat: oVty.TextCatSubcat,
          NameCat: oVty.NameCat,
          IDCat: oVty.IDCat,
          NameSubCat: oVty.NameSubCat,
          IDSubcat: oVty.IDSubcat,
          Products: {},
        });
      const oProduct =
        oCatSubcat.Products[oVty.IDProduct] ??
        (oCatSubcat.Products[oVty.IDProduct] = {
          NameProduct: oVty.NameProduct,
          IDProduct: oVty.IDProduct,
          NameImgProduct: oVty.NameImgProduct,
          Vtys: {},
        });
      oProduct.Vtys[oVty.IDVty] = oVty;
      return oAcc;
    }, {}),
  );

  // Sort by IDVty descending - the most recent variety is first
  // Move the varieties with unset coop fee to the top of the list
  const sortedVtys = groupedVtys
    .map(oProducer => {
      const CatSubcats = Object.values(oProducer.CatSubcats)
        .map(oCatSubcat => {
          const Products = Object.values(oCatSubcat.Products)
            .map(oProduct => {
              const Vtys = Object.values(oProduct.Vtys).sort((a, b) => wCompareVtyDesc(a, b));
              return {
                ...oProduct,
                Vtys,
              };
            })
            .sort((a, b) => wCompareVtyDesc(a.Vtys.at(0), b.Vtys.at(0)));
          return {
            ...oCatSubcat,
            Products,
          };
        })
        .sort((a, b) =>
          wCompareVtyDesc(a.Products.at(0)?.Vtys.at(0), b.Products.at(0)?.Vtys.at(0)),
        );
      return {
        ...oProducer,
        CatSubcats,
      };
    })
    .sort((a, b) =>
      wCompareVtyDesc(
        a.CatSubcats.at(0)?.Products.at(0)?.Vtys.at(0),
        b.CatSubcats.at(0)?.Products.at(0)?.Vtys.at(0),
      ),
    );

  return sortedVtys;
}

const wCompareVtyDesc = (aVty1, aVty2) => {
  if (!aVty1 || !aVty2) return 0;
  if (aVty1.CkFracFeeCoopWholesaleSet !== aVty2.CkFracFeeCoopWholesaleSet)
    return aVty1.CkFracFeeCoopWholesaleSet - aVty2.CkFracFeeCoopWholesaleSet;
  return aVty2.IDVty - aVty1.IDVty;
};
