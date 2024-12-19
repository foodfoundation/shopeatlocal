/** Configuration and Reference Data Module
 *  @module Site
 *  @description Manages site configuration and reference data caching
 *  @note Time-dependent data should be calculated per request
 */

import { wSite, wLocs, wCats, wSubcats } from "./Db.js";
import { Copy_Props } from "./Util.js";
import { getSanityClient } from "./Sanity.js";

/** @type {Object} Global site configuration */
export const Site = {};

/** @type {Object} Location lookup by code */
export const Locs = {};

/** @type {Object} Active locations lookup by code */
export const LocsActiv = {};

/** @type {Object} Category lookup by ID */
export const Cats = {};

/** @type {Object} Subcategory lookup by ID */
export const Subcats = {};

/** @type {Object} Cooperative parameters */
export const CoopParams = {};

/** Populates location lookups
 *  @param {Array<Object>} aLocs - Location records
 */
function fillLocs(aLocs) {
  for (const oLoc of aLocs) {
    Locs[oLoc.CdLoc] = oLoc;
    if (oLoc.CkActiv) LocsActiv[oLoc.CdLoc] = oLoc;
  }
}

/** Populates category lookup
 *  @param {Array<Object>} aCats - Category records
 */
function fillCats(aCats) {
  for (const oCat of aCats) {
    Cats[oCat.IDCat] = oCat;
  }
}

/** Populates subcategory lookup
 *  @param {Array<Object>} aSubcats - Subcategory records
 */
function fillSubcats(aSubcats) {
  for (const oSubcat of aSubcats) {
    Subcats[oSubcat.IDSubcat] = oSubcat;
  }
}

/** Initializes configuration and reference data
 *  @async
 *  @returns {Promise<void>} Resolves when initialization completes
 */
export async function wReady() {
  // Site table values
  // -----------------

  Copy_Props(Site, await wSite());

  const oRowsLoc = await wLocs();
  fillLocs(oRowsLoc);

  // Product categories
  // ------------------

  const oRowsCat = await wCats();
  fillCats(oRowsCat);

  // Product subcategories
  // ---------------------

  const oRowsSubcat = await wSubcats();
  fillSubcats(oRowsSubcat);

  // Coop parameters
  // ---------------
  const sanityClient = getSanityClient();
  const [
    coopDataTemaptes,
    informationTemplates,
    emailTemplates,
    productTypesPageMetadata,
    staticPagesMetadata,
  ] = await Promise.all([
    sanityClient.queryCoopParamsFromSanity(),
    sanityClient.queryInformationTemplates(),
    sanityClient.queryEmailTemplates(),
    sanityClient.queryProductTypesPageContent(),
    sanityClient.queryStaticPagesMetadata(),
  ]);

  const coopData = {
    ...coopDataTemaptes,
    ...informationTemplates,
    ...emailTemplates,
    isProductTypesPageDefined: productTypesPageMetadata.isDefined,
    staticPages: staticPagesMetadata,
  };

  Copy_Props(CoopParams, coopData);
}
