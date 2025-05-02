// main.js
// -------
// Client-side utilities and handlers

// Utilities
// ---------

/** This object contains functions Set and Unset, which control the display of
 *  the 'busy' mouse cursor. 'Set' can be called any number of times; the cursor
 *  will be reset when the same number of Unset calls are performed. */
const Busy = (function () {
  let oCtSet = 0;

  return {
    /** Displays the 'busy' mouse cursor. */
    Set: function () {
      ++oCtSet;

      if (oCtSet === 1) {
        $("body").addClass("Busy");
        $("button").addClass("Busy");
      }
    },
    /** Revokes the last Set call. The mouse cursor will be reset when the last
     *  call is revoked. */
    Unset: function () {
      --oCtSet;

      if (oCtSet === 0) {
        $("button").removeClass("Busy");
        $("body").removeClass("Busy");
      }
    },
  };
})();

/** This object contains functions that set or unset 'confirmation flags', which
 *  determine whether the browser requests confirmation before the user
 *  navigates from the page. The confirmation as a whole is disabled when all
 *  flags are unset. */
const ConfirmLeavePage = (function () {
  // The browser confirmation messages are depressingly awkward, and of course
  // they can no longer be customized. Chrome says:
  //
  //   Leave site? Changes you made may not be saved.
  //
  // while Firefox says:
  //
  //   This page is asking you to confirm that you want to leave — information
  //   you’ve entered may not be saved.
  //

  let oCkSetCart = false;
  let oCkSetMain = false;

  function oSet() {
    window.onbeforeunload = function () {
      return true;
    };
  }
  function oCkUnset() {
    if (!oCkSetCart && !oCkSetMain) window.onbeforeunload = null;
  }

  return {
    /** Sets the confirmation flag for the Cart dialog. */
    Set_Cart: function () {
      oCkSetCart = true;
      oSet();
    },
    /** Unsets the confirmation flag for the Cart dialog. */
    Unset_Cart: function () {
      oCkSetCart = false;
      oCkUnset();
    },

    /** Sets the confirmation flag for general page content. */
    Set_Main: function () {
      oCkSetMain = true;
      oSet();
    },
    /** Unsets the confirmation flag for general page content. */
    Unset_Main: function () {
      oCkSetMain = false;
      oCkUnset();
    },
  };
})();

/** Prevents the Cart dialog from being closed with the Esc key or a click
 *  outside the dialog. */
function Set_AllowEscDlgCart() {
  const oDlgCart = $("#DlgCart");
  // This is likely to break when Bootstrap is updated: [Bootstrap]
  oDlgCart.data("bs.modal")._config.backdrop = "static";
  oDlgCart.data("bs.modal")._config.keyboard = false;
}

/** Allows the Cart dialog to closed with the Esc key or a click outside the
 *  dialog. */
function Unset_AllowEscDlgCart() {
  const oDlgCart = $("#DlgCart");
  // This is likely to break when Bootstrap is updated: [Bootstrap]
  oDlgCart.data("bs.modal")._config.backdrop = true;
  oDlgCart.data("bs.modal")._config.keyboard = true;
}

/** Adds a flash messages to aElFlashes, or to the main flash container, if
 *  aElFlashes is not defined. */
function Add_Flash(aSty, aHead, aMsg, aElFlashes) {
  // If no selection is supplied, use the default. Don't worry about whether the
  // selection is empty:
  if (!aElFlashes) aElFlashes = $("#Flashes");

  // This HTML adapted from 'Misc/pFlash.hbs':
  let oHTML = `<div class="Flash alert alert-${aSty} alert-dismissible mb-0" role="alert">
			${aHead ? `<strong>${aHead}</strong>` : ""}
			${aMsg || ""}
			<button type="button" class="close" data-dismiss="alert" aria-label="Close">
				<span aria-hidden="true">&times;</span>
			</button>
		</div>`;
  aElFlashes.append(oHTML);
}

/** Creates a flash message describing a 'fetch' failure, then adds it to
 *  aElFlashes, or the main flash container, if aElFlashes is not defined. */
function Add_FlashFailFetch(aDescReq, aResp, aElFlashes) {
  const oHead = `${aDescReq} failed!`;
  const oMsg = `Status ${aResp.status}, '${aResp.statusText}'`;
  Add_Flash("danger", oHead, oMsg, aElFlashes);
}

/** Empties aElFlashes, or the main flash container, if aElFlashes is not
 *  defined. */
function Clear_Flashes(aElFlashes) {
  if (!aElFlashes) aElFlashes = $("#Flashes");
  aElFlashes.empty();
}

/** Returns the 'fetch' options necessary to pass the CSRF check. */
function OptsFetchCSRF() {
  const oTokCSRF = $("meta[name='csrf-token']").attr("content");

  return {
    headers: {
      "csrf-token": oTokCSRF,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    // So that cookies are included:
    credentials: "same-origin",
  };
}

/** Converts ID-suffixed properties in a FormData instance to an array of
 *  objects. Each object contains an ID property named aNameID, plus all the
 *  fields specified by aNamesFld that were found to be suffixed with that ID. */
function ElsIDFromDataForm(aDataForm, aNameID, aNamesFld) {
  // Contains objects keyed by ID, each containing all the fields associated
  // with that ID:
  const oElsByID = {};

  /** Returns the numeric ID that follows the aPrefix within aName, or 'null' if
   *  the name does not begin with the prefix. */
  function oIDFromName(aName, aPrefix) {
    if (!aName.startsWith(aPrefix)) return null;

    const oID = parseInt(aName.substring(aPrefix.length));
    return isNaN(oID) ? null : oID;
  }

  /** Returns the object within oElsByID that is keyed with the specified ID,
   *  creating and adding it first if it does not exist. */
  function oElFromID(aID) {
    let oEl = oElsByID[aID];
    if (oEl === undefined) {
      oEl = {};
      oElsByID[aID] = oEl;
    }
    return oEl;
  }

  /** Adds the specified form data pair to oElsByID, if the field name matches
   *  aName. Does nothing if the name does not match. The first element element
   *  should give the form field name, the second its value. */
  function oAdd_El(aName, aPairFld) {
    if (aPairFld.length < 2) return;

    const oID = oIDFromName(aPairFld[0], aName);
    if (!oID) return;

    const oEl = oElFromID(oID);
    oEl[aName] = aPairFld[1];
  }

  // When iterated, FormData returns two-element arrays containing the field
  // name and its value:
  for (const oPair of aDataForm) for (const oName of aNamesFld) oAdd_El(oName, oPair);

  // Convert to array
  // ----------------

  const oEls = [];
  for (const oID in oElsByID) {
    const oEl = {
      ...oElsByID[oID],
    };
    oEl[aNameID] = oID;

    oEls.push(oEl);
  }
  return oEls;
}

/** Uses service response data to update parts of the page, including flash
 *  messages. Adds messages to aElFlashes, or to the main flash container, if
 *  aElFlashes is not defined. */
function Upd_Page(aDataResp, aElFlashes) {
  if (!aElFlashes) aElFlashes = $("#Flashes");

  aElFlashes.empty();
  if (aDataResp.Flashes) for (const oHTML of aDataResp.Flashes) aElFlashes.append(oHTML);

  // These elements are replaced with the referenced HTML:
  if (aDataResp.ElsUpd)
    for (const oSel in aDataResp.ElsUpd) {
      const oHTML = aDataResp.ElsUpd[oSel];
      $(oSel).html(oHTML);
    }

  // The referenced HTML blocks are appended to these elements:
  if (aDataResp.ElsAppd)
    for (const oSel in aDataResp.ElsAppd) {
      const oHTMLs = aDataResp.ElsAppd[oSel];
      for (const oHTML of oHTMLs) {
        const oEl = $(oHTML);
        $(oSel).append(oEl);
      }
    }
}

/** Returns the next unused ID suffix for inputs with names that begin with
 *  aRootNameInput, within element aContain. */
function IDInputNext(aContain, aRootName) {
  let oIdxNext = 0;
  const oInputs = aContain.find("input");
  for (const oInput of oInputs) {
    const oName = $(oInput).attr("name");
    if (!oName.startsWith(aRootName)) continue;

    const oTextIdx = oName.slice(aRootName.length);
    const oIdx = parseInt(oTextIdx);
    if (!isNaN(oIdx) && oIdx >= oIdxNext) oIdxNext = oIdx + 1;
  }
  return oIdxNext;
}

// Event handlers
// --------------

/** Removes all non-digit characters from an input.
 *
 *  This handler is applied automatically to all inputs that bear the 'InputQty'
 *  class. It does not prevent blanks from being submitted, so those must be
 *  checked in the 'submit' event, or treated as zeros. */
function Rem_ChNonQty() {
  const oInput = $(this);
  const oVal = oInput.val();
  if (/\D/.test(oVal)) oInput.val(oVal.replace(/\D/g, ""));
}

/** Removes all characters from an input that are not either digits or periods.
 *  Also prevents more than one period from being entered.
 *
 *  This handler is applied automatically to all inputs that bear the 'InputWgt'
 *  class. It does not prevent blanks from being submitted, so those must be
 *  checked in the 'submit' event, or treated as zeros. */
function Rem_ChNonWgt(aEvt) {
  const oInput = $(this);
  let oVal = oInput.val();
  // Remove all invalid characters:
  if (/[^\d.]/.test(oVal)) oVal = oVal.replace(/[^\d.]/g, "");
  // Remove the first period, if there is more than one:
  if (!/^\d*\.?\d*$/.test(oVal)) oVal = oVal.replace(/\./, "");
  oInput.val(oVal);
}

/** Removes all characters from an input that are not either digits or periods cannot be greater than 0.99
 * and less than 0.
 *  Also prevents more than one period from being entered.
 *
 *  This handler is applied automatically to all inputs that bear the 'InputWgt'
 *  class. It does not prevent blanks from being submitted, so those must be
 *  checked in the 'submit' event, or treated as zeros. */
function Rem_ChNonFee(aEvt) {
  const oInput = $(this);
  let oVal = oInput.val();
  // Remove all invalid characters:
  if (/[^\d.]/.test(oVal)) oVal = oVal.replace(/[^\d.]/g, "");
  // Remove the first period, if there is more than one:
  if (!/^\d*\.?\d*$/.test(oVal)) oVal = oVal.replace(/\./, "");
  if (oVal > 0.99) {
    oVal = 0.99;
  }
  if (oVal < 0) {
    oVal = 0;
  }
  oInput.val(oVal);
}

/** Disables all buttons and button links in the page. Calling this from a
//  form's 'onsubmit' will block the second POST otherwise produced by a submit
//  button double-click. */
function Disab_Form() {
  // What about inputs with the 'submit' type? [TO DO]

  // We could check the button 'type' attribute, or pass selectors to this
  // function, but it seems just as good to disable everything:
  $("button").prop("disabled", true);
  $("a.btn").addClass("disabled");
}

// Cart functionality
// ------------------

/** Sends a GET request that obtains the current cart content, then updates cart
 *  elements in the page. */
async function wRefresh_Cart() {
  const oOptsFetch = {
    ...OptsFetchCSRF(),
    method: "GET",
  };

  const oResp = await fetch("/svc-cart", oOptsFetch);
  if (!oResp.ok) {
    Add_FlashFailFetch("Cart refresh request", oResp);
    return;
  }

  const oJSONResp = await oResp.json();
  const oDataResp = JSON.parse(oJSONResp);
  Upd_Page(oDataResp);

  // Any Cart dialog changes have been overwritten:
  ConfirmLeavePage.Unset_Cart();
  Unset_AllowEscDlgCart();
}

/** Sends a POST request that adds one unit of the specified variety to the
 *  cart, then updates page elements with HTML returned by the server. Set
 *  aElFlashes to a container for product dialog flash messages. */
async function wAdd_ItCart(aIDVty, aElFlashes) {
  const oDataReq = {
    IDVty: aIDVty,
    Qty: 1,
  };

  const oOptsFetch = {
    ...OptsFetchCSRF(),
    method: "POST",
    body: JSON.stringify(oDataReq),
  };

  const oResp = await fetch("/svc-cart", oOptsFetch);
  if (!oResp.ok) {
    Add_FlashFailFetch("Cart add request", oResp, aElFlashes);
    return;
  }

  const oJSONResp = await oResp.json();
  const oDataResp = JSON.parse(oJSONResp);

  // The cart may have closed while the page was open. A flash message has been
  // 'sent', so it will appear when the page refreshes. This will also disable
  // the '+1' buttons:
  if (oDataResp.CkRefresh) location.reload();
  else Upd_Page(oDataResp, aElFlashes);
}

/** Sends a PUT request that updates the entire cart, then updates page elements
 *  with HTML returned by the server. */
async function wUpd_Cart(aDataForm) {
  const oNamesFld = ["IDVty", "QtyOrd", "NoteShop"];

  const oDataReq = {
    CdLoc: aDataForm.get("CdLoc"),
    Its: ElsIDFromDataForm(aDataForm, "IDItCart", oNamesFld),
  };

  const oOptsFetch = {
    ...OptsFetchCSRF(),
    method: "PUT",
    body: JSON.stringify(oDataReq),
  };

  const oResp = await fetch("/svc-cart", oOptsFetch);
  if (!oResp.ok) {
    Add_FlashFailFetch("Cart update request", oResp);
    return;
  }

  const oJSONResp = await oResp.json();
  const oDataResp = JSON.parse(oJSONResp);

  // Any Cart dialog changes will be overwritten:
  ConfirmLeavePage.Unset_Cart();
  Unset_AllowEscDlgCart();

  // The cart may have closed while the page was open. A flash message has been
  // 'sent', so it will appear when the page refreshes. This will also disable
  // the inputs:
  if (oDataResp.CkRefresh) location.reload();
  else Upd_Page(oDataResp);
}

/** Handles a variety row '+1' button click. */
async function OnClick_BtnAddCartVty() {
  try {
    Busy.Set();

    const oBtn = $(this);
    const oIDVty = oBtn.data("id-vty");
    $("#BtnAddCartVty" + oIDVty).prop("disabled", true);

    const oIDProduct = oBtn.data("id-product");
    const oDivFlashes = $("#FlashesProduct" + oIDProduct);
    await wAdd_ItCart(Number(oIDVty), oDivFlashes);
  } finally {
    // There is no need to re-enable the button, because the variety row that
    // contains the button will be entirely replaced.

    Busy.Unset();
  }
}

/** Handles a variety row 'Add' button click for the redesigned footer button. */
async function OnClick_CardFooterBtnAddCartVty() {
  try {
    Busy.Set();

    const oBtn = $(this);
    const oIDVty = oBtn.data("id-vty");
    $("#CardFooterBtnAddCartVty" + oIDVty).prop("disabled", true);

    // Create a flash container if it doesn't exist
    let oDivFlashes = $("#FlashesProductAdd");
    if (oDivFlashes.length === 0) {
      $("body").append(
        '<div id="FlashesProductAdd" class="position-fixed" style="top: 20px; right: 20px; z-index: 1050;"></div>',
      );
      oDivFlashes = $("#FlashesProductAdd");
    }

    // Add item directly to cart
    await wAdd_ItCart(Number(oIDVty), oDivFlashes);

    // Add success notification that will auto-dismiss
    setTimeout(() => {
      oDivFlashes.find(".Flash").fadeOut(500, function () {
        $(this).remove();
      });
    }, 3000);
  } finally {
    Busy.Unset();
  }
}

/** Configures the Cart dialog to expect a Cancel or Save button press. */
async function OnChg_FormCart(aEvt) {
  // The controls that use this handler aren't served when the cart is closed,
  // so there is no need to check the shopping window.

  $("#BtnCancelCart").removeClass("d-none");
  $("#BtnSaveCart").removeClass("d-none");
  $("#BtnCloseCart").addClass("d-none");

  // We want the Cart dialog to behave like other dialogs until something is
  // edited; then we want to prevent it from closing unless the user explicitly
  // saves or cancels.
  //
  // Normally, Bootstrap 'modals' close when the Esc key is pressed, or when the
  // user clicks outside the modal. Those behaviors are disabled completely by
  // adding HTML attributes to the modal element:
  //
  //   data-keyboard="false" data-backdrop="static"
  //
  // It might seem that this could be done dynamically with:
  //
  //   $("#DlgCart").data("backdrop", "static").data("keyboard", "false");
  //
  // but it did not work for me. This Stack Overflow answer gives a hack that
  // does work:
  //
  //   https://stackoverflow.com/a/63499508/3728155
  //
  // but apparently, that is almost certain to break when Bootstrap is updated.
  //
  // If necessary, we can go back to disabling the close options permanently.

  Set_AllowEscDlgCart();
  ConfirmLeavePage.Set_Cart();
}

/** Handles the Cart dialog Cancel button press. */
async function OnCancel_FormCart(aEvt) {
  Busy.Set();
  try {
    await wRefresh_Cart();

    $("#DlgCart").modal("hide");

    $("#BtnCancelCart").addClass("d-none");
    $("#BtnSaveCart").addClass("d-none");
    $("#BtnCloseCart").removeClass("d-none");
  } finally {
    Busy.Unset();
  }
}

/** Handles the Cart dialog Save button press. */
async function OnSave_FormCart(aEvt) {
  aEvt.preventDefault();

  Busy.Set();
  // Prevent second POST on double-click:
  $("#BtnSaveCart").prop("disabled", true);
  try {
    await wUpd_Cart(new FormData($(this)[0]));

    $("#DlgCart").modal("hide");

    $("#BtnCancelCart").addClass("d-none");
    $("#BtnSaveCart").addClass("d-none");
    $("#BtnCloseCart").removeClass("d-none");
  } finally {
    $("#BtnSaveCart").prop("disabled", false);
    Busy.Unset();
  }
}
