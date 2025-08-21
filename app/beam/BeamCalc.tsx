'use client';

import React, { useMemo, useState } from "react";

// BeamCalc V1 – simply supported beam with either:
//  1) Uniformly distributed load (UDL) over full span, or
//  2) Single point load at midspan
// Outputs: reactions, peak shear, peak moment, max deflection.
// Units: choose US (kip, in) or Metric (kN, mm). Internally, we compute in base units (force, length)
// and display in user-chosen units.

// ------------------ Types ------------------
type Units = "US" | "Metric";

type LoadType = "UDL" | "Point (midspan)";

interface Inputs {
  units: Units;
  span: number; // length (in or mm depending on units)
  E: number; // modulus (ksi or GPa)
  I: number; // moment of inertia (in^4 or mm^4)
  loadType: LoadType;
  w: number; // UDL magnitude (kip/in or kN/mm)
  P: number; // point load magnitude (kip or kN)
}

// ------------------ Unit Helpers ------------------
function label(u: Units, us: string, metric: string) {
  return u === "US" ? us : metric;
}

// Convert inputs to a consistent internal system for calcs
// We'll use: Force = N, Length = m internally via SI (to avoid big/small numbers).
// US conversions: kip->kN, in->m, E ksi->GPa-ish mapping.

const IN_TO_M = 0.0254;
const MM_TO_M = 0.001;
const KIP_TO_KN = 4.4482216153; // 1 kip = 4.4482216153 kN
const KSI_TO_GPA = 6.89475729 / 1000; // 1 psi = 6.894757e-3 kPa; 1 ksi = 6.894757 GPa? Careful: 1 ksi = 6.894757 MPa. => 0.006894757 GPa
// Correct value:
const KSI_TO_GPA_CORRECT = 0.006894757293168361;

// For display back:
const KN_TO_KIP = 1 / KIP_TO_KN;
const M_TO_IN = 39.3700787402;
const M_TO_MM = 1000;

// ------------------ Mechanics Formulas ------------------
// Simply supported beam of span L with UDL w (N/m):
// Max moment Mmax = w L^2 / 8
// Max deflection delta_max = 5 w L^4 / (384 E I)
// Reactions = w L / 2 each; Vmax = w L / 2

// Simply supported beam with midspan point load P (N):
// Mmax = P L / 4; delta_max = P L^3 / (48 E I)
// Reactions = P/2 each; Vmax = P/2

interface Results {
  R: number; // reaction at each support (kN)
  Vmax: number; // peak shear (kN)
  Mmax: number; // peak moment (kN·m)
  deflMax: number; // max deflection (mm)
}

function compute(inputs: Inputs): Results | null {
  const { units, span, E, I, loadType, w, P } = inputs;
  if (!span || !E || !I || (loadType === "UDL" ? !w : !P)) return null;

  // Convert to SI base: length m, force kN, E GPa, I m^4
  let L_m = 0;
  let E_GPa = 0;
  let I_m4 = 0;
  let w_kN_per_m = 0;
  let P_kN = 0;

  if (units === "US") {
    L_m = span * IN_TO_M;
    E_GPa = E * KSI_TO_GPA_CORRECT; // ksi -> GPa
    // I in^4 -> m^4
    const IN4_TO_M4 = Math.pow(IN_TO_M, 4);
    I_m4 = I * IN4_TO_M4;
    if (loadType === "UDL") {
      // w (kip/in) -> kN/m
      w_kN_per_m = w * KIP_TO_KN / IN_TO_M;
    } else {
      // P (kip) -> kN
      P_kN = P * KIP_TO_KN;
    }
  } else {
    // Metric input expects mm & kN & GPa
    L_m = span * MM_TO_M; // mm -> m
    E_GPa = E; // already GPa
    // I mm^4 -> m^4
    const MM4_TO_M4 = Math.pow(MM_TO_M, 4);
    I_m4 = I * MM4_TO_M4;
    if (loadType === "UDL") {
      // w (kN/mm) -> kN/m
      w_kN_per_m = w / MM_TO_M;
    } else {
      // P kN -> kN
      P_kN = P;
    }
  }

  const E_kN_per_m2 = E_GPa * 1e6; // 1 GPa = 1e9 N/m^2 = 1e6 kN/m^2

  let R_kN = 0;
  let Vmax_kN = 0;
  let Mmax_kN_m = 0;
  let defl_m = 0;

  if (loadType === "UDL") {
    R_kN = (w_kN_per_m * L_m) / 2;
    Vmax_kN = R_kN; // peak at supports
    Mmax_kN_m = (w_kN_per_m * Math.pow(L_m, 2)) / 8;
    defl_m = (5 * w_kN_per_m * Math.pow(L_m, 4)) / (384 * E_kN_per_m2 * I_m4);
  } else {
    R_kN = P_kN / 2;
    Vmax_kN = R_kN;
    Mmax_kN_m = (P_kN * L_m) / 4;
    defl_m = (P_kN * Math.pow(L_m, 3)) / (48 * E_kN_per_m2 * I_m4);
  }

  // Convert for display: kN, kN, kN·m, mm
  const defl_mm = defl_m * M_TO_MM;
  return {
    R: R_kN,
    Vmax: Vmax_kN,
    Mmax: Mmax_kN_m,
    deflMax: defl_mm,
  };
}

// ------------------ UI ------------------
export default function BeamCalc() {
  const [inputs, setInputs] = useState<Inputs>({
    units: "US",
    span: 120, // in or mm
    E: 29000, // ksi or GPa
    I: 200, // in^4 or mm^4
    loadType: "UDL",
    w: 0.001, // kip/in or kN/mm
    P: 10, // kip or kN
  });

  const results = useMemo(() => compute(inputs), [inputs]);

  function numberInput(name: keyof Inputs, step = 0.001) {
    return (
      <input
        className="w-full rounded-xl border p-2"
        type="number"
        step={step}
        value={Number(inputs[name] ?? 0)}
        onChange={(e) => setInputs({ ...inputs, [name]: parseFloat(e.target.value) })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Beam Loads & Deflection – V1</h1>
            <p className="text-sm text-gray-600">Simply supported beam. Choose UDL or midspan point load. Calculates reactions, peak shear/moment, and max deflection.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Units</label>
            <select
              className="rounded-xl border p-2"
              value={inputs.units}
              onChange={(e) => setInputs({ ...inputs, units: e.target.value as Units })}
            >
              <option value="US">US (kip, in)</option>
              <option value="Metric">Metric (kN, mm)</option>
            </select>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Geometry & Section</h2>
            <label className="text-sm">Span L ({label(inputs.units, "in", "mm")})</label>
            {numberInput("span", 1)}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">E ({label(inputs.units, "ksi", "GPa")})</label>
                {numberInput("E", 1)}
              </div>
              <div>
                <label className="text-sm">I ({label(inputs.units, "in^4", "mm^4")})</label>
                {numberInput("I", 1)}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Tip: Steel E ≈ 29,000 ksi (US) or 200 GPa (Metric). For a rectangle, I = b·h³/12.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Loading</h2>
            <label className="text-sm">Load type</label>
            <select
              className="w-full rounded-xl border p-2"
              value={inputs.loadType}
              onChange={(e) => setInputs({ ...inputs, loadType: e.target.value as LoadType })}
            >
              <option>UDL</option>
              <option>Point (midspan)</option>
            </select>
            {inputs.loadType === "UDL" ? (
              <div className="mt-3">
                <label className="text-sm">w ({label(inputs.units, "kip/in", "kN/mm")})</label>
                {numberInput("w", 0.0001)}
              </div>
            ) : (
              <div className="mt-3">
                <label className="text-sm">P ({label(inputs.units, "kip", "kN")})</label>
                {numberInput("P", 0.1)}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">V1 assumes load spans full length or acts at midspan. More cases coming soon.</p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">Results</h2>
            {results ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Reaction (each):</span><span>{results.R.toFixed(3)} kN</span></div>
                <div className="flex justify-between"><span>Peak Shear |V|max:</span><span>{results.Vmax.toFixed(3)} kN</span></div>
                <div className="flex justify-between"><span>Peak Moment Mmax:</span><span>{results.Mmax.toFixed(3)} kN·m</span></div>
                <div className="flex justify-between"><span>Max Deflection δmax:</span><span>{results.deflMax.toFixed(3)} mm</span></div>
                <p className="text-xs text-gray-500">Display units fixed to kN, kN·m, mm for clarity. (US inputs are converted internally.)</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Enter span, E, I, and a load to see results.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Notes & Formulas</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-gray-700">
            <li>Simply supported beam with UDL: R = wL/2; Mmax = wL²/8; δmax = 5wL⁴/(384EI).</li>
            <li>Midspan point load: R = P/2; Mmax = PL/4; δmax = PL³/(48EI).</li>
            <li>Steel: E ≈ 29,000 ksi ≈ 200 GPa. Deflection sign shown as magnitude. Serviceability checks often compare δmax to L/240, L/360, etc.</li>
            <li>Use consistent units. This tool converts inputs to SI for calculations and reports results in kN, kN·m, and mm.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
