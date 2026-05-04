#!/usr/bin/env node
/* eslint-env node */
/* global console */
/**
 * Build-time precomputation of SVG paths for the «Истоки» public map.
 *
 * Reads public/istoki/russia-subjects.geojson, applies a brand-locked
 * Albers conic projection sized to the 1000x500 viewBox, and writes
 * public/istoki/russia-paths.json with per-feature `d` strings + centroid.
 *
 * The frontend (`RussiaMap.jsx`) renders plain `<path>` elements, so no
 * runtime geo library is needed — `react-simple-maps` was retired
 * because Vite v8's optimizer chokes on its CommonJS d3-geo subdeps
 * under React 19.
 *
 * Run via `npm run build:istoki-map`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { geoAlbers, geoPath } from "d3-geo";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const SRC = path.join(REPO_ROOT, "public", "istoki", "russia-subjects.geojson");
const DST = path.join(REPO_ROOT, "public", "istoki", "russia-paths.json");

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;

const geojson = JSON.parse(readFileSync(SRC, "utf8"));

// geoAlbers is the classical equal-area conic projection used for wide
// northern countries. rotate([-105, 0]) brings the central meridian to
// ~105°E (central Russia); center([-10, 65]) shifts the visual centre
// north so the polar regions don't dominate; parallels [50, 70] match
// Russia's mid-latitude band.
const projection = geoAlbers()
  .rotate([-105, 0])
  .center([-10, 65])
  .parallels([50, 70])
  .fitExtent(
    [
      [20, 20],
      [VIEWBOX_WIDTH - 20, VIEWBOX_HEIGHT - 20],
    ],
    geojson,
  );

const pathFn = geoPath(projection);

const features = geojson.features.map((feature) => ({
  name: feature.properties.name,
  nameEn: feature.properties.name_en ?? null,
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
