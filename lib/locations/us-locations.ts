// lib/locations/us-locations.ts
//
// Static reference list of US states + top 200 cities by population.
// Used by the location typeahead filter. No DB dependency.

export interface USState {
  name: string
  abbreviation: string
  type: 'state'
}

export interface USCity {
  name: string
  state: string  // abbreviation
  type: 'city'
  population: number
}

export type LocationOption = USState | USCity

export const US_STATES: USState[] = [
  { name: 'Alabama', abbreviation: 'AL', type: 'state' },
  { name: 'Alaska', abbreviation: 'AK', type: 'state' },
  { name: 'Arizona', abbreviation: 'AZ', type: 'state' },
  { name: 'Arkansas', abbreviation: 'AR', type: 'state' },
  { name: 'California', abbreviation: 'CA', type: 'state' },
  { name: 'Colorado', abbreviation: 'CO', type: 'state' },
  { name: 'Connecticut', abbreviation: 'CT', type: 'state' },
  { name: 'Delaware', abbreviation: 'DE', type: 'state' },
  { name: 'District of Columbia', abbreviation: 'DC', type: 'state' },
  { name: 'Florida', abbreviation: 'FL', type: 'state' },
  { name: 'Georgia', abbreviation: 'GA', type: 'state' },
  { name: 'Hawaii', abbreviation: 'HI', type: 'state' },
  { name: 'Idaho', abbreviation: 'ID', type: 'state' },
  { name: 'Illinois', abbreviation: 'IL', type: 'state' },
  { name: 'Indiana', abbreviation: 'IN', type: 'state' },
  { name: 'Iowa', abbreviation: 'IA', type: 'state' },
  { name: 'Kansas', abbreviation: 'KS', type: 'state' },
  { name: 'Kentucky', abbreviation: 'KY', type: 'state' },
  { name: 'Louisiana', abbreviation: 'LA', type: 'state' },
  { name: 'Maine', abbreviation: 'ME', type: 'state' },
  { name: 'Maryland', abbreviation: 'MD', type: 'state' },
  { name: 'Massachusetts', abbreviation: 'MA', type: 'state' },
  { name: 'Michigan', abbreviation: 'MI', type: 'state' },
  { name: 'Minnesota', abbreviation: 'MN', type: 'state' },
  { name: 'Mississippi', abbreviation: 'MS', type: 'state' },
  { name: 'Missouri', abbreviation: 'MO', type: 'state' },
  { name: 'Montana', abbreviation: 'MT', type: 'state' },
  { name: 'Nebraska', abbreviation: 'NE', type: 'state' },
  { name: 'Nevada', abbreviation: 'NV', type: 'state' },
  { name: 'New Hampshire', abbreviation: 'NH', type: 'state' },
  { name: 'New Jersey', abbreviation: 'NJ', type: 'state' },
  { name: 'New Mexico', abbreviation: 'NM', type: 'state' },
  { name: 'New York', abbreviation: 'NY', type: 'state' },
  { name: 'North Carolina', abbreviation: 'NC', type: 'state' },
  { name: 'North Dakota', abbreviation: 'ND', type: 'state' },
  { name: 'Ohio', abbreviation: 'OH', type: 'state' },
  { name: 'Oklahoma', abbreviation: 'OK', type: 'state' },
  { name: 'Oregon', abbreviation: 'OR', type: 'state' },
  { name: 'Pennsylvania', abbreviation: 'PA', type: 'state' },
  { name: 'Rhode Island', abbreviation: 'RI', type: 'state' },
  { name: 'South Carolina', abbreviation: 'SC', type: 'state' },
  { name: 'South Dakota', abbreviation: 'SD', type: 'state' },
  { name: 'Tennessee', abbreviation: 'TN', type: 'state' },
  { name: 'Texas', abbreviation: 'TX', type: 'state' },
  { name: 'Utah', abbreviation: 'UT', type: 'state' },
  { name: 'Vermont', abbreviation: 'VT', type: 'state' },
  { name: 'Virginia', abbreviation: 'VA', type: 'state' },
  { name: 'Washington', abbreviation: 'WA', type: 'state' },
  { name: 'West Virginia', abbreviation: 'WV', type: 'state' },
  { name: 'Wisconsin', abbreviation: 'WI', type: 'state' },
  { name: 'Wyoming', abbreviation: 'WY', type: 'state' },
]

// Top 100 US cities by population (approximate 2024 census estimates)
export const US_CITIES: USCity[] = [
  { name: 'New York', state: 'NY', type: 'city', population: 8300000 },
  { name: 'Los Angeles', state: 'CA', type: 'city', population: 3900000 },
  { name: 'Chicago', state: 'IL', type: 'city', population: 2700000 },
  { name: 'Houston', state: 'TX', type: 'city', population: 2300000 },
  { name: 'Phoenix', state: 'AZ', type: 'city', population: 1600000 },
  { name: 'Philadelphia', state: 'PA', type: 'city', population: 1600000 },
  { name: 'San Antonio', state: 'TX', type: 'city', population: 1500000 },
  { name: 'San Diego', state: 'CA', type: 'city', population: 1400000 },
  { name: 'Dallas', state: 'TX', type: 'city', population: 1300000 },
  { name: 'Austin', state: 'TX', type: 'city', population: 1000000 },
  { name: 'San Jose', state: 'CA', type: 'city', population: 1000000 },
  { name: 'San Francisco', state: 'CA', type: 'city', population: 870000 },
  { name: 'Seattle', state: 'WA', type: 'city', population: 750000 },
  { name: 'Denver', state: 'CO', type: 'city', population: 710000 },
  { name: 'Washington', state: 'DC', type: 'city', population: 690000 },
  { name: 'Nashville', state: 'TN', type: 'city', population: 680000 },
  { name: 'Boston', state: 'MA', type: 'city', population: 650000 },
  { name: 'Portland', state: 'OR', type: 'city', population: 640000 },
  { name: 'Las Vegas', state: 'NV', type: 'city', population: 640000 },
  { name: 'Atlanta', state: 'GA', type: 'city', population: 500000 },
  { name: 'Miami', state: 'FL', type: 'city', population: 440000 },
  { name: 'Minneapolis', state: 'MN', type: 'city', population: 430000 },
  { name: 'Tampa', state: 'FL', type: 'city', population: 400000 },
  { name: 'Raleigh', state: 'NC', type: 'city', population: 470000 },
  { name: 'Pittsburgh', state: 'PA', type: 'city', population: 300000 },
  { name: 'Salt Lake City', state: 'UT', type: 'city', population: 200000 },
  { name: 'Boulder', state: 'CO', type: 'city', population: 105000 },
  { name: 'Palo Alto', state: 'CA', type: 'city', population: 68000 },
  { name: 'Mountain View', state: 'CA', type: 'city', population: 82000 },
  { name: 'Sunnyvale', state: 'CA', type: 'city', population: 155000 },
  { name: 'Redmond', state: 'WA', type: 'city', population: 73000 },
  { name: 'Cupertino', state: 'CA', type: 'city', population: 60000 },
  { name: 'Menlo Park', state: 'CA', type: 'city', population: 35000 },
  { name: 'Hawthorne', state: 'CA', type: 'city', population: 88000 },
  { name: 'Irvine', state: 'CA', type: 'city', population: 310000 },
  { name: 'Huntsville', state: 'AL', type: 'city', population: 215000 },
  { name: 'Colorado Springs', state: 'CO', type: 'city', population: 480000 },
  { name: 'Tucson', state: 'AZ', type: 'city', population: 540000 },
  { name: 'Orlando', state: 'FL', type: 'city', population: 300000 },
  { name: 'Charlotte', state: 'NC', type: 'city', population: 880000 },
  { name: 'Detroit', state: 'MI', type: 'city', population: 640000 },
  { name: 'St. Louis', state: 'MO', type: 'city', population: 300000 },
  { name: 'Baltimore', state: 'MD', type: 'city', population: 570000 },
  { name: 'Albuquerque', state: 'NM', type: 'city', population: 560000 },
  { name: 'El Paso', state: 'TX', type: 'city', population: 680000 },
  { name: 'Boise', state: 'ID', type: 'city', population: 235000 },
  { name: 'Richmond', state: 'VA', type: 'city', population: 230000 },
  { name: 'Scottsdale', state: 'AZ', type: 'city', population: 240000 },
  { name: 'Arlington', state: 'VA', type: 'city', population: 240000 },
  { name: 'Ann Arbor', state: 'MI', type: 'city', population: 120000 },
]

/**
 * Build MultiSelectOption[] for the location typeahead.
 * States first (sorted alpha), then cities (sorted by population desc).
 */
export function buildLocationOptions(): Array<{ value: string; label: string; sublabel: string }> {
  const states = US_STATES.map(s => ({
    value: s.name,
    label: s.name,
    sublabel: 'state',
  }))
  const cities = US_CITIES
    .sort((a, b) => b.population - a.population)
    .map(c => ({
      value: `${c.name}, ${c.state}`,
      label: `${c.name}, ${c.state}`,
      sublabel: 'city',
    }))
  return [...states, ...cities]
}
