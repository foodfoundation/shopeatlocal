// delete-category.js
// ------------------
// Delete Category controllers

import { Valid as _Valid, wExec, CkFail, Retry } from "../../Form.js";
import { wCatFromID, wCatsExcept, wConnNew } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const oIDCatDel = aReq.params.IDCat;
  const oCatDel = await wCatFromID(oIDCatDel);
  if (!oCatDel) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Add_Props(aResp.locals, oCatDel);

  aResp.locals.CatsExcept = await wCatsExcept(oIDCatDel);

  aResp.locals.Title = `${CoopParams.CoopNameShort} delete category`;
  aResp.render("SiteAdmin/delete-category");
}

export async function wHandPost(aReq, aResp) {
  const oIDCatDel = aReq.params.IDCat;

  // Field-level validation
  // ----------------------

  function oValid_IDCatReplace(aFld) {
    _Valid.Gen.ID(aFld);
    if (aFld.MsgFail) return;

    // Shouldn't be possible to do this in the first place:
    if (aFld.ValCook === oIDCatDel) aFld.MsgFail = "You must select a different category.";
  }

  const oFlds = {
    IDCatReplace: { CkRequire: true, Valid: oValid_IDCatReplace },
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

  await wReplaceDel_Cat(oFlds.IDCatReplace.ValCook, oIDCatDel);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, "The category has been deleted.");
  aResp.redirect(303, "/manage-categories");
}

async function wReplaceDel_Cat(aIDCatReplace, aIDCatDel) {
  const oConn = await wConnNew();

  try {
    const oSQLReplace = `UPDATE Subcat
			SET IDCat = :IDCatReplace
			WHERE IDCat = :IDCatDel`;
    const oParamsReplace = {
      IDCatDel: aIDCatDel,
      IDCatReplace: aIDCatReplace,
    };
    await oConn.wExecPrep(oSQLReplace, oParamsReplace);

    //before we update CatProducer, we need to get rows that will violate primary keys
    const rowsWithBothCategories = `select a.* from CatProducer a
			join ( select IDProducer AS IDProducer2 from CatProducer where IDCat = :IDCatReplace) b on a.IDProducer = IDProducer2
			where a.IDCat = :IDCatDel`;
    const bothCategoriesParams = {
      IDCatDel: aIDCatDel,
      IDCatReplace: aIDCatReplace,
    };
    let [bothCats] = await oConn.wExecPrep(rowsWithBothCategories, bothCategoriesParams);
    console.log(bothCats);
    await deleteFromCatProducer(bothCats, oConn);

    //also need to transfer IDCat in table catproducer
    const oSQLReplaceProducer = `UPDATE CatProducer
			SET IDCat = :IDCatReplace
			WHERE IDCat = :IDCatDel`;
    const oParamsReplaceProducer = {
      IDCatDel: aIDCatDel,
      IDCatReplace: aIDCatReplace,
    };
    await oConn.wExecPrep(oSQLReplaceProducer, oParamsReplaceProducer);

    const oSQLDel = `DELETE FROM Cat
			WHERE IDCat = :IDCatDel`;
    const oParamsDel = {
      IDCatDel: aIDCatDel,
    };
    await oConn.wExecPrep(oSQLDel, oParamsDel);
  } catch (aErr) {
    throw aErr;
  } finally {
    oConn.Release();
  }
}

async function deleteFromCatProducer(rowArray, oConn) {
  rowArray.map(async x => {
    console.log(x);
    const deleteSQL = `DELETE from CatProducer
		WHERE IDCat = :IDCatDel AND IDProducer = :IDProducerDel
		ORDER BY IDProducer`;
    const deleteParams = {
      IDCatDel: x.IDCat,
      IDProducerDel: x.IDProducer,
    };
    await oConn.wExecPrep(deleteSQL, deleteParams);
  });
}
