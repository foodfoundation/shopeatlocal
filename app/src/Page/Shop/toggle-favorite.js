//toggle-favorites.js
// -----------------
// Toggle the favorites of a product in the database

import {wToggleFavorite } from "../../Db.js";
import {Conn } from "../../Db.js";
import _ from "lodash";



export function HandPost(aReq, aResp) {
 
 // call wToggleFavorates function to send ProductId and IDMemb to the database
  wToggleFavorite( aReq.user.IDMemb,aReq.body.productId).then((result) => {
   // console.log("Sumit=Toggle---Result: ", result);
    if (result) {
      //console.log("Sumit=Toggle---Result: ", result);
      aResp.status(200).json({ message: "Success" });
    } else {
      aResp.status(500).json({ message: "Error" });
    }
  }).catch((error) => {
    //console.error("Sumit=Toggle---Error: ", error);
    aResp.status(500).json({ message: "Error" });
  } );
}

