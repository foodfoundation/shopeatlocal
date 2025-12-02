// edit-coop-parameters.js
// ----------------
// Edit Location controllers

import { Conv as _Conv, Valid as _Valid, wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.CkEdit = true;
  aResp.locals.Title = aReq.t("common:pageTitles.editMarketParameters", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/edit-coop-parameters");
}

export async function wHandPost(aReq, aResp) {
  const fields = {
    CoopName: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Any,
    },
    CoopNameShort: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Any,
    },
    CoopNameBusiness: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Any,
    },
    Phone: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Phone,
    },
    HelpEmail: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Email,
    },
    InfoEmail: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Email,
    },
    AddressLine1: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Addr,
    },
    AddressLine2: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Addr,
    },
    HomeWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    PickupWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    CalendarWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    TermsOfServiceWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    FacebookUrl: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    InstagramUrl: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    SenderEmail: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Email,
    },
    SenderEmailDisplayName: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Any,
    },
    ProductStandardsWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
    MembershipNotificationEmail: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Email,
    },
    GeneralManager: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Name,
    },
    GeneralManagerTitle: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Any,
    },
    PaypalEmail: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Email,
    },
    ProducerStandardsWebsite: {
      Conv: _Conv.Gen.Trim,
      Valid: _Valid.Gen.Url,
    },
  };

  const oNameImgHeaderLogoPath =
    aReq.files && aReq.files["ImgHeaderLogoPath"] && aReq.files["ImgHeaderLogoPath"].length > 0
      ? aReq.files["ImgHeaderLogoPath"][0].filename
      : null;

  const oNameImgHeroLogoPath =
    aReq.files && aReq.files["ImgHeroLogoPath"] && aReq.files["ImgHeroLogoPath"].length > 0
      ? aReq.files["ImgHeroLogoPath"][0].filename
      : null;

  const oNameImgFooterLogoPath =
    aReq.files && aReq.files["ImgFooterLogoPath"] && aReq.files["ImgFooterLogoPath"].length > 0
      ? aReq.files["ImgFooterLogoPath"][0].filename
      : null;

  const oNameImgTextLogoPath =
    aReq.files && aReq.files["ImgTextLogoPath"] && aReq.files["ImgTextLogoPath"].length > 0
      ? aReq.files["ImgTextLogoPath"][0].filename
      : null;

  const oNameImgFaviconPath =
    aReq.files && aReq.files["ImgFaviconPath"] && aReq.files["ImgFaviconPath"].length > 0
      ? aReq.files["ImgFaviconPath"][0].filename
      : null;

  await wExec(aReq.body, fields);
  if (CkFail(fields)) {
    Retry(aResp, fields);
    await wHandGet(aReq, aResp);
    return;
  }

  await wUpdOne("CoopParams", "Id", "1", fields, {
    ...(oNameImgHeaderLogoPath ? { HeaderLogoPath: oNameImgHeaderLogoPath } : {}),
    ...(oNameImgHeroLogoPath ? { HeroLogoPath: oNameImgHeroLogoPath } : {}),
    ...(oNameImgFooterLogoPath ? { FooterLogoPath: oNameImgFooterLogoPath } : {}),
    ...(oNameImgTextLogoPath ? { TextLogoPath: oNameImgTextLogoPath } : {}),
    ...(oNameImgFaviconPath ? { FaviconPath: oNameImgFaviconPath } : {}),
  });
  await wReady();

  aResp.Show_Flash("success", null, aReq.t("common:flashMessages.marketParametersUpdated"));

  aResp.redirect(303, "/site-admin");
}
