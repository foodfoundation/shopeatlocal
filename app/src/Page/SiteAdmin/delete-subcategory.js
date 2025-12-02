// delete-subcategory.js
// ---------------------
// Delete Subcategory controllers

import { Valid as _Valid, wExec, CkFail, Retry } from "../../Form.js";
import { Conn, wConnNew } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const oIDSubcatDel = parseInt(aReq.params.IDSubcat);
  if (isNaN(oIDSubcatDel)) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  const oSubcatDel = await wSubcatCat(oIDSubcatDel);
  if (!oSubcatDel) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Add_Props(aResp.locals, oSubcatDel);

  aResp.locals.CatSubcatsExcept = await wCatSubcatsExcept(oIDSubcatDel);

  aResp.locals.Title = aReq.t("common:pageTitles.deleteSubcategory", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/delete-subcategory");
}

export async function wHandPost(aReq, aResp) {
  const oIDSubcatDel = parseInt(aReq.params.IDSubcat);
  if (isNaN(oIDSubcatDel)) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  // Field-level validation
  // ----------------------

  function oValid_IDSubcatReplace(aFld) {
    _Valid.Gen.ID(aFld);
    if (aFld.MsgFail) return;

    // Shouldn't be possible to do this in the first place:
    if (aFld.ValCook === oIDSubcatDel)
      aFld.MsgFail = aReq.t("common:categories.mustSelectDifferentSubcategory");
  }

  const oFlds = {
    IDSubcatReplace: { CkRequire: true, Valid: oValid_IDSubcatReplace },
  };
  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Delete record
  // -------------

  await wReplaceDel_Subcat(oFlds.IDSubcatReplace.ValCook, oIDSubcatDel);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, aReq.t("common:categories.subcategoryDeleted"));
  aResp.redirect(303, "/manage-categories");
}

async function wSubcatCat(aIDSubcat) {
  const oSQL = `SELECT Subcat.*,
			Cat.NameCat
		FROM Subcat
		JOIN Cat USING (IDCat)
		WHERE IDSubcat = :IDSubcat`;
  const oParams = {
    IDSubcat: aIDSubcat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length ? oRows[0] : null;
}

async function wReplaceDel_Subcat(aIDSubcatReplace, aIDSubcatDel) {
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    const oSQLReplace = `UPDATE Product
			SET IDSubcat = :IDSubcatReplace
			WHERE IDSubcat = :IDSubcatDel`;
    const oParamsReplace = {
      IDSubcatDel: aIDSubcatDel,
      IDSubcatReplace: aIDSubcatReplace,
    };
    await oConn.wExecPrep(oSQLReplace, oParamsReplace);

    const oSQLDel = `DELETE FROM Subcat
			WHERE IDSubcat = :IDSubcatDel`;
    const oParamsDel = {
      IDSubcatDel: aIDSubcatDel,
    };
    await oConn.wExecPrep(oSQLDel, oParamsDel);

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Returns all category/subcategory combinations, except the one specified. */
async function wCatSubcatsExcept(aIDSubcat) {
  const oSQL = `SELECT Cat.IDCat, Cat.NameCat,
			Subcat.IDSubcat, Subcat.NameSubcat
		FROM Cat
		JOIN Subcat USING (IDCat)
		WHERE IDSubcat != :IDSubcat
		ORDER BY NameCat, IDCat, NameSubcat, IDSubcat`;
  const oParams = {
    IDSubcat: aIDSubcat,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
