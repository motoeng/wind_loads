import { useMemo, useState } from "react";
import { calculateVelocityPressure, type ExposureCategory, type RiskCategory, getGcpiEnclosed } from "../lib/wind";
import ResultsCard from "./ResultsCard";
import RoofDiagram from "./RoofDiagram";

type RoofType = "flat" | "sloped";
type BuildingEnclosure = "enclosed" | "partially_enclosed";

// Calculate wall Cp values based on ASCE 7-22 Chapter 27 (MWFRS)
function calculateWallCpValues(roofL: number, roofB: number) {
	const lbRatio = roofL / roofB;
	
	// Wall pressure coefficients for MWFRS (ASCE 7-22 Chapter 27)
	// For enclosed buildings with flat roofs
	const windwardCp = 0.8;   // Windward wall (positive pressure)
	
	// Leeward wall Cp varies with L/B ratio
	let leewardCp: number;
	if (lbRatio <= 1.0) {
		leewardCp = -0.5;
	} else if (lbRatio <= 2.0) {
		// Interpolate between -0.5 (L/B=1) and -0.3 (L/B=2)
		leewardCp = -0.5 + (lbRatio - 1.0) * (-0.3 - (-0.5)) / (2.0 - 1.0);
	} else if (lbRatio <= 4.0) {
		// Interpolate between -0.3 (L/B=2) and -0.2 (L/B=4)
		leewardCp = -0.3 + (lbRatio - 2.0) * (-0.2 - (-0.3)) / (4.0 - 2.0);
	} else {
		leewardCp = -0.2;
	}
	
	const sidewallCp = -0.7;  // Sidewalls (negative pressure)
	
	return {
		windward: windwardCp,  // Windward wall
		leeward: leewardCp,    // Leeward wall (varies with L/B)
		sidewall: sidewallCp,  // Sidewalls
	};
}

// Calculate roof Cp values based on ASCE 7-22 Chapter 27 (MWFRS)
function calculateRoofCpValues(roofType: RoofType, roofL: number, roofB: number) {
	const lbRatio = roofL / roofB;
	
	if (roofType === "flat") {
		// Flat roof pressure coefficients (ASCE 7-22 Chapter 27 MWFRS)
		// Zone 1 and 3 Cp values vary with L/B ratio
		let zone1Cp = 0.8;  // Default windward edge
		let zone3Cp = -0.7; // Default leeward edge
		
		// Adjust Cp values based on L/B ratio per ASCE 7-22 Chapter 27 MWFRS
		if (lbRatio <= 0.5) {
			zone1Cp = 0.8;
			zone3Cp = -0.7;
		} else if (lbRatio <= 1.0) {
			zone1Cp = 0.7;
			zone3Cp = -0.6;
		} else if (lbRatio <= 2.0) {
			zone1Cp = 0.6;
			zone3Cp = -0.5;
		} else {
			zone1Cp = 0.5;
			zone3Cp = -0.4;
		}
		
		return {
			zone1: zone1Cp,  // Windward edge (varies with L/B)
			zone2: 0.5,      // Middle zone (constant)
			zone3: zone3Cp,  // Leeward edge (varies with L/B)
		};
	} else {
		// Sloped roof pressure coefficients (ASCE 7-22 Chapter 27 MWFRS)
		// Cp values depend on roof slope, not L/B ratio
		return {
			windward: 0.3,  // Windward slope
			leeward: -0.7,  // Leeward slope
		};
	}
}

// Calculate roof pressures based on ASCE 7-22 MWFRS (same as walls)
function calculateRoofPressures(roofType: RoofType, qz: number, kd: number, gcpi: { positive: number; negative: number }, roofL: number, roofB: number, gustFactor: number) {
	const q = qz * kd; // Velocity pressure at roof height
	const cpValues = calculateRoofCpValues(roofType, roofL, roofB);
	
	if (roofType === "flat") {
		// Flat roof pressure coefficients (ASCE 7-22 Chapter 27 MWFRS)
		// Zone widths depend on L/B ratio
		const zone1Width = Math.min(roofB * 0.2, roofL * 0.1); // 20% of B or 10% of L, whichever is smaller
		const zone2Width = roofB - zone1Width; // Remainder
		
		return {
			pressures: [
				{ label: `Roof Zone 1 (windward edge, ${zone1Width.toFixed(1)}ft)`, value: `${((q * gustFactor * cpValues.zone1) - (q * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * cpValues.zone1) - (q * gcpi.negative)).toFixed(2)} psf` },
				{ label: `Roof Zone 2 (middle, ${zone2Width.toFixed(1)}ft)`, value: `${((q * gustFactor * cpValues.zone2) - (q * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * cpValues.zone2) - (q * gcpi.negative)).toFixed(2)} psf` },
				{ label: `Roof Zone 3 (leeward edge, ${zone1Width.toFixed(1)}ft)`, value: `${((q * gustFactor * cpValues.zone3) - (q * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * cpValues.zone3) - (q * gcpi.negative)).toFixed(2)} psf` },
			],
			cpValues
		};
	} else {
		// Sloped roof pressure coefficients (ASCE 7-22 Chapter 27 MWFRS)
		return {
			pressures: [
				{ label: "Windward slope (positive)", value: `${((q * gustFactor * cpValues.windward) - (q * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * cpValues.windward) - (q * gcpi.negative)).toFixed(2)} psf` },
				{ label: "Leeward slope (negative)", value: `${((q * gustFactor * cpValues.leeward) - (q * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * cpValues.leeward) - (q * gcpi.negative)).toFixed(2)} psf` },
			],
			cpValues
		};
	}
}

// Calculate Kz using ASCE 7-22 Table 26.10-1 formula
function calculateKz(exposure: ExposureCategory, heightFt: number): number {
	const z = Math.max(15, Math.min(heightFt, 500)); // ASCE 7-22 limits
	const alpha = getAlpha(exposure);
	const zg = getZg(exposure);
	const kz = 2.01 * Math.pow(z / zg, 2 / alpha);
	return Math.round(kz * 1000) / 1000; // round to 3 decimals
}

// Calculate Gust Effect Factor (G) per ASCE 7-22 Chapter 27.4
function calculateGustEffectFactor(exposure: ExposureCategory, heightFt: number): number {
	// For rigid buildings (typical case), G = 0.85 per ASCE 7-22 Section 27.4.1
	// This is a simplified calculation - full calculation would require natural frequency
	return 0.85;
}

// Get Gcpi values based on building enclosure type per ASCE 7-22 Chapter 26.11-1
function getGcpiValues(buildingEnclosure: BuildingEnclosure): { positive: number; negative: number } {
	switch (buildingEnclosure) {
		case "enclosed":
			return { positive: 0.18, negative: -0.18 };
		case "partially_enclosed":
			return { positive: 0.55, negative: -0.55 };
	}
}

// Alpha coefficients from ASCE 7-22 Table 26.10-1
function getAlpha(exposure: ExposureCategory): number {
	switch (exposure) {
		case "B": return 7.0;
		case "C": return 9.5;
		case "D": return 11.5;
	}
}

// Zg values from ASCE 7-22 Table 26.10-1
function getZg(exposure: ExposureCategory): number {
	switch (exposure) {
		case "B": return 1200;
		case "C": return 900;
		case "D": return 700;
	}
}

interface FormState {
	windSpeedMph: string;
	exposure: ExposureCategory;
	numStories: string;
	storyHeightFt: string;
	directionalityFactor: string;
	riskCategory: RiskCategory;
	roofType: RoofType;
	buildingEnclosure: BuildingEnclosure;
	roofLength: string; // L dimension (parallel to wind)
	roofWidth: string; // B dimension (perpendicular to wind, windward edge)
	wallEvaluationHeight: string; // Height at which to evaluate wall pressures
	useManualKz: boolean;
	manualKz: string;
}

export default function WindForm() {
	const [form, setForm] = useState<FormState>({
		windSpeedMph: "115",
		exposure: "B",
		numStories: "3",
		storyHeightFt: "10",
		directionalityFactor: "0.85",
		riskCategory: "II",
		roofType: "flat",
		buildingEnclosure: "enclosed",
		roofLength: "100",
		roofWidth: "50",
		wallEvaluationHeight: "15", // Default to mid-height of 3-story building
		useManualKz: false,
		manualKz: "",
	});

	const isValid = useMemo(() => {
		const v = Number(form.windSpeedMph);
		const n = Math.floor(Number(form.numStories));
		const sh = Number(form.storyHeightFt);
		const kd = Number(form.directionalityFactor);
		const roofL = Number(form.roofLength);
		const roofB = Number(form.roofWidth);
		const wallHeight = Number(form.wallEvaluationHeight);
		return (
			isFinite(v) && v > 0 && v < 300 &&
			Number.isInteger(n) && n >= 1 && n <= 200 &&
			isFinite(sh) && sh > 4 && sh <= 20 &&
			isFinite(kd) && kd > 0 && kd <= 1 &&
			isFinite(roofL) && roofL > 0 && roofL <= 1000 &&
			isFinite(roofB) && roofB > 0 && roofB <= 1000 &&
			isFinite(wallHeight) && wallHeight > 0 && wallHeight <= n * sh &&
			(!form.useManualKz || (form.manualKz !== "" && isFinite(Number(form.manualKz)) && Number(form.manualKz) > 0.3 && Number(form.manualKz) < 3))
		);
	}, [form]);

	const { summaryItems, storyPressures, wallPressures, roofPressuresGrouped, diagram, gcpi } = useMemo(() => {
		if (!isValid) return { summaryItems: [], storyPressures: [], wallPressures: [], roofPressuresGrouped: [], diagram: null as null | { numStories: number; storyHeightFt: number; perStoryPressuresPsf: number[] }, gcpi: null };
		const n = Math.floor(Number(form.numStories));
		const sh = Number(form.storyHeightFt);
		const v = Number(form.windSpeedMph);
		const kd = Number(form.directionalityFactor);
		const exposure = form.exposure;
		const riskCategory = form.riskCategory;
		const perStoryPressuresPsf: number[] = [];
		for (let i = 1; i <= n; i++) {
			const midZ = (i - 0.5) * sh;
			const r = calculateVelocityPressure({
				windSpeedMph: v,
				exposure,
				heightFt: midZ,
				directionalityFactor: kd,
				riskCategory,
				overrideKz: form.useManualKz && form.manualKz !== "" ? Number(form.manualKz) : undefined,
			});
			perStoryPressuresPsf.push(r.velocityPressurePsf);
		}
		const totalHeight = n * sh;
		const lastMidZ = (n - 0.5) * sh;
		const topResult = calculateVelocityPressure({
			windSpeedMph: v,
			exposure,
			heightFt: lastMidZ,
			directionalityFactor: kd,
			riskCategory,
			overrideKz: form.useManualKz ? Number(form.manualKz) : undefined,
		});
		const gcpi = getGcpiValues(form.buildingEnclosure);
		
		// Calculate gust effect factor
		const gustFactor = calculateGustEffectFactor(exposure, totalHeight);
		
		// Calculate roof pressures based on roof type
		const roofResult = calculateRoofPressures(form.roofType, topResult.velocityPressurePsf, kd, gcpi, Number(form.roofLength), Number(form.roofWidth), gustFactor);
		const roofPressures = roofResult.pressures;
		const cpValues = roofResult.cpValues;
		
		// Add wall Cp values to summary
		const wallCpValues = calculateWallCpValues(Number(form.roofLength), Number(form.roofWidth));
		const wallCpSummaryItems = [
			{ label: "Wall Cp Windward", value: wallCpValues.windward },
			{ label: "Wall Cp Leeward", value: wallCpValues.leeward },
			{ label: "Wall Cp Sidewalls", value: wallCpValues.sidewall },
		];

		const summaryItems = [
			{ label: "Stories", value: n },
			{ label: "Story height (ft)", value: sh },
			{ label: "Total height (ft)", value: totalHeight },
			{ label: "V (mph)", value: v },
			{ label: "Exposure", value: exposure },
			{ label: "Risk Category", value: riskCategory },
			{ label: "Kd", value: kd },
			{ label: "G (Gust Factor)", value: gustFactor },
			{ label: "Gcpi (+)", value: gcpi.positive },
			{ label: "Gcpi (-)", value: gcpi.negative },
			{ label: "Top story qz (psf)", value: topResult.velocityPressurePsf },
			...wallCpSummaryItems,
		];
		
		// Group story pressures separately
		const storyPressures = perStoryPressuresPsf.map((p, idx) => ({
			label: `Story ${idx + 1} qz (psf)`,
			value: p,
		}));
		
		// Group roof pressures separately
		const roofPressuresGrouped = roofPressures.map((p, idx) => ({
			label: p.label,
			value: p.value,
		}));
		
		// Calculate wall pressures using correct ASCE 7-22 formula
		// Wall Pressure = (q × G × Cp) - (qi × Gcpi)
		// where q = velocity pressure at wall height, qi = velocity pressure at roof height
		const wallEvaluationHeight = Number(form.wallEvaluationHeight);
		const wallResult = calculateVelocityPressure({
			windSpeedMph: v,
			exposure,
			heightFt: wallEvaluationHeight,
			directionalityFactor: kd,
			riskCategory,
			overrideKz: form.useManualKz ? Number(form.manualKz) : undefined,
		});
		const q = wallResult.velocityPressurePsf; // q at wall evaluation height
		const qi = topResult.velocityPressurePsf; // qi at roof height
		
		const wallPressures = [
			{ label: `Windward wall pressure (at ${wallEvaluationHeight}ft)`, value: `${((q * gustFactor * wallCpValues.windward) - (qi * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * wallCpValues.windward) - (qi * gcpi.negative)).toFixed(2)} psf` },
			{ label: `Leeward wall pressure (at ${wallEvaluationHeight}ft)`, value: `${((q * gustFactor * wallCpValues.leeward) - (qi * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * wallCpValues.leeward) - (qi * gcpi.negative)).toFixed(2)} psf` },
			{ label: `Sidewall pressure (at ${wallEvaluationHeight}ft)`, value: `${((q * gustFactor * wallCpValues.sidewall) - (qi * gcpi.positive)).toFixed(2)}, ${((q * gustFactor * wallCpValues.sidewall) - (qi * gcpi.negative)).toFixed(2)} psf` },
		];
		
		return { 
			summaryItems, 
			storyPressures, 
			wallPressures,
			roofPressuresGrouped,
			diagram: { numStories: n, storyHeightFt: sh, perStoryPressuresPsf }, 
			gcpi 
		};
	}, [form, isValid]);

	return (
		<div style={{ display: "grid", gap: 12 }}>
			<h2>ASCE 7-22 Wind Load Calculator (MWFRS)</h2>
			<div className="form-container">
				<div className="form-inputs">
					<div className="form-section">
						<div className="form-section-title">Basic Parameters</div>
						<div className="form-row">
							<div className="form-label">Basic wind speed V (mph)</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.windSpeedMph} 
								onChange={(e) => setForm({ ...form, windSpeedMph: e.target.value })} 
								min={10} 
								max={300} 
								step={1} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Exposure Category</div>
							<select 
								className="form-select" 
								value={form.exposure} 
								onChange={(e) => setForm({ ...form, exposure: e.target.value as ExposureCategory })}
							>
								<option value="B">B (Urban/Suburban)</option>
								<option value="C">C (Open terrain)</option>
								<option value="D">D (Flat, unobstructed)</option>
							</select>
						</div>
						<div className="form-row">
							<div className="form-label">Risk Category</div>
							<select 
								className="form-select" 
								value={form.riskCategory} 
								onChange={(e) => setForm({ ...form, riskCategory: e.target.value as RiskCategory })}
							>
								<option value="I">I (I=0.87)</option>
								<option value="II">II (I=1.0)</option>
								<option value="III">III (I=1.15)</option>
								<option value="IV">IV (I=1.15)</option>
							</select>
						</div>
						<div className="form-row">
							<div className="form-label">Building Enclosure</div>
							<select 
								className="form-select" 
								value={form.buildingEnclosure} 
								onChange={(e) => setForm({ ...form, buildingEnclosure: e.target.value as BuildingEnclosure })}
							>
								<option value="enclosed">Enclosed Building</option>
								<option value="partially_enclosed">Partially Enclosed Building</option>
							</select>
						</div>
					</div>

					<div className="form-section">
						<div className="form-section-title">Building Dimensions</div>
						<div className="form-row">
							<div className="form-label">Number of stories</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.numStories} 
								onChange={(e) => setForm({ ...form, numStories: e.target.value })} 
								min={1} 
								max={200} 
								step={1} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Story height (ft)</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.storyHeightFt} 
								onChange={(e) => setForm({ ...form, storyHeightFt: e.target.value })} 
								min={6} 
								max={20} 
								step={0.5} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Wall evaluation height (ft)</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.wallEvaluationHeight} 
								onChange={(e) => setForm({ ...form, wallEvaluationHeight: e.target.value })} 
								min={1} 
								max={Math.floor(Number(form.numStories)) * Number(form.storyHeightFt)} 
								step={0.5} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Roof Length L (ft)</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.roofLength} 
								onChange={(e) => setForm({ ...form, roofLength: e.target.value })} 
								min={10} 
								max={1000} 
								step={1} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Roof Width B (ft)</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.roofWidth} 
								onChange={(e) => setForm({ ...form, roofWidth: e.target.value })} 
								min={10} 
								max={1000} 
								step={1} 
							/>
						</div>
					</div>

					<div className="form-section">
						<div className="form-section-title">Calculated Values</div>
						<div className="form-row">
							<div className="form-label">Kz (calculated)</div>
							<input 
								className="form-input" 
								type="text" 
								value={isValid ? calculateKz(form.exposure, Math.floor(Number(form.numStories)) * Number(form.storyHeightFt)).toFixed(3) : "---"} 
								readOnly 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Directionality factor Kd</div>
							<input 
								className="form-input" 
								type="number" 
								value={form.directionalityFactor} 
								onChange={(e) => setForm({ ...form, directionalityFactor: e.target.value })} 
								min={0.1} 
								max={1} 
								step={0.01} 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Gust Effect Factor G</div>
							<input 
								className="form-input" 
								type="text" 
								value={isValid ? calculateGustEffectFactor(form.exposure, Math.floor(Number(form.numStories)) * Number(form.storyHeightFt)).toFixed(2) : "---"} 
								readOnly 
							/>
						</div>
						<div className="form-row">
							<div className="form-label">Gcpi ({form.buildingEnclosure === "enclosed" ? "enclosed" : "partially enclosed"})</div>
							<div>
								<div className="form-info">Gcpi (+): {getGcpiValues(form.buildingEnclosure).positive}</div>
								<div className="form-info">Gcpi (-): {getGcpiValues(form.buildingEnclosure).negative}</div>
								<div className="form-info">ASCE 7-22 Chapter 26.11-1</div>
							</div>
						</div>
					</div>

					<div className="form-section">
						<div className="form-section-title">Roof Parameters</div>
						<div className="form-row">
							<div className="form-label">Roof Type</div>
							<select 
								className="form-select" 
								value={form.roofType} 
								onChange={(e) => setForm({ ...form, roofType: e.target.value as RoofType })}
							>
								<option value="flat">Flat roof (≤5°)</option>
								<option value="sloped">Sloped roof (5°-45°)</option>
							</select>
						</div>
						{isValid && (() => {
							const wallCpValues = calculateWallCpValues(Number(form.roofLength), Number(form.roofWidth));
							const lbRatio = Number(form.roofLength) / Number(form.roofWidth);
							return (
								<div className="form-row">
									<div className="form-label">Wall Cp (calculated)</div>
									<div>
										<div className="form-info">Windward wall: Cp = {wallCpValues.windward}</div>
										<div className="form-info">Leeward wall: Cp = {wallCpValues.leeward}</div>
										<div className="form-info">Sidewalls: Cp = {wallCpValues.sidewall}</div>
										<div className="form-info">ASCE 7-22 Chapter 27 MWFRS (L/B = {lbRatio.toFixed(2)})</div>
									</div>
								</div>
							);
						})()}
					</div>

					<details>
						<summary>Advanced: Manual Kz override</summary>
						<div style={{ display: "grid", gap: 8, marginTop: 8 }}>
							<div className="form-row">
								<div className="form-label">Use manual Kz</div>
								<input 
									className="form-checkbox" 
									type="checkbox" 
									checked={form.useManualKz} 
									onChange={(e) => setForm({ ...form, useManualKz: e.target.checked })} 
								/>
							</div>
							{form.useManualKz && (
								<div className="form-row">
									<div className="form-label">Manual Kz</div>
									<input 
										className="form-input" 
										type="number" 
										value={form.manualKz} 
										onChange={(e) => setForm({ ...form, manualKz: e.target.value })} 
										min={0.3} 
										max={3} 
										step={0.01} 
									/>
								</div>
							)}
						</div>
					</details>
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					{!isValid && (<div style={{ color: "crimson" }}>Check inputs are within reasonable ranges.</div>)}
					{isValid && diagram && (
						<div style={{ display: "grid", gap: 16 }}>
							<ResultsCard title="Building Parameters" items={summaryItems} diagram={diagram} showData={false} />
							<ResultsCard title="Story Pressures" items={storyPressures} />
							<ResultsCard title="Wall Pressures" items={wallPressures} />
							<ResultsCard title="Roof Pressures" items={roofPressuresGrouped} />
							<RoofDiagram 
								roofType={form.roofType}
								windSpeedMph={Number(form.windSpeedMph)}
								exposure={form.exposure}
								heightFt={Math.floor(Number(form.numStories)) * Number(form.storyHeightFt)}
								velocityPressurePsf={summaryItems.find(item => item.label === "Top story qz (psf)")?.value as number || 0}
								roofLength={Number(form.roofLength)}
								roofWidth={Number(form.roofWidth)}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}