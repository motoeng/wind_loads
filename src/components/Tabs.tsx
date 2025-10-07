import { ReactNode, useState } from "react";

export interface TabItem {
	label: string;
	content: ReactNode;
}

interface TabsProps {
	items: TabItem[];
	initialIndex?: number;
}

export default function Tabs({ items, initialIndex = 0 }: TabsProps) {
	const [active, setActive] = useState(initialIndex);
	return (
		<div>
			<div style={{ display: "flex", gap: 8, borderBottom: "1px solid #ddd", marginBottom: 12 }}>
				{items.map((it, idx) => (
					<button
						key={it.label}
						onClick={() => setActive(idx)}
						style={{
							padding: "8px 12px",
							border: "none",
							borderBottom: active === idx ? "2px solid #1f6feb" : "2px solid transparent",
							background: "transparent",
							cursor: "pointer",
							color: active === idx ? "#1f6feb" : "#333",
						}}
					>
						{it.label}
					</button>
				))}
			</div>
			<div>
				{items[active]?.content}
			</div>
		</div>
	);
}


