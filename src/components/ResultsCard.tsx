import { useEffect, useRef, useState } from "react";

interface DiagramSpec {
	numStories: number;
	storyHeightFt: number;
	perStoryPressuresPsf: number[];
}

interface ResultsCardProps {
	title: string;
	items: Array<{ label: string; value: string | number }>;
	diagram?: DiagramSpec;
	showData?: boolean;
}

export default function ResultsCard({ title, items, diagram, showData = true }: ResultsCardProps) {
	return (
		<div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
			<h3 style={{ margin: 0 }}>{title}</h3>
			{showData && (
				<ul>
					{items.map((it) => (
						<li key={it.label}>
							<strong>{it.label}:</strong> {String(it.value)}
						</li>
					))}
				</ul>
			)}
			{diagram && (
				<div style={{ marginTop: 12 }}>
					<div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: 8 }}>Building Elevation Diagram</div>
					<div style={{ border: "2px solid #333", padding: 8, backgroundColor: "#f9f9f9" }}>
						{/* Simple ASCII-style building diagram */}
						<div style={{ fontFamily: "monospace", fontSize: "12px" }}>
							{Array.from({ length: diagram.numStories }, (_, i) => {
								const storyNum = diagram.numStories - i;
								const pressure = diagram.perStoryPressuresPsf[storyNum - 1];
								return (
									<div key={storyNum} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
										<div style={{ width: "60px", textAlign: "right", marginRight: "8px" }}>
											Story {storyNum}:
										</div>
										<div style={{ width: "100px", height: "20px", border: "1px solid #666", backgroundColor: "#e0e0e0", marginRight: "8px" }}>
										</div>
										<div style={{ color: "#0066cc", fontWeight: "bold" }}>
											→ {pressure.toFixed(1)} psf
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Auto-render image whenever content changes
export function useAutoRender(cardRefDeps: unknown[], render: () => void) {
	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			void render();
		});
		return () => cancelAnimationFrame(raf);
	}, cardRefDeps);
}