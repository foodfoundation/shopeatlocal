// filt-product.js
// ---------------
// Product filtering for Producer Catalog and Inventory
//
// It would be easier to submit filter choices as query parameters, and then
// filter and format on the server side. However, the Producer Inventory page is
// already a form, and we definitely do not want to submit the producer's edits
// every time the change a filter option.
//
// I used CSS selectors and the 'display' property to show or hide product and
// variety elements. Unfortunately, that breaks the CSS row striping, which
// seems to ignore the element display status. A better implementation would
// move those elements to or from the DOM, but that would be much more work.
//
// Subcategory headings remain visible even when all their child products have
// been hidden. This can be fixed by grouping the products by subcategory, and
// then compiling subcategory properties, the same way product properties are
// compiled from varieties. Doesn't seem worth the effort, however.

/** The page that is using the product filter. This should be set to 'Invt' or
 * 'Catalog'. */
let PageFiltProduct = "Unknown";

/** Returns the name of the local storage item. */
function NameStoreOptsFilt() {
  return "OptsFilt" + PageFiltProduct;
}

/** Returns the filter options stored in local storage, or the default values,
 * where those options are missing. */
function OptsFiltStoreOrDef() {
  const oOptsDef = {
    CkShowList: true,
    CkShowUnlist: true,
    CkShowArchiv: false,
    CkHideNoOrd: false,
  };

  const oText = localStorage.getItem(NameStoreOptsFilt());
  const oOpts = JSON.parse(oText);
  if (!oOpts) return oOptsDef;

  if (oOpts.CkShowList === undefined) oOpts.CkShowList = oOptsDef.CkShowList;
  if (oOpts.CkShowUnlist === undefined) oOpts.CkShowUnlist = oOptsDef.CkShowUnlist;
  if (oOpts.CkShowArchiv === undefined) oOpts.CkShowArchiv = oOptsDef.CkShowArchiv;
  if (oOpts.CkHideNoOrd === undefined) oOpts.CkHideNoOrd = oOptsDef.CkHideNoOrd;

  return oOpts;
}

/** Stores the specified filter options in local storage. */
function Store_OptsFilt(aOpts) {
  const oText = JSON.stringify(aOpts);
  localStorage.setItem(NameStoreOptsFilt(), oText);
}

/** Returns the filter options selected in the page. */
function OptsFiltPage() {
  return {
    CkShowList: $("#CkShowList").prop("checked"),
    CkShowUnlist: $("#CkShowUnlist").prop("checked"),
    CkShowArchiv: $("#CkShowArchiv").prop("checked"),
    CkHideNoOrd: $("#CkHideNoOrd").prop("checked"),
  };
}

/** Selects the specified filter options in the page. */
function Sel_Filt(aOpts) {
  $("#CkShowList").prop("checked", aOpts.CkShowList);
  $("#CkShowUnlist").prop("checked", aOpts.CkShowUnlist);
  $("#CkShowArchiv").prop("checked", aOpts.CkShowArchiv);
  $("#CkHideNoOrd").prop("checked", aOpts.CkHideNoOrd);
}

/** Applies the specified filter options to the product and variety elements. */
function Apply_Filt(aOpts) {
  function oShow(aSel, aCk) {
    const oDisp = aCk ? "block" : "none";
    $(aSel).css("display", oDisp);
  }

  const oCkShowList = aOpts.CkShowList;
  const oCkShowUnlist = aOpts.CkShowUnlist;
  const oCkShowArchiv = aOpts.CkShowArchiv;
  const oCkShowNoOrd = !aOpts.CkHideNoOrd;

  oShow(".Product", false);

  // Unlike variety elements, products can bear multiple 'CkContain' classes, so
  // we can't just hide the individual classes we don't want to see. Instead, we
  // must hide all the products, then reveal the ones with classes we want:
  if (oCkShowList) {
    oShow(".Product.CkContainList.Ord", true);
    if (oCkShowNoOrd) oShow(".Product.CkContainList.NoOrd", true);
  }
  oShow(".Vty.List.Ord", oCkShowList);
  oShow(".Vty.List.NoOrd", oCkShowList && oCkShowNoOrd);

  if (oCkShowUnlist) {
    oShow(".Product.CkContainUnlist.Ord", true);
    if (oCkShowNoOrd) oShow(".Product.CkContainUnlist.NoOrd", true);
  }
  oShow(".Vty.Unlist.Ord", oCkShowUnlist);
  oShow(".Vty.Unlist.NoOrd", oCkShowUnlist && oCkShowNoOrd);

  if (oCkShowArchiv) {
    oShow(".Product.CkContainArchiv.Ord", true);
    if (oCkShowNoOrd) oShow(".Product.CkContainArchiv.NoOrd", true);
  }
  oShow(".Vty.Archiv.Ord", oCkShowArchiv);
  oShow(".Vty.Archiv.NoOrd", oCkShowArchiv && oCkShowNoOrd);
}

/** Handles a filter control change. */
function Hand_ChgFilt() {
  const oOpts = OptsFiltPage();
  Apply_Filt(oOpts);
  Store_OptsFilt(oOpts);
}

/** Handles a Show All button press. */
function Hand_ClickShowAll() {
  const oOpts = {
    CkShowList: true,
    CkShowUnlist: true,
    CkShowArchiv: true,
    CkHideNoOrd: false,
  };
  Store_OptsFilt(oOpts);
  Apply_Filt(oOpts);
  Sel_Filt(oOpts);
}

/** Restores the product filtering options from local storage and applies them
 * to the page. */
function Ready_Filt() {
  const oOpts = OptsFiltStoreOrDef();
  Apply_Filt(oOpts);
  Sel_Filt(oOpts);
}
