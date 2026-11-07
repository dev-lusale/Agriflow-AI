import type { Province } from "@prisma/client";

export const PROVINCES: { value: Province; label: string }[] = [
  { value: "LUSAKA", label: "Lusaka" },
  { value: "COPPERBELT", label: "Copperbelt" },
  { value: "SOUTHERN", label: "Southern" },
  { value: "CENTRAL", label: "Central" },
  { value: "EASTERN", label: "Eastern" },
  { value: "NORTHERN", label: "Northern" },
  { value: "LUAPULA", label: "Luapula" },
  { value: "MUCHINGA", label: "Muchinga" },
  { value: "WESTERN", label: "Western" },
  { value: "NORTH_WESTERN", label: "North-Western" },
];

export const provinceLabel = (p: Province | string | null | undefined) =>
  PROVINCES.find((x) => x.value === p)?.label ?? (p ? String(p) : "—");

/**
 * Districts by province. Coordinates are the approximate location of the district's
 * administrative town (not farm locations). They are used only to look up area weather
 * when a farm has no farmer-supplied GPS point, and the UI says so.
 * `null` coordinates mean we do not hold a reliable centre point for that district.
 */
export const DISTRICTS: Record<Province, { name: string; lat: number | null; lng: number | null }[]> = {
  LUSAKA: [
    { name: "Lusaka", lat: -15.4167, lng: 28.2833 },
    { name: "Chongwe", lat: -15.329, lng: 28.682 },
    { name: "Kafue", lat: -15.7691, lng: 28.1814 },
    { name: "Chilanga", lat: -15.5636, lng: 28.2731 },
    { name: "Luangwa", lat: -15.6167, lng: 30.4167 },
    { name: "Rufunsa", lat: null, lng: null },
    { name: "Chirundu", lat: -16.0347, lng: 28.8503 },
    { name: "Shibuyunji", lat: null, lng: null },
  ],
  COPPERBELT: [
    { name: "Ndola", lat: -12.9587, lng: 28.6366 },
    { name: "Kitwe", lat: -12.8024, lng: 28.2132 },
    { name: "Chingola", lat: -12.529, lng: 27.8536 },
    { name: "Mufulira", lat: -12.5497, lng: 28.2405 },
    { name: "Luanshya", lat: -13.1367, lng: 28.4166 },
    { name: "Kalulushi", lat: -12.8384, lng: 28.0948 },
    { name: "Chililabombwe", lat: -12.3667, lng: 27.8333 },
    { name: "Masaiti", lat: null, lng: null },
    { name: "Mpongwe", lat: -13.5124, lng: 28.1536 },
    { name: "Lufwanyama", lat: null, lng: null },
  ],
  SOUTHERN: [
    { name: "Choma", lat: -16.8065, lng: 26.9531 },
    { name: "Livingstone", lat: -17.8419, lng: 25.8543 },
    { name: "Mazabuka", lat: -15.856, lng: 27.748 },
    { name: "Monze", lat: -16.2803, lng: 27.4733 },
    { name: "Kalomo", lat: -17.0322, lng: 26.4848 },
    { name: "Namwala", lat: -15.75, lng: 26.4333 },
    { name: "Siavonga", lat: -16.5383, lng: 28.7083 },
    { name: "Sinazongwe", lat: -17.2614, lng: 27.4618 },
    { name: "Gwembe", lat: -16.4986, lng: 27.6067 },
    { name: "Kazungula", lat: -17.7833, lng: 25.2667 },
    { name: "Pemba", lat: -16.5167, lng: 27.3667 },
    { name: "Zimba", lat: -17.3167, lng: 26.2 },
  ],
  CENTRAL: [
    { name: "Kabwe", lat: -14.4469, lng: 28.4464 },
    { name: "Kapiri Mposhi", lat: -13.9714, lng: 28.6694 },
    { name: "Mkushi", lat: -13.62, lng: 29.3933 },
    { name: "Serenje", lat: -13.2325, lng: 30.2352 },
    { name: "Mumbwa", lat: -14.9783, lng: 27.0619 },
    { name: "Chibombo", lat: -14.6569, lng: 28.07 },
    { name: "Chisamba", lat: -14.98, lng: 28.38 },
    { name: "Itezhi-Tezhi", lat: -15.7333, lng: 26.0167 },
    { name: "Luano", lat: null, lng: null },
  ],
  EASTERN: [
    { name: "Chipata", lat: -13.6333, lng: 32.65 },
    { name: "Katete", lat: -14.0567, lng: 31.8783 },
    { name: "Petauke", lat: -14.2426, lng: 31.3253 },
    { name: "Lundazi", lat: -12.2928, lng: 33.1782 },
    { name: "Nyimba", lat: -14.5567, lng: 30.815 },
    { name: "Chadiza", lat: -14.0683, lng: 32.4389 },
    { name: "Mambwe", lat: -13.25, lng: 31.8 },
    { name: "Sinda", lat: -14.2167, lng: 31.75 },
    { name: "Vubwi", lat: null, lng: null },
  ],
  NORTHERN: [
    { name: "Kasama", lat: -10.2129, lng: 31.1808 },
    { name: "Mbala", lat: -8.8406, lng: 31.3667 },
    { name: "Mpulungu", lat: -8.77, lng: 31.11 },
    { name: "Luwingu", lat: -10.2621, lng: 29.9272 },
    { name: "Mporokoso", lat: -9.3729, lng: 30.1251 },
    { name: "Kaputa", lat: -8.4706, lng: 29.6617 },
    { name: "Mungwi", lat: -10.1736, lng: 31.3658 },
    { name: "Chilubi", lat: null, lng: null },
  ],
  LUAPULA: [
    { name: "Mansa", lat: -11.1998, lng: 28.8943 },
    { name: "Samfya", lat: -11.365, lng: 29.5545 },
    { name: "Kawambwa", lat: -9.7915, lng: 29.0791 },
    { name: "Nchelenge", lat: -9.3451, lng: 28.7344 },
    { name: "Mwense", lat: -10.3845, lng: 28.6979 },
    { name: "Milenge", lat: null, lng: null },
    { name: "Chienge", lat: -8.65, lng: 29.15 },
  ],
  MUCHINGA: [
    { name: "Chinsali", lat: -10.5414, lng: 32.0816 },
    { name: "Mpika", lat: -11.8343, lng: 31.4529 },
    { name: "Nakonde", lat: -9.3277, lng: 32.7556 },
    { name: "Isoka", lat: -10.1597, lng: 32.6335 },
    { name: "Chama", lat: -11.2161, lng: 33.1593 },
    { name: "Shiwang'andu", lat: null, lng: null },
  ],
  WESTERN: [
    { name: "Mongu", lat: -15.2484, lng: 23.1274 },
    { name: "Kaoma", lat: -14.7833, lng: 24.8 },
    { name: "Senanga", lat: -16.1167, lng: 23.2667 },
    { name: "Sesheke", lat: -17.4747, lng: 24.2963 },
    { name: "Kalabo", lat: -14.97, lng: 22.6814 },
    { name: "Lukulu", lat: -14.3833, lng: 23.25 },
    { name: "Shangombo", lat: null, lng: null },
  ],
  NORTH_WESTERN: [
    { name: "Solwezi", lat: -12.1688, lng: 26.3894 },
    { name: "Kasempa", lat: -13.4584, lng: 25.8338 },
    { name: "Mwinilunga", lat: -11.7358, lng: 24.4293 },
    { name: "Zambezi", lat: -13.5432, lng: 23.1047 },
    { name: "Kabompo", lat: -13.5925, lng: 24.2009 },
    { name: "Mufumbwe", lat: -13.6833, lng: 24.8 },
    { name: "Chavuma", lat: -13.0833, lng: 22.6833 },
    { name: "Ikelenge", lat: null, lng: null },
  ],
};

export function districtsFor(province: Province | string | null | undefined) {
  if (!province) return [];
  return DISTRICTS[province as Province] ?? [];
}

export function isValidDistrict(province: Province, district: string) {
  return districtsFor(province).some((d) => d.name.toLowerCase() === district.toLowerCase());
}

export function districtCentre(province: Province, district: string) {
  const d = districtsFor(province).find((x) => x.name.toLowerCase() === district.toLowerCase());
  if (!d || d.lat === null || d.lng === null) return null;
  return { lat: d.lat, lng: d.lng };
}
