// Utilities for loading species archetypes and scenarios via fetch.

export async function loadArchetype(name: string): Promise<any> {
  const url = `/src/data/species/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load archetype ${name}: HTTP ${res.status}`);
  }
  return res.json();
}

export async function loadScenario(name: string): Promise<any> {
  const url = `/src/data/scenarios/${name}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load scenario ${name}: HTTP ${res.status}`);
  }
  return res.json();
}
