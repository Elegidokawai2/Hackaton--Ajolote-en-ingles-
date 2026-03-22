# Requirements Document

## Introduction

This document defines requirements for improving the ProofWork platform - a freelancer/project management system with Stellar blockchain integration. The platform enables recruiters to post events (hackathons) and projects, while freelancers can participate, submit work, and earn MXNE tokens. The improvements focus on enhancing visual UX/UI, fixing backend-frontend integration issues, improving error handling, and ensuring proper functionality across all features.

## Glossary

- **Platform**: The ProofWork web application system
- **Frontend**: Next.js 16.2.1 application running on port 3001
- **Backend**: Express.js API server running on port 5000
- **User**: Any authenticated person using the platform (freelancer, recruiter, or admin)
- **Freelancer**: A user who participates in events and accepts project contracts
- **Recruiter**: A user who creates events and project proposals
- **Event**: A competition/hackathon with prize pool and multiple participants
- **Project**: A 1:1 contract between recruiter and freelancer with escrow
- **Wallet**: User's Stellar blockchain wallet containing MXNE token balance
- **MXNE**: The platform's native token on Stellar blockchain
- **Escrow**: Locked funds held until project/event completion
- **API_Client**: The axios instance configured for backend communication
- **Auth_Store**: Zustand store managing authentication state
- **UI_Component**: Reusable React component in the design system

## Requirements

### Requirement 1: Authentication Flow Enhancement

**User Story:** As a user, I want a seamless authentication experience with proper error handling and state management, so that I can reliably access the platform.

#### Acceptance Criteria

1. WHEN a user submits login credentials, THE Frontend SHALL display loading state and disable the form
2. WHEN authentication succeeds, THE Auth_Store SHALL persist user data and THE Frontend SHALL redirect to dashboard
3. WHEN authentication fails with 401, THE Frontend SHALL display specific error message from backend
4. WHEN authentication fails with network error, THE Frontend SHALL display "Connection failed" message
5. WHEN a user's session expires, THE API_Client SHALL clear stored credentials and redirect to login
6. WHEN a user logs out, THE Backend SHALL invalidate the session token and THE Frontend SHALL clear all stored state
7. WHEN a user registers successfully, THE Frontend SHALL automatically log them in and redirect to dashboard
8. THE Frontend SHALL validate email format before submission
9. THE Frontend SHALL validate password minimum length (6 characters) before submission
10. WHEN registration fails due to duplicate email, THE Frontend SHALL display "Email already registered" message

### Requirement 2: Dashboard Data Loading and Error States

**User Story:** As a user, I want to see my dashboard data load reliably with proper loading and error states, so that I understand what's happening with my data.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Frontend SHALL display skeleton loaders for each data section
2. WHEN wallet data fails to load, THE Frontend SHALL display wallet section with zero balance and error indicator
3. WHEN events data fails to load, THE Frontend SHALL display "Unable to load events" message with retry button
4. WHEN projects data fails to load, THE Frontend SHALL display "Unable to load projects" message with retry button
5. WHEN reputation data fails to load for freelancers, THE Frontend SHALL hide reputation section gracefully
6. WHEN all data loads successfully, THE Frontend SHALL animate content into view
7. THE Frontend SHALL use Promise.allSettled to load dashboard data independently
8. WHEN a user clicks retry button, THE Frontend SHALL re-fetch failed data section
9. THE Frontend SHALL display last updated timestamp for dashboard data
10. WHEN no events exist, THE Frontend SHALL display empty state with "Create Event" call-to-action for recruiters

### Requirement 3: Project Workflow Integration

**User Story:** As a freelancer or recruiter, I want the project workflow to function correctly from proposal through completion, so that I can manage contracts reliably.

#### Acceptance Criteria

1. WHEN a recruiter creates a project, THE Backend SHALL validate sufficient wallet balance before creating escrow
2. WHEN project creation succeeds, THE Backend SHALL deduct funds from recruiter wallet and create locked escrow
3. WHEN a freelancer accepts a project, THE Backend SHALL update status to "active" and notify recruiter
4. WHEN a freelancer rejects a project, THE Backend SHALL refund escrow to recruiter and update status to "rejected"
5. WHEN a freelancer submits delivery, THE Backend SHALL update status to "review" and notify recruiter
6. WHEN a recruiter approves delivery, THE Backend SHALL release escrow to freelancer and update status to "completed"
7. WHEN a recruiter requests correction, THE Backend SHALL update status to "active" only if correction_used is false
8. WHEN correction is already used, THE Frontend SHALL disable "Request Correction" button
9. WHEN a recruiter rejects delivery, THE Backend SHALL refund escrow to recruiter and update status to "rejected"
10. WHEN project status changes, THE Frontend SHALL refresh project data and update UI immediately
11. THE Backend SHALL create notification for each status change
12. THE Backend SHALL update freelancer reputation by +5 points when project completes successfully

### Requirement 4: Event Workflow Integration

**User Story:** As a freelancer or recruiter, I want the event workflow to function correctly from creation through winner selection, so that competitions run smoothly.

#### Acceptance Criteria

1. WHEN a recruiter creates an event, THE Backend SHALL validate sufficient wallet balance for prize pool
2. WHEN event creation succeeds, THE Backend SHALL deduct prize amount from recruiter wallet and create locked escrow
3. WHEN a freelancer applies to event, THE Backend SHALL create participant record with "applied" status
4. WHEN a freelancer submits work, THE Backend SHALL update participant status to "submitted"
5. WHEN a recruiter selects winners, THE Backend SHALL distribute prize pool equally among winners
6. WHEN winners are selected, THE Backend SHALL update winner wallets and create payment transactions
7. WHEN winners are selected, THE Backend SHALL update winner reputation by +10 points
8. WHEN winners are selected, THE Backend SHALL update non-winner participant reputation by +1 point
9. WHEN winners are selected, THE Backend SHALL update event status to "completed"
10. WHEN event status changes, THE Frontend SHALL refresh event data and update UI
11. THE Backend SHALL support multiple winners based on max_winners field
12. THE Frontend SHALL display participant count and submission count for event owners

### Requirement 5: Wallet and Transaction Management

**User Story:** As a user, I want to manage my wallet balance and view transaction history accurately, so that I can track my earnings and spending.

#### Acceptance Criteria

1. WHEN a user views wallet page, THE Frontend SHALL display current MXNE balance prominently
2. WHEN a user deposits funds, THE Backend SHALL create deposit transaction and increment wallet balance
3. WHEN a user withdraws funds, THE Backend SHALL validate sufficient balance before processing
4. WHEN withdrawal succeeds, THE Backend SHALL decrement wallet balance and create withdrawal transaction
5. WHEN transaction history loads, THE Frontend SHALL display transactions sorted by date (newest first)
6. WHEN a transaction is escrow type, THE Frontend SHALL display lock icon and "Escrow" label
7. WHEN a transaction is release type, THE Frontend SHALL display unlock icon and "Release" label
8. WHEN a transaction is deposit type, THE Frontend SHALL display green arrow and positive amount
9. WHEN a transaction is withdraw type, THE Frontend SHALL display red arrow and negative amount
10. THE Frontend SHALL display transaction status badge (completed, pending, failed)
11. THE Frontend SHALL truncate Stellar addresses to readable format (first 10 + last 10 characters)
12. WHEN wallet doesn't exist, THE Backend SHALL create wallet with mock Stellar address for MVP

### Requirement 6: Real-time Chat Integration

**User Story:** As a project participant, I want to communicate with the other party through chat, so that we can discuss project details.

#### Acceptance Criteria

1. WHEN a project detail page loads, THE Frontend SHALL display chat interface with conversation history
2. WHEN a user sends a message, THE Backend SHALL create message record linked to conversation
3. WHEN a message is sent, THE Frontend SHALL append message to chat immediately (optimistic update)
4. WHEN message send fails, THE Frontend SHALL display error indicator and retry option
5. THE Frontend SHALL auto-scroll to latest message when new message arrives
6. THE Frontend SHALL display sender username and timestamp for each message
7. THE Frontend SHALL support file attachments via URL input
8. WHEN attachment URL is provided, THE Frontend SHALL display clickable link in message
9. THE Backend SHALL create conversation record when project is created
10. THE Frontend SHALL poll for new messages every 5 seconds when chat is open
11. THE Frontend SHALL display "typing..." indicator when other user is typing
12. THE Frontend SHALL mark messages as read when conversation is viewed

### Requirement 7: Notification System

**User Story:** As a user, I want to receive notifications for important events, so that I stay informed about platform activities.

#### Acceptance Criteria

1. WHEN a project status changes, THE Backend SHALL create notification for affected users
2. WHEN an event receives new participant, THE Backend SHALL notify event owner
3. WHEN an event receives submission, THE Backend SHALL notify event owner
4. WHEN a user wins an event, THE Backend SHALL create "Congratulations" notification
5. WHEN payment is released, THE Backend SHALL create payment notification with amount
6. WHEN a user views notifications page, THE Frontend SHALL display unread count badge
7. WHEN a user clicks notification, THE Frontend SHALL mark it as read and navigate to related resource
8. THE Frontend SHALL display notification icon in navbar with unread count
9. THE Backend SHALL include notification type (project, event, payment, system)
10. THE Frontend SHALL display different icons based on notification type
11. THE Frontend SHALL support notification filtering by type and read status
12. THE Backend SHALL automatically delete notifications older than 30 days

### Requirement 8: Form Validation and Error Display

**User Story:** As a user, I want clear validation feedback on forms, so that I can correct errors before submission.

#### Acceptance Criteria

1. WHEN a required field is empty, THE Frontend SHALL display "This field is required" error
2. WHEN email format is invalid, THE Frontend SHALL display "Invalid email format" error
3. WHEN password is too short, THE Frontend SHALL display "Minimum 6 characters required" error
4. WHEN amount is negative or zero, THE Frontend SHALL display "Amount must be positive" error
5. WHEN deadline is in the past, THE Frontend SHALL display "Deadline must be in the future" error
6. THE Frontend SHALL display validation errors below the respective input field
7. THE Frontend SHALL disable submit button while validation errors exist
8. THE Frontend SHALL validate on blur for better user experience
9. THE Frontend SHALL clear validation error when user corrects the input
10. WHEN backend returns validation error, THE Frontend SHALL map error to respective field
11. THE Frontend SHALL use Zod schema validation for type safety
12. THE Frontend SHALL display field-level errors with red border and error icon

### Requirement 9: Loading States and Optimistic Updates

**User Story:** As a user, I want the interface to feel responsive with proper loading states, so that I know the system is processing my actions.

#### Acceptance Criteria

1. WHEN a user submits a form, THE Frontend SHALL display loading spinner on submit button
2. WHEN a user submits a form, THE Frontend SHALL disable all form inputs
3. WHEN data is loading, THE Frontend SHALL display skeleton loaders matching content structure
4. WHEN an action succeeds, THE Frontend SHALL display success toast notification
5. WHEN an action fails, THE Frontend SHALL display error toast notification with message
6. THE Frontend SHALL use optimistic updates for chat messages
7. THE Frontend SHALL use optimistic updates for status changes
8. WHEN optimistic update fails, THE Frontend SHALL revert UI state and show error
9. THE Frontend SHALL display inline loading spinner for partial page updates
10. THE Frontend SHALL display progress indicator for multi-step processes
11. THE Frontend SHALL prevent double-submission by disabling buttons during processing
12. THE Frontend SHALL display estimated time for long-running operations

### Requirement 10: Responsive Design and Mobile Support

**User Story:** As a user on mobile device, I want the interface to adapt to my screen size, so that I can use all features comfortably.

#### Acceptance Criteria

1. WHEN viewport width is below 768px, THE Frontend SHALL display single-column layout
2. WHEN viewport width is below 768px, THE Frontend SHALL collapse navigation to hamburger menu
3. WHEN viewport width is below 768px, THE Frontend SHALL stack sidebar content below main content
4. THE Frontend SHALL use responsive grid classes (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
5. THE Frontend SHALL ensure touch targets are minimum 44x44 pixels on mobile
6. THE Frontend SHALL use responsive text sizes (text-sm md:text-base)
7. THE Frontend SHALL ensure modals are scrollable on small screens
8. THE Frontend SHALL use responsive padding (px-4 md:px-6 lg:px-8)
9. THE Frontend SHALL test layouts at breakpoints: 320px, 768px, 1024px, 1440px
10. THE Frontend SHALL ensure images scale proportionally without overflow
11. THE Frontend SHALL use mobile-friendly date pickers and select inputs
12. THE Frontend SHALL ensure horizontal scrolling is prevented on all pages

### Requirement 11: Accessibility Compliance

**User Story:** As a user with accessibility needs, I want the interface to be usable with keyboard and screen readers, so that I can access all features.

#### Acceptance Criteria

1. THE Frontend SHALL provide keyboard navigation for all interactive elements
2. THE Frontend SHALL display visible focus indicators on all focusable elements
3. THE Frontend SHALL use semantic HTML elements (button, nav, main, article)
4. THE Frontend SHALL provide alt text for all images
5. THE Frontend SHALL use ARIA labels for icon-only buttons
6. THE Frontend SHALL ensure color contrast ratio meets WCAG AA standards (4.5:1 for text)
7. THE Frontend SHALL support screen reader announcements for dynamic content changes
8. THE Frontend SHALL provide skip-to-content link for keyboard users
9. THE Frontend SHALL ensure form labels are properly associated with inputs
10. THE Frontend SHALL provide error announcements for screen readers
11. THE Frontend SHALL ensure modals trap focus and return focus on close
12. THE Frontend SHALL support reduced motion preferences for animations

### Requirement 12: Error Handling and Recovery

**User Story:** As a user, I want clear error messages and recovery options when something goes wrong, so that I can resolve issues quickly.

#### Acceptance Criteria

1. WHEN API returns 400 error, THE Frontend SHALL display specific validation error from response
2. WHEN API returns 401 error, THE Frontend SHALL redirect to login and clear stored credentials
3. WHEN API returns 403 error, THE Frontend SHALL display "Access denied" message
4. WHEN API returns 404 error, THE Frontend SHALL display "Resource not found" message
5. WHEN API returns 500 error, THE Frontend SHALL display "Server error, please try again" message
6. WHEN network request fails, THE Frontend SHALL display "Connection failed" with retry button
7. WHEN request times out, THE Frontend SHALL display "Request timed out" with retry button
8. THE Backend SHALL return consistent error format: { message: string, error?: string }
9. THE Backend SHALL log all errors with stack traces for debugging
10. THE Backend SHALL validate request body before processing
11. THE Backend SHALL use try-catch blocks in all async route handlers
12. THE Backend SHALL return appropriate HTTP status codes for different error types

### Requirement 13: Performance Optimization

**User Story:** As a user, I want pages to load quickly and interactions to feel instant, so that I have a smooth experience.

#### Acceptance Criteria

1. WHEN a page loads, THE Frontend SHALL display initial content within 2 seconds
2. THE Frontend SHALL use React.lazy for code splitting on route level
3. THE Frontend SHALL prefetch data for likely next navigation
4. THE Frontend SHALL cache API responses for 5 minutes using SWR or React Query
5. THE Frontend SHALL debounce search input by 300ms
6. THE Frontend SHALL paginate lists with more than 50 items
7. THE Frontend SHALL use virtual scrolling for lists with more than 100 items
8. THE Frontend SHALL compress images to WebP format with max 200KB size
9. THE Backend SHALL add database indexes on frequently queried fields
10. THE Backend SHALL use MongoDB aggregation for complex queries
11. THE Backend SHALL implement rate limiting (100 requests per minute per user)
12. THE Backend SHALL enable gzip compression for API responses

### Requirement 14: Data Consistency and Validation

**User Story:** As a developer, I want data to remain consistent between frontend and backend, so that the system behaves predictably.

#### Acceptance Criteria

1. THE Backend SHALL validate all required fields before database operations
2. THE Backend SHALL validate data types match schema definitions
3. THE Backend SHALL validate foreign key references exist before creating relationships
4. THE Backend SHALL use MongoDB transactions for multi-document operations
5. THE Backend SHALL validate wallet balance before creating escrow
6. THE Backend SHALL validate event deadline is in future before creation
7. THE Backend SHALL validate project deadline is in future before creation
8. THE Backend SHALL prevent duplicate event applications by same freelancer
9. THE Backend SHALL prevent duplicate project proposals for same freelancer
10. THE Frontend SHALL use TypeScript interfaces matching backend models
11. THE Frontend SHALL validate data before sending to backend
12. THE Backend SHALL sanitize user input to prevent injection attacks

### Requirement 15: UI Component Consistency

**User Story:** As a user, I want consistent visual design across all pages, so that the interface feels cohesive.

#### Acceptance Criteria

1. THE Frontend SHALL use design tokens from globals.css for all colors
2. THE Frontend SHALL use consistent border radius (9px for inputs, 12px for cards)
3. THE Frontend SHALL use consistent spacing scale (0.5rem increments)
4. THE Frontend SHALL use consistent typography scale (text-xs, text-sm, text-base, text-lg, text-xl, text-2xl)
5. THE Frontend SHALL use consistent button variants (primary, secondary, danger, ghost)
6. THE Frontend SHALL use consistent badge variants for all status types
7. THE Frontend SHALL use consistent card shadow and hover effects
8. THE Frontend SHALL use consistent animation durations (150ms for micro, 300ms for standard)
9. THE Frontend SHALL use consistent icon size (w-4 h-4 for inline, w-5 h-5 for standalone)
10. THE Frontend SHALL use consistent empty state pattern across all list views
11. THE Frontend SHALL use consistent modal styling and behavior
12. THE Frontend SHALL use consistent form layout and spacing

### Requirement 16: Search and Filter Functionality

**User Story:** As a user, I want to search and filter content effectively, so that I can find relevant items quickly.

#### Acceptance Criteria

1. WHEN a user types in search input, THE Frontend SHALL filter results client-side for lists under 100 items
2. WHEN a user types in search input, THE Frontend SHALL debounce and query backend for lists over 100 items
3. WHEN a user selects category filter, THE Frontend SHALL request filtered data from backend
4. WHEN a user selects status filter, THE Frontend SHALL filter results client-side
5. THE Frontend SHALL display result count after applying filters
6. THE Frontend SHALL display "No results found" message when filters return empty
7. THE Frontend SHALL provide "Clear filters" button when filters are active
8. THE Frontend SHALL persist filter state in URL query parameters
9. THE Frontend SHALL restore filters from URL on page load
10. THE Backend SHALL support case-insensitive search on title and description fields
11. THE Backend SHALL support multiple filter parameters in single request
12. THE Frontend SHALL highlight search terms in results

### Requirement 17: Reputation System Display

**User Story:** As a freelancer, I want to see my reputation scores clearly displayed, so that I understand my standing in different categories.

#### Acceptance Criteria

1. WHEN a freelancer views dashboard, THE Frontend SHALL display reputation bars for each category
2. THE Frontend SHALL display reputation score as progress bar (0-100 scale)
3. THE Frontend SHALL display reputation level badge (bronze, silver, gold, diamond)
4. THE Frontend SHALL use color coding: bronze (#CD7F32), silver (#C0C0C0), gold (#FFD700), diamond (#B9F2FF)
5. WHEN reputation score is 0-19, THE Frontend SHALL display "Bronze" level
6. WHEN reputation score is 20-49, THE Frontend SHALL display "Silver" level
7. WHEN reputation score is 50-99, THE Frontend SHALL display "Gold" level
8. WHEN reputation score is 100+, THE Frontend SHALL display "Diamond" level
9. THE Frontend SHALL display reputation change indicator (+5, +10, +1) after events
10. THE Frontend SHALL display reputation history timeline on profile page
11. THE Backend SHALL initialize reputation at 0 for new freelancers
12. THE Backend SHALL create reputation log entry for each reputation change

### Requirement 18: File Upload and Attachment Handling

**User Story:** As a user, I want to attach files to submissions and messages, so that I can share work and documents.

#### Acceptance Criteria

1. WHEN a user submits project delivery, THE Frontend SHALL accept file URL input
2. WHEN a user submits event work, THE Frontend SHALL accept file URL input
3. WHEN a user sends message with attachment, THE Frontend SHALL accept file URL input
4. THE Frontend SHALL validate URL format before submission
5. THE Frontend SHALL display attachment as clickable link with external icon
6. THE Frontend SHALL support common file hosting services (Google Drive, Dropbox, GitHub)
7. THE Frontend SHALL display file type icon based on URL extension
8. THE Frontend SHALL open attachments in new tab
9. THE Backend SHALL store attachment URLs in database
10. THE Backend SHALL validate attachment URL is not empty when provided
11. THE Frontend SHALL display attachment preview for images
12. THE Frontend SHALL display "No attachment" message when URL is empty

### Requirement 19: Status Badge and Timeline Visualization

**User Story:** As a user, I want to see project and event status clearly visualized, so that I understand current state and progress.

#### Acceptance Criteria

1. THE Frontend SHALL display status badge on all project and event cards
2. THE Frontend SHALL use color-coded badges: green (active/completed), amber (review), red (rejected), gray (pending)
3. WHEN viewing project detail, THE Frontend SHALL display timeline with completed steps highlighted
4. THE Frontend SHALL display timeline steps: Proposed → Active → Review → Completed
5. THE Frontend SHALL highlight current step in timeline
6. THE Frontend SHALL gray out future steps in timeline
7. THE Frontend SHALL display checkmark icon for completed steps
8. THE Frontend SHALL display current step with pulsing indicator
9. THE Frontend SHALL display status change history with timestamps
10. THE Frontend SHALL display who changed status (username)
11. THE Backend SHALL create status log entry for each status change
12. THE Frontend SHALL display estimated time to next status based on deadline

### Requirement 20: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive tests to ensure system reliability, so that bugs are caught before production.

#### Acceptance Criteria

1. THE Backend SHALL have unit tests for all controller functions
2. THE Backend SHALL have integration tests for all API endpoints
3. THE Backend SHALL test authentication middleware with valid and invalid tokens
4. THE Backend SHALL test wallet balance validation before escrow creation
5. THE Backend SHALL test reputation calculation logic
6. THE Backend SHALL test transaction creation and wallet updates
7. THE Frontend SHALL have component tests for all UI components
8. THE Frontend SHALL have integration tests for authentication flow
9. THE Frontend SHALL have integration tests for project workflow
10. THE Frontend SHALL have integration tests for event workflow
11. THE Frontend SHALL test form validation with valid and invalid inputs
12. THE Frontend SHALL test error handling for API failures

