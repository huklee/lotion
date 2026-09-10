import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="home-content">
        <h1>This page could not be displayed.</h1>
        <p>
          Your committed files and browser drafts have not been deleted. Reload
          to try again, or inspect the server log for a document validation
          issue.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
