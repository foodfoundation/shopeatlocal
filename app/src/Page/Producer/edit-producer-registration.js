// edit-producer-registration.js
// -----------------------------
// Edit producer registration controllers

import _ from "lodash";
import { wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { wProducerFromID, wCats, wCatsProducerCk, wUpd_CatsProducer } from "../../Db.js";
import { Add_Props, CatsFromForm, PageAfterEditProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Though other staff are not allowed to edit a manager's member data, I think
  // it does make sense to allow them to edit producer data.

  if (!aResp.locals.CredUser.CkStaff() && aResp.locals.CredSelImperUser.CdRegProducer === "Approv")
    aResp.Show_Flash(
      "danger",
      "Please take note!",
      "Editing your registration will return your producer account to the " + "'pending' status.",
    );

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  const oProducer = await wProducerFromID(oIDProducer);
  Add_Props(aResp.locals, oProducer);

  let oCats;
  // Restore the user's category selections, in case of validation failure:
  if (aResp.locals.zIDsCats) {
    oCats = await wCats();
    for (const oCat of oCats) oCat.Ck = aResp.locals.zIDsCats.indexOf(oCat.IDCat) >= 0;
  } else oCats = await wCatsProducerCk(oIDProducer);
  aResp.locals.Cats = oCats;

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit producer registration`;
  aResp.render("Producer/edit-producer-registration");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

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
  };
  await wExec(aReq.body, oFlds);

  // The 'Cat' checkboxes were omitted from oFlds:
  const oIDsCats = CatsFromForm(aReq.body);

  // Form-level validation
  // ---------------------
  // The new producer registration page requires that at least one product
  // category be selected. I think it makes sense to allow all to be unselected
  // here, however.

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);
    // Conserve the user's category selections:
    aResp.locals.zIDsCats = oIDsCats;

    wHandGet(aReq, aResp);
    return;
  }

  // Update producer and category records
  // ------------------------------------

  const oParamsEx = {};
  // Don't change the producer status to 'pending' if a staff member is editing:
  if (!aResp.locals.CredUser.CkStaff()) oParamsEx.CdRegProducer = "Pend";

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  await wUpdOne("Producer", "IDProducer", oIDProducer, oFlds, oParamsEx);
  await wUpd_CatsProducer(oIDProducer, oIDsCats);

  // Go to Producer or Producer Detail page
  // --------------------------------------

  aResp.Show_Flash("success", null, "The registration has been updated.");

  const oPage = PageAfterEditProducer(aReq, aResp);
  aResp.redirect(303, oPage);
}
