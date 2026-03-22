# Design Document: NUV Platform Backend Integration

## Overview

This design document specifies the frontend architecture and implementation approach for integrating all missing backend functionality into the NUV freelancing platform. NUV is a decentralized freelancing platform built on Stellar/Soroban blockchain, enabling recruiters to post projects and events while freelancers build on-chain reputation.

### Current State

The platform has approximately 40% backend integration. Core flows exist but critical functionality is missing:
- Wallet deposit/withdraw handlers (forms exist, no implementation)
- Project workflow actions (accept/reject/approve/refund buttons missing)
- Notifications system (3 endpoints, zero UI)
- Freelancer search (using mock data instead of real API)
- Dispute management (can only open, not view/manage)
- Profile editing (no UI for profile updates)
- Standalone messaging page (only works in project context)
- Event submissions/participants display (endpoints exist, not called)
- Reputation history (logs endpoint not used)
- Stellar wallet authentication (backend ready, frontend missing)

### Design Goals

1. **Complete Integration**: Connect all existing backend endpoints to frontend UI
2. **Consistent UX**: Maintain minimalist design aesthetic across new features
3. **Error Resilience**: Implement comprehensive error handling and recovery flows
4. **Real-time Updates**: Integrate Socket.io for notifications and chat
5. **State Management**: Design scalable Zustand stores for new features
6. **Accessibility**: Ensure WCAG AA compliance for all new components
7. **Mobile-First**: Responsive design for all screen sizes


## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Pages Layer                                                 │
│  ├─ /notifications (NEW)                                     │
│  ├─ /disputes (NEW)                                          │
│  ├─ /conversations (NEW)                                     │
│  ├─ /profile/settings (NEW)                                  │
│  ├─ /ranking (NEW)                                           │
│  ├─ /projects/[id] (ENHANCED)                                │
│  ├─ /events/[id] (ENHANCED)                                  │
│  ├─ /wallet (ENHANCED)                                       │
│  └─ /freelancers (ENHANCED)                                  │
├─────────────────────────────────────────────────────────────┤
│  State Management (Zustand)                                  │
│  ├─ authStore (EXISTING)                                     │
│  ├─ notificationStore (NEW)                                  │
│  ├─ conversationStore (NEW)                                  │
│  └─ disputeStore (NEW)                                       │
├─────────────────────────────────────────────────────────────┤
│  Components Layer                                            │
│  ├─ UI Components (Card, Button, Badge, Modal, etc.)        │
│  ├─ Feature Components (NEW)                                 │
│  │   ├─ NotificationBell                                     │
│  │   ├─ NotificationList                                     │
│  │   ├─ DisputeCard                                          │
│  │   ├─ ConversationList                                     │
│  │   ├─ ProfileEditor                                        │
│  │   ├─ RankingTable                                         │
│  │   ├─ ProjectActions                                       │
│  │   ├─ EventParticipants                                    │
│  │   └─ WalletActions                                        │
│  └─ Layout Components (Navbar, ProtectedRoute)              │
├─────────────────────────────────────────────────────────────┤
│  API Layer (axios)                                           │
│  └─ /lib/api.ts (ENHANCED with new endpoints)               │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ├─ Authentication Routes                                    │
│  ├─ User Routes                                              │
│  ├─ Project Routes                                           │
│  ├─ Event Routes                                             │
│  ├─ Wallet Routes                                            │
│  ├─ Notification Routes                                      │
│  ├─ Dispute Routes                                           │
│  ├─ Conversation Routes                                      │
│  └─ Reputation Routes                                        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  Stellar/Soroban Blockchain                  │
│  ├─ Reputation Ledger Contract                               │
│  ├─ Project Escrow Contract                                  │
│  └─ Event Prize Distribution Contract                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Patterns

#### 1. Optimistic Update Pattern (Chat, Status Changes)
```
User Action → Optimistic UI Update → API Call → Success: Keep Update | Failure: Revert + Error
```

#### 2. Polling Pattern (Notifications, Messages)
```
Component Mount → Start Interval → API Poll (5s) → Update State → Unmount: Clear Interval
```

#### 3. Real-time Pattern (Socket.io - Future Enhancement)
```
Socket Connect → Subscribe to Channels → Receive Events → Update State → Emit Events
```

#### 4. Error Recovery Pattern
```
API Call → Error → Parse Error Type → Display Toast → Offer Retry → Log Error
```


## Components and Interfaces

### New Components

#### 1. NotificationBell Component
**Location**: `frontend/src/components/layout/NotificationBell.tsx`

**Purpose**: Display notification icon in navbar with unread count badge

**Props**:
```typescript
interface NotificationBellProps {
  // No props - uses notificationStore
}
```

**State**:
- Reads from `notificationStore.unreadCount`
- Triggers dropdown menu on click

**UI Structure**:
```
<button> (Bell icon)
  <Badge> (Unread count if > 0)
  <Dropdown> (Recent 5 notifications)
    <NotificationItem> × 5
    <Link to="/notifications"> (View all)
```

**Behavior**:
- Poll notifications every 30 seconds when mounted
- Display red badge with count if unread > 0
- Dropdown shows 5 most recent notifications
- Click notification → mark as read → navigate to resource

---

#### 2. NotificationList Component
**Location**: `frontend/src/components/notifications/NotificationList.tsx`

**Purpose**: Display paginated list of all notifications with filtering

**Props**:
```typescript
interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}
```

**UI Structure**:
```
<Card>
  <Header>
    <Title> Notifications
    <Button> Mark all as read
  <Filters>
    <Tab> All | Unread | Projects | Events | Payments
  <List>
    <NotificationItem> × N
      <Icon> (Type-specific)
      <Content>
        <Title>
        <Description>
        <Timestamp>
      <Badge> (Unread indicator)
```

**Behavior**:
- Filter by type (project, event, payment, system)
- Filter by read status
- Click notification → mark as read → navigate
- Pagination: 20 per page

---

#### 3. ProjectActions Component
**Location**: `frontend/src/components/projects/ProjectActions.tsx`

**Purpose**: Render context-aware action buttons for project workflow

**Props**:
```typescript
interface ProjectActionsProps {
  project: Project;
  isFreelancer: boolean;
  isRecruiter: boolean;
  onAction: (action: ProjectAction) => Promise<void>;
  loading: boolean;
}

type ProjectAction = 
  | 'accept' 
  | 'reject' 
  | 'deliver' 
  | 'approve' 
  | 'refund' 
  | 'request_correction' 
  | 'dispute';
```

**UI Structure**:
```
<Card>
  <Title> Actions
  <ButtonGroup>
    {/* Conditional rendering based on role + status */}
    <Button> (Primary action)
    <Button> (Secondary action)
    <Button variant="danger"> (Destructive action)
```

**Action Matrix**:
| Role | Status | Actions |
|------|--------|---------|
| Freelancer | proposed | Accept, Reject |
| Freelancer | active | Deliver, Dispute |
| Freelancer | review | Dispute |
| Recruiter | review | Approve, Request Correction (if !correction_used), Refund |
| Any | completed | None (show completion message) |

---

#### 4. WalletActions Component
**Location**: `frontend/src/components/wallet/WalletActions.tsx`

**Purpose**: Handle deposit and withdraw operations with validation

**Props**:
```typescript
interface WalletActionsProps {
  balance: number;
  onDeposit: (amount: number) => Promise<void>;
  onWithdraw: (amount: number, clabe: string) => Promise<void>;
}
```

**UI Structure**:
```
<Grid cols={2}>
  <Card> Deposit
    <Input> Amount (MXN)
    <Button> Deposit funds
  <Card> Withdraw
    <Input> Amount (MXN)
    <Input> CLABE interbancaria
    <Button> Withdraw to account
```

**Validation**:
- Deposit: amount > 0, amount <= 100000 (max per transaction)
- Withdraw: amount > 0, amount <= balance, CLABE format (18 digits)

---

#### 5. DisputeCard Component
**Location**: `frontend/src/components/disputes/DisputeCard.tsx`

**Purpose**: Display dispute information with evidence submission

**Props**:
```typescript
interface DisputeCardProps {
  dispute: Dispute;
  onSubmitEvidence: (evidence: string) => Promise<void>;
  canResolve: boolean;
  onResolve: (resolution: 'freelancer' | 'recruiter') => Promise<void>;
}
```

**UI Structure**:
```
<Card>
  <Header>
    <Title> Dispute #{id}
    <Badge> (Status: open/reviewing/resolved)
  <Content>
    <Field> Project: {project.title}
    <Field> Opened by: {user.username}
    <Field> Reason: {reason}
    <Field> Description: {description}
  <Actions>
    <Textarea> Submit evidence
    <Button> Submit
    {canResolve && (
      <ButtonGroup>
        <Button> Resolve for Freelancer
        <Button> Resolve for Recruiter
    )}
```

---

#### 6. ConversationList Component
**Location**: `frontend/src/components/conversations/ConversationList.tsx`

**Purpose**: Display list of all user conversations with last message preview

**Props**:
```typescript
interface ConversationListProps {
  conversations: ConversationWithDetails[];
  onSelect: (conversationId: string) => void;
  selectedId?: string;
}

interface ConversationWithDetails extends Conversation {
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
}
```

**UI Structure**:
```
<List>
  <ConversationItem> × N
    <Avatar> (Other user)
    <Content>
      <Name> {otherUser.username}
      <Preview> {lastMessage.message}
      <Timestamp> {lastMessage.created_at}
    <Badge> (Unread count if > 0)
```

---

#### 7. EventParticipants Component
**Location**: `frontend/src/components/events/EventParticipants.tsx`

**Purpose**: Display event participants and submissions for event owner

**Props**:
```typescript
interface EventParticipantsProps {
  eventId: string;
  participants: EventParticipant[];
  submissions: EventSubmission[];
  canSelectWinner: boolean;
  onSelectWinner: (freelancerId: string) => Promise<void>;
}
```

**UI Structure**:
```
<Card>
  <Tabs>
    <Tab> Participants ({count})
    <Tab> Submissions ({count})
  
  <TabPanel> Participants
    <List>
      <ParticipantItem> × N
        <Avatar>
        <Name>
        <Badge> (Status: applied/submitted/winner)
  
  <TabPanel> Submissions
    <Grid>
      <SubmissionCard> × N
        <Avatar>
        <Name>
        <Link> View submission
        <Button> Select as winner (if canSelectWinner)
```

---

#### 8. ProfileEditor Component
**Location**: `frontend/src/components/profile/ProfileEditor.tsx`

**Purpose**: Edit user profile and role-specific profile data

**Props**:
```typescript
interface ProfileEditorProps {
  user: User;
  profile: FreelancerProfile | RecruiterProfile | null;
  onSave: (data: ProfileUpdateData) => Promise<void>;
}
```

**UI Structure**:
```
<Form>
  <Section> Basic Info
    <Input> Username
    <Textarea> Bio
    <Input> Country
    <Input> Profile Image URL
  
  {role === 'freelancer' && (
    <Section> Freelancer Profile
      <Input> Title
      <Textarea> Description
      <TagInput> Skills
      <Select> Experience Level
      <Input> Portfolio URL
  )}
  
  {role === 'recruiter' && (
    <Section> Recruiter Profile
      <Input> Company Name
      <Textarea> Company Description
      <Input> Website
  )}
  
  <ButtonGroup>
    <Button> Save Changes
    <Button variant="secondary"> Cancel
```

---

#### 9. RankingTable Component
**Location**: `frontend/src/components/ranking/RankingTable.tsx`

**Purpose**: Display leaderboard of top freelancers by reputation

**Props**:
```typescript
interface RankingTableProps {
  rankings: RankingEntry[];
  currentUserId?: string;
}

interface RankingEntry {
  rank: number;
  user: User;
  totalReputation: number;
  categoryBreakdown: { category: string; score: number }[];
}
```

**UI Structure**:
```
<Card>
  <Table>
    <Header>
      <Column> Rank
      <Column> Freelancer
      <Column> Total Reputation
      <Column> Top Categories
    <Body>
      <Row> × N
        <Cell> #{rank}
        <Cell>
          <Avatar>
          <Name> (Highlight if currentUser)
        <Cell> {totalReputation}
        <Cell>
          <Badge> × 3 (Top 3 categories)
```


## Data Models

### Frontend Type Extensions

#### Notification Type
```typescript
export interface Notification {
  _id: string;
  user_id: string;
  type: 'project' | 'event' | 'payment' | 'system';
  title: string;
  message: string;
  link?: string; // Navigation target
  read: boolean;
  created_at: string;
}
```

#### ConversationWithDetails Type
```typescript
export interface ConversationWithDetails extends Conversation {
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
  project?: Project; // If conversation is project-related
}
```

#### RankingEntry Type
```typescript
export interface RankingEntry {
  rank: number;
  user: User;
  totalReputation: number;
  categoryBreakdown: Array<{
    category: Category;
    score: number;
    level: 'bronze' | 'silver' | 'gold' | 'diamond';
  }>;
}
```

#### ProfileUpdateData Type
```typescript
export interface ProfileUpdateData {
  // User fields
  username?: string;
  bio?: string;
  country?: string;
  profile_image?: string;
  
  // Freelancer profile fields
  title?: string;
  description?: string;
  skills?: string[];
  experience_level?: 'junior' | 'mid' | 'senior';
  availability?: string;
  portfolio_url?: string;
  
  // Recruiter profile fields
  company_description?: string;
  website?: string;
}
```

#### WalletWithEscrows Type
```typescript
export interface WalletWithEscrows extends Wallet {
  escrows: Array<{
    _id: string;
    type: 'project' | 'event';
    amount: number;
    related_id: string;
    related_title: string;
    locked_at: string;
  }>;
}
```

### State Store Schemas

#### NotificationStore
```typescript
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  lastFetch: number | null;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void; // For real-time
  incrementUnread: () => void;
}
```

#### ConversationStore
```typescript
interface ConversationState {
  conversations: ConversationWithDetails[];
  activeConversation: string | null;
  messages: Record<string, Message[]>; // conversationId -> messages
  loading: boolean;
  
  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, message: string, attachment?: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  markAsRead: (conversationId: string) => Promise<void>;
}
```

#### DisputeStore
```typescript
interface DisputeState {
  disputes: Dispute[];
  loading: boolean;
  
  // Actions
  fetchDisputes: () => Promise<void>;
  openDispute: (projectId: string, reason: string, description: string) => Promise<void>;
  submitEvidence: (disputeId: string, evidence: string) => Promise<void>;
  resolveDispute: (disputeId: string, resolution: 'freelancer' | 'recruiter') => Promise<void>;
}
```

### API Response Formats

#### Paginated Response
```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### Error Response
```typescript
interface ErrorResponse {
  message: string;
  error?: string;
  field?: string; // For validation errors
}
```

#### Success Response
```typescript
interface SuccessResponse<T = any> {
  message: string;
  data?: T;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication State Persistence

*For any* successful authentication (login or registration), the user data SHALL be persisted in the auth store and the user SHALL be redirected to the dashboard.

**Validates: Requirements 1.2, 1.7**

---

### Property 2: Session Expiration Cleanup

*For any* API request that returns 401 status, the system SHALL clear all stored credentials and redirect to the login page.

**Validates: Requirements 1.5, 12.2**

---

### Property 3: Email Validation

*For any* string input to email field, only strings matching valid email format (contains @ and domain) SHALL pass validation.

**Validates: Requirements 1.8, 8.2**

---

### Property 4: Password Length Validation

*For any* string input to password field, only strings with length >= 6 characters SHALL pass validation.

**Validates: Requirements 1.9, 8.3**

---

### Property 5: Independent Data Loading

*For any* dashboard data fetch operation, failure in one data section (wallet, events, projects, reputation) SHALL NOT prevent other sections from loading successfully.

**Validates: Requirements 2.7**

---

### Property 6: Wallet Balance Validation for Projects

*For any* project creation attempt, if the recruiter's wallet balance < project amount, the system SHALL reject the creation and return an error.

**Validates: Requirements 3.1**

---

### Property 7: Project Escrow Creation

*For any* successful project creation, the recruiter's wallet balance SHALL decrease by exactly the project amount and an escrow record SHALL be created.

**Validates: Requirements 3.2**

---

### Property 8: Project Status Transitions

*For any* project workflow action (accept, reject, deliver, approve, refund), the system SHALL update the project status to the correct next state and create a notification for affected users.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11**

---

### Property 9: Correction Request Limitation

*For any* project, the "Request Correction" action SHALL only succeed if correction_used is false, and SHALL set correction_used to true after execution.

**Validates: Requirements 3.7, 3.8**

---

### Property 10: Project Completion Reputation Reward

*For any* project that transitions to "completed" status, the freelancer's reputation SHALL increase by exactly 5 points.

**Validates: Requirements 3.12**

---

### Property 11: Event Prize Distribution

*For any* event with N winners selected (where N <= max_winners), each winner SHALL receive exactly (prize_amount / N) in their wallet.

**Validates: Requirements 4.5, 4.6, 4.11**

---

### Property 12: Event Reputation Rewards

*For any* completed event, winners SHALL gain +10 reputation points and non-winner participants SHALL gain +1 reputation point.

**Validates: Requirements 4.7, 4.8**

---

### Property 13: Wallet Deposit Transaction

*For any* successful deposit operation with amount A, the user's wallet balance SHALL increase by A and a deposit transaction record SHALL be created.

**Validates: Requirements 5.2**

---

### Property 14: Wallet Withdrawal Validation

*For any* withdrawal attempt with amount A, if wallet balance < A, the system SHALL reject the withdrawal and return an error.

**Validates: Requirements 5.3**

---

### Property 15: Wallet Withdrawal Transaction

*For any* successful withdrawal operation with amount A, the user's wallet balance SHALL decrease by A and a withdrawal transaction record SHALL be created.

**Validates: Requirements 5.4**

---

### Property 16: Transaction Sorting

*For any* transaction history display, transactions SHALL be ordered by created_at timestamp in descending order (newest first).

**Validates: Requirements 5.5**

---

### Property 17: Stellar Address Truncation

*For any* Stellar address string with length > 20, the display SHALL show first 10 characters + "..." + last 10 characters.

**Validates: Requirements 5.11**

---

### Property 18: Message Creation

*For any* message sent in a conversation, a message record SHALL be created with the correct conversation_id, sender_id, and message content.

**Validates: Requirements 6.2**

---

### Property 19: Optimistic Message Update

*For any* message send operation, the message SHALL appear in the UI immediately before the API response is received.

**Validates: Requirements 6.3**

---

### Property 20: Conversation Creation with Project

*For any* project created, a conversation record SHALL be created linking the recruiter and freelancer.

**Validates: Requirements 6.9**

---

### Property 21: Notification Creation on Status Change

*For any* project or event status change, a notification SHALL be created for all affected users with the correct type and message.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

---

### Property 22: Notification Read on Click

*For any* notification clicked by a user, the notification SHALL be marked as read and the user SHALL be navigated to the related resource.

**Validates: Requirements 7.7**

---

### Property 23: Required Field Validation

*For any* form field marked as required, if the field value is empty or whitespace-only, the system SHALL display "This field is required" error.

**Validates: Requirements 8.1**

---

### Property 24: Amount Validation

*For any* amount input field, if the value is <= 0, the system SHALL display "Amount must be positive" error.

**Validates: Requirements 8.4**

---

### Property 25: Deadline Validation

*For any* deadline input field, if the selected date is before the current date, the system SHALL display "Deadline must be in the future" error.

**Validates: Requirements 8.5**

---

### Property 26: Submit Button Disabled on Validation Errors

*For any* form with validation errors present, the submit button SHALL be disabled until all errors are resolved.

**Validates: Requirements 8.7**

---

### Property 27: Validation Error Clearing

*For any* form field with a validation error, when the user corrects the input to a valid value, the error SHALL be cleared.

**Validates: Requirements 8.9**

---

### Property 28: Backend Error Mapping

*For any* backend validation error response with a field property, the frontend SHALL display the error message below the corresponding form field.

**Validates: Requirements 8.10**

---

### Property 29: Consistent Error Response Format

*For any* backend error response, the response SHALL contain a message field and optionally an error field, following the format { message: string, error?: string }.

**Validates: Requirements 12.8**

---

### Property 30: HTTP Status Code Correctness

*For any* backend error, the response SHALL use the appropriate HTTP status code: 400 for validation errors, 401 for authentication errors, 403 for authorization errors, 404 for not found, 500 for server errors.

**Validates: Requirements 12.12**

---

### Property 31: Client-Side Search Filtering

*For any* search query on a list with < 100 items, the filtering SHALL be performed client-side without making an API request.

**Validates: Requirements 16.1**

---

### Property 32: Debounced Backend Search

*For any* search query on a list with >= 100 items, the system SHALL debounce the input and make an API request after the debounce delay.

**Validates: Requirements 16.2**

---

### Property 33: Filter State URL Persistence

*For any* active filter on a page, the filter state SHALL be reflected in the URL query parameters, and SHALL be restored when the page loads with those parameters.

**Validates: Requirements 16.8, 16.9**

---

### Property 34: Case-Insensitive Search

*For any* backend search query, the search SHALL match results regardless of case (uppercase, lowercase, mixed case).

**Validates: Requirements 16.10**

---

### Property 35: Reputation Level Calculation

*For any* reputation score S, the displayed level SHALL be: "Bronze" if 0 <= S < 20, "Silver" if 20 <= S < 50, "Gold" if 50 <= S < 100, "Diamond" if S >= 100.

**Validates: Requirements 17.5, 17.6, 17.7, 17.8**

---

### Property 36: Initial Reputation Value

*For any* newly created freelancer user, the initial reputation score SHALL be 0 for all categories.

**Validates: Requirements 17.11**

---

### Property 37: Reputation Change Logging

*For any* reputation score change, a reputation log entry SHALL be created with the delta, reason, source_type, and source_id.

**Validates: Requirements 17.12**


## Error Handling

### Error Classification

#### 1. Network Errors
**Cause**: Connection failure, timeout, DNS resolution failure

**Handling**:
- Display toast: "Connection failed. Please check your internet connection."
- Provide retry button
- Log error to console for debugging
- Do not clear user state

**Implementation**:
```typescript
try {
  const response = await api.get('/endpoint');
} catch (error) {
  if (axios.isAxiosError(error) && !error.response) {
    // Network error
    toast.error('Connection failed', {
      description: 'Please check your internet connection',
      action: { label: 'Retry', onClick: () => refetch() }
    });
  }
}
```

---

#### 2. Authentication Errors (401)
**Cause**: Invalid token, expired session, missing credentials

**Handling**:
- Clear auth store
- Clear localStorage
- Redirect to /auth/login
- Display toast: "Session expired. Please log in again."
- Handled globally in axios interceptor

**Implementation**:
```typescript
// In api.ts interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pw_auth');
      window.location.href = '/auth/login';
      toast.error('Session expired', {
        description: 'Please log in again'
      });
    }
    return Promise.reject(error);
  }
);
```

---

#### 3. Authorization Errors (403)
**Cause**: User lacks permission for requested action

**Handling**:
- Display toast: "Access denied. You don't have permission for this action."
- Do not redirect
- Log error for debugging

---

#### 4. Validation Errors (400)
**Cause**: Invalid input data, missing required fields, constraint violations

**Handling**:
- Parse error response for field-specific errors
- Display errors below respective form fields
- If no field specified, display general error toast
- Keep form data intact for correction

**Implementation**:
```typescript
try {
  await api.post('/projects', data);
} catch (error) {
  if (error.response?.status === 400) {
    const { message, field } = error.response.data;
    if (field) {
      setFieldError(field, message);
    } else {
      toast.error('Validation Error', { description: message });
    }
  }
}
```

---

#### 5. Not Found Errors (404)
**Cause**: Requested resource doesn't exist

**Handling**:
- Display empty state with message: "Resource not found"
- Provide navigation back to list view
- Log error for debugging

---

#### 6. Server Errors (500)
**Cause**: Backend exception, database error, external service failure

**Handling**:
- Display toast: "Server error. Please try again later."
- Provide retry button
- Log full error details to console
- Consider fallback to cached data if available

---

### Error Recovery Strategies

#### Optimistic Update Rollback
When optimistic updates fail, revert UI state:

```typescript
const sendMessage = async (message: string) => {
  const tempId = `temp-${Date.now()}`;
  const optimisticMessage = { _id: tempId, message, sender_id: user._id, created_at: new Date().toISOString() };
  
  // Optimistic update
  setMessages(prev => [...prev, optimisticMessage]);
  
  try {
    const response = await api.post('/messages', { message });
    // Replace temp message with real one
    setMessages(prev => prev.map(m => m._id === tempId ? response.data : m));
  } catch (error) {
    // Rollback on failure
    setMessages(prev => prev.filter(m => m._id !== tempId));
    toast.error('Failed to send message', {
      action: { label: 'Retry', onClick: () => sendMessage(message) }
    });
  }
};
```

---

#### Retry with Exponential Backoff
For transient failures, implement retry logic:

```typescript
const fetchWithRetry = async (url: string, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await api.get(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

---

#### Graceful Degradation
When non-critical features fail, continue with reduced functionality:

```typescript
const fetchDashboard = async () => {
  const results = await Promise.allSettled([
    api.get('/wallets'),
    api.get('/projects'),
    api.get('/events'),
    api.get('/reputation')
  ]);
  
  // Process successful results, show errors for failed ones
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      // Update state with data
    } else {
      // Show error indicator for this section only
      showSectionError(sections[index]);
    }
  });
};
```

---

### Error Logging

All errors should be logged with context for debugging:

```typescript
const logError = (error: any, context: string) => {
  console.error(`[${context}]`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
};
```


## Testing Strategy

### Dual Testing Approach

This project requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property tests**: Verify universal properties across all inputs through randomization

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide input space.

---

### Unit Testing

#### Focus Areas

1. **Component Rendering**: Test that components render correctly with various props
2. **User Interactions**: Test button clicks, form submissions, navigation
3. **Edge Cases**: Empty states, loading states, error states
4. **Integration Points**: API calls, store updates, route navigation
5. **Error Handling**: Specific error scenarios (401, 404, 500, network errors)

#### Example Unit Tests

```typescript
// NotificationBell.test.tsx
describe('NotificationBell', () => {
  it('displays unread count badge when unread > 0', () => {
    const { getByText } = render(<NotificationBell />);
    expect(getByText('5')).toBeInTheDocument();
  });
  
  it('does not display badge when unread = 0', () => {
    const { queryByText } = render(<NotificationBell />);
    expect(queryByText('0')).not.toBeInTheDocument();
  });
  
  it('opens dropdown on click', () => {
    const { getByRole, getByText } = render(<NotificationBell />);
    fireEvent.click(getByRole('button'));
    expect(getByText('View all notifications')).toBeInTheDocument();
  });
});

// ProjectActions.test.tsx
describe('ProjectActions', () => {
  it('shows Accept button for freelancer on proposed project', () => {
    const project = { status: 'proposed', ... };
    const { getByText } = render(
      <ProjectActions project={project} isFreelancer={true} isRecruiter={false} />
    );
    expect(getByText('Aceptar propuesta')).toBeInTheDocument();
  });
  
  it('disables Request Correction when correction_used is true', () => {
    const project = { status: 'review', correction_used: true, ... };
    const { getByText } = render(
      <ProjectActions project={project} isFreelancer={false} isRecruiter={true} />
    );
    expect(getByText('Solicitar corrección')).toBeDisabled();
  });
});

// WalletActions.test.tsx
describe('WalletActions', () => {
  it('validates withdraw amount does not exceed balance', async () => {
    const { getByLabelText, getByText } = render(
      <WalletActions balance={1000} onWithdraw={jest.fn()} />
    );
    
    fireEvent.change(getByLabelText('Amount'), { target: { value: '2000' } });
    fireEvent.click(getByText('Withdraw'));
    
    expect(getByText('Insufficient balance')).toBeInTheDocument();
  });
  
  it('validates CLABE format (18 digits)', async () => {
    const { getByLabelText, getByText } = render(
      <WalletActions balance={1000} onWithdraw={jest.fn()} />
    );
    
    fireEvent.change(getByLabelText('CLABE'), { target: { value: '12345' } });
    fireEvent.click(getByText('Withdraw'));
    
    expect(getByText('Invalid CLABE format')).toBeInTheDocument();
  });
});
```

---

### Property-Based Testing

#### Library Selection

**For TypeScript/JavaScript**: Use **fast-check** library

```bash
npm install --save-dev fast-check
```

#### Configuration

- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: platform-ux-improvements-and-integration, Property {number}: {property_text}`

#### Example Property Tests

```typescript
import fc from 'fast-check';

// Feature: platform-ux-improvements-and-integration, Property 3: Email Validation
describe('Property 3: Email Validation', () => {
  it('accepts only valid email formats', () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        (email) => {
          const result = validateEmail(email);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('rejects invalid email formats', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !s.includes('@')),
        (invalidEmail) => {
          const result = validateEmail(invalidEmail);
          expect(result.isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: platform-ux-improvements-and-integration, Property 4: Password Length Validation
describe('Property 4: Password Length Validation', () => {
  it('accepts passwords with length >= 6', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 6, maxLength: 100 }),
        (password) => {
          const result = validatePassword(password);
          expect(result.isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('rejects passwords with length < 6', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 5 }),
        (password) => {
          const result = validatePassword(password);
          expect(result.isValid).toBe(false);
          expect(result.error).toBe('Minimum 6 characters required');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: platform-ux-improvements-and-integration, Property 7: Project Escrow Creation
describe('Property 7: Project Escrow Creation', () => {
  it('decreases wallet balance by project amount on creation', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 10000 }), // project amount
        fc.integer({ min: 10000, max: 100000 }), // initial balance
        async (amount, initialBalance) => {
          const recruiter = await createTestUser({ balance: initialBalance });
          const project = await createProject({ amount, recruiter_id: recruiter._id });
          
          const updatedWallet = await getWallet(recruiter._id);
          expect(updatedWallet.balance_mxne).toBe(initialBalance - amount);
          
          const escrow = await getEscrow(project._id);
          expect(escrow.amount).toBe(amount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: platform-ux-improvements-and-integration, Property 11: Event Prize Distribution
describe('Property 11: Event Prize Distribution', () => {
  it('distributes prize equally among winners', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 50000 }), // prize amount
        fc.integer({ min: 1, max: 10 }), // number of winners
        async (prizeAmount, numWinners) => {
          const event = await createTestEvent({ prize_amount: prizeAmount, max_winners: numWinners });
          const winners = await createTestFreelancers(numWinners);
          
          const initialBalances = await Promise.all(
            winners.map(w => getWallet(w._id).then(wallet => wallet.balance_mxne))
          );
          
          await selectWinners(event._id, winners.map(w => w._id));
          
          const finalBalances = await Promise.all(
            winners.map(w => getWallet(w._id).then(wallet => wallet.balance_mxne))
          );
          
          const expectedShare = prizeAmount / numWinners;
          finalBalances.forEach((finalBalance, i) => {
            expect(finalBalance).toBe(initialBalances[i] + expectedShare);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: platform-ux-improvements-and-integration, Property 16: Transaction Sorting
describe('Property 16: Transaction Sorting', () => {
  it('sorts transactions by created_at descending', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(fc.date(), { minLength: 2, maxLength: 20 }),
        async (dates) => {
          const user = await createTestUser();
          
          // Create transactions with random dates
          for (const date of dates) {
            await createTransaction({ user_id: user._id, created_at: date });
          }
          
          const transactions = await getTransactions(user._id);
          
          // Verify descending order
          for (let i = 0; i < transactions.length - 1; i++) {
            const current = new Date(transactions[i].created_at);
            const next = new Date(transactions[i + 1].created_at);
            expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: platform-ux-improvements-and-integration, Property 35: Reputation Level Calculation
describe('Property 35: Reputation Level Calculation', () => {
  it('calculates correct level for any score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        (score) => {
          const level = calculateReputationLevel(score);
          
          if (score < 20) {
            expect(level).toBe('bronze');
          } else if (score < 50) {
            expect(level).toBe('silver');
          } else if (score < 100) {
            expect(level).toBe('gold');
          } else {
            expect(level).toBe('diamond');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

---

### Integration Testing

Test complete user flows end-to-end:

```typescript
describe('Project Workflow Integration', () => {
  it('completes full project lifecycle', async () => {
    // 1. Recruiter creates project
    const recruiter = await createTestUser({ role: 'recruiter', balance: 10000 });
    const freelancer = await createTestUser({ role: 'freelancer' });
    
    const project = await createProject({
      recruiter_id: recruiter._id,
      freelancer_id: freelancer._id,
      amount: 5000
    });
    
    expect(project.status).toBe('proposed');
    
    // 2. Freelancer accepts
    await acceptProject(project._id, freelancer._id);
    const updated1 = await getProject(project._id);
    expect(updated1.status).toBe('active');
    
    // 3. Freelancer delivers
    await deliverProject(project._id, { file_url: 'https://example.com/file' });
    const updated2 = await getProject(project._id);
    expect(updated2.status).toBe('review');
    
    // 4. Recruiter approves
    await approveDelivery(project._id, recruiter._id);
    const updated3 = await getProject(project._id);
    expect(updated3.status).toBe('completed');
    
    // 5. Verify funds released
    const freelancerWallet = await getWallet(freelancer._id);
    expect(freelancerWallet.balance_mxne).toBe(5000);
    
    // 6. Verify reputation increased
    const reputation = await getReputation(freelancer._id);
    expect(reputation.score).toBe(5);
  });
});
```

---

### Test Coverage Goals

- **Unit Tests**: 80% code coverage minimum
- **Property Tests**: All 37 correctness properties implemented
- **Integration Tests**: All critical user flows covered
- **E2E Tests**: Smoke tests for main pages and workflows


## Implementation Approach

### Phase 1: State Management and API Integration

#### 1.1 Create Zustand Stores

**NotificationStore** (`frontend/src/store/notificationStore.ts`):
```typescript
import { create } from 'zustand';
import api from '@/lib/api';
import type { Notification } from '@/types';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  lastFetch: number | null;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  incrementUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  lastFetch: null,
  
  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/notifications');
      const notifications = response.data;
      const unreadCount = notifications.filter((n: Notification) => !n.read).length;
      set({ notifications, unreadCount, lastFetch: Date.now(), loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  
  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      set(state => ({
        notifications: state.notifications.map(n => 
          n._id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  },
  
  markAllAsRead: async () => {
    try {
      await api.patch('/notifications/read-all');
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  },
  
  addNotification: (notification: Notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));
  },
  
  incrementUnread: () => {
    set(state => ({ unreadCount: state.unreadCount + 1 }));
  }
}));
```

**ConversationStore** (`frontend/src/store/conversationStore.ts`):
```typescript
import { create } from 'zustand';
import api from '@/lib/api';
import type { Conversation, Message, User } from '@/types';

interface ConversationWithDetails extends Conversation {
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
}

interface ConversationState {
  conversations: ConversationWithDetails[];
  activeConversation: string | null;
  messages: Record<string, Message[]>;
  loading: boolean;
  
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, message: string, attachment?: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  markAsRead: (conversationId: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {},
  loading: false,
  
  fetchConversations: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/conversations');
      set({ conversations: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  
  fetchMessages: async (conversationId: string) => {
    try {
      const response = await api.get(`/conversations/${conversationId}`);
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: response.data.messages
        }
      }));
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  },
  
  sendMessage: async (conversationId: string, message: string, attachment?: string) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      _id: tempId,
      conversation_id: conversationId,
      sender_id: '', // Will be set by backend
      message,
      attachment_url: attachment,
      read_at: null,
      created_at: new Date().toISOString()
    };
    
    // Optimistic update
    set(state => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), optimisticMessage]
      }
    }));
    
    try {
      const response = await api.post(`/conversations/${conversationId}/messages`, {
        message,
        attachment_url: attachment
      });
      
      // Replace temp message with real one
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId].map(m =>
            m._id === tempId ? response.data : m
          )
        }
      }));
    } catch (error) {
      // Rollback on failure
      set(state => ({
        messages: {
          ...state.messages,
          [conversationId]: state.messages[conversationId].filter(m => m._id !== tempId)
        }
      }));
      throw error;
    }
  },
  
  setActiveConversation: (id: string | null) => {
    set({ activeConversation: id });
  },
  
  markAsRead: async (conversationId: string) => {
    try {
      await api.patch(`/conversations/${conversationId}/read`);
    } catch (error) {
      console.error('Failed to mark conversation as read', error);
    }
  }
}));
```

**DisputeStore** (`frontend/src/store/disputeStore.ts`):
```typescript
import { create } from 'zustand';
import api from '@/lib/api';
import type { Dispute } from '@/types';

interface DisputeState {
  disputes: Dispute[];
  loading: boolean;
  
  fetchDisputes: () => Promise<void>;
  openDispute: (projectId: string, reason: string, description: string) => Promise<void>;
  submitEvidence: (disputeId: string, evidence: string) => Promise<void>;
  resolveDispute: (disputeId: string, resolution: 'freelancer' | 'recruiter') => Promise<void>;
}

export const useDisputeStore = create<DisputeState>((set) => ({
  disputes: [],
  loading: false,
  
  fetchDisputes: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/disputes');
      set({ disputes: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
  
  openDispute: async (projectId: string, reason: string, description: string) => {
    const response = await api.post('/disputes', {
      project_id: projectId,
      reason,
      description
    });
    set(state => ({
      disputes: [response.data, ...state.disputes]
    }));
  },
  
  submitEvidence: async (disputeId: string, evidence: string) => {
    await api.post(`/disputes/${disputeId}/evidence`, { evidence });
    // Refetch to get updated dispute
    const response = await api.get(`/disputes/${disputeId}`);
    set(state => ({
      disputes: state.disputes.map(d =>
        d._id === disputeId ? response.data : d
      )
    }));
  },
  
  resolveDispute: async (disputeId: string, resolution: 'freelancer' | 'recruiter') => {
    await api.post(`/disputes/${disputeId}/resolve`, { resolution });
    set(state => ({
      disputes: state.disputes.map(d =>
        d._id === disputeId ? { ...d, status: 'resolved', resolution } : d
      )
    }));
  }
}));
```

---

#### 1.2 Extend API Client

Add new API methods to `frontend/src/lib/api.ts`:

```typescript
// Notification endpoints
export const notificationApi = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all')
};

// Conversation endpoints
export const conversationApi = {
  getAll: () => api.get('/conversations'),
  getById: (id: string) => api.get(`/conversations/${id}`),
  sendMessage: (conversationId: string, data: { message: string; attachment_url?: string }) =>
    api.post(`/conversations/${conversationId}/messages`, data)
};

// Dispute endpoints
export const disputeApi = {
  getAll: () => api.get('/disputes'),
  getById: (id: string) => api.get(`/disputes/${id}`),
  open: (data: { project_id: string; reason: string; description: string }) =>
    api.post('/disputes', data),
  submitEvidence: (id: string, evidence: string) =>
    api.post(`/disputes/${id}/evidence`, { evidence }),
  resolve: (id: string, resolution: 'freelancer' | 'recruiter') =>
    api.post(`/disputes/${id}/resolve`, { resolution })
};

// Project action endpoints
export const projectApi = {
  accept: (id: string) => api.post(`/projects/${id}/accept`),
  reject: (id: string) => api.post(`/projects/${id}/reject`),
  approve: (id: string) => api.post(`/projects/${id}/approve`),
  refund: (id: string) => api.post(`/projects/${id}/refund`)
};

// Wallet endpoints
export const walletApi = {
  deposit: (amount: number) => api.post('/wallets/deposit', { amount }),
  withdraw: (amount: number, clabe: string) =>
    api.post('/wallets/withdraw', { amount, clabe }),
  getBalance: () => api.get('/wallets/balance'),
  getEscrows: () => api.get('/wallets/escrows')
};

// Event endpoints
export const eventApi = {
  getParticipants: (id: string) => api.get(`/events/${id}/participants`),
  getSubmissions: (id: string) => api.get(`/events/${id}/submissions`)
};

// User endpoints
export const userApi = {
  searchFreelancers: (params: { search?: string; category?: string; minRep?: number }) =>
    api.get('/users/search/freelancers', { params }),
  getRanking: () => api.get('/users/ranking'),
  getOnChainProfile: (id: string) => api.get(`/users/${id}/on-chain-profile`),
  updateProfile: (data: any) => api.put('/users/profile', data)
};

// Reputation endpoints
export const reputationApi = {
  getLogs: (userId: string) => api.get(`/reputation/${userId}/logs`)
};
```


### Phase 2: Component Implementation

#### 2.1 Notifications Feature

**NotificationBell Component** (`frontend/src/components/layout/NotificationBell.tsx`):

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/store/notificationStore';
import Badge from '@/components/ui/Badge';

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, fetchNotifications, markAsRead } = useNotificationStore();
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);
  
  const handleNotificationClick = async (notification: any) => {
    await markAsRead(notification._id);
    setShowDropdown(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };
  
  const recentNotifications = notifications.slice(0, 5);
  
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-zinc-200 z-50">
          <div className="p-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-zinc-400">
                No notifications
              </div>
            ) : (
              recentNotifications.map(notification => (
                <button
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-3 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-900">{notification.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">{notification.message}</p>
                </button>
              ))
            )}
          </div>
          <div className="p-3 border-t border-zinc-100">
            <button
              onClick={() => {
                setShowDropdown(false);
                router.push('/notifications');
              }}
              className="text-sm text-zinc-600 hover:text-zinc-900 font-medium"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Notifications Page** (`frontend/src/app/notifications/page.tsx`):

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Navbar from '@/components/layout/Navbar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useNotificationStore } from '@/store/notificationStore';
import { formatDate } from '@/lib/utils';
import { Bell, CheckCheck } from 'lucide-react';

type FilterType = 'all' | 'unread' | 'project' | 'event' | 'payment' | 'system';

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [filter, setFilter] = useState<FilterType>('all');
  
  useEffect(() => {
    fetchNotifications();
  }, []);
  
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });
  
  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markAsRead(notification._id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };
  
  if (loading) {
    return (
      <ProtectedRoute>
        <Navbar />
        <div className="pt-14 min-h-screen bg-zinc-100 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }
  
  return (
    <ProtectedRoute>
      <Navbar />
      <div className="pt-14 min-h-screen bg-zinc-100">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Notifications
            </h1>
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              disabled={notifications.every(n => n.read)}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['all', 'unread', 'project', 'event', 'payment', 'system'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border capitalize ${
                  filter === f
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          {/* Notification List */}
          <Card>
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filteredNotifications.map(notification => (
                  <button
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-4 text-left hover:bg-zinc-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-zinc-900">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-zinc-600 mb-2">{notification.message}</p>
                        <p className="text-xs text-zinc-400">{formatDate(notification.created_at)}</p>
                      </div>
                      <Badge variant={notification.type === 'payment' ? 'completed' : 'pending'}>
                        {notification.type}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
```

---

#### 2.2 Project Actions Enhancement

**ProjectActions Component** (`frontend/src/components/projects/ProjectActions.tsx`):

```typescript
'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { projectApi } from '@/lib/api';
import { sileo } from 'sileo';
import type { Project } from '@/types';

interface ProjectActionsProps {
  project: Project;
  isFreelancer: boolean;
  isRecruiter: boolean;
  onUpdate: () => void;
}

export default function ProjectActions({ project, isFreelancer, isRecruiter, onUpdate }: ProjectActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  const [description, setDescription] = useState('');
  
  const handleAction = async (action: () => Promise<any>, successMessage: string) => {
    setLoading(true);
    const promise = action();
    sileo.promise(promise, {
      loading: { title: 'Processing...' },
      success: { title: successMessage },
      error: { title: 'Error' }
    });
    try {
      await promise;
      onUpdate();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };
  
  const handleDeliver = async () => {
    if (!fileUrl) return;
    await handleAction(
      () => projectApi.deliver(project._id, { file_url: fileUrl, description }),
      'Delivery submitted'
    );
    setShowDeliverModal(false);
    setFileUrl('');
    setDescription('');
  };
  
  return (
    <>
      <div className="space-y-2">
        {/* Freelancer: Proposed status */}
        {isFreelancer && project.status === 'proposed' && (
          <>
            <Button
              className="w-full"
              onClick={() => handleAction(() => projectApi.accept(project._id), 'Project accepted')}
              loading={loading}
            >
              Accept Proposal
            </Button>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => handleAction(() => projectApi.reject(project._id), 'Project rejected')}
              loading={loading}
            >
              Reject Proposal
            </Button>
          </>
        )}
        
        {/* Freelancer: Active status */}
        {isFreelancer && project.status === 'active' && (
          <Button className="w-full" onClick={() => setShowDeliverModal(true)}>
            Submit Delivery
          </Button>
        )}
        
        {/* Recruiter: Review status */}
        {isRecruiter && project.status === 'review' && (
          <>
            <Button
              className="w-full"
              onClick={() => handleAction(() => projectApi.approve(project._id), 'Delivery approved')}
              loading={loading}
            >
              Approve Delivery
            </Button>
            {!project.correction_used && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleAction(
                  () => projectApi.requestCorrection(project._id),
                  'Correction requested'
                )}
                loading={loading}
              >
                Request Correction
              </Button>
            )}
            <Button
              variant="danger"
              className="w-full"
              onClick={() => handleAction(() => projectApi.refund(project._id), 'Project refunded')}
              loading={loading}
            >
              Refund & Reject
            </Button>
          </>
        )}
        
        {/* Completed */}
        {project.status === 'completed' && (
          <p className="text-xs text-zinc-400 text-center py-2">
            Project completed ✓
          </p>
        )}
      </div>
      
      {/* Deliver Modal */}
      <Modal open={showDeliverModal} onClose={() => setShowDeliverModal(false)} title="Submit Delivery">
        <div className="space-y-4">
          <Input
            label="File URL"
            placeholder="https://drive.google.com/..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe your delivery..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <Button
            className="w-full"
            onClick={handleDeliver}
            loading={loading}
            disabled={!fileUrl}
          >
            Submit Delivery
          </Button>
        </div>
      </Modal>
    </>
  );
}
```

---

#### 2.3 Wallet Actions Implementation

**WalletActions Component** (`frontend/src/components/wallet/WalletActions.tsx`):

```typescript
'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { walletApi } from '@/lib/api';
import { sileo } from 'sileo';

interface WalletActionsProps {
  balance: number;
  onUpdate: () => void;
}

export default function WalletActions({ balance, onUpdate }: WalletActionsProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [clabe, setClabe] = useState('');
  const [loading, setLoading] = useState(false);
  
  const validateDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return 'Amount must be positive';
    if (amount > 100000) return 'Maximum deposit is 100,000 MXN';
    return null;
  };
  
  const validateWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return 'Amount must be positive';
    if (amount > balance) return 'Insufficient balance';
    if (!/^\d{18}$/.test(clabe)) return 'CLABE must be 18 digits';
    return null;
  };
  
  const handleDeposit = async () => {
    const error = validateDeposit();
    if (error) {
      sileo.error({ title: 'Validation Error', description: error });
      return;
    }
    
    setLoading(true);
    const promise = walletApi.deposit(parseFloat(depositAmount));
    sileo.promise(promise, {
      loading: { title: 'Processing deposit...' },
      success: { title: 'Deposit successful' },
      error: { title: 'Deposit failed' }
    });
    
    try {
      await promise;
      setDepositAmount('');
      onUpdate();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };
  
  const handleWithdraw = async () => {
    const error = validateWithdraw();
    if (error) {
      sileo.error({ title: 'Validation Error', description: error });
      return;
    }
    
    setLoading(true);
    const promise = walletApi.withdraw(parseFloat(withdrawAmount), clabe);
    sileo.promise(promise, {
      loading: { title: 'Processing withdrawal...' },
      success: { title: 'Withdrawal successful' },
      error: { title: 'Withdrawal failed' }
    });
    
    try {
      await promise;
      setWithdrawAmount('');
      setClabe('');
      onUpdate();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <h3 className="text-base font-semibold text-zinc-900 mb-3">Deposit</h3>
        <div className="space-y-3">
          <Input
            label="Amount (MXN)"
            type="number"
            placeholder="1000"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={handleDeposit}
            loading={loading}
            disabled={!depositAmount}
          >
            Deposit Funds
          </Button>
        </div>
      </Card>
      
      <Card>
        <h3 className="text-base font-semibold text-zinc-900 mb-3">Withdraw</h3>
        <div className="space-y-3">
          <Input
            label="Amount (MXN)"
            type="number"
            placeholder="500"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
          />
          <Input
            label="CLABE Interbancaria"
            placeholder="012345678901234567"
            maxLength={18}
            value={clabe}
            onChange={(e) => setClabe(e.target.value)}
          />
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleWithdraw}
            loading={loading}
            disabled={!withdrawAmount || !clabe}
          >
            Withdraw to Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
```

