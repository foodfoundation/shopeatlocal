// acknowledgments.js
// ------------------
// Acknowledgments page controllers

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.acknowledgments");
  aResp.render("Home/acknowledgments");
}
