// edit-about-producer.js
// ----------------------
// Edit producer 'about' controllers

import _ from "lodash";
import {wExec, CkFail, Retry, wUpdOne, wClearProducerImages, wInsertProducerImage} from "../../Form.js";
import { wProducerFromID } from "../../Db.js";
import { PageAfterEditProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Though other staff are not allowed to edit a manager's member data, I think
  // it does make sense to allow them to edit producer data.

  const oIDProducerEff = aResp.locals.CredSelImperUser.IDProducer;
  const oProducer = await wProducerFromID(oIDProducerEff);
  console.log(oProducer);
  Object.assign(aResp.locals, oProducer);

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit about producer`;
  aResp.render("Producer/edit-about-producer");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

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
    AboutStory: { Valid: false },
    AboutProducts: { Valid: false },
    AboutPract: { Valid: false },
    Facebook: { Valid: isValidHttpUrl },
    Instagram: { Valid: isValidHttpUrl },
    YourWebsite: { Valid: isValidHttpUrl },
  };
  await wExec(aReq.body, oFlds);

  // Image upload
  // ------------

  // If the user selected a 'new' file, use that. Otherwise, use the previously-
  // selected file, unless the user opted to remove it:
  let oNameImg=[];
  if (aReq.files && aReq.files["Img"] && aReq.files["Img"].length > 0)
    oNameImg.push(...aReq.files["Img"].map(f => f.filename));
  else if (aReq.body.CkRemImg) oNameImg = [];
  else if (aReq.body.NameImgProduct) oNameImg = [aReq.body.NameImgProduct];
  else oNameImg = [];

  // Handle validation failure
  // -------------------------
  // There is no validation now, but I assume there will be.

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);
    aResp.locals.NameImgProducer = oNameImg;

    aResp.locals.Title = `${CoopParams.CoopNameShort} edit about producer`;
    aResp.render("Producer/edit-about-producer");
    return;
  }

  // Update producer and category records
  // ------------------------------------

  const oParamsEx = {
    NameImgProducer: oNameImg[0],
  };

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  await wClearProducerImages(oIDProducer);
  await wUpdOne("Producer", "IDProducer", oIDProducer, oFlds, oParamsEx);
  for (const [i, name] of oNameImg.entries()) {
    await wInsertProducerImage(oIDProducer, name, i);
  }

  // Go to Producer or Producer Detail page
  // --------------------------------------

  aResp.Show_Flash("success", null, "The About data has been updated.");

  const oPage = PageAfterEditProducer(aReq, aResp);
  aResp.redirect(303, oPage);
}
