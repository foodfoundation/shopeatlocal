/** Producer Reports Module
 *  @module producer-reports
 *  @requires Db
 *  @requires Site
 */

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

/** GET handler for producer reports interface
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders producer reports view
 */
export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} Producer Reports`;
  // Initial page load - render empty page, data will be fetched via API
  aResp.render("Producer/producer-reports");
}

/** API endpoint to fetch producer reports data with pagination and filters
 *  IDProducer is taken from server-side session for security
 *  @param {Request} aReq - Express request with query params
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Returns JSON with data and pagination info
 */
export async function wHandGetData(aReq, aResp) {
  try {
    // Get producer ID from server-side session (NOT from client request for security)
    const producerId = aResp.locals.CredSelImperUser.IDProducer;

    if (!producerId) {
      return aResp.status(403).json({ error: "Producer ID not found in session" });
    }

    const page = parseInt(aReq.query.page) || 1;
    const limit = parseInt(aReq.query.limit) || 50;
    const startDate = aReq.query.startDate;
    const endDate = aReq.query.endDate;
    const cycleFrom = aReq.query.cycleFrom ? parseInt(aReq.query.cycleFrom) : null;
    const cycleTo = aReq.query.cycleTo ? parseInt(aReq.query.cycleTo) : null;

    const result = await wGetProducerReport({
      producerId,
      page,
      limit,
      startDate,
      endDate,
      cycleFrom,
      cycleTo,
    });
    aResp.json(result);
  } catch (error) {
    console.error("Error fetching producer report data:", error);
    aResp.status(500).json({ error: "Failed to fetch producer report data" });
  }
}

/** Retrieves sales data for a specific producer with pagination and filters
 *  @param {Object} options - Query options
 *  @param {number} options.producerId - Producer ID (required, from server session)
 *  @param {number} options.page - Page number (1-indexed)
 *  @param {number} options.limit - Number of records per page
 *  @param {string} options.startDate - Start date filter (ISO format)
 *  @param {string} options.endDate - End date filter (ISO format)
 *  @param {number} options.cycleFrom - Minimum cycle ID filter
 *  @param {number} options.cycleTo - Maximum cycle ID filter
 *  @returns {Promise<Object>} Object containing data array, pagination info, and metadata
 */
const wGetProducerReport = async function (options = {}) {
  const { producerId, page = 1, limit = 50, startDate, endDate, cycleFrom, cycleTo } = options;
  const offset = (page - 1) * limit;

  // Build WHERE clause conditions - always include producer ID for security
  let whereConditions = ["Producer.IDProducer = ?"];
  const params = [producerId];

  // Add date filter if provided
  if (startDate) {
    whereConditions.push("Cyc.WhenStartCyc >= ?");
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push("Cyc.WhenEndCyc <= ?");
    params.push(endDate);
  }

  // Add cycle ID range filter if provided
  if (cycleFrom !== null && cycleFrom !== undefined) {
    whereConditions.push("Cyc.IDCyc >= ?");
    params.push(cycleFrom);
  }
  if (cycleTo !== null && cycleTo !== undefined) {
    whereConditions.push("Cyc.IDCyc <= ?");
    params.push(cycleTo);
  }

  const whereClause = whereConditions.join(" AND ");

  // For the onsite query, we need to handle the Cart.IDCyc -> CO.IDCyc replacement
  // but also keep the Producer.IDProducer condition unchanged
  const whereClauseOnsite = whereConditions
    .map(cond => cond.replace(/Cart\.IDCyc/g, "CO.IDCyc"))
    .join(" AND ");

  // First, get the total count
  const countSQL = `
    SELECT COUNT(*) as total
    FROM (
      (
        SELECT 1
        FROM ItCart
          JOIN Cart ON ItCart.IDCart = Cart.IDCart
          JOIN Cyc ON Cart.IDCyc = Cyc.IDCyc
          JOIN Vty ON ItCart.IDVty = Vty.IDVty
          JOIN Product ON Vty.IDProduct = Product.IDProduct
          JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
          JOIN Cat ON Subcat.IDCat = Cat.IDCat
          JOIN Producer ON Product.IDProducer = Producer.IDProducer
          JOIN Memb ON Cart.IDMemb = Memb.IDMemb
          JOIN Loc on Cart.CdLoc = Loc.CdLoc
        WHERE ${whereClause}
      )
      UNION ALL
      (
        SELECT 1
        FROM ItCartOnsite
          JOIN CartOnsite CO ON ItCartOnsite.IDCartOnsite = CO.IDCartOnsite
          JOIN Cyc ON CO.IDCyc = Cyc.IDCyc
          JOIN Vty ON ItCartOnsite.IDVty = Vty.IDVty
          JOIN Product ON Vty.IDProduct = Product.IDProduct
          JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
          JOIN Cat ON Subcat.IDCat = Cat.IDCat
          JOIN Producer ON Product.IDProducer = Producer.IDProducer
          JOIN Memb ON CO.IDMembShop = Memb.IDMemb
        WHERE ${whereClauseOnsite}
      )
    ) as count_result;`;

  const countResult = await Conn.wExecPrep(countSQL, params.concat(params));
  const totalRecords = countResult[0][0].total;

  // Now get the paginated data
  const dataSQL = `
    SELECT
      saleSource,
      NameLoc as location,
      QtyDeliv,
      SaleNom,
      FeeCoop,
      FeeCoopForgiv,
      TaxSale,
      IDVty,
      IDCyc,
      WhenStartCyc,
      WhenEndCyc,
      NameCat,
      NameSubcat,
      NameProduct,
      IDProduct,
      IDMemb,
      CustomerName,
      CustEmail,
      CustPhone
    FROM (
      (
        SELECT
          CONCAT('web') as saleSource,
          Loc.NameLoc,
          ItCart.QtyDeliv,
          ItCart.SaleNom,
          ItCart.FeeCoop,
          ItCart.FeeCoopForgiv,
          ItCart.TaxSale,
          CONCAT(0) as FeeCoopProducer,
          CONCAT(0) as FeeInvt,
          Vty.IDVty,
          Cyc.IDCyc,
          Cyc.WhenStartCyc,
          Cyc.WhenEndCyc,
          Cat.NameCat,
          Subcat.NameSubcat,
          Product.NameProduct,
          Product.IDProduct,
          Memb.IDMemb,
          IF(Memb.CkAllowPublicName, CONCAT(Memb.Name1First, ' ',  Memb.Name1Last), '-') as CustomerName,
          IF(Memb.CkAllowPublicName, Memb.Email1, '-') as CustEmail,
          IF(Memb.CkAllowPublicName, Memb.Phone1, '-') as CustPhone
        FROM
          ItCart
            JOIN Cart ON ItCart.IDCart = Cart.IDCart
            JOIN Cyc ON Cart.IDCyc = Cyc.IDCyc
            JOIN Vty ON ItCart.IDVty = Vty.IDVty
            JOIN Product ON Vty.IDProduct = Product.IDProduct
            JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
            JOIN Cat ON Subcat.IDCat = Cat.IDCat
            JOIN Producer ON Product.IDProducer = Producer.IDProducer
            JOIN Memb ON Cart.IDMemb = Memb.IDMemb
            JOIN Loc on Cart.CdLoc = Loc.CdLoc
        WHERE ${whereClause}
      )
      UNION ALL
      (
        SELECT
          CONCAT('onsite') as saleSource,
          CONCAT('Franklin Plaza') as NameLoc,
          ItCartOnsite.Qty as QtyDeliv,
          ItCartOnsite.SaleNom,
          ItCartOnsite.FeeCoopShop,
          ItCartOnsite.FeeCoopShopForgiv,
          ItCartOnsite.TaxSale,
          ItCartOnsite.FeeCoopProducer,
          ItCartOnsite.FeeInvt,
          ItCartOnsite.IDVty,
          Cyc.IDCyc,
          Cyc.WhenStartCyc,
          Cyc.WhenEndCyc,
          Cat.NameCat,
          Subcat.NameSubcat,
          Product.NameProduct,
          Product.IDProduct,
          Memb.IDMemb,
          IF(Memb.CkAllowPublicName, CONCAT(Memb.Name1First, ' ',  Memb.Name1Last), '-') as CustomerName,
          IF(Memb.CkAllowPublicName, Memb.Email1, '-') as CustEmail,
          IF(Memb.CkAllowPublicName, Memb.Phone1, '-') as CustPhone
        FROM
          ItCartOnsite
            JOIN CartOnsite CO ON ItCartOnsite.IDCartOnsite = CO.IDCartOnsite
            JOIN Cyc ON CO.IDCyc = Cyc.IDCyc
            JOIN Vty ON ItCartOnsite.IDVty = Vty.IDVty
            JOIN Product ON Vty.IDProduct = Product.IDProduct
            JOIN Subcat ON Product.IDSubcat = Subcat.IDSubcat
            JOIN Cat ON Subcat.IDCat = Cat.IDCat
            JOIN Producer ON Product.IDProducer = Producer.IDProducer
            JOIN Memb ON CO.IDMembShop = Memb.IDMemb
        WHERE ${whereClauseOnsite}
      )
    ) as result
    ORDER BY IDCyc DESC, IDProduct
    LIMIT ? OFFSET ?;`;

  const allParams = params.concat(params).concat([limit, offset]);
  const dataResult = await Conn.wExecPrep(dataSQL, allParams);

  return {
    data: dataResult[0],
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
    },
    filters: {
      startDate: startDate || null,
      endDate: endDate || null,
      cycleFrom: cycleFrom || null,
      cycleTo: cycleTo || null,
    },
  };
};
