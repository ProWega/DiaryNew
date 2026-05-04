#!/usr/bin/env node
/* eslint-env node */
/* global console */
/**
 * Build-time precomputation of SVG paths for the «Истоки» public map.
 *
 * Reads public/istoki/russia-subjects.geojson, applies a brand-locked
 * projection sized to the 1000x500 viewBox, and writes
 * public/istoki/russia-paths.json with per-feature `d` strings + centroid.
 *
 * Synthetic polygons (the six post-2014/2022 RF subjects added by hand
 * in the GeoJSON) get expanded in-place before projection so they read
 * as clickable regions on the rendered map instead of pixel-sized dots.
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

// Minimum visible footprint for the synthetic polygons (post-2014/2022
// subjects missing from the upstream click_that_hood dataset). Their
// real-world extents are small enough that fitExtent compresses them to
// 1–2 px when projected alongside Чукотка. Sizing them up to ~3°×1.5°
// (~330×165 km) keeps them clickable without claiming cartographic truth.
const SYNTHETIC_MIN_LON_RADIUS = 1.5;
const SYNTHETIC_MIN_LAT_RADIUS = 0.75;

function expandSyntheticPolygon(feature) {
  // Compute centroid in lon/lat by averaging ring vertices.
  const ring = feature.geometry.coordinates[0];
  const sum = ring.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), {
    lon: 0,
    lat: 0,
  });
  const cx = sum.lon / ring.length;
  const cy = sum.lat / ring.length;

  // Hexagonal footprint around the centroid — closer to a real region
  // outline than a square, still obviously decorative.
  const dx = SYNTHETIC_MIN_LON_RADIUS;
  const dy = SYNTHETIC_MIN_LAT_RADIUS;
  const hex = [
    [cx - dx, cy],
    [cx - dx * 0.6, cy + dy],
    [cx + dx * 0.6, cy + dy],
    [cx + dx, cy],
    [cx + dx * 0.6, cy - dy],
    [cx - dx * 0.6, cy - dy],
    [cx - dx, cy], // close
  ];
  return {
    ...feature,
    geometry: { type: "Polygon", coordinates: [hex] },
  };
}

const geojson = JSON.parse(readFileSync(SRC, "utf8"));

geojson.features = geojson.features.map((feature) =>
  feature.properties.synthetic ? expandSyntheticPolygon(feature) : feature,
);

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
