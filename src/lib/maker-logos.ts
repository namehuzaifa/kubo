export const makerDomains: Record<string, string> = {
  Audi: "audi.com",
  Bentley: "bentleymotors.com",
  Bmw: "bmw.com",
  BMW: "bmw.com",
  Chevrolet: "chevrolet.com",
  Daihatsu: "daihatsu.com",
  Ferrari: "ferrari.com",
  Ford: "ford.com",
  Genesis: "genesis.com",
  Hino: "hino.com",
  Honda: "honda.com",
  Hyundai: "hyundai.com",
  Infiniti: "infiniti.com",
  Isuzu: "isuzu.com",
  Jaguar: "jaguar.com",
  Kia: "kia.com",
  "Land Rover": "landrover.com",
  Lexus: "lexus.com",
  Mazda: "mazda.com",
  "Mercedes Benz": "mercedes-benz.com",
  "Mercedes-Benz": "mercedes-benz.com",
  Mini: "mini.com",
  Mitsubishi: "mitsubishi-motors.com",
  "Mitsubishi Fuso": "mitsubishi-fuso.com",
  Nissan: "nissan-global.com",
  Porsche: "porsche.com",
  Renault: "renault.com",
  "Renault Samsung": "renaultkoream.com",
  Smart: "smart.com",
  Subaru: "subaru.com",
  Suzuki: "globalsuzuki.com",
  Tesla: "tesla.com",
  Toyota: "toyota.com",
  Volkswagen: "volkswagen.com",
  Volvo: "volvocars.com",
};

export function getMakerLogoUrl(label: string, logoKey: string): string | undefined {
  const domain = makerDomains[label];
  if (!domain || !logoKey) return undefined;
  return `https://img.logo.dev/${domain}?token=${logoKey}&size=64&format=png&theme=light&fallback=monogram`;
}

export function getMakerInitials(label: string): string {
  return label.split(/\s+/).map((word) => word[0]).join("").slice(0, 2);
}
