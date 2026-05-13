# Issue #4 Implementation Guide

## Overview

This guide covers the implementation of Issue #4: Server Status Header & Control Buttons for the MC-Server-Manager dashboard.

## What Was Implemented

### 1. Components

#### ServerHeader.tsx
Located at: `/src/components/ServerHeader.tsx`

Displays comprehensive server information:
- Server name (from MOTD)
- Status indicator with color coding (green=online, red=offline, yellow=starting/stopping)
- IP address
- Player count (current/max)
- Minecraft version
- Server uptime (when online)

**Props:**
```typescript
interface ServerHeaderProps {
  status: ServerStatus | null;
  loading?: boolean;
}
```

**Usage:**
```typescript
<ServerHeader status={status} loading={loading} />
```

#### ControlButtons.tsx
Located at: `/src/components/ControlButtons.tsx`

Interactive server control buttons:
- **Start Button**: Visible when server is offline
- **Stop Button**: Visible when server is online
- **Restart Button**: Always visible (disabled when offline)

Features:
- Loading states with animated spinners
- Error message display
- Smart button visibility based on server state
- Disabled states for inappropriate actions
- Calls API endpoints automatically

**Props:**
```typescript
interface ControlButtonsProps {
  status: ServerStatus | null;
  loading?: boolean;
  onStatusChange?: () => void;
}
```

**Usage:**
```typescript
<ControlButtons
  status={status}
  loading={loading}
  onStatusChange={refetch}
/>
```

### 2. Custom Hook

#### useServerStatus.ts
Located at: `/src/hooks/useServerStatus.ts`

Manages server status with automatic polling and real-time updates:
- Fetches `/api/server/status` every 2 seconds
- Listens to WebSocket `server:status:changed` events
- Returns status, loading state, error, and refetch function

**Return Value:**
```typescript
{
  status: ServerStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

**Usage:**
```typescript
const { status, loading, error, refetch } = useServerStatus();
```

### 3. Files Modified

**src/styles/app.css**
- Added ServerHeader styles with responsive layout
- Added ControlButtons styles with animations
- Included loading spinner and pulse animations
- Mobile-responsive media queries

## Integration Instructions

To integrate these components into your Dashboard, update `src/pages/Dashboard.tsx`:

```typescript
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

        {/* Server Status Header */}
        <ServerHeader status={status} loading={loading} />

        {/* Server Control Buttons */}
        <ControlButtons
          status={status}
          loading={loading}
          onStatusChange={refetch}
        />

        {/* Rest of your dashboard content */}
      </main>
    </div>
  );
}
```

## API Endpoints Used

The components interact with these backend endpoints:

- **GET /api/server/status** - Fetches current server status
- **POST /api/server/start** - Starts the server
- **POST /api/server/stop** - Stops the server
- **POST /api/server/restart** - Restarts the server

## WebSocket Integration

The components listen to WebSocket events:

- **Event:** `server:status:changed`
- **Trigger:** When server status changes on the backend
- **Action:** Automatically refetches current status

## CSS Classes and Variables

All components use BEM-style CSS classes:

### ServerHeader Classes
- `.server-header` - Main container
- `.server-header__name` - Server name
- `.server-header__status-indicator` - Status display
- `.server-header__info-grid` - Information grid
- `.server-header__info-item` - Individual info item

### ControlButtons Classes
- `.control-buttons` - Main container
- `.control-buttons__group` - Button group
- `.control-buttons__button` - Individual button
- `.control-buttons__error` - Error message
- `.control-buttons__spinner` - Loading spinner

### CSS Variables Used
From `:root`:
- `--bg` - Background color
- `--bg-card` - Card background
- `--border` - Border color
- `--text` - Text color
- `--text-muted` - Muted text color
- `--green` - Online status color
- `--red` - Offline status color
- `--yellow` - Starting/stopping status color

## Responsive Design

All components are responsive and adapt to:
- Desktop (1100px+): Full layout with side-by-side elements
- Tablet (640px - 1100px): Adapted grid layouts
- Mobile (<640px): Single column layout with stacked buttons

## Error Handling

- **Network Errors**: Displayed in ControlButtons error message
- **API Errors**: Shows error details to user
- **WebSocket Disconnections**: Gracefully handled with polling fallback
- **Loading States**: Clear spinners show during transitions

## Type Safety

All components are fully typed with TypeScript:
- No `any` types used
- Proper interface definitions
- Type-safe hook returns
- Imported types from `src/types/api.ts`

## Testing Tips

1. **Test Status Display**: Verify ServerHeader shows correct status colors
2. **Test Button Visibility**: Confirm buttons show/hide based on status
3. **Test API Calls**: Use browser DevTools to inspect network requests
4. **Test Error Handling**: Try stopping the backend server
5. **Test WebSocket**: Monitor WebSocket frames in DevTools
6. **Test Responsive**: Use browser dev tools to test mobile layouts

## Documentation

See `/src/components/COMPONENTS.md` for detailed component documentation.

See `/src/components/integration-example.tsx` for example integration code.

## File Structure

```
src/
├── components/
│   ├── ServerHeader.tsx
│   ├── ControlButtons.tsx
│   ├── index.ts
│   ├── COMPONENTS.md
│   └── integration-example.tsx
├── hooks/
│   ├── useApi.ts (existing)
│   ├── useServerSocket.ts (existing)
│   ├── useServerStatus.ts (NEW)
│   └── index.ts (NEW)
├── types/
│   └── api.ts (existing)
├── pages/
│   └── Dashboard.tsx (UPDATE THIS)
└── styles/
    └── app.css (UPDATED)
```

## Build Status

✓ TypeScript compilation successful
✓ All imports resolve correctly
✓ CSS builds without errors
✓ No development warnings
✓ Production-ready build passes

To build: `npm run build`
To develop: `npm run dev`
