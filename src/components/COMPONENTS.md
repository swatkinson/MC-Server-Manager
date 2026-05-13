# Server Status Components

This document describes the components created for Issue #4 (Server Status Header & Control Buttons).

## Components

### ServerHeader

Displays the server status with real-time information.

#### Props

```typescript
interface ServerHeaderProps {
  status: ServerStatus | null;
  loading?: boolean;
}
```

#### Features

- **Server Name**: Shows the MOTD (message of the day) as the server name
- **Status Indicator**: Color-coded indicator showing current status (online, offline, starting, stopping)
- **IP Address**: Displays the server IP
- **Player Count**: Shows current/max players
- **Version**: Displays the Minecraft version
- **Uptime**: Shows server uptime when online (formatted as days/hours/minutes)
- **Responsive**: Adapts to different screen sizes

#### Status Colors

- `online`: Green (#22c55e)
- `offline`: Red (#ef4444)
- `starting`: Yellow (#f59e0b)
- `stopping`: Yellow (#f59e0b)

#### Usage

```typescript
import { ServerHeader } from './components';
import { useServerStatus } from './hooks';

export function Dashboard() {
  const { status, loading } = useServerStatus();

  return <ServerHeader status={status} loading={loading} />;
}
```

### ControlButtons

Provides interactive buttons to control the server (start, stop, restart).

#### Props

```typescript
interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
}
```

#### Features

- **Start Button**: Visible only when server is offline
- **Stop Button**: Visible only when server is online
- **Restart Button**: Always visible, disabled when server is offline
- **Loading States**: Shows spinner and "Starting/Stopping/Restarting..." text during transitions
- **Error Handling**: Displays error messages if actions fail
- **Disabled States**: Buttons are disabled during transitions or when appropriate
- **Responsive**: Grid layout adapts to screen size

#### Button States

| Button | Offline | Starting | Online | Stopping |
|--------|---------|----------|--------|----------|
| Start  | Visible | Disabled | Hidden | Disabled |
| Stop   | Hidden  | Disabled | Visible| Disabled |
| Restart| Disabled| Disabled | Visible| Disabled |

#### Usage

```typescript
import { ControlButtons } from './components';
import { useServerStatus } from './hooks';

export function Dashboard() {
  const { status, loading, refetch } = useServerStatus();

  return (
    <ControlButtons
      status={status}
      loading={loading}
      onStatusChange={refetch}
    />
  );
}
```

## Hooks

### useServerStatus

Custom hook that manages server status fetching and real-time updates via WebSocket.

#### Features

- **Polling**: Fetches server status every 2 seconds
- **WebSocket Integration**: Listens to `server:status:changed` events for real-time updates
- **Automatic Refetch**: Triggers status update when WebSocket events are received
- **Error Handling**: Returns error state if fetch fails

#### Return Value

```typescript
{
  status: ServerStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

#### Usage

```typescript
import { useServerStatus } from './hooks';

export function MyComponent() {
  const { status, loading, error, refetch } = useServerStatus();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      Server is {status?.status}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

## API Integration

The components use the following API endpoints:

- **GET /api/server/status**: Fetches current server status
- **POST /api/server/start**: Starts the server
- **POST /api/server/stop**: Stops the server
- **POST /api/server/restart**: Restarts the server

## WebSocket Events

The components listen to:

- **server:status:changed**: Triggered when server status changes, triggers automatic refetch

## Styling

All components use CSS classes with the following structure:

- `.server-header` and `.server-header__*`: ServerHeader styles
- `.control-buttons` and `.control-buttons__*`: ControlButtons styles

Styles are included in `src/styles/app.css` and use CSS variables for theming:

- `--bg`: Background color
- `--bg-card`: Card background
- `--border`: Border color
- `--text`: Text color
- `--text-muted`: Muted text
- `--green`, `--red`, `--yellow`: Status colors

## Integration into Dashboard

To integrate these components into the main Dashboard, update `src/pages/Dashboard.tsx`:

```typescript
import { useState } from 'react'
import { ServerHeader, ControlButtons } from '../components';
import { useServerStatus } from '../hooks';

export function Dashboard() {
  const { status, loading, error, refetch } = useServerStatus();

  return (
    <div className="dashboard">
      <header className="header">
        <h1>MC Server Manager</h1>
        <p>Manage your Minecraft server from the browser</p>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            <p>Error: {error}</p>
          </div>
        )}

        <ServerHeader status={status} loading={loading} />

        <ControlButtons
          status={status}
          loading={loading}
          onStatusChange={refetch}
        />

        {/* Rest of dashboard content */}
      </main>
    </div>
  )
}
```

## Type Safety

All components are fully typed with TypeScript. The `ServerStatus` type is imported from `src/types/api.ts`:

```typescript
export interface ServerStatus {
  status: 'online' | 'offline' | 'starting' | 'stopping';
  uptime: number;
  version: string;
  motd: string;
  ip: string;
  players: {
    current: number;
    max: number;
  };
}
```

## Responsive Design

Both components are responsive and adapt to mobile screens:

- On mobile (< 640px): Layout adjusts for smaller screens
- Grid layouts switch to single column when needed
- Buttons stack appropriately
- Text sizes adjust for readability

## Error Handling

- **Network Errors**: Caught and displayed to the user
- **API Failures**: Error messages shown in ControlButtons
- **WebSocket Disconnections**: Gracefully handled by useServerSocket
- **Loading States**: Clear loading indicators shown during fetches
