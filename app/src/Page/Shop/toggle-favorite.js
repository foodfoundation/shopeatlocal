// toggle-favorites.js
// -----------------
// Toggle the favorites of a product in the database

import { wToggleFavorite } from "../../Db.js";
import _ from "lodash";

export async function HandPost(aReq, aResp) {
  await wToggleFavorite(aResp.locals.CredImperUser.IDMemb, aReq.body.productId);
  aResp.status(200).end();
}
