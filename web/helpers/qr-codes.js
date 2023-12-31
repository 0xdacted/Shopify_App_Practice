import shopify from "../shopify.js";
import { QRCodesDB } from "../qr-codes-db.js";

const QR_CODE_ADMIN_QUERY = `
  query nodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        handle
        title
        images(first: 1) {
          edges {
            node {
              url
            }
          }
        }
      }
      ... on ProductVariant {
        id
      }
      ... on DiscountCodeNode {
        id
      }
    }
  }
`;

export async function getQrCodeOr404(req, res, checkDomain = true) {
  try {
    const response = await 
    QRCodesDB.read(req.params.id);
    if (
      response === undefined || 
      (checkDomain && 
        (await getShopUrlFromSession(res, res))
        !== response.shopDomain)
    ) {
      res.status(404).send();
    } else {
      return response;
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
  return undefined;
}

export async function getShopUrlFromSession(req, res) {
  return `https://${res.locals.shopify.session.shop}`;
}

export async function parseQrCodeBody(req, res) {
  return {
    title: req.body.title,
    productId: req.body.productId,
    variantId: req.body.variantId,
    handle: req.body.handle,
    discountId: req.body.discountId,
    discountCode: req.body.discountCode,
    destination: req.body.destination,
  };
}

export async function formatQrCodeResponse(req, res, rawCodeData) {
  const ids = [];

  rawCodeData.forEach(({ productId, discountId, variantId }) => {
    ids.push(productId);
    ids.push(variantId);

    if (discountId) {
      ids.push(discountId);
    }
  });

  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const adminData = await client.query({
    data: {
      query: QR_CODE_ADMIN_QUERY,
      variables: { ids },
    },
  });

  const formattedData = rawCodeData.map((qrCode) => {
    const product = 
    adminData.body.data.nodes.find(
      (node) => qrCode.productId === node?.id
      ) || {
        title: "Deleted product",
      };
    
      const discountDeleted = 
        qrCode.discountId &&
        !adminData.body.data.nodes.find((node) => 
        qrCode.discountId === node?.id);
      
      if (discountDeleted) {
        QRCodesDB.update(qrCode.id, {
          ...qrCode,
          discountId: "",
          discountCode: "",
        });
      }

      const formattedQRCode = {
        ...qrCode,
        product,
        discountCode: discountDeleted ? "" : 
        qrCode.discountCode,
      };

      delete formattedQRCode.productId;
      
      return formattedQRCode; 
    });
  return formattedData
}