// Auth.js
// =======
// Authentication system
//
// Authentication is implemented with Passport:
//
//   http://www.passportjs.org/docs/
//
//   https://github.com/jwalton/passport-api-docs
//
//   https://github.com/jaredhanson/passport
//
//   https://github.com/jaredhanson/passport-local
//
//   https://medium.com/@evangow/server-authentication-basics-express-sessions-passport-and-curl-359b7456003d
//
//   https://expressjs.com/en/advanced/best-practice-security.html
//
//
// Session Management
// ----------------
// Current behavior: Users are redirected to the 403 page when their session expires.
// Potential enhancement: Add session expiration notification.
// Implementation considerations:
// 1. Session data becomes inaccessible after expiration
// 2. Session record is typically deleted at this point
// 3. Adding a cookie-based login state tracker would require cookie-parser
// Note: Session timeout occurs after 24 hours of inactivity

import { promisify } from "node:util";

import { Conn } from "./Db.js";
import { wCredFromNameLogin, wCredFromIDMemb } from "./Cred.js";
import { wComp, CompLeg, wHash } from "./Pass.js";
import { CtFailLoginBlock } from "../Cfg.js";
import { CoopParams } from "./Site.js";

import passport from "passport";

import passportRequest from "passport/lib/http/request.js";
const { logIn, logOut } = passportRequest;

import { Strategy } from "passport-local";

// ------------------
// Configure strategy
// ------------------

const OptsStrat = {
  usernameField: "NameLogin",
  passwordField: "Pass",
};

/** The 'verify' function, which checks the user's username and password. Even
    if these are correct, the login might be canceled later for some other
    reason. */
async function wHandVerif(aNameLogin, aPass, aDone) {
  try {
    if (aNameLogin.endsWith(" ")) {
      aNameLogin = aNameLogin.slice(0, -1);
    }

    const oUser = await wCredFromNameLogin(aNameLogin);
    if (!oUser) {
      aDone(null, false);
      return;
    }

    // Check regular BCrypt hash:
    if (await wComp(aPass, oUser.HashPass)) {
      aDone(null, oUser);
      return;
    }

    // Check MD5 hash from original database, and convert if there is a match:
    if (CompLeg(aPass, oUser.HashPassLeg)) {
      wConvert_Pass(aNameLogin, aPass);

      aDone(null, oUser);
      return;
    }

    aDone(null, false);
  } catch (oErr) {
    aDone(null, false);
  }
}

const StratAuth = new Strategy(OptsStrat, wHandVerif);
passport.use(StratAuth);

// ----------------------
// Store and restore user
// ----------------------

// Converts the user object to a value that can be stored in the session.
passport.serializeUser((aUser, aDone) => {
  aDone(null, aUser.IDMemb);
});

// Converts the value stored in the session to the full user object, so it can
// be added to the request. The user object is also produced in wHandVerif when
// the user first logs in.
passport.deserializeUser(async (aIDMemb, aDone) => {
  const oUser = await wCredFromIDMemb(aIDMemb);
  aDone(null, oUser);
});

// -------
// Exports
// -------

/** Readies Passport and adds it to the pipeline. */
export function Ready(aApp) {
  aApp.use(function (req, _res, next) {
    req.logIn = promisify(logIn);
    req.logOut = promisify(logOut);
    next();
  });
  aApp.use(passport.initialize());
  aApp.use(passport.session());
}

/** Records the specified login attempt. Set aIDMemb to 'null' if the login
 *  failed. */
export async function wAdd_Login(aIP, aNameLogin, aIDMemb) {
  const oParams = {
    IP: aIP,
    NameLogin: aNameLogin,
    IDMemb: aIDMemb,
  };
  const oSQL = `INSERT INTO Login (IP, NameLogin, IDMemb)
		VALUES (:IP, :NameLogin, :IDMemb)`;
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows < 1) throw Error("Auth wAdd_Login: Failed to add record");
}

/** Records a login failure. */
async function wAdd_FailLogin(aNameLogin, aIP) {
  const oParams = {
    NameLogin: aNameLogin,
    IP: aIP,
  };
  const oSQL = `INSERT INTO FailLogin (NameLogin, IP)
		VALUES (:NameLogin, :IP)`;
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows < 1) throw Error("Auth wAdd_FailLogin: Failed to add record");
}

/** Returns the number of failed login attempts from the specified IP over the
 *  last day. Recall that a succesful login causes failure records to be
 *  deleted. */
async function wCtRecentFailLogin(aIP) {
  const oParams = { IP: aIP };
  const oSQL = `SELECT COUNT(*) AS Ct
		FROM FailLogin
		WHERE IP = :IP
			AND zWhen > DATE_SUB(NOW(), INTERVAL 1 DAY)`;
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows[0].Ct;
}

/** Deletes all login failure records that contain the specified IP. */
async function wClear_FailsLogin(aIP) {
  const oParams = {
    IP: aIP,
  };
  const oSQL = `DELETE FROM FailLogin WHERE IP = :IP`;
  await Conn.wExec(oSQL, oParams);
}

/** Returns currently-blocked IP addresses. Recall that IPs are unblocked
    automatically as the login failures age. */
export async function wIPsBlock() {
  const oSQL = `SELECT *
		FROM (
			SELECT IP, COUNT(IP) AS CtFail
			FROM FailLogin
			WHERE zWhen > DATE_SUB(NOW(), INTERVAL 1 DAY)
			GROUP BY IP
		) AS IPFail
		WHERE IPFail.CtFail >= ?`;
  const [oRows] = await Conn.wExecPrep(oSQL, [CtFailLoginBlock]);
  return oRows;
}

/** Handles a login request. */
export async function wHandPostLogin(aReq, aResp, aNext) {
  function oFlash_BlockIP(aIP) {
    const oMsg = `Please contact ${CoopParams.CoopNameShort} and ask that address <strong>${aIP}</strong> be unblocked`;
    aResp.Show_Flash("danger", "IP address is blocked!", oMsg);
  }

  // Check IP address block
  // ----------------------

  let oCtFailLogin = await wCtRecentFailLogin(aReq.ip);
  if (oCtFailLogin >= CtFailLoginBlock) {
    oFlash_BlockIP(aReq.ip);
    aResp.redirect("/");
    return;
  }

  const owHandAuth = async (aErr, aUser, _aInfo) => {
    if (aErr) {
      aNext(aErr);
      return;
    }

    // Add to login history
    // --------------------

    const oIDMemb = aUser ? aUser.IDMemb : null;
    await wAdd_Login(aReq.ip, aReq.body.NameLogin, oIDMemb);

    // Handle bad username or password
    // -------------------------------

    if (!aUser) {
      await wAdd_FailLogin(aReq.body.NameLogin, aReq.ip);

      if (++oCtFailLogin >= CtFailLoginBlock) {
        oFlash_BlockIP(aReq.ip);
        aResp.redirect("/");
        return;
      }

      aResp.Show_Flash("danger", "Bad username or password!", "Please try again.");
      aResp.redirect("/");
      return;
    }

    // Check member account lock
    // -------------------------

    if (aUser.CkLock) {
      aResp.Show_Flash(
        "danger",
        "This account has been locked!",
        "You may not login until it is unlocked.",
      );
      aResp.redirect("/");
      return;
    }

    // Handle correct username and password
    // ------------------------------------

    await wClear_FailsLogin(aReq.ip);

    switch (aUser.CdRegMemb) {
      // We will allow access for 'Avail' and 'Pend'. 'Registration changes
      // required' messages will be displayed by WareFlashPersist:
      case "Avail":
      case "Pend":
      case "Approv":
        break;

      case "Susp":
        // We don't want staff to lock themselves out:
        if (aUser.CkStaff()) break;

        // The user will be logged-out by WareMembSusp when they next visit:
        aResp.Show_Flash(
          "danger",
          "Account suspended.",
          "You may not login until your membership has been reinstated.",
        );
        aResp.redirect("/");
        return;

      default:
        aResp.Show_Flash(
          "danger",
          "Invalid membership status.",
          `Please contact ${CoopParams.CoopNameShort} for help.`,
        );
        aResp.redirect("/");
        return;
    }

    // Complete login
    // --------------
    try {
      await aReq.login(aUser);
      aResp.redirect("/member");
    } catch (oErr) {
      console.error("login_error:", oErr);
      aNext(oErr);
    }
  };
  const oWareAuth = passport.authenticate("local", owHandAuth);
  oWareAuth(aReq, aResp, aNext);
}

/** Handles a logout request. */
export async function HandGetLogout(aReq, aResp) {
  // This seems like a good idea:
  delete aReq.session.IDMembImper;

  try {
    await aReq.logout();
    aResp.Show_Flash("success", null, "You are now logged-out.");
    aResp.redirect("/");
  } catch (oErr) {
    console.error("logout_error:", oErr);
    aResp.Show_Flash("danger", null, "Logout failed.");
  }
}

async function wConvert_Pass(aNameLogin, aPass) {
  const oSQL = `UPDATE Memb
		SET HashPass = :HashPass, HashPassLeg = NULL
		WHERE Memb.NameLogin = :NameLogin`;
  const oParams = {
    NameLogin: aNameLogin,
    HashPass: await wHash(aPass),
  };
  await Conn.wExecPrep(oSQL, oParams);
}
