import sedanImg from "@/assets/body-sedan.jpg";
import hatchImg from "@/assets/body-hatch.jpg";
import suvImg from "@/assets/body-suv.jpg";
import vanImg from "@/assets/body-van.jpg";
import truckImg from "@/assets/body-truck.jpg";
import keiImg from "@/assets/body-kei.jpg";
import wagonImg from "@/assets/body-wagon.jpg";
import coupeImg from "@/assets/body-coupe.jpg";
import busImg from "@/assets/body-bus.jpg";

export const site = {
  name: "Kubo Trading Japan",
  tagline: "Japanese Used Car Exporter",
  phone: "+81 6-4560-4097",
  email: "info@kubotrading.com",
  address: "1-8-15 Nishitanabe, Higashisumiyoshi-ku, Osaka, Japan",
  logo: "https://kubotrading.com/wp-content/uploads/2024/04/logo.png",
};

export const nav = [
  { label: "Home", to: "/" as const },
  { label: "About Us", to: "/about" as const },
  { label: "All Stock", to: "/all-stock" as const },
  { label: "New Arrivals", to: "/new-arrivals" as const },
  { label: "On Sale", to: "/on-sale" as const },
  { label: "One Price", to: "/one-price" as const },
  { label: "Inquiry", to: "/inquiry" as const },
  { label: "How To Buy", to: "/how-to-buy" as const },
  { label: "Contact Us", to: "/contact" as const },
];

export const bodyTypes = [
  "Sedan",
  "Coupe",
  "Wagon",
  "Hatchback",
  "SUV",
  "Convertible",
  "Van & MiniVan",
  "Truck",
  "Bus",
  "Mini Vehicle",
] as const;

export type BodyType = (typeof bodyTypes)[number];

const bodyImage: Record<BodyType, string> = {
  Sedan: sedanImg,
  Coupe: coupeImg,
  Wagon: wagonImg,
  Hatchback: hatchImg,
  SUV: suvImg,
  Convertible: coupeImg,
  "Van & MiniVan": vanImg,
  Truck: truckImg,
  Bus: busImg,
  "Mini Vehicle": keiImg,
};

export type Transmission = "AT" | "MT" | "CVT";
export type Fuel = "Petrol" | "Diesel" | "Hybrid" | "Electric";
export type Steering = "Right" | "Left";

export type Vehicle = {
  slug: string;
  name: string;
  image: string;
  maker: string;
  model: string;
  brand: string;
  bodyType: BodyType;
  year: number;
  priceJpy: number;
  price: string;
  mileageKm: number;
  transmission: Transmission;
  fuel: Fuel;
  steering: Steering;
  engineCc: number;
  countries: string[];
  stock: "In stock" | "Sold";
};

type Row = [
  maker: string,
  model: string,
  body: BodyType,
  year: number,
  priceJpy: number,
  mileageKm: number,
  transmission: Transmission,
  fuel: Fuel,
  engineCc: number,
  steering: Steering,
  countries: string[],
];

const rows: Row[] = [
  ["Toyota", "Corolla Axio", "Sedan", 2017, 890000, 78000, "CVT", "Petrol", 1500, "Right", ["Pakistan"]],
  ["Toyota", "Premio", "Sedan", 2015, 1180000, 92000, "CVT", "Petrol", 1800, "Right", ["Sri Lanka"]],
  ["Toyota", "Aqua", "Hatchback", 2018, 880000, 64000, "CVT", "Hybrid", 1500, "Right", ["New Zealand"]],
  ["Toyota", "Vitz", "Hatchback", 2016, 720000, 81000, "CVT", "Petrol", 1000, "Right", ["Jamaic"]],
  ["Toyota", "Passo", "Hatchback", 2018, 690000, 52000, "CVT", "Petrol", 1000, "Right", ["Sri Lanka"]],
  ["Toyota", "Land Cruiser Prado", "SUV", 2019, 5480000, 46000, "AT", "Diesel", 2800, "Right", ["Kiribati"]],
  ["Toyota", "RAV4", "SUV", 2020, 3290000, 38000, "AT", "Petrol", 2000, "Right", ["Pakistan"]],
  ["Toyota", "Hiace Van", "Van & MiniVan", 2016, 2180000, 128000, "AT", "Diesel", 3000, "Right", ["PNG"]],
  ["Toyota", "Noah", "Van & MiniVan", 2017, 1690000, 87000, "CVT", "Petrol", 2000, "Right", ["Malawi"]],
  ["Toyota", "Dyna Flatbed", "Truck", 2015, 1980000, 156000, "MT", "Diesel", 4000, "Right", ["Dominican Republic"]],
  ["Toyota", "Coaster", "Bus", 2014, 3450000, 172000, "MT", "Diesel", 4200, "Right", ["Malawi"]],
  ["Toyota", "Corolla Fielder", "Wagon", 2017, 1090000, 74000, "CVT", "Hybrid", 1500, "Right", ["Kiribati"]],
  ["Toyota", "86", "Coupe", 2016, 2180000, 58000, "MT", "Petrol", 2000, "Right", ["New Zealand"]],
  ["Toyota", "Pixis Epoch", "Mini Vehicle", 2019, 610000, 41000, "CVT", "Petrol", 660, "Right", ["Pakistan"]],
  ["Nissan", "Sylphy", "Sedan", 2016, 890000, 86000, "CVT", "Petrol", 1800, "Right", ["Sri Lanka"]],
  ["Nissan", "Note e-Power", "Hatchback", 2019, 1120000, 44000, "CVT", "Hybrid", 1200, "Right", ["Jamaic"]],
  ["Nissan", "March", "Hatchback", 2015, 540000, 96000, "CVT", "Petrol", 1200, "Right", ["Malawi"]],
  ["Nissan", "X-Trail", "SUV", 2018, 1980000, 62000, "CVT", "Hybrid", 2000, "Right", ["Kiribati"]],
  ["Nissan", "Patrol", "SUV", 2013, 3180000, 148000, "AT", "Diesel", 3000, "Left", ["PNG"]],
  ["Nissan", "Serena", "Van & MiniVan", 2017, 1580000, 79000, "CVT", "Petrol", 2000, "Right", ["Pakistan"]],
  ["Nissan", "Caravan", "Van & MiniVan", 2015, 1690000, 134000, "AT", "Diesel", 2500, "Right", ["Dominican Republic"]],
  ["Nissan", "Atlas", "Truck", 2014, 1480000, 168000, "MT", "Diesel", 3000, "Right", ["Malawi"]],
  ["Nissan", "Fairlady Z", "Coupe", 2012, 2680000, 88000, "MT", "Petrol", 3700, "Right", ["New Zealand"]],
  ["Nissan", "Dayz", "Mini Vehicle", 2020, 780000, 32000, "CVT", "Petrol", 660, "Right", ["Sri Lanka"]],
  ["Nissan", "Leaf", "Hatchback", 2019, 1420000, 39000, "AT", "Electric", 0, "Right", ["New Zealand"]],
  ["Honda", "Grace", "Sedan", 2017, 1080000, 68000, "CVT", "Hybrid", 1500, "Right", ["Pakistan"]],
  ["Honda", "Fit", "Hatchback", 2018, 830000, 57000, "CVT", "Hybrid", 1500, "Right", ["Jamaic"]],
  ["Honda", "Fit", "Hatchback", 2010, 410000, 142000, "CVT", "Petrol", 1300, "Right", ["Jamaic"]],
  ["Honda", "Vezel", "SUV", 2019, 1780000, 48000, "CVT", "Hybrid", 1500, "Right", ["Kiribati"]],
  ["Honda", "CR-V", "SUV", 2018, 2280000, 61000, "CVT", "Petrol", 1500, "Right", ["Malawi"]],
  ["Honda", "Freed", "Van & MiniVan", 2017, 1290000, 72000, "CVT", "Petrol", 1500, "Right", ["Sri Lanka"]],
  ["Honda", "Stepwgn", "Van & MiniVan", 2016, 1390000, 84000, "CVT", "Petrol", 1500, "Right", ["PNG"]],
  ["Honda", "S660", "Convertible", 2017, 1480000, 29000, "MT", "Petrol", 660, "Right", ["New Zealand"]],
  ["Honda", "N-Box", "Mini Vehicle", 2020, 980000, 26000, "CVT", "Petrol", 660, "Right", ["Pakistan"]],
  ["Honda", "Acty Truck", "Truck", 2016, 690000, 88000, "MT", "Petrol", 660, "Right", ["Dominican Republic"]],
  ["Mazda", "Axela", "Sedan", 2017, 1090000, 71000, "AT", "Diesel", 1500, "Right", ["Sri Lanka"]],
  ["Mazda", "Demio", "Hatchback", 2018, 730000, 59000, "AT", "Petrol", 1300, "Right", ["Kiribati"]],
  ["Mazda", "CX-5", "SUV", 2019, 2380000, 51000, "AT", "Diesel", 2200, "Right", ["Pakistan"]],
  ["Mazda", "MX-5 Roadster", "Convertible", 2018, 2180000, 34000, "MT", "Petrol", 1500, "Right", ["New Zealand"]],
  ["Mazda", "Bongo Van", "Van & MiniVan", 2015, 890000, 121000, "MT", "Diesel", 1800, "Right", ["Malawi"]],
  ["Suzuki", "Swift", "Hatchback", 2018, 890000, 47000, "CVT", "Petrol", 1200, "Right", ["Jamaic"]],
  ["Suzuki", "Wagon R", "Mini Vehicle", 2023, 1240000, 12000, "CVT", "Petrol", 660, "Right", ["Pakistan"]],
  ["Suzuki", "Alto", "Mini Vehicle", 2019, 620000, 38000, "CVT", "Petrol", 660, "Right", ["Sri Lanka"]],
  ["Suzuki", "Jimny", "SUV", 2020, 2180000, 24000, "MT", "Petrol", 660, "Right", ["Kiribati"]],
  ["Suzuki", "Every Van", "Van & MiniVan", 2018, 880000, 66000, "AT", "Petrol", 660, "Right", ["PNG"]],
  ["Suzuki", "Carry Truck", "Truck", 2019, 790000, 54000, "MT", "Petrol", 660, "Right", ["Dominican Republic"]],
  ["Daihatsu", "Mira e:S", "Mini Vehicle", 2018, 620000, 44000, "CVT", "Petrol", 660, "Right", ["Malawi"]],
  ["Daihatsu", "Tanto", "Mini Vehicle", 2019, 890000, 33000, "CVT", "Petrol", 660, "Right", ["Pakistan"]],
  ["Daihatsu", "Hijet Truck", "Truck", 2020, 850000, 31000, "MT", "Petrol", 660, "Right", ["Sri Lanka"]],
  ["Daihatsu", "Rocky", "SUV", 2021, 1780000, 22000, "CVT", "Petrol", 1000, "Right", ["Kiribati"]],
  ["Subaru", "Impreza G4", "Sedan", 2017, 1180000, 69000, "CVT", "Petrol", 1600, "Right", ["New Zealand"]],
  ["Subaru", "Forester", "SUV", 2018, 1980000, 58000, "CVT", "Petrol", 2000, "Right", ["Pakistan"]],
  ["Subaru", "Levorg", "Wagon", 2017, 1580000, 74000, "CVT", "Petrol", 1600, "Right", ["Jamaic"]],
  ["Subaru", "BRZ", "Coupe", 2016, 2080000, 61000, "MT", "Petrol", 2000, "Right", ["New Zealand"]],
  ["Mitsubishi", "Outlander PHEV", "SUV", 2018, 2180000, 66000, "AT", "Hybrid", 2400, "Right", ["Kiribati"]],
  ["Mitsubishi", "Delica D:5", "Van & MiniVan", 2017, 1980000, 82000, "AT", "Diesel", 2300, "Right", ["PNG"]],
  ["Mitsubishi", "Canter Truck", "Truck", 2015, 1880000, 162000, "MT", "Diesel", 3000, "Right", ["Dominican Republic"]],
  ["Mitsubishi", "eK Wagon", "Mini Vehicle", 2019, 720000, 36000, "CVT", "Petrol", 660, "Right", ["Malawi"]],
  ["Isuzu", "Elf Flatbed", "Truck", 2013, 1150000, 184000, "MT", "Diesel", 3000, "Right", ["Dominican Republic"]],
  ["Isuzu", "Forward", "Truck", 2012, 2480000, 226000, "MT", "Diesel", 6000, "Right", ["Malawi"]],
  ["Hino", "Dutro", "Truck", 2016, 2180000, 148000, "MT", "Diesel", 4000, "Right", ["PNG"]],
  ["Hino", "Liesse", "Bus", 2013, 2980000, 198000, "MT", "Diesel", 4000, "Right", ["Malawi"]],
  ["Mitsubishi Fuso", "Rosa", "Bus", 2014, 3180000, 176000, "MT", "Diesel", 4900, "Right", ["Kiribati"]],
  ["Lexus", "IS300h", "Sedan", 2017, 2480000, 63000, "AT", "Hybrid", 2500, "Right", ["Pakistan"]],
  ["Lexus", "RX450h", "SUV", 2018, 4180000, 54000, "AT", "Hybrid", 3500, "Right", ["Kiribati"]],
  ["BMW", "3 Series", "Sedan", 2017, 1890000, 72000, "AT", "Petrol", 2000, "Right", ["Pakistan"]],
  ["BMW", "X5", "SUV", 2018, 4280000, 61000, "AT", "Diesel", 3000, "Right", ["Kiribati"]],
  ["BMW", "4 Series Convertible", "Convertible", 2016, 2880000, 68000, "AT", "Petrol", 2000, "Right", ["New Zealand"]],
  ["Mini", "Cooper S", "Hatchback", 2018, 1980000, 47000, "AT", "Petrol", 2000, "Right", ["Jamaic"]],
  ["Mercedes-Benz", "C200", "Sedan", 2017, 2380000, 66000, "AT", "Petrol", 2000, "Right", ["Sri Lanka"]],
  ["Mercedes-Benz", "G350d", "SUV", 2016, 9850000, 74000, "AT", "Diesel", 3000, "Left", ["Turks And Caicos Islands"]],
  ["Mercedes-Benz", "V-Class", "Van & MiniVan", 2018, 3980000, 58000, "AT", "Diesel", 2100, "Left", ["PNG"]],
  ["Audi", "A4", "Sedan", 2017, 1780000, 78000, "AT", "Petrol", 2000, "Left", ["Pakistan"]],
  ["Audi", "Q5", "SUV", 2018, 2880000, 64000, "AT", "Diesel", 2000, "Left", ["Kiribati"]],
  ["Volkswagen", "Golf", "Hatchback", 2017, 1280000, 71000, "AT", "Petrol", 1200, "Left", ["Jamaic"]],
  ["Volkswagen", "Tiguan", "SUV", 2018, 2180000, 59000, "AT", "Petrol", 1400, "Left", ["Malawi"]],
  ["Volvo", "V60", "Wagon", 2017, 1880000, 69000, "AT", "Diesel", 2000, "Left", ["New Zealand"]],
  ["Land Rover", "Range Rover Evoque", "SUV", 2017, 2980000, 72000, "AT", "Diesel", 2000, "Right", ["Kiribati"]],
  ["Porsche", "Cayenne", "SUV", 2016, 4680000, 84000, "AT", "Petrol", 3000, "Left", ["Turks And Caicos Islands"]],
  ["Porsche", "911 Carrera", "Coupe", 2015, 8980000, 62000, "AT", "Petrol", 3000, "Left", ["New Zealand"]],
];

const yen = (n: number) => `¥${n.toLocaleString("en-US")}`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const vehicles: Vehicle[] = rows.map(
  ([maker, model, body, year, priceJpy, mileageKm, transmission, fuel, engineCc, steering, cts], i) => ({
    slug: `${slugify(`${maker}-${model}-${year}`)}-${i + 1}`,
    name: `${maker} ${model} ${year}`,
    image: bodyImage[body],
    maker,
    model,
    brand: maker,
    bodyType: body,
    year,
    priceJpy,
    price: yen(priceJpy),
    mileageKm,
    transmission,
    fuel,
    steering,
    engineCc,
    countries: ["All", ...cts],
    stock: "In stock",
  }),
);

export const makers = Array.from(new Set(vehicles.map((v) => v.maker))).sort();

export const brands = makers;

export const bodyTypeCounts = bodyTypes.map((b) => ({
  name: b,
  count: vehicles.filter((v) => v.bodyType === b).length,
}));

export const makerCounts = makers.map((m) => ({
  name: m,
  count: vehicles.filter((v) => v.maker === m).length,
}));

const countryImages: Record<string, string> = {
  All: "https://kubotrading.com/wp-content/uploads/2024/04/i-10.webp",
  "Dominican Republic":
    "https://kubotrading.com/wp-content/uploads/2024/04/Dominican-Republic.png",
  Jamaic: "https://kubotrading.com/wp-content/uploads/2024/04/jamaic.png",
  Malawi: "https://kubotrading.com/wp-content/uploads/2024/04/Malawi.png",
  Pakistan: "https://kubotrading.com/wp-content/uploads/2024/04/Pakistan.png",
  "Sri Lanka": "https://kubotrading.com/wp-content/uploads/2024/04/srilanka.png",
  "New Zealand":
    "https://kubotrading.com/wp-content/uploads/2025/07/429472522_384680894282200_2078730389482661759_n.jpg",
  Kiribati:
    "https://kubotrading.com/wp-content/uploads/2025/07/427536242_430806879377046_1771894406159312499_n.jpg",
  PNG: "https://kubotrading.com/wp-content/uploads/2025/07/424470175_1098600378050310_8049663394767949289_n.jpg",
  "Turks And Caicos Islands":
    "https://kubotrading.com/wp-content/uploads/2024/04/i-10.webp",
};

export const countries = Object.keys(countryImages).map((name) => {
  const count =
    name === "All"
      ? vehicles.length
      : vehicles.filter((v) => v.countries.includes(name)).length;
  return {
    name,
    count: `${count} ${count === 1 ? "product" : "products"}`,
    image: countryImages[name]!,
  };
});
