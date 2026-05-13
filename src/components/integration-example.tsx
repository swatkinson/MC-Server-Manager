/**
 * Integration Example for ServerHeader and ControlButtons components
 *
 * This file demonstrates how to integrate ServerHeader and ControlButtons
 * into the Dashboard component. The actual integration will be done separately.
 */

import { useState } from 'react';
import { ServerHeader } from './ServerHeader';
import { ControlButtons } from './ControlButtons';
import { useServerStatus } from '../hooks/useServerStatus';

/**
 * Example Dashboard integration:
 *
 * export function Dashboard() {
 *   const { status, loading, error, refetch } = useServerStatus();
 *
 *   return (
 *     <div className="dashboard">
 *       <header className="header">
 *         <h1>MC Server Manager</h1>
 *         <p>Manage your Minecraft server from the browser</p>
 *       </header>
 *
 *       <main className="main">
 *         {error && <div className="error-banner">{error}</div>}
 *
 *         <ServerHeader status={status} loading={loading} />
 *
 *         <ControlButtons
 *           status={status}
 *           loading={loading}
 *           onStatusChange={refetch}
 *         />
 *
 *         {/* ... rest of the dashboard ... *\/}
 *       </main>
 *     </div>
 *   );
 * }
 */

// Full example with all components
export function DashboardExample() {
  const { status, loading, error, refetch } = useServerStatus();

  return (
    <div className="dashboard">
      <header className="header">
        <h1>MC Server Manager</h1>
        <p>Manage your Minecraft server from the browser</p>
      </header>

      <main>
        {/* Error banner - optional but recommended */}
        {error && (
          <div className="error-banner">
            <p>Error: {error}</p>
          </div>
        )}

        {/* Server status header with info */}
        <ServerHeader status={status} loading={loading} />

        {/* Control buttons for server actions */}
        <ControlButtons status={status} loading={loading} onStatusChange={refetch} />

        {/* Rest of dashboard content can go here */}
      </main>
    </div>
  );
}
