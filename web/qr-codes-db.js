import sqlite3 from "sqlite3";
import path from "path";
import shopify from "./shopify.js";

const DEFAULT_DB_FILE = path.join(process.cwd(), "qr_codes_db.sqlite");
const DEFAULT_PURCHASE_QUANTITY = 1;

export const QRCodesDB = {
  qrCodesTableName: "qr_codes",
  db: null,
  ready: null,

  create: async function ({
    shopDomain,
    title,
    productId,
    variantId,
    handle,
    discountId,
    discountCode,
    destination,
  }) {
    await this.ready;

    const query = `
    INSERT INTO ${this.qrCodesTableName}
    (shopDomain, title, productId, variantId,
    handle, discountId, discountCode, destination, 
    scans)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0)
    RETURNING id;
    `;

    const rawResults = await this.__query(query, [
      shopDomain,
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination
    ]);
    return rawResults[0].id;
  },

  update: async function (
    id,
    {
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination,
    }
  ) {
    await this.ready;

    const query = `
    UPDATE ${this.qrCodesTableName}
    SET 
      title = ?,
      productId = ?,
      variantId = ?.
      handle = ?,
      discountId = ?,
      discountCode = ?,
      destination = ?
    WHERE 
      id = ?;
    `;
    await this.__query(query, [
      title,
      productId,
      variantId,
      handle,
      discountId,
      discountCode,
      destination,
      id,
    ]);
    return true;
  },

  list: async function (shopDomain) {
    await this.ready;
    const query = `
    SELECT * FROM ${this.qrCodesTableName}
    WHERE shopDomain = ?;
    `;

  const results = await this.__query(query, [shopDomain]);
  return results.map((qrcode) => 
  this.__addImageUrl(qrcode));
  },

  read: async function (id) {
    await this.ready;
    const query = `
      SELECT * FROM ${this.qrCodesTableName}
      WHERE id = ?;
    `;
    const rows = await this.__query(query, [id]);
    if (!Array.isArray(rows) || rows?.length !== 1) 
    return undefined;

    return this.__addImageUrl(rows[0]);
  },

  delete: async function (id) {
    await this.ready;
    const query = `
      DELETE FROM ${this.qrCodesTableName}
      WHERE id = ?;  
    `;
    await this.__query(query, [id]);
    return true
  },

  generateQrCodeDestinationUrl: function (qrcode) 
  {
    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/scan
    `;
  },

  handleCodeScan: async function (qrcode) {
    await this.__increaseScanCount(qrcode);
    const url = new URL(qrcode.shopDomain);
    switch(qrcode.destination) {
      case "product":
        return this.__goToProductView(url, qrcode);
      case "checkout":
        return this.__goToProductCheckout(url, qrcode);
      default:
        throw `Unrecognized destination 
        "${qrcode.destination}"`;
    }
  },

  __hasQrCodesTable: async function () {
    const query = `
    SELECT name FROM sqlite_schema
    WHERE 
      type = 'table' AND
      name = ?;
    `;
    const rows = await this.__query(query, [this.qrCodesTableName]);
    return rows.length === 1;
  },

  init: async function () {
    this.db = this.db ?? new
    sqlite3.Database(DEFAULT_DB_FILE);

    const hasQrCodesTable = await
    this.__hasQrCodesTable();

    if (hasQrCodesTable) {
      this.ready = Promise.resolve();
    } else {
      const query = `
        CREATE TABLE ${this.qrCodesTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
          shopDomain VARCHAR(511) NOT NULL,
          title VARCHAR(511) NOT NULL,
          productId VARCHAR(255) NOT NULL,
          variantId VARCHAR(255) NOT NULL,
          handle VARCHAR(255) NOT NULL,
          discountId VARCHAR(255) NOT NULL,
          discountCode VARCHAR(255) NOT NULL,
          destination VARCHAR(255) NOT NULL,
          scans INTEGER,
          createdAt DATETIME NOT NULL DEFAULT
          (datetime(CURRENT_TIMESTAMP,
          'localtime'))
        )
      `;
      this.ready = this.__query(query);
    }
  },

  __query: function(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },

  __addImageUrl: function (qrcode) {
    try {
      qrcode.imageUrl = 
      this.__generateQrCodeImageUrl(qrcode);
    } catch (err) {
      console.error(err);
    }
    return qrcode;
  },

  __generateQrCodeImageUrl: function (qrcode) {
    return `${shopify.api.config.hostScheme}://${shopify.api.config.hostName}/qrcodes/${qrcode.id}/image`;
  },

  __increaseScanCount: async function (qrcode) {
    const query = `
      UPDATE ${this.qrCodesTableName}
      SET scans = scans + 1
      WHERE id = ?
    `;
    await this.__query(query, [qrcode.id]);
  },

  __goToProductView: function (url, qrcode) {
    return productViewURL({
      discountCode: qrcode.discountCode,
      host: url.toString(),
      productHandle: qrcode.handle,
    });
  },

  __goToProductCheckout: function (url, qrcode) {
    return productCheckoutURL({
      discountCode: qrcode.discountCode,
      host: url.toString(),
      variantId: qrcode.variantId,
      quantity: DEFAULT_PURCHASE_QUANTITY,
    });
  },
};

function productViewURL({ host, productHandle, discountCode }) {
  const url = new URL(host);
  const productPath = `/products/${productHandle}`;

  if (discountCode) {
    url.pathname = `/discount/${discountCode}`;
    url.searchParams.append("redirect", 
    productPath);
  } else {
    url.pathname = productPath;
  }

  return url.toString();
}

function productCheckoutURL({ host, variantId, quantity = 1, discountCode }) {
  const url = new URL(host);
  const id = variantId.replace(/gid:\/\/shopify\/ProductVariant\/([0-9])+/,"$1");

  url.pathname = `/cart/${id}:${quantity}`;

  if (discountCode) {
    url.searchParams.append("discount", discountCode);
  }

  return url.toString();
}