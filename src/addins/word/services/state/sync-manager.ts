// This class is responsible for synchronizing the add-in's state
// with a backend service or across different parts of the add-in if needed.
// For a simple add-in, this might not be extensively used if AddinState
// handles persistence via Office.Settings. However, for more complex scenarios
// involving a user account or shared state, this would be crucial.

import { AddinState } from "./addin-state";

interface SyncResult {
    success: boolean;
    timestamp?: Date;
    error?: string;
    // Potentially, data anknowledgements or conflicts
}

export class SyncManager {
    private static lastSyncTimestamp: Date | null = null;
    private static isSyncing: boolean = false;
    private static syncInterval: number | undefined; // For periodic sync

    /**
     * Manually triggers a synchronization of the add-in state with a backend.
     * @param state The current add-in state to sync.
     */
    public static async syncStateWithBackend(state: ReturnType<AddinState['getAllSettings']>): Promise<SyncResult> {
        if (this.isSyncing) {
            console.warn("SyncManager: Sync already in progress.");
            return { success: false, error: "Sync in progress" };
        }

        this.isSyncing = true;
        console.log("SyncManager: Starting state synchronization with backend...", state);

        // Placeholder for actual backend synchronization logic
        // This would involve an API call (e.g., fetch) to a server.
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Assume success for this placeholder
            this.lastSyncTimestamp = new Date();
            console.log("SyncManager: State synchronized successfully at", this.lastSyncTimestamp);
            this.isSyncing = false;
            return { success: true, timestamp: this.lastSyncTimestamp };

        } catch (error: any) {
            console.error("SyncManager: Error during state synchronization:", error);
            this.isSyncing = false;
            return { success: false, error: error.message || "Unknown sync error" };
        }
    }

    /**
     * Starts periodic synchronization of the add-in state.
     * @param intervalMilliseconds The interval at which to sync.
     */
    public static startPeriodicSync(intervalMilliseconds: number = 5 * 60 * 1000): void { // Default: 5 minutes
        if (this.syncInterval !== undefined) {
            console.warn("SyncManager: Periodic sync is already running.");
            return;
        }

        this.syncInterval = window.setInterval(async () => {
            const currentState = AddinState.getInstance().getAllSettings();
            await this.syncStateWithBackend(currentState);
        }, intervalMilliseconds);

        console.log(`SyncManager: Periodic sync started with interval ${intervalMilliseconds}ms.`);

        // Optionally, perform an initial sync
        const initialCurrentState = AddinState.getInstance().getAllSettings();
        this.syncStateWithBackend(initialCurrentState);
    }

    /**
     * Stops periodic synchronization.
     */
    public static stopPeriodicSync(): void {
        if (this.syncInterval !== undefined) {
            window.clearInterval(this.syncInterval);
            this.syncInterval = undefined;
            console.log("SyncManager: Periodic sync stopped.");
        } else {
            console.warn("SyncManager: Periodic sync is not running.");
        }
    }

    public static getLastSyncTimestamp(): Date | null {
        return this.lastSyncTimestamp;
    }

    // Potential future methods:
    // - handleConflictResolution(serverState, localState): Promise<ResolvedState>
    // - fetchRemoteState(): Promise<RemoteState>
}