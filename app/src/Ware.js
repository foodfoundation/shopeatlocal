// Ware.js
// =======
// Middleware

import { wCredFromIDMemb, wCredFromIDProducer } from "./Cred.js";
import {
  wExec_StartCyc,
  wExec_StartShop,
  wExec_EndShop,
  wExec_StartDeliv,
  wExec_EndDeliv,
  wExec_StartPickup,
  wExec_EndPickup,
  wExec_EndCyc,
} from "./EvtCyc.js";
import {
  wConnNew,
  wLock_StApp,
  wCycPrev,
  wCycStApp,
  wCycNext,
  CdsPhaseCyc,
  wSummCartOrCreate,
  wProductFromID,
  wVtyFromID,
  wTransactFromID,
} from "./Db.js";
import { LocsActiv, CoopParams } from "./Site.js";
import { Bool_Cks, PageAfterEditMemb } from "./Util.js";

// Wraps the specified asynchronous middleware in another middleware that
// catches exceptions and passes them to the 'next' function, for regular
// Express error handling. All asynchronous handlers must use this function. It
// is not necessary for synchronous handlers, as Express automatically forwards
// the exceptions they throw. Express 5 will do the same for asynchronous
// handlers, so this can be removed at some point.
//
// An equivalent approach is discussed here:
//
//   https://medium.com/@Abazhenov/using-async-await-in-express-with-node-8-b8af872c0016
//
export function NextOnExcept(awWare) {
  async function oWareTry(aReq, aResp, aNext) {
    try {
      await awWare(aReq, aResp, aNext);
    } catch (aErr) {
      aNext(aErr);
    }
  }
  return oWareTry;
}

// ---------------------
// Data and events
// ---------------------
// Add methods to request and response prototypes, instead of adding in
// middleware?

/** Adds commonly-used system-wide data to the response, along with the Work
 *  object, and translates boolean query string and form data values. */
export async function wWareData(aReq, aResp, aNext) {
  // Common data
  // -----------
  // These values are used in most views, often because they are referenced by
  // 'Main.hbs'. Cycle-specific data are added in wWarePhase.

  // Use the 'Referer' request header instead?:
  aResp.locals.URL = aReq.originalUrl;

  aResp.locals.LocsActiv = LocsActiv;

  aResp.locals.CoopParams = CoopParams;

  // Work object
  // -----------
  // This object allows data to be passed between handlers without presenting
  // it to the view.
  //
  // This is barely used, is it really needed? [TO DO]

  aReq.Work = {};

  // Query string and form data processing
  // -------------------------------------

  if (aReq.query) Bool_Cks(aReq.query, true);

  // Checkbox HTML inputs produce "on" and 'undefined' values in 'body', which
  // are appropriately truthy and falsy, but the most obvious choices for hidden
  // inputs are the strings "true" and "false", which are both truthy. For this
  // reason, it is tempting to convert all form fields:
  //
  //   if (aReq.body) gUtil.PropsToBool(aReq.body);
  //
  // Form the time being, 'Form.js' converts those values itself.

  aNext();
}

/** Set to 'true' if a task is advancing the phase or cycle. */
let CkLockAdvPhase = false;

/** Compares the current time against the cycle times, then advances the phase
 *  and cycle ID as necessary, while also running various cycle events. Also
 *  creates the new 'next' cycle when needed, and adds various cycle data to the
 *  response. */
export async function wWarePhase(aReq, aResp, aNext) {
  // Loop until the cycle and phase are current, running cycle events as
  // appropriate, then drop out of the loop and allow the request to be
  // processed:
  while (true) {
    const oConn = await wConnNew();
    // I was concerned about starting a transaction for every request, but I
    // don't see a better way to keep the StApp and Cyc data consistent, and I
    // have read that the transaction overhead is very slight:
    await oConn.wTransact();
    try {
      // This lock will prevent the phase or cycle from being advanced:
      const oStApp = await wLock_StApp(oConn);

      const oCycPrev = await wCycPrev(oConn);
      // We have oStApp, why do we need to include the StApp data here? This is
      // later copied to 'locals.CycCurr', is it used there? If so, why doesn't
      // that name reflect its content?: [TO DO]
      const oCycCurrStApp = await wCycStApp(oConn);
      const oCycNext = await wCycNext(oConn);

      // Stop if the current phase is still active
      // -----------------------------------------
      // Compare the current time against the phase time referenced by the
      // CdsPhaseCyc element.

      const oPhaseCurr = CdsPhaseCyc[oStApp.CdPhaseCyc];
      if (!oPhaseCurr) throw Error("wWarePhase: Invalid cycle phase");

      const oWhenEndPhaseCurr = oCycCurrStApp["When" + oPhaseCurr.NamePhaseNext];
      if (!oWhenEndPhaseCurr) throw Error("wWarePhase: Cannot get phase end");

      const oNow = new Date();
      // If the current phase has not ended, store the StApp and Cyc data, and
      // allow the request to be processed:
      if (oNow < oWhenEndPhaseCurr) {
        aResp.locals.StApp = oStApp;
        aResp.locals.CycPrev = oCycPrev;
        aResp.locals.CycCurr = oCycCurrStApp;
        aResp.locals.CycNext = oCycNext;

        // No changes to commit, but this is probably faster than rolling-back:
        await oConn.wCommit();
        break;
      }

      // The referenced phase has ended. If another request is already advancing
      // the phase, close the transaction and retry the phase check. The 'await'
      // calls at the start of the loop will give the phase-advancing task the
      // time it needs to finish. This simple flag works because it is not
      // possible for another task to interrupt this one unless this one awaits.
      // For that reason, nothing should await between this check and the line
      // that sets the flag. It is okay to await within the 'false' branch
      // because that causes the loop to restart.
      //
      // Understand that we do not want to exclusively lock the StApp table
      // here. That would prevent us from interfering with the phase-advancing
      // task, but after waiting for that task, this one would continue to
      // update the phase. We want to restart the check altogether:
      if (CkLockAdvPhase) {
        // No changes to commit, but this is probably faster than rolling-back:
        await oConn.wCommit();
        continue;
      }

      // Advance to the next phase or cycle:
      try {
        CkLockAdvPhase = true;

        let owExec_ChgPhase;
        // Would be better to move CdsPhaseCyc to 'EvtCyc.js', and store the
        // phase change handlers therein:
        switch (oStApp.CdPhaseCyc) {
          case "PendCyc":
            owExec_ChgPhase = wExec_StartCyc;
            break;
          case "StartCyc":
            owExec_ChgPhase = wExec_StartShop;
            break;
          case "StartShop":
            owExec_ChgPhase = wExec_EndShop;
            break;
          case "EndShop":
            owExec_ChgPhase = wExec_StartDeliv;
            break;
          case "StartDeliv":
            owExec_ChgPhase = wExec_EndDeliv;
            break;
          case "EndDeliv":
            owExec_ChgPhase = wExec_StartPickup;
            break;
          case "StartPickup":
            owExec_ChgPhase = wExec_EndPickup;
            break;
          case "EndPickup":
            owExec_ChgPhase = wExec_EndCyc;
            break;
          default:
            throw Error("wWarePhase: Invalid cycle phase code");
        }
        await owExec_ChgPhase(oConn, oCycPrev, oCycCurrStApp, oCycNext);

        console.log("Committing phase or cycle changes...");
        await oConn.wCommit();
      } finally {
        CkLockAdvPhase = false;
      }
    } catch (aErr) {
      await oConn.wRollback();

      // The event would be retried automatically the next time a request is
      // received. This logs the retry, however, and prevents the 500 page from
      // being displayed to the request that triggered this event. That allows
      // the request to be processed as normal, once the database contention is
      // resolved.
      //
      // Would could limit the number of retries, but the same thing would
      // happen with the next request:
      if (aErr.code && aErr.code === "ER_LOCK_DEADLOCK") {
        console.log("Retrying after cycle event deadlock...");
        continue;
      }
      throw aErr;
    } finally {
      oConn.Release();
    }

    // Always repeat the phase check...
  }

  // Postpone the Shop Start date
  const user = aReq.user;
  const oNow = new Date();
  const oMembTagIds = aReq.user?.TagIDs ?? [];
  const oIsOnTimeShopping =
    MembershipTags.find(oMemberTag => oMembTagIds.includes(oMemberTag.tagId))?.onTimeShopping ??
    false;
  const oIsStaff = user?.CkStaff() ?? false;

  // If none of the membership tags have onTimeShopping set to true, then everyone shops on time
  const everyoneShopsOnTime = MembershipTags.every(oMemberTag => !oMemberTag.onTimeShopping);

  const oShouldPostponeShopStartDate = !(oIsOnTimeShopping || oIsStaff || everyoneShopsOnTime);

  Add_PropsCyc(aResp, oNow, "Shop", oShouldPostponeShopStartDate);
  Add_PropsCyc(aResp, oNow, "Deliv", false);
  Add_PropsCyc(aResp, oNow, "Pickup", false);

  aNext();
}

/** Adds a time and a flag to the response that gives the time of the specified
 *  event, plus the relationship of the current time to that event. */
//
// For example, when aName is 'Shop', the following properties are added:
//
// ~ WhenStartShopNext and WhenEndShopNext: The beginning and end of the
//   shopping window, in this cycle, if it has not ended, or in the next, if it
//   has;
//
// ~ FlagBeforeShop, FlagShop, or FlagAfterShop: Set to 'true' if the current
//   time is before, during, or after the current cycle's shopping window.
//
function Add_PropsCyc(aResp, aNow, aName, aShouldPostponeShopStartDate) {
  // Maybe 'Next' should be replaced with 'Soon', to avoid confusion with the
  // 'next' cycle? [TO DO]

  // WhenStartShopNext
  // WhenEndShopNext
  // FlagBeforeShop

  const oShouldPostponeShopStartDate = !!aShouldPostponeShopStartDate;

  const whenCycleStart = aResp.locals.CycCurr[`WhenStart${aName}`];
  if (aName === "Shop" && oShouldPostponeShopStartDate) {
    whenCycleStart.setHours(whenCycleStart.getHours() + 30);
  }

  // Shopping started: 12:00 !!!
  // 12:05
  //

  // The current-cycle window has not started:
  if (aNow < whenCycleStart) {
    aResp.locals[`WhenStart${aName}Next`] = whenCycleStart;
    aResp.locals[`WhenEnd${aName}Next`] = aResp.locals.CycCurr[`WhenEnd${aName}`];
    aResp.locals[`FlagBefore${aName}`] = true;
  }
  // The current-cycle window has not ended:
  else if (aNow < aResp.locals.CycCurr[`WhenEnd${aName}`]) {
    aResp.locals[`WhenStart${aName}Next`] = whenCycleStart;
    aResp.locals[`WhenEnd${aName}Next`] = aResp.locals.CycCurr[`WhenEnd${aName}`];
    aResp.locals[`Flag${aName}`] = true;
  }
  // The current-cycle window has ended:
  else {
    aResp.locals[`WhenStart${aName}Next`] = aResp.locals.CycNext[`WhenStart${aName}`];
    aResp.locals[`WhenEnd${aName}Next`] = aResp.locals.CycNext[`WhenEnd${aName}`];
    aResp.locals[`FlagAfter${aName}`] = true;
  }
}

// -----------------------
// Suspended member logout
// -----------------------
// It seems more direct to log-out the user in Edit Member Status, when the
// suspension happens. This could be done by deleting the member's 'sessions'
// record, but that table does not provide an easy way to locate records by
// member. Perhaps it is worth keeping the other session data anyway.

/** Logs the user out if their member status is 'suspended'. */
export async function WareMembSusp(aReq, aResp, aNext) {
  // Should we also log-out members for whom CkLock is 'true'? [TO DO]

  if (aReq.user && aReq.user.CdRegMemb === "Susp" && !aReq.user.CkStaff()) await aReq.logout();

  aNext();
}

// ----------------------------------
// Request and response modifications
// ----------------------------------

// 'redirect' fix
// --------------
// There is an Express bug that sometimes causes session data to be lost when
// 'redirect' is used; see the SaveRedirect implementation for details. In our
// case, the bug caused Passport's additions to 'session' to be discarded, which
// then caused authentication to fail on Chrome, when serving from 'localhost'.
// Firefox worked consistently.
//
// Replacing 'redirect' with 'SaveRedirect' seems to fix the problem.

/** Copies flash data to the session, saves the session data to work-around an
 *  Express bug, and then redirects to the specified path. */
function SaveRedirect(aReq, aResp, aCd, aPath) {
  if (aPath === undefined) {
    aPath = aCd;
    // This is the 'redirect' default:
    aCd = 302;
  }

  // Copy flash messages to the session, so they can be restored by the Flash
  // middleware when the request is received:
  aReq.session.Flashes = aResp.locals.Flashes;

  // Express contains a race condition that sometimes causes session changes
  // to be lost when 'redirect' is used:
  //
  //   https://github.com/expressjs/session/issues/360
  //
  // The exact problem is outlined here:
  //
  //   https://github.com/expressjs/session/issues/360#issuecomment-246124797
  //
  // The bug goes back at least to 2014:
  //
  //   https://github.com/expressjs/session/pull/69
  //
  // I encountered it when I was testing Passport. So far, this workaround
  // seems to fix the problem:
  aReq.session.save(aErr => {
    if (aErr) throw aErr;
    aResp.RedirectBase(aCd, aPath);
  });
}

/** Forwards 'redirect' calls to SaveRedirect. */
//
// It would be nice to make these changes to the response prototype, but
// SaveRedirect requires access to both the response and the request:
export function WareSaveRedirect(aReq, aResp, aNext) {
  /** The original Express 'redirect' method. */
  aResp.RedirectBase = aResp.redirect;

  aResp.redirect = (aCd, aPath) => {
    SaveRedirect(aReq, aResp, aCd, aPath);
  };

  aNext();
}

// ------------------
// Post-routing setup
// ------------------

/** Adds the current URL to the page history, within the session. URLs that
 *  begin with '/svc' are not added. */
//
// This function used to use 'body', so it had to be called after 'multer'. That
// is no longer true, so it can be moved, if necessary:
function WareHistPage(aReq, aResp, aNext) {
  // It seems kind of slow to update the session in every request, but we will
  // try it. If necessary, the page history could be stored on the client, and
  // the previous page could be sent in a header.

  if (!aReq.session.HistPage) aReq.session.HistPage = [];
  const oHist = aReq.session.HistPage;

  if (
    !aReq.originalUrl.startsWith("/svc") &&
    (!oHist.length || oHist[oHist.length - 1] !== aReq.originalUrl)
  )
    oHist.push(aReq.originalUrl);

  if (oHist.length > 25) oHist.shift();

  aNext();
}

// User credential setup
// ---------------------
// 'user' is the person who is logged-in.
//
// A member is 'impersonated' by selecting an entry from the member or producer
// search, and then clicking the 'impersonate' button. This allows staff to
// perform some (but not all) actions on that member's behalf. If a member is
// being impersonated, their ID will be stored in IDMembImper, within the
// session. That value is then used to add CredImper to 'locals' within the
// response object.
//
// The 'selected' member is the one referenced by the IDMembSel or IDProducerSel
// route parameter, if there is such. This parameter is set when an entry is
// selected from the member or producer search. It is also forwarded to pages
// that are linked from the Member and Producer Detail pages, including the
// various registration and status pages, Producer Check-in, Shopper Checkout,
// et cetera.
//
// The 'effective' member is typically the one whose data will be viewed or
// edited by a given page. In many cases, this is:
//
// 1) The selected member, if any. This allows the user to view one member's
//    data while they are impersonating another member;
//
// 2) Otherwise, the impersonated member, if any;
//
// 3) Otherwise, the user.
//
// Other times, the selected member will be disregarded, or it won't be possible
// to select a member, because the route does not allow the IDMembSel or
// IDProducerSel parameters. In these cases, the effective member is:
//
// 1) The impersonated member, if any;
//
// 2) Otherwise, the user.
//
// By way of example, it would be a mistake to show a selected member's cart
// data when the Cart button in the page header is clicked. It is correct,
// however, to show an impersonated member's cart data in that situation.
//
// These effective member choices are stored in the CredSelImperUser and
// CredImperUser properties, which are added to 'locals' by the wWareCred
// middleware. Related properties give the effective member's cart data, and
// tell whether that member is also the user.
//
// Some operations (such as password changes) are never permitted on behalf of
// other users, so these operations should not be offered when the user is
// selecting or impersonating, and their controllers should not use the
// effective member.
//
// Note that query parameters IDMembSel and IDProducerSel should not be used
// in public routes like 'about-producer'. Those parameters cause CredSel to be
// assigned, allowing staff to 'select' accounts for administrative work, almost
// like member impersonation. wWareCred will therefore return '403' if a
// non-staff user loads a route that uses such a parameter. Use the IDMembView
// and IDProducerView parameters to 'view' a member without granting special
// privileges. Those parameters are read directly by the controllers.
//
// Recall, however, that route parameters suffixed with a question mark are
// optional. This allows staff members to provide the parameter, causing CredSel
// to be assigned, while non-staff members omit it. When CredSel is set,
// CredSelImperUser references that object; when it is not, it references
// CredUser.

/** Adds selection, impersonation, and effective user data to 'aResp.locals'.
 *
 *  Members are selected with route parameters, so this middleware must be
 *  executed after the path has been processed by Express. */
async function wWareCred(aReq, aResp, aNext) {
  // Move the various credential properties into a 'Cred' object that is always
  // defined? Incorporate with 'Cred.js'? [TO DO]

  if (!aReq.user) {
    aNext();
    return;
  }

  // User
  // ----

  /** The logged-in user. */
  aResp.locals.CredUser = aReq.user;

  // Selected member or producer
  // ---------------------------
  // Producer IDs can be added to routes, but it is still the member who is
  // being selected.

  if (aReq.params.IDMembSel !== undefined) {
    if (!aReq.user.CkStaff()) {
      aResp.status(403);
      aResp.render("Misc/403");
      return;
    }

    // This parameter should be filtered with a regular expression in the route,
    // but just in case:
    const oIDMembSel = parseInt(aReq.params.IDMembSel);
    const oCred = !isNaN(oIDMembSel) && (await wCredFromIDMemb(oIDMembSel));

    if (!oCred) {
      aResp.locals.Title = "Page not found";
      aResp.status(404);
      aResp.render("Misc/404");
      return;
    }

    /** The selected member or producer, if any. */
    aResp.locals.CredSel = oCred;
  }

  if (aReq.params.IDProducerSel !== undefined) {
    if (!aReq.user.CkStaff()) {
      aResp.status(403);
      aResp.render("Misc/403");
      return;
    }

    // This parameter should be filtered with a regular expression in the route,
    // but just in case:
    const oIDProducerSel = parseInt(aReq.params.IDProducerSel);
    const oCred = !isNaN(oIDProducerSel) && (await wCredFromIDProducer(oIDProducerSel));

    if (!oCred) {
      aResp.locals.Title = "Page not found";
      aResp.status(404);
      aResp.render("Misc/404");
      return;
    }

    /** The selected member or producer, if any. */
    aResp.locals.CredSel = oCred;
  }

  // Impersonated member
  // -------------------

  if (aReq.session.IDMembImper)
    /** The impersonated member, if any. */
    aResp.locals.CredImper = await wCredFromIDMemb(aReq.session.IDMembImper);

  // Effective member
  // ----------------

  /** The selected or impersonated member, or the user. */
  aResp.locals.CredSelImperUser =
    aResp.locals.CredSel || aResp.locals.CredImper || aResp.locals.CredUser;
  /** Set to 'true' if CredSelImperUser references the user. */
  aResp.locals.CkSelImperUserSelf =
    aResp.locals.CredSelImperUser.IDMemb === aResp.locals.CredUser.IDMemb;
  // Cart data was being derived from CredSelImperUser and stored in
  // SummCartSelImperUser, much the way SummCartImperUser is assigned below, but
  // that does not seem useful.

  /** The impersonated member, or the user. */
  aResp.locals.CredImperUser = aResp.locals.CredImper || aResp.locals.CredUser;
  /** Set to 'true' if CredImperUser references the user. */
  aResp.locals.CkImperUserSelf = aResp.locals.CredImperUser.IDMemb === aResp.locals.CredUser.IDMemb;
  /** Cart data for the impersonated member, or the user, or 'null' if there is
   *  no cart, and if no cart can be created. */
  aResp.locals.SummCartImperUser = await wSummCartOrCreate(
    aResp.locals.CredImperUser,
    aResp.locals.FlagShop,
  );

  aNext();
}

// 'Persistent' user messages
// --------------------------

/** Displays flash messages that are meant to appear on every page. */
function WareFlashPersist(aReq, aResp, aNext) {
  // We don't want to queue messages when handling POST, et cetera, or multiple
  // messages will appear when the following GET is processed:
  if (aReq.user && aReq.user.CdRegMemb === "Avail" && aReq.method === "GET")
    aResp.Show_Flash(
      "info",
      "Your member registration requires changes.",
      `Please refer to the e-mail you received from ${CoopParams.CoopNameShort}.`,
    );

  aNext();
}

// CSRF protection
// ---------------

import gCSurf from "csurf";
import { MembershipTags } from "../Cfg.js";

// Be sure to perform the CSRF check after wWareDataUser, so the user data is
// available when the '403' page is rendered:
const WareCSurf = gCSurf();

/** Adds the CSRF token to 'locals'. */
//
// This must be called after WareCSurf, as that middleware adds the 'csrfToken'
// method:
const WareTokCSRF = function (aReq, aResp, aNext) {
  aResp.locals.TokCSRF = aReq.csrfToken();
  aNext();
};

export const WaresPostRoute = [
  // As noted above, wWareCred must be called after Express has processed the
  // path, and WareCSurf and WareTokCSRF must be called after that. They must be
  // called before WareCkUser, so that the CSRF token is valid for the login,
  // and before WareCkStaff, since that middleware reads the user data.
  //
  // These must be passed to 'use' before the error functions, so that the user
  // data is available in the event that no route was matched.
  //
  // This awkwardness is necessary because of the way we use the IDMembSel route
  // parameter to determine the effective member:
  WareHistPage,
  NextOnExcept(wWareCred),
  WareFlashPersist,
  WareCSurf,
  WareTokCSRF,
];

// ----------------------
// User credential checks
// ----------------------

/** Verifies that the user has been authenticated, and displays '401
 *  Unauthorized' if they have not. */
export function WareCkUser(aReq, aResp, aNext) {
  if (!aReq.user) {
    aResp.status(401);
    aResp.render("Misc/401");
    return;
  }
  aNext();
}

/** Verifies that the user is staff, and displays '403 Forbidden' if they
 *  are not. */
export function WareCkStaff(aReq, aResp, aNext) {
  if (!aReq.user || !aReq.user.CkStaff()) {
    aResp.locals.Msg = "You must have staff privileges to view that page.";
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }
  aNext();
}

/** Verifies that the user has accounting privileges, and displays '403
 *  Forbidden' if they do not. */
export function WareCkStaffAccts(aReq, aResp, aNext) {
  if (!aReq.user || !aReq.user.CkStaffAccts()) {
    aResp.locals.Msg = "You must have accounting privileges to view that page.";
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }
  aNext();
}

/** Verifies that the user has manager privileges, and displays '403
 *  Forbidden' if they do not. */
export function WareCkStaffMgr(aReq, aResp, aNext) {
  if (!aReq.user || !aReq.user.CkStaffMgr()) {
    aResp.locals.Msg = "You must have manager privileges to view that page.";
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }
  aNext();
}

/** Verifies that the user has superuser privileges, and displays '403
 *  Forbidden' if they do not. */
export function WareCkStaffSuper(aReq, aResp, aNext) {
  if (!aReq.user || !aReq.user.CkStaffSuper()) {
    aResp.locals.Msg = "You must have superuser privileges to view that page.";
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }
  aNext();
}

/** Checks the effective member's 'show producer' flag and IDProducer property,
 *  and displays an error message if they are not registered as a producer. */
export function WareCkProducer(aReq, aResp, aNext) {
  // Notice that the selected/impersonated credentials are being checked. It
  // would not be correct to allow staff through automatically, because if no
  // one is selected or impersonated, and if the staff member is not a producer,
  // then there is nothing for them to view.

  if (!aResp.locals.CredSelImperUser.CkShowProducer) {
    // Most staff members aren't producers themselves, yet they will be
    // redirected to their 'own' producer pages if they stop an impersonation
    // while viewing such a page. The usual message would confuse:
    if (!aResp.locals.CredUser.CkStaff())
      aResp.Show_Flash(
        "danger",
        null,
        `You must contact ${CoopParams.CoopNameShort} if you wish to become a producer.`,
      );
    aResp.redirect(303, "/member");
    return;
  }
  if (!aResp.locals.CredSelImperUser.IDProducer) {
    aResp.Show_Flash(
      "danger",
      null,
      "You must complete the producer registration before using that page.",
    );
    aResp.redirect(303, "/producer-registration");
    return;
  }
  aNext();
}

export function WareAllowEditMemb(aReq, aResp, aNext) {
  // Do not allow anyone to edit a manager, except the manager themself:
  if (
    aResp.locals.CredUser.CkStaffSuper() ||
    aResp.locals.CkSelImperUserSelf ||
    (aResp.locals.CredUser.CkStaff() && !aResp.locals.CredSelImperUser.CkStaffMgr())
  ) {
    aNext();
    return;
  }

  aResp.Show_Flash(
    "danger",
    null,
    "You are not allowed to edit a manager's registration or status.",
  );

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
  return;
}

// -----------------------------
// Product and variety selection
// -----------------------------
// Members can also be selected, but that is handled by the user credential
// system.

/** Stores the selected product in 'aResp.locals.ProductSel', regardless of who
 *  produces the product. Displays '404' if the product is not recognized. */
export async function wWareProductSel(aReq, aResp, aNext) {
  if (!aReq.params.IDProductSel) {
    aNext();
    return;
  }

  const oIDProduct = parseInt(aReq.params.IDProductSel);
  if (isNaN(oIDProduct)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oProduct = await wProductFromID(oIDProduct);
  if (!oProduct) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.ProductSel = oProduct;
  aNext();
}

/** Stores the selected product in 'aResp.locals.ProductSel' if it is produced
 *  by the effective member, or if the user is staff. Displays '404' if the
 *  product is not recognized, or '403' if the user is not allowed to edit it. */
export async function wWareProductSelOwn(aReq, aResp, aNext) {
  if (!aReq.params.IDProductSel) {
    aNext();
    return;
  }

  const oIDProduct = parseInt(aReq.params.IDProductSel);
  if (isNaN(oIDProduct)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oProduct = await wProductFromID(oIDProduct);
  if (!oProduct) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  if (!aReq.user.CkStaff() && oProduct.IDProducer !== aResp.locals.CredImperUser.IDProducer) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  aResp.locals.ProductSel = oProduct;
  aNext();
}

/** Stores the selected variety in 'aResp.locals.VtySel', regardless of who
 *  produces it. Displays '404' if the variety is not recognized. */
export async function wWareVtySel(aReq, aResp, aNext) {
  if (!aReq.params.IDVtySel) {
    aNext();
    return;
  }

  const oIDVty = parseInt(aReq.params.IDVtySel);
  if (isNaN(oIDVty)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oVty = await wVtyFromID(oIDVty);
  if (!oVty) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  if (!aReq.user.CkStaff() && oVty.IDProducer !== aResp.locals.CredImperUser.IDProducer) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  aResp.locals.VtySel = oVty;
  aNext();
}

/** Stores the selected variety in 'aResp.locals.VtySel' if it is produced by
 *  the effective member, or if the user is staff. Displays '404' if the
 *  variety is not recognized, or '403' if the user is not allowed to edit it. */
export async function wWareVtySelOwn(aReq, aResp, aNext) {
  if (!aReq.params.IDVtySel) {
    aNext();
    return;
  }

  const oIDVty = parseInt(aReq.params.IDVtySel);
  if (isNaN(oIDVty)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oVty = await wVtyFromID(oIDVty);
  if (!oVty) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  if (!aReq.user.CkStaff() && oVty.IDProducer !== aResp.locals.CredImperUser.IDProducer) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  aResp.locals.VtySel = oVty;
  aNext();
}

// ---------------------
// Transaction selection
// ---------------------

/** Stores the selected transaction in 'aResp.locals.TransactSel', regardless of
 *  whose transaction it is. Displays '404' if the transaction is not
 *  recognized. */
export async function wWareTransactSel(aReq, aResp, aNext) {
  if (!aReq.params.IDTransactSel) {
    aNext();
    return;
  }

  const oIDTransact = parseInt(aReq.params.IDTransactSel);
  if (isNaN(oIDTransact)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oTransact = await wTransactFromID(oIDTransact);
  if (!oTransact) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.TransactSel = oTransact;
  aNext();
}

/** Stores the selected transaction in 'aResp.locals.TransactSel' if it is
 ** assigned to the effective member, or if the user is staff. Displays
 *  '404' if the transaction is not recognized, or '403' if the user is not
 *  allowed to view it. */
export async function wWareTransactSelOwn(aReq, aResp, aNext) {
  if (!aReq.params.IDTransactSel) {
    aNext();
    return;
  }

  const oIDTransact = parseInt(aReq.params.IDTransactSel);
  if (isNaN(oIDTransact)) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  const oTransact = await wTransactFromID(oIDTransact);
  if (!oTransact) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  if (!aReq.user.CkStaff() && oTransact.IDMemb !== aResp.locals.CredImperUser.IDMemb) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  aResp.locals.TransactSel = oTransact;
  aNext();
}

export async function wWareSetWholesale(aReq, aResp, aNext) {
  aResp.locals.CdCartType = "Wholesale";
  aNext();
}
