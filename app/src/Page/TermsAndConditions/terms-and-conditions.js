import { getSanityClient } from "../../Sanity.js";

export async function wHandGet(aReq, aResp) {
  const termsAndConditionsPage = await getSanityClient().queryTermsAndConditionsPageContent();

  aResp.locals.Title = termsAndConditionsPage.title;
  aResp.locals.termsAndConditionsContent = termsAndConditionsPage.content;

  const externalUrl = termsAndConditionsPage.externalUrl;
  if (externalUrl) {
    aResp.redirect(externalUrl);
    return;
  }

  aResp.render("TermsAndConditions/terms-and-conditions");
}
