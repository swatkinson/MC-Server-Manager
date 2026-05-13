# Console Interface Implementation (Issue #5)

This document describes the implementation of the console interface with command input for the MC-Server-Manager dashboard.

## Overview

The console interface provides real-time log viewing and command execution capabilities for the Minecraft server. It consists of multiple components working together:

1. **ConsolePanel** - Main container component
2. **ConsoleInterface** - Log display area
3. **ConsoleInput** - Command input with history navigation
4. **Hooks** - useConsoleLogs and useConsoleCommand for state management

## Components

### ConsolePanel (`src/components/ConsolePanel.tsx`)

The main wrapper component that combines the console interface and input. It also displays the connection status (Live or Polling).

**Features:**
- Header with title and connection status indicator
- Integrates ConsoleInterface and ConsoleInput
- Manages communication between sub-components

### ConsoleInterface (`src/components/ConsoleInterface.tsx`)

Displays log lines with color-coding by level and auto-scrolling functionality.

**Features:**
- Color-coded log levels:
  - ERROR: Red (#ef4444)
  - WARN: Yellow (#f59e0b)
  - INFO: White (#e2e8f0)
  - DEBUG: Gray (#6b7280)
- Auto-scroll to bottom when new messages arrive
- Monospace font for better readability
- Placeholder text for empty state
- Error message display
- Containerized scrollable area

### ConsoleInput (`src/components/ConsoleInput.tsx`)

Text input field for entering console commands with history navigation and output display.

**Features:**
- Command input with Enter key submission
- Command history navigation (↑/↓ arrow keys)
- Loading state indicator
- Error message display
- Output feedback display (auto-hides after 10 seconds)
- Disabled state when command is executing
- Command hints display
- Empty command prevention

## Hooks

### useConsoleLogs (`src/hooks/useConsoleLogs.ts`)

Manages fetching and updating console logs in real-time.

**API:**
```typescript
useConsoleLogs(limit?: number = 100)
  -> {
    logs: LogLine[]
    loading: boolean
    error: string | null
    clearLogs: () => void
    refetch: () => void
    connected: boolean  // WebSocket connection status
  }
```

**Behavior:**
- Fetches initial logs from `/api/console/logs?limit={limit}`
- Listens for 'console:line' events via WebSocket
- Maintains buffer of last N logs
- Falls back to polling if WebSocket disconnects
- Implements 5-second polling interval when disconnected

### useConsoleCommand (`src/hooks/useConsoleCommand.ts`)

Manages command execution and history.

**API:**
```typescript
useConsoleCommand()
  -> {
    executeCommand: (command: string) => Promise<void>
    getPreviousCommand: (index: number) => string
    getNextCommand: (index: number) => string
    resetHistory: () => void
    loading: boolean
    error: string | null
    lastOutput: string
    historyLength: number
  }
```

**Behavior:**
- Executes commands via POST to `/api/console/command`
- Maintains command history in memory
- Supports history navigation with up/down arrows
- Listens for command execution events from other clients
- Resets history index when new command is executed

## Styling

Added comprehensive CSS in `src/styles/app.css`:

- `.console-interface` - Main container
- `.console-interface__container` - Scrollable log area
- `.console-interface__line` - Individual log line
- `.console-input` - Input wrapper
- `.console-input__form` - Command form
- `.console-input__field` - Input field
- `.console-input__submit` - Submit button
- `.console-panel` - Main panel wrapper
- Responsive design for mobile (stacks form vertically)

**Colors:**
- Uses CSS variables from app.css (--red, --yellow, --green, etc.)
- Dark theme (#0a0e1a for console background)
- Consistent with existing UI theme

## Backend Integration

### API Endpoints

**GET /api/console/logs**
- Query param: `limit` (default: 50)
- Returns: `{ logs: LogLine[] }`

**POST /api/console/command**
- Body: `{ command: string }`
- Returns: `{ success: boolean, output: string }`
- Emits: 'console:command:executed' to all connected clients

### WebSocket Events

**console:line**
- Emitted when new log line is generated
- Payload: `LogLine`
- Used for real-time log updates

**console:command:executed**
- Emitted after command execution
- Payload: `{ command: string, output: string }`

## Features Implemented

### 1. Console Output Display
- [x] Last 100+ log lines displayed
- [x] Color-coded by level (ERROR, WARN, INFO, DEBUG)
- [x] Auto-scroll to bottom
- [x] Monospace font for readability
- [x] Timestamp display
- [x] Line wrapping for long messages

### 2. Command Input
- [x] Text input for commands
- [x] Submit with Enter key
- [x] Loading state during execution
- [x] Command output/error feedback
- [x] Input cleared after submission
- [x] Command history navigation (↑/↓)

### 3. Real-time Updates
- [x] WebSocket integration for live logs
- [x] Fallback polling if disconnected
- [x] Connection status indicator
- [x] Automatic scroll on new messages

### 4. Edge Cases Handled
- [x] Empty console (placeholder text)
- [x] Long messages (word wrapping)
- [x] WebSocket disconnection (fallback polling)
- [x] Command history exhaustion
- [x] Empty command prevention
- [x] Error display and recovery

### 5. Responsive Design
- [x] Works on mobile devices
- [x] Form stacks vertically on small screens
- [x] Touch-friendly input

## Integration into Dashboard

The ConsolePanel is integrated into `src/pages/Dashboard.tsx`:

```typescript
<section className="card card--full" style={{ minHeight: '500px' }}>
  <ConsolePanel />
</section>
```

The component is placed as a full-width card below the quick actions section.

## Usage Example

```typescript
import { ConsolePanel } from '../components/ConsolePanel';

export function MyDashboard() {
  return (
    <div className="dashboard">
      {/* Other components */}
      <section className="card card--full">
        <ConsolePanel />
      </section>
    </div>
  );
}
```

## Future Enhancements

1. **Virtual Scrolling** - Implement windowing for 1000+ log lines
2. **Log Filtering** - Filter by level or keyword
3. **Log Export** - Download logs as file
4. **Search** - Search within logs
5. **Command Autocomplete** - Suggest commands
6. **Syntax Highlighting** - Highlight command syntax
7. **Persistent History** - Store history in localStorage
8. **Log Rotation** - Archive old logs

## Testing Considerations

1. Test WebSocket connection/disconnection
2. Test fallback polling behavior
3. Test command history navigation
4. Test long log messages
5. Test rapid command execution
6. Test empty state rendering
7. Test responsive layout
8. Test error scenarios

## Type Safety

All components use TypeScript with proper typing:
- LogLine type from API
- ConsoleLogsResponse type
- ConsoleCommandResponse type
- Component props interfaces
- Hook return types

## Performance

- Maintains maximum of 100 log lines in memory (configurable)
- Uses efficient array operations (slice, push)
- Smooth scrolling with CSS transitions
- Debounced polling to prevent excessive requests
- Efficient re-renders through React hooks
