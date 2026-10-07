import sedanImg from "@/assets/body-sedan.jpg";
import hatchImg from "@/assets/body-hatch.jpg";
import suvImg from "@/assets/body-suv.jpg";
import vanImg from "@/assets/body-van.jpg";
import truckImg from "@/assets/body-truck.jpg";
import keiImg from "@/assets/body-kei.jpg";
import wagonImg from "@/assets/body-wagon.jpg";
import coupeImg from "@/assets/body-coupe.jpg";
import busImg from "@/assets/body-bus.jpg";
import type { InventoryVehicle } from "@/lib/inventory.functions";

const imageByBody: Record<string, string> = {
  Sedan: sedanImg,
  Coupe: coupeImg,
  Wagon: wagonImg,
  Hatchback: hatchImg,
  SUV: suvImg,
  Convertible: coupeImg,
  Van: vanImg,
  "Mini Van": vanImg,
  "Van & MiniVan": vanImg,
  Truck: truckImg,
  "Pick up": truckImg,
  Bus: busImg,
  "Mini Bus": busImg,
  "Mini Vehicle": keiImg,
};

export function bodyImage(bodyType: string | null | undefined): string {
  return (bodyType && imageByBody[bodyType]) || sedanImg;
}

export function formatPrice(amount: number | null, currency: string | null): string {
  if (amount === null) return "Ask price";
  const code = currency ?? "USD";
  const symbol = code === "USD" ? "$" : code === "JPY" ? "¥" : "";
  return `${symbol}${Math.round(amount).toLocaleString("en-US")}${symbol ? "" : ` ${code}`}`;
}

export type CardVehicle = {
  id: string;
  slug: string;
  name: string;
  image: string;
  maker: string;
  model: string;
  bodyType: string;
  price: string;
  mileageKm: number;
  transmission: string;
  fuel: string;
  steering: string;
  countries: string[];
  stock: string;
  stockId?: string;
};

export function toCardVehicle(vehicle: InventoryVehicle): CardVehicle {
  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.title,
    image: bodyImage(vehicle.body_type),
    maker: vehicle.make,
    model: vehicle.model,
    bodyType: vehicle.body_type ?? "Vehicle",
    price: formatPrice(vehicle.price, vehicle.currency),
    mileageKm: vehicle.mileage ?? 0,
    transmission: vehicle.transmission ?? "—",
    fuel: vehicle.fuel ?? "—",
    steering: vehicle.steering ?? "—",
    countries: vehicle.inventory_location ? [vehicle.inventory_location] : [],
    stock: vehicle.status === "Available" ? "In stock" : vehicle.status,
    stockId: vehicle.stock_id,
  };
}
