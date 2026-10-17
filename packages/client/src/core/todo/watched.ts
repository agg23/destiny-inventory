import type { Watch } from "./vendorTypes.ts";

const EXCHANGE = [2865242233, 825199458, 2001857187, 3612161799];

const CLAN_BOUNTIES = [
  4036455306, 2736452412, 3553274676, 241149628, 425910192,
];

const BRIGHT_DUST = 2817410917;

const STRANGE_COIN = 800069450;

// Each character only sees its own class's ornament here
export const ARMOR_ORNAMENTS = 2031393824;

// Tess's weekly stock is in these nameless sub-vendors
const BRIGHT_DUST_ROWS = [
  [2168194999, ARMOR_ORNAMENTS, 3118972542, 4020265966, 3702989297, 1105106638],
  [2184482416, 1446296883, 2041776156, 213864513],
];

const XUR = 2190858386;

// Xur's exotic weapons and catalysts are behind his Strange Gear Offers screen
const STRANGE_GEAR_OFFERS = 3751514131;

const EXOTIC_ENGRAM = 903043774;

export const PURCHASED_REASONS = [
  "Already Purchased on Account",
  "Already Acquired",
  "Already Claimed This Week",
];

export const WATCHED: Watch[] = [
  {
    vendor: 3361454721,
    mode: "rotation",
    rows: BRIGHT_DUST_ROWS,
    currency: BRIGHT_DUST,
  },
  {
    vendor: XUR,
    mode: "visit",
    rows: [[XUR], [STRANGE_GEAR_OFFERS]],
    categories: [
      "category_xur_offers_peculiar",
      "category_black_market_exotics",
    ],
    skip: [EXOTIC_ENGRAM],
    currency: STRANGE_COIN,
  },
  { vendor: 153857624, mode: "claims", name: "Zavala" },
  { vendor: 3949128738, mode: "offers", only: EXCHANGE },
  {
    vendor: 3347378076,
    mode: "offers",
    categories: ["clan_bounties_vendor_display"],
    owned: "social.clans.",
    pursuits: CLAN_BOUNTIES,
  },
];

// Rare stock, surfaced from any vendor
export const PRIORITY = [2001857187, 2228452164];
