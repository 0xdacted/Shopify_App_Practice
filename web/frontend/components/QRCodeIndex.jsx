import { useNavigate } from "@shopify/app-bridge-react";
import {
  Card,
  Icon,
  IndexTable,
  Stack,
  TextStyle,
  Thumbnail,
  UnstyledLink,
} from "@shopify/polaris";
import { DiamondAlertMajor, ImageMajor } from "@shopify/polaris-icons";
import { useMedia } from "@shopify/react-hooks";
import dayjs from "dayjs";

function SmallScreenCard({
  id,
  title,
  product,
  discountCode,
  scans,
  createdAt,
  navigate,
}) {
  return (
    <UnstyledLink onClick={() => 
    navigate(`/qrcodes/${id}`)}>
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E1E3e5"}}>
        <Stack>
          <Stack.item>
            <Thumbnail
              source={product?.images?.edges[0]?.node?.url || ImageMajor}
              alt="placeholder"
              color="base"
              size="small"
            />
          </Stack.item>
          <Stack.Item fill>
            <Stack vertical={true}>
              <Stack.item>
                <p>
                  <TextStyle variation="strong">
                    {truncate(title, 35)}
                  </TextStyle>
                </p>
                <p>
                  {truncate(product?.title, 35)}
                </p>
                <p>{dayjs(createdAt).format("MMMM D, YYYY")}</p>
              </Stack.item>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 3 }}>
                  <TextStyle variation="subdued">Discount</TextStyle>
                  <p>{discountCode || "-"}</p>
                </div>
                <div style={{ flex: 2}}>
                  <TextStyle variation="subdued">Scans</TextStyle>
                  <p>{scans}</p>
                </div>
              </div>
            </Stack>
          </Stack.Item>
        </Stack>
      </div>
    </UnstyledLink>
  );
}