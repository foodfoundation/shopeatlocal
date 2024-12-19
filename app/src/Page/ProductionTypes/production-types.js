import { getSanityClient } from "../../Sanity.js";

export async function wHandGet(aReq, aResp) {
  const productionTypesPage = await getSanityClient().queryProductTypesPageContent();

  aResp.locals.Title = productionTypesPage.title;
  aResp.locals.productionTypesPageContent = productionTypesPage.content;

  const externalUrl = productionTypesPage.externalUrl;
  if (externalUrl) {
    aResp.redirect(externalUrl);
    return;
  }

  aResp.render("ProductionTypes/production-types");
}
