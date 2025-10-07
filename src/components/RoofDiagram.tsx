import { useRef, useState, useEffect } from "react";

interface RoofDiagramProps {
	roofType: "flat" | "sloped";
	windSpeedMph: number;
	exposure: string;
	heightFt: number;
	velocityPressurePsf: number;
	roofLength: number;
	roofWidth: number;
}

export default function RoofDiagram({ roofType, windSpeedMph, exposure, heightFt, velocityPressurePsf, roofLength, roofWidth }: RoofDiagramProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [dataUrl, setDataUrl] = useState<string | null>(null);

	async function handleRenderImage() {
		if (!ref.current) return;
		const container = ref.current;
		const width = Math.max(360, Math.ceil(container.clientWidth || 480));
		const padding = 16;
		const lineGap = 8;
		const titleFont = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
		const bodyFont = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
		
		// Roof dimensions
		const diagramWidth = 200;
		const diagramHeight = roofType === "sloped" ? 60 : 20;
		const buildingHeight = 80;
		const totalHeight = buildingHeight + diagramHeight + 40; // extra for labels
		const height = padding * 2 + totalHeight;

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Background
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, width, height);

		// Border
		ctx.strokeStyle = "#dddddd";
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

		// Title
		ctx.font = titleFont;
		ctx.fillStyle = "#111111";
		ctx.textBaseline = "top";
		ctx.fillText(`Roof Wind Loads - ${roofType === "flat" ? "Flat" : "Sloped"} Roof (L=${roofLength}ft, B=${roofWidth}ft)`, padding, padding);

		// Building outline
		const startX = (width - diagramWidth) / 2;
		const startY = padding + 30;
		
		// Building walls
		ctx.strokeStyle = "#444";
		ctx.lineWidth = 2;
		ctx.strokeRect(startX, startY + diagramHeight, diagramWidth, buildingHeight);

		// Roof with proper L/B proportions
		const scale = Math.min(diagramWidth / roofLength, diagramHeight / roofWidth);
		const scaledL = roofLength * scale;
		const scaledB = roofWidth * scale;
		const roofStartX = startX + (diagramWidth - scaledL) / 2;
		const roofStartY = startY + (diagramHeight - scaledB) / 2;

		// Roof with proper L/B proportions and zone widths
		if (roofType === "flat") {
			// Flat roof with scaled dimensions
			ctx.strokeStyle = "#444";
			ctx.lineWidth = 2;
			ctx.strokeRect(roofStartX, roofStartY, scaledL, scaledB);
			
			// Calculate zone widths based on ASCE 7-22
			const zone1Width = Math.min(scaledB * 0.2, scaledL * 0.1); // 20% of B or 10% of L, whichever is smaller
			const zone2Width = scaledB - zone1Width; // Remainder
			
			// Zone 1 (windward edge)
			ctx.fillStyle = "rgba(255, 100, 100, 0.3)";
			ctx.fillRect(roofStartX, roofStartY, zone1Width, scaledB);
			ctx.strokeStyle = "#ff6464";
			ctx.lineWidth = 1;
			ctx.strokeRect(roofStartX, roofStartY, zone1Width, scaledB);
			
			// Zone 2 (middle)
			ctx.fillStyle = "rgba(100, 255, 100, 0.3)";
			ctx.fillRect(roofStartX + zone1Width, roofStartY, zone2Width, scaledB);
			ctx.strokeStyle = "#64ff64";
			ctx.lineWidth = 1;
			ctx.strokeRect(roofStartX + zone1Width, roofStartY, zone2Width, scaledB);
			
			// Zone 3 (leeward edge)
			ctx.fillStyle = "rgba(100, 100, 255, 0.3)";
			ctx.fillRect(roofStartX + zone1Width + zone2Width, roofStartY, zone1Width, scaledB);
			ctx.strokeStyle = "#6464ff";
			ctx.lineWidth = 1;
			ctx.strokeRect(roofStartX + zone1Width + zone2Width, roofStartY, zone1Width, scaledB);
			
			// Zone labels with actual dimensions
			ctx.font = bodyFont;
			ctx.fillStyle = "#333";
			ctx.textAlign = "center";
			ctx.fillText(`Zone 1 (${(zone1Width/scale).toFixed(1)}ft)`, roofStartX + zone1Width/2, roofStartY + scaledB/2);
			ctx.fillText(`Zone 2 (${(zone2Width/scale).toFixed(1)}ft)`, roofStartX + zone1Width + zone2Width/2, roofStartY + scaledB/2);
			ctx.fillText(`Zone 3 (${(zone1Width/scale).toFixed(1)}ft)`, roofStartX + zone1Width + zone2Width + zone1Width/2, roofStartY + scaledB/2);
			
		} else {
			// Sloped roof
			const slopeAngle = 30; // degrees
			const roofSlope = Math.tan(slopeAngle * Math.PI / 180);
			const roofTopX = startX + roofWidth / 2;
			const roofTopY = startY;
			const roofLeftX = startX;
			const roofLeftY = startY + roofHeight;
			const roofRightX = startX + roofWidth;
			const roofRightY = startY + roofHeight;
			
			// Roof outline
			ctx.strokeStyle = "#444";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(roofLeftX, roofLeftY);
			ctx.lineTo(roofTopX, roofTopY);
			ctx.lineTo(roofRightX, roofRightY);
			ctx.stroke();
			
			// Pressure zones for sloped roof
			// Windward slope (positive pressure)
			ctx.fillStyle = "rgba(255, 200, 100, 0.3)";
			ctx.beginPath();
			ctx.moveTo(roofLeftX, roofLeftY);
			ctx.lineTo(roofTopX, roofTopY);
			ctx.lineTo(roofTopX, roofLeftY);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = "#ffc864";
			ctx.lineWidth = 1;
			ctx.stroke();
			
			// Leeward slope (negative pressure)
			ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
			ctx.beginPath();
			ctx.moveTo(roofTopX, roofTopY);
			ctx.lineTo(roofRightX, roofRightY);
			ctx.lineTo(roofTopX, roofRightY);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = "#64c8ff";
			ctx.lineWidth = 1;
			ctx.stroke();
			
			// Zone labels
			ctx.font = bodyFont;
			ctx.fillStyle = "#333";
			ctx.fillText("Windward", roofLeftX + 10, roofLeftY - 10);
			ctx.fillText("Leeward", roofTopX + 10, roofRightY - 10);
		}

		// Pressure direction arrows
		if (roofType === "flat") {
			// Flat roof pressure arrows
			const zoneHeight = roofHeight / 3;
			const arrowLength = 20;
			
			// Zone 1 arrows (positive pressure - inward)
			for (let i = 0; i < 3; i++) {
				const arrowX = startX + 10 + i * 15;
				const arrowY = startY + zoneHeight / 2;
				// Arrow pointing down (positive pressure)
				ctx.strokeStyle = "#ff6464";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(arrowX, arrowY + arrowLength);
				ctx.stroke();
				// Arrow head
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY + arrowLength);
				ctx.lineTo(arrowX - 4, arrowY + arrowLength - 8);
				ctx.lineTo(arrowX + 4, arrowY + arrowLength - 8);
				ctx.closePath();
				ctx.fillStyle = "#ff6464";
				ctx.fill();
			}
			
			// Zone 2 arrows (lower positive pressure)
			for (let i = 0; i < 4; i++) {
				const arrowX = startX + roofWidth * 0.2 + 10 + i * 20;
				const arrowY = startY + zoneHeight / 2;
				ctx.strokeStyle = "#64ff64";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(arrowX, arrowY + arrowLength * 0.7);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY + arrowLength * 0.7);
				ctx.lineTo(arrowX - 3, arrowY + arrowLength * 0.7 - 6);
				ctx.lineTo(arrowX + 3, arrowY + arrowLength * 0.7 - 6);
				ctx.closePath();
				ctx.fillStyle = "#64ff64";
				ctx.fill();
			}
			
			// Zone 3 arrows (negative pressure - outward)
			for (let i = 0; i < 2; i++) {
				const arrowX = startX + roofWidth * 0.8 + 10 + i * 15;
				const arrowY = startY + zoneHeight / 2;
				// Arrow pointing up (negative pressure)
				ctx.strokeStyle = "#6464ff";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(arrowX, arrowY - arrowLength);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY - arrowLength);
				ctx.lineTo(arrowX - 4, arrowY - arrowLength + 8);
				ctx.lineTo(arrowX + 4, arrowY - arrowLength + 8);
				ctx.closePath();
				ctx.fillStyle = "#6464ff";
				ctx.fill();
			}
		} else {
			// Sloped roof pressure arrows
			const arrowLength = 25;
			
			// Windward slope arrows (positive pressure - inward)
			for (let i = 0; i < 3; i++) {
				const arrowX = startX + 30 + i * 25;
				const arrowY = startY + roofHeight - 10;
				// Arrow pointing down and right (positive pressure)
				ctx.strokeStyle = "#ffc864";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(arrowX + arrowLength * 0.7, arrowY + arrowLength * 0.7);
				ctx.stroke();
				// Arrow head
				ctx.beginPath();
				ctx.moveTo(arrowX + arrowLength * 0.7, arrowY + arrowLength * 0.7);
				ctx.lineTo(arrowX + arrowLength * 0.7 - 6, arrowY + arrowLength * 0.7 - 6);
				ctx.lineTo(arrowX + arrowLength * 0.7 - 6, arrowY + arrowLength * 0.7 + 6);
				ctx.closePath();
				ctx.fillStyle = "#ffc864";
				ctx.fill();
			}
			
			// Leeward slope arrows (negative pressure - outward)
			for (let i = 0; i < 3; i++) {
				const arrowX = startX + roofWidth - 30 - i * 25;
				const arrowY = startY + roofHeight - 10;
				// Arrow pointing up and left (negative pressure)
				ctx.strokeStyle = "#64c8ff";
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(arrowX, arrowY);
				ctx.lineTo(arrowX - arrowLength * 0.7, arrowY - arrowLength * 0.7);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(arrowX - arrowLength * 0.7, arrowY - arrowLength * 0.7);
				ctx.lineTo(arrowX - arrowLength * 0.7 + 6, arrowY - arrowLength * 0.7 + 6);
				ctx.lineTo(arrowX - arrowLength * 0.7 + 6, arrowY - arrowLength * 0.7 - 6);
				ctx.closePath();
				ctx.fillStyle = "#64c8ff";
				ctx.fill();
			}
		}

		// Pressure values
		ctx.font = bodyFont;
		ctx.fillStyle = "#333";
		const pressureText = `qz = ${velocityPressurePsf.toFixed(2)} psf`;
		ctx.fillText(pressureText, startX, startY + roofHeight + buildingHeight + 20);

		const png = canvas.toDataURL("image/png");
		setDataUrl(png);
	}

	// Auto-render when inputs change
	useEffect(() => {
		let raf = requestAnimationFrame(() => {
			void handleRenderImage();
		});
		return () => cancelAnimationFrame(raf);
	}, [roofType, windSpeedMph, exposure, heightFt, velocityPressurePsf]);

	return (
		<div>
			{dataUrl && (
				<div>
					<img src={dataUrl} alt="Roof wind loads diagram" style={{ maxWidth: "100%", border: "1px solid #eee" }} />
				</div>
			)}
		</div>
	);
}
