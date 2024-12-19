import { getSanityClient } from "../../Sanity.js";

export async function wHandGet(aReq, aResp) {
  const slug = aReq.params.pageSlug;
  const staticPage = await getSanityClient().queryStaticPageContent(slug);

  if (!staticPage) {
    aResp.locals.Title = "Page not found";
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.Title = staticPage.title;
  aResp.locals.staticPageContent = staticPage.content;

  const externalUrl = staticPage.externalUrl;
  if (externalUrl) {
    aResp.redirect(externalUrl);
    return;
  }

  aResp.render("StaticPages/static-pages");
}
