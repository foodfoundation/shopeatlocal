// transactions.js
// ---------------
// Transactions page controllers

import { wMembFromID, wProducerFromIDMemb, Conn } from "../../Db.js";
import { Fmt_RowExcel } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:

export async function wHandGet(aReq, aResp) {
  // Staff users can select a member when using this page. Non-staff users
  // cannot:
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  aResp.locals.Memb = await wMembFromID(oIDMemb);
  aResp.locals.Producer = await wProducerFromIDMemb(oIDMemb);
  aResp.locals.Years = await wTransactsByYear(oIDMemb);

  aResp.locals.PathExport = aReq.params.IDMembSel
    ? "/transactions-export/" + oIDMemb
    : "/transactions-export";

  aResp.locals.Title = aReq.t("common:pageTitles.transactions", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/transactions");
}

export async function wHandGetExport(aReq, aResp) {
  // Staff users can select a member when using this page. Non-staff users
  // cannot:
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  const oTransacts = await wTransacts(oIDMemb);

  for (const oTransact of oTransacts) {
    if (!aReq.user.CkStaff()) {
      delete oTransact.Note;
      delete oTransact.IDMembStaffCreate;
    }
    delete oTransact.Name1First;
    delete oTransact.Name1Last;
    delete oTransact.NameBus;
    delete oTransact.NameBusProducer;
    delete oTransact.Name1FirstCreate;
    delete oTransact.Name1LastCreate;

    Fmt_RowExcel(oTransact);
  }

  aResp.attachment("Member transactions.csv");
  aResp.csv(oTransacts, true);
}

/** Returns the specified member's transactions. */
async function wTransacts(aIDMemb) {
  const oSQL = `SELECT Transact.*,
			Memb.Name1First, Memb.Name1Last,
			Producer.NameBus AS NameBusProducer,
			MembCreate.Name1First AS Name1FirstCreate,
			MembCreate.Name1Last AS Name1LastCreate
		FROM Transact
		LEFT JOIN Memb USING (IDMemb)
		LEFT JOIN Producer USING (IDProducer)
		LEFT JOIN Memb AS MembCreate
			ON MembCreate.IDMemb = Transact.IDMembStaffCreate
		WHERE Transact.IDMemb = :IDMemb
		ORDER BY Transact.WhenCreate DESC`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oTransacts] = await Conn.wExecPrep(oSQL, oParams);

  // Add balances
  // ------------

  let oBalMoney = 0.0;
  let oBalEBT = 0.0;
  // The records are in descending date order:
  for (let oIdx = oTransacts.length - 1; oIdx >= 0; oIdx--) {
    const oTransact = oTransacts[oIdx];

    oBalMoney += oTransact.AmtMoney;
    oTransact.BalMoney = oBalMoney;

    oBalEBT += oTransact.AmtEBT;
    oTransact.BalEBT = oBalEBT;
  }

  return oTransacts;
}

/** Returns the specified member's transactions, grouped by year. */
async function wTransactsByYear(aIDMemb) {
  const oTransacts = await wTransacts(aIDMemb);

  const oGroupsYear = [];

  let oGroupYearLast = null;
  for (const oTransact of oTransacts) {
    const oYear = oTransact.WhenCreate.getFullYear();
    if (!oGroupYearLast || oYear !== oGroupYearLast.Year) {
      oGroupYearLast = {
        Transacts: [],
        Year: oYear,
      };
      oGroupsYear.push(oGroupYearLast);
    }
    oGroupYearLast.Transacts.push(oTransact);
  }

  return oGroupsYear;
}
