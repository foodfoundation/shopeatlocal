// acknowledgments.js
// ------------------
// Acknowledgments page controllers

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = "Acknowledgments";
  aResp.render("Home/acknowledgments");
}
