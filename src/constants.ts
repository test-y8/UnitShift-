/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Unit {
  label: string;
  value: string;
  ratio: number; // Ratio to base unit (e.g. for length, base is meters)
  symbol?: string;
  description?: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  color: string; // Tailwind color class stem (e.g., 'blue', 'emerald')
  units: Unit[];
  baseUnit: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'Length',
    icon: 'Ruler',
    color: 'blue',
    baseUnit: 'm',
    units: [
      { label: 'Nanometers (nm)', value: 'nm', ratio: 1e-9, description: 'Microscopic measurements, electronics.' },
      { label: 'Micrometers (µm)', value: 'um', ratio: 1e-6, description: 'Thickness of human hair, cell biology.' },
      { label: 'Millimeters (mm)', value: 'mm', ratio: 0.001, description: 'Small mechanical parts, rainfall.' },
      { label: 'Centimeters (cm)', value: 'cm', ratio: 0.01, description: 'Daily objects, height measurements.' },
      { label: 'Meters (m)', value: 'm', ratio: 1, description: 'SI base unit for length, room dimensions.' },
      { label: 'Kilometers (km)', value: 'km', ratio: 1000, description: 'Road distances, travel.' },
      { label: 'Inches (in)', value: 'in', ratio: 0.0254, description: 'Screen sizes, tools (Imperial).' },
      { label: 'Feet (ft)', value: 'ft', ratio: 0.3048, description: 'Human height, altitude (Imperial).' },
      { label: 'Yards (yd)', value: 'yd', ratio: 0.9144, description: 'Sports fields, fabrics.' },
      { label: 'Miles (mi)', value: 'mi', ratio: 1609.34, description: 'Long distances, speed limits (US/UK).' },
      { label: 'Nautical Miles (nmi)', value: 'nmi', ratio: 1852, description: 'Maritime and air navigation.' },
      { label: 'Angstroms (Å)', value: 'angstrom', ratio: 1e-10, description: 'Atomic scale measurements.' },
    ]
  },
  {
    id: 'weight',
    label: 'Weight',
    icon: 'Weight',
    color: 'emerald',
    baseUnit: 'kg',
    units: [
      { label: 'Milligrams (mg)', value: 'mg', ratio: 0.000001, description: 'Medicine dosage, spices.' },
      { label: 'Grams (g)', value: 'g', ratio: 0.001, description: 'Cooking ingredients, small items.' },
      { label: 'Kilograms (kg)', value: 'kg', ratio: 1, description: 'SI base unit, human weight, groceries.' },
      { label: 'Metric Tons (t)', value: 't', ratio: 1000, description: 'Heavy machinery, large shipments.' },
      { label: 'Ounces (oz)', value: 'oz', ratio: 0.0283495, description: 'Food products, precious metals (Imperial).' },
      { label: 'Pounds (lb)', value: 'lb', ratio: 0.453592, description: 'Body weight, common in US.' },
      { label: 'Stones (st)', value: 'st', ratio: 6.35029, description: 'Human body weight (mostly UK).' },
      { label: 'Carats (ct)', value: 'ct', ratio: 0.0002, description: 'Gemstones and diamonds.' },
    ]
  },
  {
    id: 'temperature',
    label: 'Temperature',
    icon: 'Thermometer',
    color: 'orange',
    baseUnit: 'c',
    units: [
      { label: 'Celsius (°C)', value: 'c', ratio: 1, description: 'Metric standard, water freezes at 0°C.' },
      { label: 'Fahrenheit (°F)', value: 'f', ratio: 1, description: 'Common in USA, water freezes at 32°F.' },
      { label: 'Kelvin (K)', value: 'k', ratio: 1, description: 'Scientific base unit, absolute zero is 0K.' },
      { label: 'Rankine (°R)', value: 'r', ratio: 1, description: 'Thermodynamic scale (US engineering).' },
    ]
  },
  {
    id: 'time',
    label: 'Time',
    icon: 'Clock',
    color: 'purple',
    baseUnit: 's',
    units: [
      { label: 'Milliseconds (ms)', value: 'ms', ratio: 0.001, description: 'Digital ping, camera shutters.' },
      { label: 'Seconds (s)', value: 's', ratio: 1, description: 'Base unit of time.' },
      { label: 'Minutes (min)', value: 'min', ratio: 60, description: 'Short tasks, cooking.' },
      { label: 'Hours (h)', value: 'h', ratio: 3600, description: 'Workday, long travel.' },
      { label: 'Days (d)', value: 'd', ratio: 86400, description: 'Calendar cycle.' },
      { label: 'Weeks (wk)', value: 'wk', ratio: 604800, description: 'Work cycles, schedules.' },
      { label: 'Months (avg. mo)', value: 'mo', ratio: 2629746, description: 'Billing cycles, average length.' },
      { label: 'Years (avg. yr)', value: 'yr', ratio: 31556952, description: 'Age measurements, long term plans.' },
    ]
  },
  {
    id: 'volume',
    label: 'Volume',
    icon: 'Droplets',
    color: 'cyan',
    baseUnit: 'l',
    units: [
      { label: 'Milliliters (ml)', value: 'ml', ratio: 0.001, description: 'Liquids, healthcare products.' },
      { label: 'Liters (l)', value: 'l', ratio: 1, description: 'Beverages, engine displacement.' },
      { label: 'Fluid Ounces (fl oz)', value: 'floz', ratio: 0.0295735, description: 'Liquid containers (US/Imperial).' },
      { label: 'Cups (cup)', value: 'cup', ratio: 0.236588, description: 'Cooking recipes.' },
      { label: 'Pints (pt)', value: 'pt', ratio: 0.473176, description: 'Pub beverages, milk.' },
      { label: 'Quarts (qt)', value: 'qt', ratio: 0.946353, description: 'Engine oil, large liquid containers.' },
      { label: 'Gallons (gal)', value: 'gal', ratio: 3.78541, description: 'Fuel, pool volume.' },
      { label: 'Cubic Meters (m³)', value: 'm3', ratio: 1000, description: 'Industrial volume, swimming pools.' },
      { label: 'Tablespoons (tbsp)', value: 'tbsp', ratio: 0.0147868, description: 'Cooking recipes (US).' },
      { label: 'Teaspoons (tsp)', value: 'tsp', ratio: 0.00492892, description: 'Cooking recipes (US).' },
    ]
  },
  {
    id: 'pressure',
    label: 'Pressure',
    icon: 'Gauge',
    color: 'rose',
    baseUnit: 'pa',
    units: [
      { label: 'Pascals (Pa)', value: 'pa', ratio: 1, description: 'SI unit of pressure.' },
      { label: 'Kilopascals (kPa)', value: 'kpa', ratio: 1000, description: 'Tire pressure, meteorology.' },
      { label: 'Bars (bar)', value: 'bar', ratio: 100000, description: 'Atmospheric pressure, scuba diving.' },
      { label: 'PSI (lb/in²)', value: 'psi', ratio: 6894.76, description: 'Tire pressure, industrial machinery.' },
      { label: 'Atmospheres (atm)', value: 'atm', ratio: 101325, description: 'Standard atmospheric pressure.' },
    ]
  },
  {
    id: 'energy',
    label: 'Energy',
    icon: 'Zap',
    color: 'yellow',
    baseUnit: 'j',
    units: [
      { label: 'Joules (J)', value: 'j', ratio: 1, description: 'SI unit of energy.' },
      { label: 'Kilojoules (kJ)', value: 'kj', ratio: 1000, description: 'Food energy, mechanical work.' },
      { label: 'Calories (cal)', value: 'cal', ratio: 4.184, description: 'Thermal energy (small calorie).' },
      { label: 'Kilocalories (kcal)', value: 'kcal', ratio: 4184, description: 'Food energy (large Calorie).' },
      { label: 'Watt-hours (Wh)', value: 'wh', ratio: 3600, description: 'Electrical battery capacity.' },
      { label: 'Kilowatt-hours (kWh)', value: 'kwh', ratio: 3.6e6, description: 'Household electricity consumption.' },
      { label: 'Electronvolts (eV)', value: 'ev', ratio: 1.60218e-19, description: 'Particle physics, atomic energy.' },
    ]
  }
];

export function convertValue(value: number, from: string, to: string, categoryId: string): number {
  if (categoryId === 'temperature') {
    // Temperature has non-linear conversions
    let celsius = value;
    if (from === 'f') celsius = (value - 32) * (5 / 9);
    if (from === 'k') celsius = value - 273.15;
    if (from === 'r') celsius = (value - 491.67) * (5 / 9);

    if (to === 'c') return celsius;
    if (to === 'f') return (celsius * 9 / 5) + 32;
    if (to === 'k') return celsius + 273.15;
    if (to === 'r') return (celsius + 273.15) * (9 / 5);
    return value;
  }

  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return value;

  const fromUnit = category.units.find(u => u.value === from);
  const toUnit = category.units.find(u => u.value === to);

  if (!fromUnit || !toUnit) return value;

  // Convert to base unit then to target unit
  const baseValue = value * fromUnit.ratio;
  return baseValue / toUnit.ratio;
}

export interface HistoryItem {
  id: string;
  fromValue: number;
  fromUnit: string;
  toValue: number;
  toUnit: string;
  category: string;
  timestamp: number;
}
