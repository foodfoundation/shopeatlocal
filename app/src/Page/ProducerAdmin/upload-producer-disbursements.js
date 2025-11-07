// upload-producer-disbursements.js
// ---------------------------------
// Upload Producer Disbursements controllers

import { parse } from "csv-parse/sync";
import { wAdd_Transact, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

/**
 * Parse CSV content into an array of objects using csv-parse
 * @param {string} csvContent - The CSV file content
 * @returns {Array} Array of parsed rows
 */
function parseCSV(csvContent) {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    });

    if (!records || records.length === 0) {
      throw new Error("CSV file is empty or contains no data rows");
    }

    return records;
  } catch (err) {
    throw new Error(`CSV parsing failed: ${err.message}`);
  }
}

/**
 * Validate CSV row against schema
 * @param {Object} row - CSV row object
 * @param {number} rowIndex - Row index for error messages
 * @returns {Object} Validation result {valid: boolean, errors: Array, data: Object}
 */
function validateRow(row, rowIndex) {
  const errors = [];
  const data = {};

  // producer_id (required, number)
  if (!row.producer_id || row.producer_id.trim() === "") {
    errors.push(`Row ${rowIndex}: producer_id is required`);
  } else {
    const producerId = parseInt(row.producer_id, 10);
    if (isNaN(producerId)) {
      errors.push(`Row ${rowIndex}: producer_id must be a number`);
    } else {
      data.producer_id = producerId;
    }
  }

  // business_name (optional, ignored)
  // Not stored in data object

  // transaction_type (optional, but if provided must be "Payment disbursement")
  if (row.transaction_type && row.transaction_type.trim() !== "") {
    const transType = row.transaction_type.trim();
    if (transType !== "Payment disbursement") {
      errors.push(`Row ${rowIndex}: transaction_type must be "Payment disbursement" if provided`);
    }
  }

  // payment_method (required, must be Cash, Check, or PayPal)
  if (!row.payment_method || row.payment_method.trim() === "") {
    errors.push(`Row ${rowIndex}: payment_method is required`);
  } else {
    const method = row.payment_method.trim();
    const validMethods = ["Cash", "Check", "PayPal"];
    if (!validMethods.includes(method)) {
      errors.push(`Row ${rowIndex}: payment_method must be one of: ${validMethods.join(", ")}`);
    } else {
      data.payment_method = method;
    }
  }

  // amount (required, float)
  if (!row.amount || row.amount.trim() === "") {
    errors.push(`Row ${rowIndex}: amount is required`);
  } else {
    const amount = parseFloat(row.amount);
    if (isNaN(amount)) {
      errors.push(`Row ${rowIndex}: amount must be a number`);
    } else {
      data.amount = amount;
    }
  }

  // note (optional, sanitized)
  if (row.note && row.note.trim() !== "") {
    // Trim and limit length to prevent SQL injection and excessive data
    data.note = row.note.trim().substring(0, 500);
  }

  return {
    valid: errors.length === 0,
    errors,
    data,
  };
}

/**
 * Validate producer IDs exist in database in chunks
 * @param {Array} producerIds - Array of producer IDs to validate
 * @param {Object} aConn - Database connection
 * @returns {Object} {valid: boolean, errors: Array, producerToMemberMap: Map}
 */
async function validateProducerIds(producerIds, aConn) {
  const uniqueIds = [...new Set(producerIds)];
  const errors = [];
  const producerToMemberMap = new Map();
  const chunkSize = 50;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");

    const oSQL = `
      SELECT Producer.IDProducer, Producer.IDMemb
      FROM Producer
      WHERE Producer.IDProducer IN (${placeholders})
        AND Producer.CdRegProducer = 'Approv'
    `;

    const [rows] = await aConn.wExecPrep(oSQL, chunk);
    rows.forEach(row => producerToMemberMap.set(row.IDProducer, row.IDMemb));
  }

  // Check which IDs were not found
  const invalidIds = uniqueIds.filter(id => !producerToMemberMap.has(id));
  if (invalidIds.length > 0) {
    errors.push(
      `The following producer IDs were not found or not approved: ${invalidIds.join(", ")}`,
    );
  }

  return {
    valid: invalidIds.length === 0,
    errors,
    producerToMemberMap,
  };
}

/**
 * Fetch transaction details for display
 * @param {Array} transactionIds - Array of transaction IDs to fetch
 * @param {Object} aConn - Database connection
 * @returns {Array} Array of transaction objects with full details
 */
async function wFetchTransactions(transactionIds, aConn) {
  if (transactionIds.length === 0) return [];
  
  const placeholders = transactionIds.map(() => '?').join(',');
  
  const oSQL = `SELECT Transact.*,
      Memb.Name1First, Memb.Name1Last,
      Producer.NameBus AS NameBusProducer, Producer.CdProducer,
      MembCreate.Name1First AS Name1FirstCreate,
      MembCreate.Name1Last AS Name1LastCreate
    FROM Transact
    LEFT JOIN Memb USING (IDMemb)
    LEFT JOIN Producer ON Transact.IDProducer = Producer.IDProducer
    LEFT JOIN Memb AS MembCreate
      ON MembCreate.IDMemb = Transact.IDMembStaffCreate
    WHERE Transact.IDTransact IN (${placeholders})
    ORDER BY Transact.WhenCreate DESC`;
  
  const [transactions] = await aConn.wExecPrep(oSQL, transactionIds);
  
  return transactions;
}

/**
 * GET handler - Display upload form
 */
export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
  aResp.render("ProducerAdmin/upload-producer-disbursements");
}

/**
 * POST handler - Process uploaded CSV file
 */
export async function wHandPost(aReq, aResp) {
  try {
    // Check if file was uploaded
    if (!aReq.file) {
      aResp.locals.Errors = ["No file uploaded. Please select a CSV file."];
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
      return;
    }

    // Read and parse CSV file
    const csvContent = aReq.file.buffer.toString("utf-8");
    let parsedRows;

    try {
      parsedRows = parseCSV(csvContent);
    } catch (err) {
      aResp.locals.Errors = [`CSV parsing error: ${err.message}`];
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
      return;
    }

    if (parsedRows.length === 0) {
      aResp.locals.Errors = ["CSV file contains no data rows"];
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
      return;
    }

    // Validate each row
    const allErrors = [];
    const validatedData = [];
    const producerIds = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const result = validateRow(parsedRows[i], i + 2); // +2 because row 1 is header, and we're 0-indexed

      if (!result.valid) {
        allErrors.push(...result.errors);
      } else {
        validatedData.push(result.data);
        producerIds.push(result.data.producer_id);
      }
    }

    // If there are validation errors, show them
    if (allErrors.length > 0) {
      aResp.locals.Errors = allErrors;
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
      return;
    }

    // Validate producer IDs exist in database
    const producerValidation = await validateProducerIds(producerIds, Conn);

    if (!producerValidation.valid) {
      aResp.locals.Errors = producerValidation.errors;
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
      return;
    }

    // All validations passed - create transactions
    const staffUserId = aResp.locals.CredUser.IDMemb;
    let successCount = 0;
    const createdTransactionIds = [];

    for (const data of validatedData) {
      try {
        // Get the member ID from the producer ID
        const memberId = producerValidation.producerToMemberMap.get(data.producer_id);

        // Create PaySent transaction (negative amount for producer payment out)
        await wAdd_Transact(
          memberId,
          "PaySent",
          -Math.abs(data.amount), // Ensure negative for payment out
          0, // EBT amount
          staffUserId, // Created by staff user
          {
            IDProducer: data.producer_id,
            CdMethPay: data.payment_method,
            Note: data.note || "Producer disbursement",
          },
          null, // Use default connection
        );
        
        // Get the last inserted transaction ID
        const [result] = await Conn.wExecPrep('SELECT LAST_INSERT_ID() as IDTransact');
        createdTransactionIds.push(result[0].IDTransact);
        successCount++;
      } catch (err) {
        allErrors.push(
          `Failed to create transaction for producer ${data.producer_id}: ${err.message}`,
        );
      }
    }

    // Show results
    if (allErrors.length > 0) {
      aResp.locals.Errors = allErrors;
      aResp.locals.SuccessCount = successCount;
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
    } else {
      // Fetch the created transactions with full details
      const transactions = await wFetchTransactions(createdTransactionIds, Conn);
      
      aResp.locals.SuccessMessage = `${successCount} producer disbursement(s) processed successfully.`;
      aResp.locals.Transacts = transactions;
      aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
      aResp.render("ProducerAdmin/upload-producer-disbursements");
    }
  } catch (err) {
    aReq.Err(`upload-producer-disbursements: ${err.message}`);
    aResp.locals.Errors = [`An unexpected error occurred: ${err.message}`];
    aResp.locals.Title = `${CoopParams.CoopNameShort} upload producer disbursements`;
    aResp.render("ProducerAdmin/upload-producer-disbursements");
  }
}
