import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: unknown) => ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: unknown) {
		console.error("ErrorBoundary caught:", error);
	}

	render() {
		if (this.state.hasError) {
			const content = this.props.fallback
				? this.props.fallback(this.state.error)
				: (
					<div style={{ padding: 24 }}>
						<h2>Something went wrong.</h2>
						<p>Please adjust your inputs or reload the page.</p>
					</div>
				);
			return content as any;
		}
		return this.props.children as any;
	}
}


