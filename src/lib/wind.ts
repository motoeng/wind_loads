export type ExposureCategory = "B" | "C" | "D";
export type RiskCategory = "I" | "II" | "III" | "IV";

export interface WindInput {
	// Basic wind speed at 3-sec gust, mph
	windSpeedMph: number;
	// Exposure category
	exposure: ExposureCategory;
	// Height above ground, ft
	heightFt: number;
	// Directionality factor Kd
	directionalityFactor?: number; // default 0.85 for MWFRS
	// Topographic factor Kzt
	topographicFactor?: number; // default 1.0 typically
	// Risk Category (determines I factor)
	riskCategory?: RiskCategory; // default "II"
	// Optional manual override for Kz
	overrideKz?: number;
	// Optional Kh factor (multiplier), default 1.0
	khFactor?: number;
}

export interface WindResult {
	velocityPressurePsf: number; // qz, psf
	pressureNotes: string[];
}

// ASCE 7-22 velocity pressure at height z (qz) in psf:
// qz = 0.00256 * Kz * Kzt * Ke * V^2 * I
// This is a simplified educational calculator, not a substitute for engineering judgment.
export function calculateVelocityPressure(input: WindInput): WindResult {
	const { windSpeedMph, exposure, heightFt } = input;
	const kd = input.directionalityFactor ?? 0.85;
	const kzt = input.topographicFactor ?? 1.0;
	const riskCategory = input.riskCategory ?? "II";
	const importance = getImportanceFactor(riskCategory);
	const computedKz = getKz(exposure, heightFt);
	const kz = Number.isFinite(input.overrideKz ?? NaN) ? (input.overrideKz as number) : computedKz;
	const kh = input.khFactor ?? 1.0;
	// ASCE 7-22: qz = 0.00256 * Kz * Kzt * Ke * V^2 (Kd moved to design pressure)
	const qzBase = 0.00256 * kz * kzt * kh * windSpeedMph * windSpeedMph;
	const qz = qzBase * importance;
	const pressureNotes: string[] = [];
	pressureNotes.push(`Risk Cat ${riskCategory}: Kd=${kd.toFixed(2)}, Kzt=${kzt.toFixed(2)}, I=${importance.toFixed(2)}, Kz=${kz.toFixed(3)}, Kh=${kh.toFixed(2)}`);
	if (kz !== computedKz) {
		pressureNotes.push(`Manual Kz override used (auto was ${computedKz.toFixed(3)})`);
	}
	pressureNotes.push("Formula: qz = 0.00256 * Kz * Kzt * Ke * V^2 * I (psf)");
	return {
		velocityPressurePsf: roundTo(qz, 3),
		pressureNotes,
	};
}

// ASCE 7-22 Table 26.10-1 Kz values with proper alpha coefficients
function getKz(exposure: ExposureCategory, heightFt: number): number {
	const z = Math.max(15, Math.min(heightFt, 500)); // ASCE 7-22 limits
	const alpha = getAlpha(exposure);
	const zg = getZg(exposure);
	const kz = 2.01 * Math.pow(z / zg, 2 / alpha);
	return roundTo(kz, 3);
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

// Importance factors from ASCE 7-22 Table 1.5-2
function getImportanceFactor(riskCategory: RiskCategory): number {
	switch (riskCategory) {
		case "I": return 0.87;
		case "II": return 1.0;
		case "III": return 1.15;
		case "IV": return 1.15;
		default: return 1.0;
	}
}

function roundTo(value: number, decimals: number): number {
	const factor = Math.pow(10, decimals);
	return Math.round(value * factor) / factor;
}

// Gcpi values for enclosed buildings (ASCE 7-22 Table 26.11-1)
export function getGcpiEnclosed(): { positive: number; negative: number } {
	return { positive: 0.18, negative: -0.18 };
}