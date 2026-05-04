#!/usr/bin/env node
/* eslint-env node */
/* global console */
/**
 * Build-time precomputation of SVG paths for the «Истоки» public map.
 *
 * Reads public/istoki/russia-subjects.geojson, applies a conic equidistant
 * projection sized to the brand-locked map viewBox (1000x500), and writes
 * public/istoki/russia-paths.json with per-feature `d` strings + centroid.
 *
 * This bypasses Vite v8's optimizer choking on react-simple-maps under
 * React 19 — the frontend renders plain `<path>` elements with no runtime
 * geo library required.
 *
 * Run via `npm run build:istoki-map`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { geoConicEquidistant, geoPath } from "d3-geo";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const SRC = path.join(REPO_ROOT, "public", "istoki", "russia-subjects.geojson");
const DST = path.join(REPO_ROOT, "public", "istoki", "russia-paths.json");

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;

const geojson = JSON.parse(readFileSync(SRC, "utf8"));

// Conic equidistant centred over central Russia. Rotate ~-100° to bring
// Russia to the centre and pull the antimeridian out of the way so Chukotka
// stays on the right edge of the map. fitSize handles scaling automatically.
const projection = geoConicEquidistant()
  .rotate([-100, -52, 0])
  .fitSize([VIEWBOX_WIDTH, VIEWBOX_HEIGHT], geojson);

const pathFn = geoPath(projection);

const features = geojson.features.map((feature) => ({
  name: feature.properties.name,
  nameEn: feature.properties.name_en ?? null,
  synthetic: Boolean(feature.properties.synthetic),
  d: pathFn(feature),
  centroid: pathFn.centroid(feature).map((n) => Number(n.toFixed(2))),
}));

const output = {
  width: VIEWBOX_WIDTH,
  height: VIEWBOX_HEIGHT,
  features,
};

writeFileSync(DST, JSON.stringify(output));
console.log(`Wrote ${features.length} feature paths to ${path.relative(REPO_ROOT, DST)}`);
