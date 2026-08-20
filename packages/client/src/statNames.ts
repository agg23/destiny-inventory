// Bungie's names are written for a full-width screen
const SHORT: Record<string, string> = {
  "Rounds Per Minute": "RPM",
  "Airborne Effectiveness": "Airborne",
  "Aim Assistance": "Aim",
  "Ammo Generation": "Ammo",
  "Recoil Direction": "Recoil",
  "Reload Speed": "Reload",
  "Charge Time": "Charge",
  "Draw Time": "Draw",
  "Blast Radius": "Blast",
  Magazine: "Mag",
  "Inventory Size": "Inventory",
  "Swing Speed": "Swing",
  "Charge Rate": "Charge",
  "Guard Efficiency": "Guard",
  "Guard Resistance": "Resist",
  "Guard Endurance": "Endurance",
  "Shield Duration": "Shield",
  "Ammo Capacity": "Ammo",
  "Heat Generated": "Heat",
  "Cooling Efficiency": "Cooling",
  // DIM names its derived total through i18n
  "Stats.Total": "Total",
};

export const shortStat = (name: string): string => SHORT[name] ?? name;
