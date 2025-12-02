// edit-location.js
// ----------------
// Edit Location controllers

import { querySiteConfigurations } from "../../Db.js";
import { Conv as _Conv, Valid as _Valid, wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const siteConfigurations = await querySiteConfigurations();

  Add_Props(aResp.locals, siteConfigurations[0]);

  aResp.locals.CkEdit = true;
  aResp.locals.Title = aReq.t("common:pageTitles.editSiteConfiguration", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/edit-site-configuration");
}

export async function wHandPost(aReq, aResp) {
  const fields = {
    CtMonthTrialMembNew: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FeeMembInit: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FeeMembRenew: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FeeInvtIt: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FracFeeCoopProducer: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Frac,
    },
    FracFeeCoopShop: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Frac,
    },
    FeeTransfer: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FeeDelivBase: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FeeDelivMile: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Qty,
    },
    FracTaxSale: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Frac,
    },
    FracFeeCoopWholesaleMemb: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Frac,
    },
    FracFeeCoopWholesaleProducer: {
      Conv: _Conv.Gen.Num,
      Valid: _Valid.Gen.Frac,
    },
  };

  await wExec(aReq.body, fields);
  if (CkFail(fields)) {
    Retry(aResp, fields);
    await wHandGet(aReq, aResp);
    return;
  }

  await wUpdOne("Site", "z", "1", fields);
  await wReady();

  aResp.Show_Flash("success", null, aReq.t("common:siteConfiguration.siteInfoUpdated"));

  aResp.redirect(303, "/site-admin");
}
