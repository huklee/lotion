import type { SaveCoordinator } from "./save-coordinator";
import { useConflictActions } from "./use-conflict-actions";

type ConflictPanelProps = {
  coordinator: SaveCoordinator;
  title: string;
  refresh: () => Promise<unknown>;
  openPage: (id: string) => Promise<void>;
  handleError: (error: unknown) => void;
};

export function ConflictPanel({
  coordinator,
  title,
  refresh,
  openPage,
  handleError,
}: ConflictPanelProps) {
  const status = coordinator.status;
  const { saveCopy } = useConflictActions({
    coordinator,
    title,
    refresh,
    openPage,
    handleError,
  });
  return (
    (coordinator.error || status === "Conflict") && (
      <div className="conflict-box">
        <p>{coordinator.error}</p>
        {status === "Conflict" ? (
          <>
            <p>
              Your draft is preserved. Changes to different blocks can be
              merged; overlapping edits need your choice.
            </p>
            <button
              onClick={() => void coordinator.review().catch(handleError)}
            >
              Review latest versions
            </button>
            {coordinator.remote && (
              <div>
                <p>
                  Conflicting fields:{" "}
                  {coordinator.conflicts.join(", ") || "none"}
                </p>
                <details>
                  <summary>Your draft</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(coordinator.content, null, 2)}
                  </pre>
                </details>
                <details>
                  <summary>
                    Server version (revision {coordinator.remote.revision})
                  </summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      {
                        title: coordinator.remote.title,
                        blocks: coordinator.remote.blocks,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Use your draft for this page? The server revision remains in history. A newer server change will require another review.",
                      )
                    )
                      void coordinator
                        .resolve("local")
                        .then(refresh)
                        .catch(handleError);
                  }}
                >
                  Use my draft
                </button>
                <button
                  onClick={() =>
                    void coordinator
                      .resolve("server")
                      .then(refresh)
                      .catch(handleError)
                  }
                >
                  Use server version (archive draft)
                </button>
                <p>A recovery copy of your draft is kept in this browser.</p>
              </div>
            )}
            <button onClick={() => void saveCopy()}>
              Save draft as a copy
            </button>
          </>
        ) : (
          <button onClick={() => void coordinator.flush()}>Retry save</button>
        )}
      </div>
    )
  );
}
