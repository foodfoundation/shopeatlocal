// ========
// Server

console.log("Starting server...");

/** The project path. */
import gExpr, { static as staticModule } from "express";
import {
  NextOnExcept,
  wWareData,
  wWarePhase,
  WareMembSusp,
  WareSaveRedirect,
  WaresPostRoute,
  wWareProductSel,
  WareCkUser,
  WareAllowEditMemb,
  WareCkStaff,
  WareCkProducer,
  wWareProductSelOwn,
  wWareVtySel,
  wWareVtySelOwn,
  WareCkStaffSuper,
  wWareTransactSel,
  WareCkStaffAccts,
  WareCkStaffMgr,
  wWareSetWholesale,
} from "./Ware.js";
import {
  PhaseCycLess,
  PhaseCycLessEq,
  PhaseCycEq,
  PhaseCycGreaterEq,
  PhaseCycGreater,
  wReady,
  wAdd_EvtApp,
} from "./Db.js";
import { wHandlePaypalCreateOrder, wHandlePaypalCaptureOrder } from "./Payment.js";
import { CoopParams, wReady as _wReady } from "./Site.js";
import { TextIDMemb, NameRndAlphaNum } from "./Util.js";
import {
  UseExpressStatic,
  CkDev,
  StaticStoragePrefix,
  ImageStoragePrefix,
  LenNameFileStoreImg,
  SizeMaxUploadImg,
  Db,
  SecretCookSess,
  PortServ,
  HostServ,
} from "../Cfg.js";
import { extname } from "path";
import { Storage } from "./Storage.js";

const App = gExpr();

// --------------------------------------
// Modify request and response prototypes
// --------------------------------------

import { IncomingMessage, ServerResponse } from "http";
/** HTTP request prototype extension */
var ProtoReq = IncomingMessage.prototype;
/** HTTP response prototype extension */
var ProtoResp = ServerResponse.prototype;

/** Logs request information with timestamp, IP, and member ID
 *  @param {string} aMsg - Message to log
 *  Format: [timestamp] [IP] [Member ID] message
 */
ProtoReq.Log = function (aMsg) {
  const oNow = new Date();
  const oTextNow = oNow.toISOString();
  const oTextMemb = this.user ? ` [Memb ${TextIDMemb(this.user.IDMemb)}]` : "";

  const oText = oTextNow + " " + this.ip + oTextMemb + " " + aMsg;
  console.log(oText);
};

/** Logs errors with request context
 *  @param {Error|string} aErr - Error to log
 *  Outputs full error to stderr and summary to stdout
 */
ProtoReq.Err = function (aErr) {
  console.error(aErr);

  const oNow = new Date();
  const oTextNow = oNow.toISOString();
  const oTextMemb = this.user ? ` [Memb ${TextIDMemb(this.user.IDMemb)}]` : "";
  // Match the 'console.error' output, to some extent:
  const oMsg = aErr instanceof Error ? "Error: " + aErr.message : aErr;
  const oMsgSumm = oMsg.split("\r")[0] + "...";

  const oTextSumm = oTextNow + " " + this.ip + oTextMemb + " " + oMsgSumm;
  console.log(oTextSumm);
};

// Cycle phase comparison utilities
// --------------------------------

/** Compares current cycle phase against target
 *  @param {string} aCd - Target phase code
 *  @returns {boolean} True if current phase is less than target
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycLess = function (aCd) {
  if (!this.locals || !this.locals.StApp)
    throw Error("Response PhaseCycLess: Cannot get app state");
  return PhaseCycLess(this.locals.StApp.CdPhaseCyc, aCd);
};

/** Compares current cycle phase against target
 *  @param {string} aCd - Target phase code
 *  @returns {boolean} True if current phase is less than or equal to target
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycLessEq = function (aCd) {
  if (!this.locals || !this.locals.StApp)
    throw Error("Response PhaseCycLessEq: Cannot get app state");
  return PhaseCycLessEq(this.locals.StApp.CdPhaseCyc, aCd);
};

/** Compares current cycle phase against target
 *  @param {string} aCd - Target phase code
 *  @returns {boolean} True if current phase is equal to target
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycEq = function (aCd) {
  if (!this.locals || !this.locals.StApp) throw Error("Response PhaseCycEq: Cannot get app state");
  return PhaseCycEq(this.locals.StApp.CdPhaseCyc, aCd);
};

/** Compares current cycle phase against target
 *  @param {string} aCd - Target phase code
 *  @returns {boolean} True if current phase is greater than or equal to target
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycGreaterEq = function (aCd) {
  if (!this.locals || !this.locals.StApp)
    throw Error("Response PhaseCycGreaterEq: Cannot get app state");
  return PhaseCycGreaterEq(this.locals.StApp.CdPhaseCyc, aCd);
};

/** Compares current cycle phase against target
 *  @param {string} aCd - Target phase code
 *  @returns {boolean} True if current phase is greater than target
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycGreater = function (aCd) {
  if (!this.locals || !this.locals.StApp)
    throw Error("Response PhaseCycGreater: Cannot get app state");
  return PhaseCycGreater(this.locals.StApp.CdPhaseCyc, aCd);
};

/** Compares current cycle phase against start and end targets
 *  @param {string} aCdStart - Start phase code
 *  @param {string} aCdNext - End phase code
 *  @returns {boolean} True if current phase is between start and end
 *  @throws If application state is not available
 */
ProtoResp.PhaseCycBetw = function (aCdStart, aCdNext) {
  if (!this.locals || !this.locals.StApp)
    throw Error("Response PhaseCycBetw: Cannot get app state");
  return (
    PhaseCycGreaterEq(this.locals.StApp.CdPhaseCyc, aCdStart) &&
    PhaseCycLess(this.locals.StApp.CdPhaseCyc, aCdNext)
  );
};

// -------------------
// Prepare view engine
// -------------------

import { Ready } from "./View.js";
Ready(App);

// ----------------
// Configure server
// ----------------

// Trust proxy headers:
App.set("trust proxy", true);

// --------------------
// Set response headers
// --------------------

// Review and configure the Helmet options in detail: [TO DO]
import gHelmet from "helmet";
App.use(gHelmet());

App.use(function (aReq, aResp, aNext) {
  // This fixes a problem I encountered in Firefox:
  //
  // 1) Login to the same member account in Firefox and Chrome;
  //
  // 2) Add a note to a cart item in Firefox. Refresh the page in Chrome, verify
  //    that the note is visible;
  //
  // 3) Modify the note in Chrome and update the cart;
  //
  // 4) Refresh the page in Firefox with F5. The note change is not visible;
  //
  // 5) Refresh again in Firefox with Ctrl+F5, or navigate to a different
  //    page. This time, the note change is visible.
  //
  // I don't want to disable caching altogether, but I don't know enough about
  // this to do anything better: [TO DO][OPTIMIZE]
  aResp.set("Cache-Control", "no-store");
  aNext();
});

// ------------------
// Favicon
// ------------------

App.route("/favicon.ico").get(function (_, aResp) {
  aResp.redirect(`${CoopParams.FaviconPath}`);
});

// ------------------
// Serve static files
// ------------------

if (UseExpressStatic || CkDev) {
  console.log("Serving static files and user images from Express...");
  // 'robots.txt' is in here, but it is expected at the root, so it must be
  // specially mapped to the root by NGINX:
  const WareStatic = staticModule(`${StaticStoragePrefix.substring(1)}`, {
    index: false,
  });
  App.use(StaticStoragePrefix, WareStatic);

  const WareStoreImg = staticModule(`${ImageStoragePrefix.substring(1)}`, {
    index: false,
  });
  App.use(ImageStoragePrefix, WareStoreImg);

  // Do not serve 'StoreDoc' here; that folder contains confidential files that
  // require authentication.
}

// ------------------
// Request logging
// ------------------
import gMorg from "morgan";

// Request Logging Configuration
// --------------------------

/** Morgan middleware configuration for HTTP request/response logging
 *  Implementation note: Using split/dual logging pattern for improved
 *  request tracking and crash recovery
 *  @see {@link https://expressjs.com/en/resources/middleware/morgan.html}
 *
 *  Previous implementation used single-line format:
 *  ":date[iso] :remote-addr :method :url -> :status (:response-time[0]ms, :res[content-length]B)"
 *
 *  Current implementation uses split logging for:
 *  1. Immediate request logging on receipt
 *  2. Response logging after completion
 *
 *  Known limitation: Response logging occurs after full content transmission,
 *  affecting log order in redirect scenarios. Example timing sequence:
 *
 *  2021-09-11T18:11:08.428Z 127.0.0.1 -> POST /edit-cycle-times
 *  2021-09-11T18:11:09.654Z 127.0.0.1 -> GET /edit-cycle-times
 *  2021-09-11T18:11:09.737Z 127.0.0.1 <- POST /edit-cycle-times 303 (1221ms, 82B)
 *  2021-09-11T18:11:11.235Z 127.0.0.1 <- GET /edit-cycle-times 200 (1494ms, 21798B)
 *
 *  Note: Response logging depends on content length calculation,
 *  which requires complete response transmission
 */

// Log the request:
App.use(
  gMorg(
    // This gives the time in UTC:
    ":date[iso] :remote-addr -> :method :url",
    { immediate: true },
  ),
);

// Log the response:
App.use(
  gMorg(
    // This gives the time in UTC:
    ":date[iso] :remote-addr <- :method :url :status (:response-time[0]ms, :res[content-length]B)",
  ),
);

// -------------------
// Manage session data
// -------------------
// 'express-mysql-session' can be configured to use an existing table, instead
// of creating its own. I considered that, but it would not be useful unless the
// store wrote to other fields in the table (such as a username field) and I
// would have to modify the package to get that.

import gExprSess from "express-session";

import gStoreSess from "express-mysql-session";
/** Implements the session store. */
const tStoreSess = gStoreSess(gExprSess);
// It is possible to pass an existing connection or connection pool to the
// store constructor, and that does work when the connection is created with
// 'mysql'. When that package is replaced with 'mysql2', however, an exception
// is generated. For now, we will let the store create its own connection:
const StoreSess = new tStoreSess(Db);

App.use(
  gExprSess({
    secret: SecretCookSess,
    store: StoreSess,
    resave: false,
    saveUninitialized: true,
  }),
);

// -----------------
// Authenticate user
// -----------------

import { Ready as _Ready, wHandPostLogin, HandGetLogout } from "./Auth.js";

// This adds the 'user' object to the request, if the user is logged-in:
_Ready(App);

App.use(WareMembSusp);

// ---------------------------------
// Add data and process events
// ---------------------------------

App.use(NextOnExcept(wWareData));
App.use(NextOnExcept(wWarePhase));

// ------------------
// Parse form content
// ------------------
// 'body-parser' is deprecated now? [TO DO]

import bodyParser from "body-parser";
const { urlencoded, json } = bodyParser;

const WareBodyEncURL = urlencoded({
  extended: false,
  parameterLimit: 2000,
});
const WareBodyJSON = json();

App.use(WareBodyEncURL);

// --------------------
// Process file uploads
// --------------------
// I would prefer to add gWareMulter after the authentication check, so that
// unauthenticated users can't cause large files to be parsed, but the form
// content must be parsed before WaresPostRoute, or the CSRF check will fail. I
// guess NGINX can deal with unwanted requests.

import gMulter, { diskStorage, MulterError } from "multer";

const _StorMulter = diskStorage({
  destination: `${ImageStoragePrefix.substring(1)}/`,

  filename: function (aReq, aFile, aDone) {
    const oName = NameRndAlphaNum(LenNameFileStoreImg) + extname(aFile.originalname);
    aDone(null, oName);
  },
});

/** File upload configuration
 *  Storage: Local disk
 *  Size limit: Defined in configuration
 */
const OptsMulter = {
  storage: Storage.multerStorage,
  limits: { fileSize: SizeMaxUploadImg },
};

/** This object contains methods that generate file upload middlewares. */
const GenMulter = gMulter(OptsMulter);
/** Uploads the file referenced by the 'Img' field in some form. */
// const WareMulterImg = GenMulter.single("Img");
const WareMulterImg = GenMulter.fields([
  { name: "Img" },
  { name: "ImgHeaderLogoPath" },
  { name: "ImgHeroLogoPath" },
  { name: "ImgFooterLogoPath" },
  { name: "ImgTextLogoPath" },
  { name: "ImgFaviconPath" },
]);

/** Handles image upload processing
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @param {Function} aNext - Next middleware
 *  Processes file from 'Img' form field
 *  Continues to next middleware regardless of upload result
 */
async function WareMulterImgErr(aReq, aResp, aNext) {
  // Ideally, we would treat image upload failures like form validation errors,
  // and return to the form. For that, however, it would be necessary to modify
  // the POST handlers, and these would need access to WareMulter, or some kind
  // of flag would have to be set here. As it stands, the rest of the form will
  // be processed as usual if the upload fails, and a flash error message will
  // be displayed. That seems good enough for now.

  function oNext(aErr) {
    if (aErr) {
      let oMsgLog = "Cannot upload multipart data";
      if (aErr instanceof MulterError) oMsgLog += `: multer error '${aErr.code}'`;
      aReq.Err(oMsgLog);

      const oCkSize = aErr instanceof MulterError && aErr.code === "LIMIT_FILE_SIZE";
      const oMsgFlash = oCkSize
        ? `File cannot be larger than ${SizeMaxUploadImg / 1024}KB.`
        : "Unknown error.";
      aResp.Show_Flash("danger", "Could not upload image!", oMsgFlash);
    }
    // We do not forward the error because we have already displayed it, and we
    // do not want Express to display the 500 page:
    aNext();
  }

  WareMulterImg(aReq, aResp, oNext);
}

/** CSV file upload configuration
 *  Storage: Memory (buffer)
 *  Size limit: 5MB for CSV files
 */
const OptsMulterCSV = {
  storage: gMulter.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (aReq, aFile, aDone) => {
    // Accept only CSV files
    if (aFile.mimetype === 'text/csv' || aFile.originalname.endsWith('.csv')) {
      aDone(null, true);
    } else {
      aDone(new Error('Only CSV files are allowed'));
    }
  }
};

const GenMulterCSV = gMulter(OptsMulterCSV);
const WareMulterCSV = GenMulterCSV.single('csvFile');

/** Handles CSV upload processing
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @param {Function} aNext - Next middleware
 */
async function WareMulterCSVErr(aReq, aResp, aNext) {
  function oNext(aErr) {
    if (aErr) {
      let oMsgLog = "Cannot upload CSV file";
      if (aErr instanceof MulterError) oMsgLog += `: multer error '${aErr.code}'`;
      aReq.Err(oMsgLog);

      const oCkSize = aErr instanceof MulterError && aErr.code === "LIMIT_FILE_SIZE";
      const oMsgFlash = oCkSize
        ? "CSV file cannot be larger than 5MB."
        : aErr.message || "Unknown error.";
      aResp.Show_Flash("danger", "Could not upload file!", oMsgFlash);
    }
    aNext();
  }

  WareMulterCSV(aReq, aResp, oNext);
}

App.use(WareBodyEncURL);

// ----------------------
// Fix Express 'redirect'
// ----------------------

App.use(WareSaveRedirect);

// ----------------------
// Process flash messages
// ----------------------

import { wWare } from "./Flash.js";
App.use(NextOnExcept(wWare));

// --------------
// Route requests
// --------------
// See the 'User credential setup' comments in 'Ware.js' for help with route
// parameters like IDMembSel/IDProducerSel and IDMembView/IDProducerView.

// Healthcheck
// -----------

App.route("/healthcheck").get(function (_aReq, aResp) {
  aResp.send("OK");
});

// Market home
// -----------

import { wHandGet as homeGet } from "./Page/Home/index.js";

App.route("/").all(WaresPostRoute).get(NextOnExcept(homeGet));

import { wHandGet as producersGet } from "./Page/Home/producers.js";

App.route("/producers").all(WaresPostRoute).get(NextOnExcept(producersGet));

import { wHandGet as aboutProducersGet } from "./Page/Home/about-producer.js";

App.route("/about-producer/:IDProducerView(\\d{1,4})")
  .all(WaresPostRoute)
  .get(NextOnExcept(aboutProducersGet));

import { wHandGet as acknowledgementsGet } from "./Page/Home/acknowledgments.js";

import { wHandGet as distinguishedMembersGet } from "./Page/Home/distinguished-members.js";

App.route("/acknowledgments").all(WaresPostRoute).get(NextOnExcept(acknowledgementsGet));

App.route("/distinguished-members")
  .all(WaresPostRoute)
  .get(NextOnExcept(distinguishedMembersGet));

// New member registration
// -----------------------

import {
  Prep,
  HandGet as registrationGet,
  wHandPost as registrationPost,
} from "./Page/Memb/member-registration.js";

App.route("/member-registration")
  .all(WaresPostRoute)
  .all(Prep)
  .get(registrationGet)
  .post(NextOnExcept(registrationPost));

// Login and logout
// ----------------

App.route("/login").all(WaresPostRoute).post(NextOnExcept(wHandPostLogin));

App.route("/logout").all(WaresPostRoute).get(HandGetLogout);

// PayPal Payment
// --------------

App.route("/payment/create-paypal-orders/")
  .all(WaresPostRoute)
  .post(WareBodyJSON) // Apply JSON body parser middleware
  .post(NextOnExcept(wHandlePaypalCreateOrder));

App.route("/payment/capture-paypal-order/:orderID")
  .all(WaresPostRoute)
  .post(NextOnExcept(wHandlePaypalCaptureOrder));

// Password reset
// --------------

import {
  HandGet as requestPasswordResetGet,
  wHandPost as requestPasswordRequestPost,
} from "./Page/Memb/request-password-reset.js";

App.route("/request-password-reset")
  .all(WaresPostRoute)
  .get(requestPasswordResetGet)
  .post(NextOnExcept(requestPasswordRequestPost));

import {
  HandGet as resetPasswordGet,
  wHandPost as resetPasswordPost,
} from "./Page/Memb/reset-password.js";

App.route("/reset-password/:TokResetPass")
  .all(WaresPostRoute)
  .get(resetPasswordGet)
  .post(NextOnExcept(resetPasswordPost));

// Shopping
// --------

import {
  wHandGet as productSearchGet,
  HandPost as productSearchPost,
} from "./Page/Shop/product-search.js";

App.route("/product-search")
  .all(WaresPostRoute)
  .get((req, res, next) => {
    if (req.query.favorites) {
      return WareCkUser(req, res, next);
    }
    next();
  })
  .get(productSearchGet)
  .post(productSearchPost);

import { HandPost as toggleFavoritePost } from "./Page/Shop/toggle-favorite.js";

App.route("/toggle-favorite")
  .all(WareBodyJSON)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .post(toggleFavoritePost);
//Ends Here

import { wHandGet as productGet } from "./Page/Shop/product.js";

App.route("/product/:IDProductSel(\\d{1,6})")
  .all(WaresPostRoute)
  .all(NextOnExcept(wWareProductSel))
  .get(NextOnExcept(productGet));

import {
  wHandGet as svcCartGet,
  wHandPost as svcCartPost,
  wHandPut as svcCartPut,
} from "./Svc/svc-cart.js";

App.route("/svc-cart")
  .all(WareBodyJSON)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .get(NextOnExcept(svcCartGet))
  .post(NextOnExcept(svcCartPost))
  .put(NextOnExcept(svcCartPut));

// Member home
// -----------

import { wHandGet as memberGet } from "./Page/Memb/member.js";

App.route("/member").all(WaresPostRoute).all(WareCkUser).get(memberGet);

import {
  wHandGet as editMemberRegistrationGet,
  wHandPost as editMemberRegistrationPost,
} from "./Page/Memb/edit-member-registration.js";

App.route("/edit-member-registration/:IDMembSel(\\d{1,5})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareAllowEditMemb)
  .get(NextOnExcept(editMemberRegistrationGet))
  .post(NextOnExcept(editMemberRegistrationPost));

import {
  HandGet as changePasswordGet,
  wHandPost as changePasswordPost,
} from "./Page/Memb/change-password.js";

App.route("/change-password")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .get(changePasswordGet)
  .post(NextOnExcept(changePasswordPost));

import {
  wHandGet as editMemberStatusGet,
  wHandPost as editMemberStatusPost,
} from "./Page/Memb/edit-member-status.js";

App.route("/edit-member-status/:IDMembSel(\\d{1,5})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareAllowEditMemb)
  .all(WareCkStaff)
  .get(NextOnExcept(editMemberStatusGet))
  .post(NextOnExcept(editMemberStatusPost));

import {
  wHandGet as editMemberTagsGet,
  wHandPost as editMemberTagsPost,
} from "./Page/Memb/edit-member-tags.js";

App.route("/edit-member-tags/:IDMembSel(\\d{1,5})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareAllowEditMemb)
  .all(WareCkStaff)
  .get(NextOnExcept(editMemberTagsGet))
  .post(NextOnExcept(editMemberTagsPost));

import {
  wHandGet as transactionsGet,
  wHandGetExport as transactionsExportGet,
} from "./Page/Memb/transactions.js";

App.route("/transactions").all(WaresPostRoute).all(WareCkUser).get(NextOnExcept(transactionsGet));

// Only staff can 'select' a member with this page:
App.route("/transactions/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(transactionsGet));

App.route("/transactions-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .get(NextOnExcept(transactionsExportGet));

// Only staff can 'select' a member with this page:
App.route("/transactions-export/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(transactionsExportGet));

// Member Admin
// ------------

import {
  wHandGet as memberAdminGet,
  HandPost as memberAdminPost,
} from "./Page/MembAdmin/member-admin.js";

App.route("/member-admin")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberAdminGet))
  .post(memberAdminPost);

import {
  wHandGet as memberSearchResultsGet,
  wHandGetExport as memberExportGet,
} from "./Page/MembAdmin/member-search-results.js";

App.route("/member-search-results")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberSearchResultsGet));

App.route("/member-search-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberExportGet));

import { wHandPost as impersonateMemberPost } from "./Page/MembAdmin/impersonate-member.js";

App.route("/impersonate-member")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .post(NextOnExcept(impersonateMemberPost));

import { wHandPost as stopImpersonationPost } from "./Page/MembAdmin/stop-impersonation.js";

App.route("/stop-impersonation")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .post(NextOnExcept(stopImpersonationPost));

import { wHandGet as memberDetailGet } from "./Page/MembAdmin/member-detail.js";

App.route("/member-detail/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberDetailGet));

import { wHandGet as shopperInvoicesGet } from "./Page/Memb/shopper-invoices.js";

App.route("/shopper-invoices/:IDMembSel(\\d{1,5})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .get(NextOnExcept(shopperInvoicesGet));

import { wHandGet as webShopperInvoicesGet } from "./Page/Memb/web-shopper-invoice.js";

App.route("/web-shopper-invoice/:IDInvcShopWeb(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  // Invoice ownership is checked here:
  .get(NextOnExcept(webShopperInvoicesGet));

// New producer registration
// -------------------------

import {
  Prep as _Prep,
  wHandGet as producerRegistrationGet,
  wHandPost as producerRegistrationPost,
} from "./Page/Producer/producer-registration.js";

App.route("/producer-registration")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(_Prep)
  .get(NextOnExcept(producerRegistrationGet))
  .post(NextOnExcept(producerRegistrationPost));

// Producer home
// -------------

import { wHandGet as producerGet } from "./Page/Producer/producer.js";

App.route("/producer")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerGet));

import { wHandGet as producerReportsGet } from "./Page/Producer/producer-reports.js";

App.route("/producer-reports")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerReportsGet));

import { wHandGet as hubReportsGet } from "./Page/Cashier/hub-reports.js";

App.route("/hub-reports")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(hubReportsGet));

import {
  wHandGet as editAboutProducerGet,
  wHandPost as editAboutProducerPost,
} from "./Page/Producer/edit-about-producer.js";

App.route("/edit-about-producer/:IDProducerSel(\\d{1,4})?")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(editAboutProducerGet))
  .post(NextOnExcept(editAboutProducerPost));

import {
  wHandGet as editProducerRegistrationGet,
  wHandPost as editProducerRegistrationPost,
} from "./Page/Producer/edit-producer-registration.js";

App.route("/edit-producer-registration/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(editProducerRegistrationGet))
  .post(NextOnExcept(editProducerRegistrationPost));

import {
  wHandGet as editProducerStatusGet,
  wHandPost as editProducerStatusPost,
} from "./Page/Producer/edit-producer-status.js";

App.route("/edit-producer-status/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(editProducerStatusGet))
  .post(NextOnExcept(editProducerStatusPost));

import { wHandGet as productDetailGet } from "./Page/Product/product-detail.js";

App.route("/product-detail/:IDProductSel(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareProductSelOwn))
  .get(NextOnExcept(productDetailGet));

import {
  wHandGet as addProductGet,
  wHandPost as addProductPost,
} from "./Page/Product/add-product.js";

App.route("/add-product")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(addProductGet))
  .post(NextOnExcept(addProductPost));

import {
  wHandGet as editProductGet,
  wHandPost as editProductPost,
} from "./Page/Product/edit-product.js";

App.route("/edit-product/:IDProductSel(\\d{1,6})")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareProductSelOwn))
  .get(NextOnExcept(editProductGet))
  .post(NextOnExcept(editProductPost));

import {
  wHandGet as addVarietyGet,
  wHandPost as addVarietyPost,
} from "./Page/Product/add-variety.js";

App.route("/add-variety/:IDProductSel(\\d{1,6})")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareProductSelOwn))
  .get(NextOnExcept(addVarietyGet))
  .post(NextOnExcept(addVarietyPost));

import {
  wHandGet as editVarietyGet,
  wHandPost as editVarietyPost,
} from "./Page/Product/edit-variety.js";

App.route("/edit-variety/:IDVtySel(\\d{1,7})")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareVtySel))
  .get(NextOnExcept(editVarietyGet))
  .post(NextOnExcept(editVarietyPost));

import { wHandGet as producerCatalogGet } from "./Page/Producer/producer-catalog.js";

App.route("/producer-catalog")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerCatalogGet));

import {
  wHandGet as producerInventoryGet,
  wHandPost as producerInventoryPost,
} from "./Page/Producer/producer-inventory.js";

App.route("/producer-inventory")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerInventoryGet))
  .post(NextOnExcept(producerInventoryPost));

import { wHandGet as varietyOrderHistoryGet } from "./Page/Product/variety-order-history.js";

App.route("/variety-order-history/:IDVtySel(\\d{1,7})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareVtySelOwn))
  .get(NextOnExcept(varietyOrderHistoryGet));

import {
  wHandGet as webOrderSummaryGet,
  wHandGetExport as __wHandGetExport,
  wHandGetPicklist as __wHandGetPicklist,
} from "./Page/Producer/web-order-summary.js";

App.route("/web-order-summary/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(webOrderSummaryGet));

App.route("/web-order-summary-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(__wHandGetExport));

App.route("/web-order-picklist-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(__wHandGetPicklist));

import { wHandGet as webOrderLabelsGet } from "./Page/Producer/web-order-labels.js";

App.route("/web-order-labels")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(webOrderLabelsGet));

import {
  wHandGet as editWebOrderLabelWeightsGet,
  wHandPost as editWebOrderLabelWeightsPost,
} from "./Page/Producer/edit-web-order-label-weights.js";

App.route("/edit-web-order-label-weights")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(editWebOrderLabelWeightsGet))
  .post(NextOnExcept(editWebOrderLabelWeightsPost));

import { wHandGet as printWebOrderLabelsGet } from "./Page/Producer/print-web-order-labels.js";

App.route("/print-web-order-labels-false")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(printWebOrderLabelsGet));

import { wHandGet as printWebOrderLabels30Get } from "./Page/Producer/print-web-order-labels-30.js";

App.route("/print-web-order-labels-true")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(printWebOrderLabels30Get));

import { wHandGet as producerInvoicesGet } from "./Page/Producer/producer-invoices.js";

App.route("/producer-invoices/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerInvoicesGet));

import { wHandGet as webProducerInvoicesGet } from "./Page/Producer/web-producer-invoice.js";

App.route("/web-producer-invoice/:IDInvcProducerWeb(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  // Invoice ownership is checked here:
  .get(NextOnExcept(webProducerInvoicesGet));

import { wHandGet as onSiteProduverInvoiceGet } from "./Page/Producer/on-site-producer-invoice.js";

App.route("/on-site-producer-invoice/:IDInvcProducerOnsite(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  // Invoice ownership is checked here:
  .get(NextOnExcept(onSiteProduverInvoiceGet));

import {
  wHandGet as producerWebSalesByVarietyGet,
  wHandGetExportQtyDeliv,
  wHandGetExportSaleNom,
} from "./Page/Producer/producer-web-sales-by-variety.js";

App.route("/producer-web-sales-by-variety/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(producerWebSalesByVarietyGet));

App.route("/producer-web-sales-by-variety-export-quantities/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(wHandGetExportQtyDeliv));

App.route("/producer-web-sales-by-variety-export-sales/:IDProducerSel(\\d{1,4})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkProducer)
  .get(NextOnExcept(wHandGetExportSaleNom));

import {
  wHandGet as varietyLabelsGet,
  wHandPost as varietyLabelsPost,
} from "./Page/Product/variety-labels.js";

App.route("/variety-labels/:IDVtySel(\\d{1,7})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareVtySelOwn))
  .get(NextOnExcept(varietyLabelsGet))
  .post(NextOnExcept(varietyLabelsPost));

import { wHandGet as printVarietyLabelsGet } from "./Page/Product/print-variety-labels.js";

App.route("/print-variety-labels/:IDVtySel(\\d{1,7})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareVtySelOwn))
  .get(NextOnExcept(printVarietyLabelsGet));

// Producer Admin
// --------------

import {
  wHandGet as producerAdminGet,
  HandPost as producerAdminPost,
} from "./Page/ProducerAdmin/producer-admin.js";

App.route("/producer-admin")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerAdminGet))
  .post(producerAdminPost);

import { wHandGet as editedProductsGet } from "./Page/ProducerAdmin/edited-products.js";

App.route("/edited-products")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(editedProductsGet));

import {
  wHandGet as producerSearchResultsGet,
  wHandGetExport as producerSearchResultExportGet,
} from "./Page/ProducerAdmin/producer-search-results.js";

App.route("/producer-search-results")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerSearchResultsGet));

App.route("/producer-search-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerSearchResultExportGet));

import { wHandGet as producerDetailGet } from "./Page/ProducerAdmin/producer-detail.js";

App.route("/producer-detail/:IDProducerSel(\\d{1,4})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerDetailGet));

// Distribution
// ------------

import { wHandGet as distributionGet } from "./Page/Distrib/distribution.js";

App.route("/distribution")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(distributionGet));

import { wHandGet as cycleSummaryGet } from "./Page/Distrib/cycle-summary.js";

App.route("/cycle-summary")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cycleSummaryGet));

import { wHandGet as cartSummaryGet } from "./Page/Distrib/cart-summary.js";

App.route("/cart-summary")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cartSummaryGet));

import { wHandGet as cartDetailGet } from "./Page/Distrib/cart-detail.js";

App.route("/cart-detail/:IDCart(\\d{1,10})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cartDetailGet));

import {
  wHandGet as editCycleTimesGet,
  wHandPost as editCycleTimesPost,
} from "./Page/Distrib/edit-cycle-times.js";

App.route("/edit-cycle-times")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffSuper)
  .get(NextOnExcept(editCycleTimesGet))
  .post(NextOnExcept(editCycleTimesPost));

import { wHandGet as cycleHistoryGet } from "./Page/Distrib/cycle-history.js";

App.route("/cycle-history")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cycleHistoryGet));

import { wHandGet as shelvingPrepGet } from "./Page/Distrib/shelving-prep.js";

App.route("/shelving-prep")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shelvingPrepGet));

import { wHandGet as deliveryProgressGet } from "./Page/Distrib/delivery-progress.js";

App.route("/delivery-progress")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(deliveryProgressGet));

import {
  wHandGet as producerCheckInGet,
  wHandPost as producerCheckInPost,
} from "./Page/Distrib/producer-check-in.js";

App.route("/producer-check-in/:IDProducerSel(\\d{1,4})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerCheckInGet))
  .post(NextOnExcept(producerCheckInPost));

import { wHandGet as producerCheckInSummaryGet } from "./Page/Distrib/producer-check-in-summary.js";

App.route("/producer-check-in-summary/:IDInvcProducerWeb(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerCheckInSummaryGet));

import { wHandGet as locationFulfillmentGet } from "./Page/Distrib/location-fulfillment.js";

App.route("/location-fulfillment/:CdLoc([0-9A-Za-z]+)")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(locationFulfillmentGet));

import { wHandGet as shopperSummaryGet } from "./Page/Distrib/shopper-summary.js";

App.route("/shopper-summary")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shopperSummaryGet));

import { wHandGet as orderFulfillmentGet } from "./Page/Distrib/order-fulfillment.js";

App.route("/order-fulfillment/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(orderFulfillmentGet));

import {
  wHandGet as shopperCheckoutGet,
  wHandPost as shopperCheckoutPost,
} from "./Page/Distrib/shopper-checkout.js";

App.route("/shopper-checkout/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shopperCheckoutGet))
  .post(NextOnExcept(shopperCheckoutPost));

import { wHandGet as webCheckoutSummaryGet } from "./Page/Distrib/web-checkout-summary.js";

App.route("/web-checkout-summary/:IDInvcShopWeb(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(webCheckoutSummaryGet));

import { wHandGet as pickupProgressGet } from "./Page/Distrib/pickup-progress.js";

App.route("/pickup-progress/:CdLoc([0-9A-Za-z]+)")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(pickupProgressGet));

import { wHandGet as transferLoadingGet } from "./Page/Distrib/transfer-loading.js";

App.route("/transfer-loading/:CdLoc([0-9A-Za-z]+)")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(transferLoadingGet));

// Cashier
// -------

import { wHandGet as cashierGet, HandPost as cashierPost } from "./Page/Cashier/cashier.js";

App.route("/cashier")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cashierGet))
  .post(cashierPost);

import {
  wHandGet as coopWebSalesBySubcategoryGet,
  wHandGetExportQtySold as coopWebSalesBySubcategoryExportQuantitiesGet,
  wHandGetExportSaleNom as coopWebSalesBySubcategoryExportSalesGet,
} from "./Page/Cashier/co-op-web-sales-by-subcategory.js";

App.route("/co-op-web-sales-by-subcategory")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesBySubcategoryGet));

App.route("/co-op-web-sales-by-subcategory-export-quantities")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesBySubcategoryExportQuantitiesGet));

App.route("/co-op-web-sales-by-subcategory-export-sales")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesBySubcategoryExportSalesGet));

import {
  wHandGet as coopWebSalesByLocationGet,
  wHandGetExport as coopWebSalesByLocationExportGet,
  wHandGetExport10 as coopWebSalesByLocationExport10Get,
} from "./Page/Cashier/co-op-web-sales-by-location.js";

App.route("/co-op-web-sales-by-location")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesByLocationGet));

App.route("/co-op-web-sales-by-location-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesByLocationExportGet));

App.route("/co-op-web-sales-by-location-export-10")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopWebSalesByLocationExport10Get));

import {
  wHandGet as accountingSummaryGet,
  wHandGetExport as accountingSummaryExportGet,
} from "./Page/Cashier/accounting-summary.js";

App.route("/accounting-summary")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(accountingSummaryGet));

App.route("/accounting-summary-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(accountingSummaryExportGet));

import {
  wHandGet as shopperChargesGet,
  wHandGetExportWeb as shopperChargesWebExportGet,
  wHandGetExportOnsite as shopperChargesOnsiteExportGet,
} from "./Page/Cashier/shopper-charges.js";

App.route("/shopper-charges/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shopperChargesGet));

App.route("/shopper-charges-web-export/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shopperChargesWebExportGet));

App.route("/shopper-charges-onsite-export/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(shopperChargesOnsiteExportGet));

import {
  wHandGet as producerEarningsGet,
  wHandGetExportWeb as producerEarningsWebExportGet,
  wHandGetExportOnsite as producerEarningsOnsiteExportGet,
} from "./Page/Cashier/producer-earnings.js";

App.route("/producer-earnings/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerEarningsGet));

App.route("/producer-earnings-web-export/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerEarningsWebExportGet));

App.route("/producer-earnings-onsite-export/:IDCyc(\\d{1,3})?")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(producerEarningsOnsiteExportGet));

import {
  wHandGet as transactionSearchResultsGet,
  wHandGetExport as transactionSearchExportGet,
} from "./Page/Cashier/transaction-search-results.js";

App.route("/transaction-search-results")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(transactionSearchResultsGet));

App.route("/transaction-search-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(transactionSearchExportGet));

import { wHandGet as transactionDetailGet } from "./Page/Cashier/transaction-detail.js";

App.route("/transaction-detail/:IDTransactSel(\\d{1,9})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(NextOnExcept(wWareTransactSel))
  .get(NextOnExcept(transactionDetailGet));

import {
  wHandGet as addTransactionGet,
  wHandPost as addTransactionPost,
} from "./Page/Cashier/AddTransact.js";

App.route("/add-member-transaction/:IDMembSel(\\d{1,5})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffAccts)
  .get(NextOnExcept(addTransactionGet))
  .post(NextOnExcept(addTransactionPost));

App.route("/add-producer-transaction/:IDProducerSel(\\d{1,4})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffAccts)
  .get(NextOnExcept(addTransactionGet))
  .post(NextOnExcept(addTransactionPost));

import {
  wHandGet as coopOnsiteSalesByVarietyGet,
  wHandGetExportQty as coopOnsiteSalesByVarietyExportQuantitiesGet,
  wHandGetExportSaleNom as coopOnsiteSalesByVarietyExportSalesGet,
} from "./Page/Cashier/co-op-on-site-sales-by-variety.js";

App.route("/co-op-on-site-sales-by-variety")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopOnsiteSalesByVarietyGet));

App.route("/co-op-on-site-sales-by-variety-export-quantities")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopOnsiteSalesByVarietyExportQuantitiesGet));

App.route("/co-op-on-site-sales-by-variety-export-sales")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(coopOnsiteSalesByVarietyExportSalesGet));

import {
  wHandGet as uploadProducerDisbursementsGet,
  wHandPost as uploadProducerDisbursementsPost,
} from "./Page/ProducerAdmin/upload-producer-disbursements.js";

App.route("/upload-producer-disbursements")
  .all(WareMulterCSVErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(uploadProducerDisbursementsGet))
  .post(NextOnExcept(uploadProducerDisbursementsPost));

// Site admin
// ----------

import {
  wHandGet as siteAdminGet,
  wHandPost as siteAdminPost,
} from "./Page/SiteAdmin/site-admin.js";

App.route("/site-admin")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(siteAdminGet))
  .post(NextOnExcept(siteAdminPost));

import {
  wHandGet as editSiteConfigurationGet,
  wHandPost as editSiteConfigurationPost,
} from "./Page/SiteAdmin/edit-site-configuration.js";

App.route("/edit-site-configuration")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(editSiteConfigurationGet))
  .post(NextOnExcept(editSiteConfigurationPost));

import {
  wHandGet as editCoopParametersGet,
  wHandPost as editCoopParametersPost,
} from "./Page/SiteAdmin/edit-coop-parameters.js";

App.route("/edit-coop-parameters")
  .all(WareMulterImgErr)
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(editCoopParametersGet))
  .post(NextOnExcept(editCoopParametersPost));

import { wHandGet as manageCategoriesGet } from "./Page/SiteAdmin/manage-categories.js";

App.route("/manage-categories")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(manageCategoriesGet));

import {
  wHandGet as addCategoryGet,
  wHandPost as addCategoryPost,
} from "./Page/SiteAdmin/add-category.js";

App.route("/add-category")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(addCategoryGet))
  .post(NextOnExcept(addCategoryPost));

import {
  wHandGet as editCategoryGet,
  wHandPost as editCategoryPost,
} from "./Page/SiteAdmin/edit-category.js";

App.route("/edit-category/:IDCat(\\d{1,3})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(editCategoryGet))
  .post(NextOnExcept(editCategoryPost));

import {
  wHandGet as deleteCategoryGet,
  wHandPost as deleteCategoryPost,
} from "./Page/SiteAdmin/delete-category.js";

App.route("/delete-category/:IDCat(\\d{1,3})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(deleteCategoryGet))
  .post(NextOnExcept(deleteCategoryPost));

import {
  wHandGet as addSubcategoryGet,
  wHandPost as addSubcategoryPost,
} from "./Page/SiteAdmin/add-subcategory.js";

App.route("/add-subcategory")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(addSubcategoryGet))
  .post(NextOnExcept(addSubcategoryPost));

import {
  wHandGet as editSubcategoryGet,
  wHandPost as editSubcategoryPost,
} from "./Page/SiteAdmin/edit-subcategory.js";

App.route("/edit-subcategory/:IDSubcat(\\d{1,3})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(editSubcategoryGet))
  .post(NextOnExcept(editSubcategoryPost));

import {
  wHandGet as deleteSubcategoryGet,
  wHandPost as deleteSubcategoryPost,
} from "./Page/SiteAdmin/delete-subcategory.js";

App.route("/delete-subcategory/:IDSubcat(\\d{1,3})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(deleteSubcategoryGet))
  .post(NextOnExcept(deleteSubcategoryPost));

import { wHandGet as manageLocationsGet } from "./Page/SiteAdmin/manage-locations.js";

App.route("/manage-locations")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(manageLocationsGet));

import {
  wHandGet as addLocationGet,
  wHandPost as addLocationPost,
} from "./Page/SiteAdmin/add-location.js";

App.route("/add-location")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(addLocationGet))
  .post(NextOnExcept(addLocationPost));

import {
  wHandGet as editLocationGet,
  wHandPost as editLocationPost,
} from "./Page/SiteAdmin/edit-location.js";

App.route("/edit-location/:CdLoc([0-9A-Za-z]+)")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaffMgr)
  .get(NextOnExcept(editLocationGet))
  .post(NextOnExcept(editLocationPost));

import {
  wHandGet as unblockIpAddressGet,
  wHandPost as unblockIpAddressPost,
} from "./Page/SiteAdmin/unblock-ip-address.js";

App.route("/unblock-ip-address")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(unblockIpAddressGet))
  .post(NextOnExcept(unblockIpAddressPost));

import { wHandGet as cycleEventsGet } from "./Page/SiteAdmin/cycle-events.js";

App.route("/cycle-events")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(cycleEventsGet));

import { wHandGet as memberFeesGet } from "./Page/SiteAdmin/member-fees.js";

App.route("/member-fees")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberFeesGet));

import { wHandGet as memberBalancesGet } from "./Page/SiteAdmin/member-balances.js";

App.route("/member-balances")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(memberBalancesGet));

import { wHandGet as registrationStatusesGet } from "./Page/SiteAdmin/registration-statuses.js";

App.route("/registration-statuses")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(registrationStatusesGet));

import { wHandGet as staffTypesGet } from "./Page/SiteAdmin/staff-types.js";

App.route("/staff-types")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(staffTypesGet));

import { wHandGet as scannerUseGet } from "./Page/SiteAdmin/scanner-use.js";

App.route("/scanner-use")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(scannerUseGet));

import { wHandGet as scannerSetupGet } from "./Page/SiteAdmin/scanner-setup.js";

App.route("/scanner-setup")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(scannerSetupGet));

// On-site
// -------

import { wHandGet as onsiteGet } from "./Page/Onsite/on-site.js";

App.route("/on-site")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteGet));

import {
  wHandGet as managedCatalogGet,
  wHandGetExport as managedCatalogExportGet,
} from "./Page/Onsite/managed-catalog.js";

App.route("/managed-catalog")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(managedCatalogGet));

App.route("/managed-catalog-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(managedCatalogExportGet));

import {
  wHandGet as onsiteCatalogGet,
  wHandGetExport as onsiteCatalogExportGet,
} from "./Page/Onsite/on-site-catalog.js";

App.route("/on-site-catalog")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteCatalogGet));

App.route("/on-site-catalog-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteCatalogExportGet));

import {
  wHandGet as wholesaleCatalogGet,
  wHandGetExport as wholesaleCatalogExportGet,
} from "./Page/Onsite/wholesale-catalog.js";

App.route("/wholesale-catalog")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(wholesaleCatalogGet));

App.route("/wholesale-catalog-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(wholesaleCatalogExportGet));

import {
  wHandGet as wholesaleInventoryGet,
  wHandPost as wholesaleInventoryPost,
} from "./Page/Onsite/wholesale-inventory.js";

App.route("/wholesale-inventory")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(wholesaleInventoryGet))
  .post(NextOnExcept(wholesaleInventoryPost));

import {
  wHandGet as addToOnsiteCartGet,
  wHandPost as addToOnsiteCartPost,
} from "./Page/Onsite/add-to-on-site-cart.js";

App.route("/add-to-on-site-cart/:IDVtySel(\\d{1,7})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .all(NextOnExcept(wWareVtySel))
  .get(NextOnExcept(addToOnsiteCartGet))
  .post(NextOnExcept(addToOnsiteCartPost));

import { wHandGet as associateMemberOnsiteCartGet } from "./Page/Onsite/associate-member-on-site-cart.js";

App.route("/associate-member-on-site-cart/:IDMembView(\\d{1,5})?")
  .all(WareCkUser)
  .all(WareCkStaff)
  .all(NextOnExcept(wWareVtySel))
  .get(NextOnExcept(associateMemberOnsiteCartGet));

import { wHandGet as onsiteCartGet, wHandPost as onsitePost } from "./Page/Onsite/on-site-cart.js";

App.route("/on-site-cart")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteCartGet))
  .post(NextOnExcept(onsitePost));

import {
  wHandGet as onsiteCheckoutGet,
  wHandPost as onsiteCheckoutPost,
} from "./Page/Onsite/on-site-checkout.js";

App.route("/on-site-checkout")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteCheckoutGet))
  .post(NextOnExcept(onsiteCheckoutPost));

import { wHandGet as onsiteCheckoutSummaryGet } from "./Page/Onsite/on-site-checkout-summary.js";

App.route("/on-site-checkout-summary/:IDInvcShopOnsite(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteCheckoutSummaryGet));

import {
  wHandGet as onsiteShopperInvoicesGet,
  wHandGetExport as onsiteShopperInvoicesExportGet,
} from "./Page/Onsite/on-site-shopper-invoices.js";

App.route("/on-site-shopper-invoices")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteShopperInvoicesGet));

App.route("/on-site-shopper-invoices-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .get(NextOnExcept(onsiteShopperInvoicesExportGet));

App.route("/wholesale-shopper-invoices")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .all(wWareSetWholesale)
  .get(NextOnExcept(onsiteShopperInvoicesGet));

App.route("/wholesale-shopper-invoices-export")
  .all(WaresPostRoute)
  .all(WareCkUser)
  .all(WareCkStaff)
  .all(wWareSetWholesale)
  .get(NextOnExcept(onsiteShopperInvoicesExportGet));

import { wHandGet as onsiteShopperInvoiceGet } from "./Page/Onsite/on-site-shopper-invoice.js";

App.route("/on-site-shopper-invoice/:IDInvcShopOnsite(\\d{1,6})")
  .all(WaresPostRoute)
  .all(WareCkUser)
  // Invoice ownership is checked here:
  .get(NextOnExcept(onsiteShopperInvoiceGet));

import { wHandGet as svcOnsiteCartGet } from "./Svc/svc-on-site-cart.js";

App.route("/svc-on-site-cart/:IDVtySel(\\d{1,7})")
  .all(WareBodyJSON)
  .all(WareCkUser)
  .all(WareCkStaff)
  .all(NextOnExcept(wWareVtySel))
  .get(NextOnExcept(svcOnsiteCartGet));

import { wHandGet as termsAndConditionsGet } from "./Page/TermsAndConditions/terms-and-conditions.js";

App.route("/terms-and-conditions").all(WaresPostRoute).get(NextOnExcept(termsAndConditionsGet));

import { wHandGet as productionTypesGet } from "./Page/ProductionTypes/production-types.js";

App.route("/production-types").all(WaresPostRoute).get(NextOnExcept(productionTypesGet));

// Static Pages
// ------------

import { wHandGet as staticPagesHandleGet } from "./Page/StaticPages/static-pages.js";

App.route("/pages/:pageSlug([0-9A-Za-z-]+)")
  .all(WaresPostRoute)
  .get(NextOnExcept(staticPagesHandleGet));

// Error handling
// --------------

// This fixes another irritating 'csurf' problem. To prevent DOS attacks, the
// 'multer' documentation recommends that its middleware be run only on routes
// that expect file uploads. This means that 'multipart/form-data' data is not
// parsed on most routes. Therefore, if a file upload form happens to POST to
// the wrong address, the contained CSRF token will go unparsed, and a very
// confusing CSRF failure will result, rather than the '404' or body content
// mismatch one would expect.
//
// This middleware parses 'multipart/form-data' CSRF tokens without accepting
// unwanted files:
App.use(GenMulter.none());
// Make the user data available to the error pages, and add the CSRF token, so
// that the user can submit from them:
App.use(WaresPostRoute);

// Catch CSRF failures:
App.use((aErr, aReq, aResp, aNext) => {
  if (aErr.code === "EBADCSRFTOKEN") {
    // This fixes an irritating 'csurf' problem. The 'csurf' middleware must run
    // before 'csrfToken' is called, but that same middleware also blocks POST
    // requests that lack the correct token. If I use the browser developer
    // console to change the token in the page (or, presumably, if the user
    // leaves a page open long enough for the token to time-out) and then submit
    // a login request, the '403' page will be rendered, and the login form
    // embedded in that page will have a blank token. This will cause succeeding
    // login attempts to fail as well. Only layout-embedded forms are affected,
    // since the user would have to navigate away from the '403' page to use any
    // other, and that would produce a correct token:
    aResp.locals.TokCSRF = aReq.csrfToken();

    aResp.locals.Msg = "Your session has timed-out; please try again.";
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }
  aNext(aErr);
});

// Display the '500' page:
App.use((aErr, aReq, aResp, aNext) => {
  const oCkDeadlock = aErr.code && aErr.code === "ER_LOCK_DEADLOCK";

  // Deadlocks aren't 'exceptional' in the same way that other exceptions are,
  // so we won't send them to the error stream:
  if (oCkDeadlock) {
    console.log("DATABASE DEADLOCK");
    console.log(aErr);
  } else aReq.Err(aErr);

  // The Express documentation warns that custom error handlers "must delegate
  // to the default" if headers have already been sent to the client. If an
  // error is passed to 'next' when response data has already started streaming
  // to the client, the default handler will 'fail' the request and close the
  // connection:
  if (aResp.headersSent) {
    aNext(aErr);
    return;
  }

  if (oCkDeadlock) {
    aResp.locals.Title = "Server deadlock";
    aResp.locals.Head = "Server deadlock";
    aResp.locals.Msg =
      "Another user was busy with the data you want to use. " + "Please try again.";
  } else aResp.locals.Title = "Server error";

  aResp.status(500);
  aResp.render("Misc/500");
});

// Display the '404' page:
App.use((aReq, aResp) => {
  aResp.locals.Title = "Page not found";
  aResp.status(404);
  aResp.render("Misc/404");
});

// ------------
// Start server
// ------------
(async function () {
  await wReady();
  await _wReady();

  await wAdd_EvtApp("StartApp", null, null, null);

  App.listen(PortServ, HostServ, () => {
    console.log(`Listening on port ${PortServ}...`);
  });
})();
