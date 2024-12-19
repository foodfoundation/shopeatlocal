// stop-impersonation.js
// ---------------------
// Member impersonation controllers

export async function wHandPost(aReq, aResp) {
  delete aReq.session.IDMembImper;

  // Staff members are perhaps more likely to open multiple tabs:
  const oPage = aReq.body.URLReturn || "/member";
  aResp.redirect(303, oPage);
}
