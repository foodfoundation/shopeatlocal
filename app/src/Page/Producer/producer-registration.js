// producer-registration.js
// ------------------------
// Producer registration controllers

import _ from "lodash";
import { wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wCats, wUpd_CatsProducer } from "../../Db.js";
import { CatsFromForm } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export function Prep(aReq, aResp, aNext) {
  // Fix syntax for selected and impersonated members: [TO DO]
  if (!aResp.locals.CredSelImperUser.CkShowProducer) {
    // Most staff members aren't producers themselves, yet they will be
    // redirected to their 'own' producer pages if they stop an impersonation
    // while viewing such a page. The usual message would confuse:
    if (!aResp.locals.CredUser.CkStaff())
      aResp.Show_Flash(
        "danger",
        null,
        `You must contact ${CoopParams.CoopNameShort} if you wish to become a producer.`,
      );
    aResp.redirect(303, "/member");
    return;
  }
  if (aResp.locals.CredSelImperUser.IDProducer) {
    aResp.Show_Flash("danger", null, "You have already registered as a producer.");
    aResp.redirect(303, "/producer");
    return;
  }
  aNext();
}

export async function wHandGet(aReq, aResp) {
  const oCats = await wCats();
  // Restore the user's category selections, in case of validation failure:
  if (aResp.locals.zIDsCats)
    for (const oCat of oCats) oCat.Ck = aResp.locals.zIDsCats.indexOf(oCat.IDCat) >= 0;
  aResp.locals.Cats = oCats;

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer registration`;
  aResp.render("Producer/producer-registration");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  function Valid_CkAffirmTerms(aFld) {
    if (!aFld.ValCook) aFld.MsgFail = "You must affirm the Terms and Agreements to continue.";
  }
  function isValidHttpUrl(string) {
    console.log(string.ValCook);
    let url;
    try {
      url = new URL(string.ValCook);
      console.log(url);
    } catch (_) {
      string.MsgFail = "Your hyperlinks must include 'http:' or 'https:'.";
      return false;
    }
    if (url.protocol === "http:" || url.protocol === "https:") {
      return true;
    } else {
      string.MsgFail = "Your hyperlinks must include 'http:' or 'https:'.";
      return false;
    }
  }

  const oFlds = {
    NameBus: { CkRequire: true },
    Addr1: { CkRequire: true },
    Addr2: {},
    City: { CkRequire: true },
    St: { CkRequire: true },
    Zip: { CkRequire: true },
    InstructDeliv: { Valid: false },
    CkShowAddr: {},
    Phone1: { CkRequire: true },
    CkShowPhone1: {},
    Phone2: {},
    CkShowPhone2: {},
    Email: { CkRequire: true },
    Web: { Valid: false },
    AboutStory: { Valid: false },
    AboutProducts: { Valid: false },
    AboutPract: { Valid: false },
    Facebook: { Valid: isValidHttpUrl },
    Instagram: { Valid: isValidHttpUrl },
    YourWebsite: { Valid: isValidHttpUrl },
    PractGen: { Valid: false },
    CdProductMeat: {},
    DtlProcessMeatCut: { Valid: false },
    DtlPestDiseaseLandSoil: { Valid: false },
    DtlLivestockFeed: { Valid: false },
    CkFeedsByprodAnimal: {},
    CkHormone: {},
    CkAntibiotic: {},
    DtlAcquisAnimal: { Valid: false },
    DtlInfoAddition: { Valid: false },
    CkCertOrganic: {},
    CkCertNaturGrown: {},
    CkCertAnimalWelfare: {},
    CkCertFairTrade: {},
    CkLicenseEggHand: {},
    CkLicenseHomeFoodEstab: {},
    CkLicenseKitch: {},
    CkInsurLiab: {},
    DtlCertOther: { Valid: false },
    CkAffirmTerms: { Valid: Valid_CkAffirmTerms, Store: false },
  };
  await wExec(aReq.body, oFlds);

  // The 'Cat' checkboxes were omitted from oFlds:
  const oIDsCats = CatsFromForm(aReq.body);

  // Form-level validation
  // ---------------------

  if (oIDsCats.length < 1)
    // This element is associated with the category checkboxes as a group, not
    // with any particular field:
    aResp.locals.MsgFailCats = "You must select at least one product category.";

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds) || aResp.locals.MsgFailCats) {
    Retry(aResp, oFlds);
    // Conserve the user's category selections:
    aResp.locals.zIDsCats = oIDsCats;

    wHandGet(aReq, aResp);
    return;
  }

  // Create producer and category records
  // ------------------------------------

  const oParamsEx = {
    IDMemb: aResp.locals.CredSelImperUser.IDMemb,
  };

  const oIDProducer = await wIns("Producer", oFlds, oParamsEx);
  if (!oIDProducer) throw Error("wHandPost: Could not create producer record");

  await wUpd_CatsProducer(oIDProducer, oIDsCats);

  // Go to producer page
  // -------------------

  aResp.Show_Flash(
    "success",
    "Thank you!",
    "You will receive an e-mail when your registration has been reviewed.",
  );
  aResp.redirect(303, "/producer");
}
