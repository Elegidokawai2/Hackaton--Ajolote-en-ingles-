# Admin Dashboard - Quick Start Testing Guide

## Prerequisites

1. **Set up admin user in MongoDB:**
```javascript
db.users.updateOne(
  { email: 'admin@nuup.io' },
  {
    $set: {
      role: 'admin',
      status: 'active',
      password_hash: 'hashed_password' // Use bcrypt hash
    }
  }
)
```

2. **Start the backend:**
```bash
cd backend
npm install
npm start
```

Server runs on `http://localhost:5000/api`

3. **Install and start frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## Testing Workflow

### 1. Login as Admin
1. Go to `http://localhost:3000/auth/login`
2. Enter admin email and password
3. You should be redirected to `/dashboard`

### 2. Access Admin Dashboard
1. Navigate to `http://localhost:3000/admin`
2. You should see the admin layout with sidebar and KPI cards
3. If not admin, you'll be redirected to `/dashboard`

### 3. Test User Management
**Navigate to:** `/admin/users`

Features to test:
- [ ] Users load in table
- [ ] Search by name (try "john")
- [ ] Search by email (try "john@example.com")
- [ ] Filter by role dropdown
- [ ] Filter by status dropdown
- [ ] Pagination works (next/previous)
- [ ] Suspend user button works
- [ ] Delete user confirmação appears
- [ ] User list updates after action

**API Call:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/users?page=1&limit=20&search=john&role=freelancer"
```

### 4. Test Disputes
**Navigate to:** `/admin/disputes`

Features to test:
- [ ] Disputes load in table
- [ ] Filter by status (pending/resolved)
- [ ] Click "Ver detalle" to open dispute detail

**Detail View** (`/admin/disputes/:id`):
- [ ] Project summary displays
- [ ] Dispute details show
- [ ] Evidence items appear
- [ ] Select ruling radio button
- [ ] Enter reasoning text
- [ ] Click "Resolver Disputa" shows confirmation modal
- [ ] Click confirm updates dispute status
- [ ] Page shows resolved state after submission

**API Calls:**
```bash
# Get disputes list
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/disputes?page=1&status=pending"

# Resolve dispute
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ruling": "freelancer",
    "reasoning": "Freelancer completed work to specifications"
  }' \
  "http://localhost:5000/api/admin/disputes/DISPUTE_ID/resolve"
```

### 5. Test Company Verification
**Navigate to:** `/admin/verifications`

Features to test:
- [ ] Verification requests load
- [ ] Company details display
- [ ] Website link opens in new tab
- [ ] "Aprobar" button approves verification
- [ ] "Rechazar" button with optional reason
- [ ] Item disappears from list after action

**API Calls:**
```bash
# Get verification queue
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/verifications"

# Approve verification
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved": true}' \
  "http://localhost:5000/api/admin/verify-company/USER_ID"

# Reject verification
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved": false, "rejection_reason": "Invalid RFC"}' \
  "http://localhost:5000/api/admin/verify-company/USER_ID"
```

### 6. Test Dashboard Stats
**Navigate to:** `/admin`

Features to test:
- [ ] KPI cards load with numbers
- [ ] User registration chart displays
- [ ] Recent activity feed shows entries
- [ ] All data is current/valid

**API Call:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/stats"
```

### 7. Test Mobile Responsiveness
- [ ] Open admin pages on mobile/tablet
- [ ] Tables still readable (might be card layout)
- [ ] Navigation accessible
- [ ] Forms work on small screens
- [ ] No horizontal scrolling needed

### 8. Test Auth Guard
1. Logout from admin account
2. Try to access `/admin/users` directly
3. Should redirect to `/auth/login`
4. Log in as non-admin user
5. Try to access `/admin`
6. Should redirect to `/dashboard`

## Common Issues & Solutions

### MongoDB Connection Error
**Problem:** Backend logs "MongoDB connection error"
**Solution:** 
- Ensure MongoDB is running: `mongod`
- Check MONGO_URI in `.env` file
- Fix connection string if needed

### API Returns 403 Forbidden
**Problem:** Even when logged in as admin, API returns 403
**Solution:**
- Check user.role in database is "admin"
- Verify JWT token is valid
- Check token is sent in Authorization header

### Frontend Won't Build
**Problem:** "Next.js inferred your workspace root" error
**Solution:**
- Delete `package-lock.json` in root directory
- Run: `cd frontend && npm install`
- Try: `npm run dev` (for testing)

### Pages Not Showing Data
**Problem:** Tables/forms load but show no data
**Solution:**
- Open browser console (F12) for errors
- Check Network tab for API failures
- Verify backend is running and accessible
- Check database has test data

## Test Data Creation

### Create Test Users
```javascript
db.users.insertMany([
  {
    username: 'freelancer1',
    email: 'freelancer@test.com',
    role: 'freelancer',
    status: 'active',
    stellar_public_key: 'GB...',
    password_hash: 'hashed_pass',
    created_at: new Date()
  },
  {
    username: 'recruiter1',
    email: 'recruiter@test.com',
    role: 'recruiter',
    status: 'active',
    stellar_public_key: 'GB...',
    password_hash: 'hashed_pass',
    created_at: new Date()
  }
])
```

### Create Test Dispute
```javascript
db.disputes.insertOne({
  project_id: ObjectId('PROJECT_ID'),
  opened_by: ObjectId('FREELANCER_ID'),
  reason: 'Incomplete work',
  description: 'Deliverables do not match specification',
  status: 'pending',
  created_at: new Date()
})
```

### Add Verification Request
```javascript
db.recruiterprofiles.updateOne(
  { user_id: ObjectId('RECRUITER_ID') },
  {
    $set: {
      company_name: 'Tech Company LLC',
      rfc: 'TCL123456789',
      website: 'https://techcompany.com',
      verification_requested_at: new Date(),
      verified: false
    }
  }
)
```

## Performance Testing

### Load Test User Search
```bash
# Test search performance
time curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:5000/api/admin/users?search=a"
```

Should respond in <200ms.

### Load Test Disputes Pagination
```bash
# Test pagination
for i in {1..5}; do
  curl -H "Authorization: Bearer TOKEN" \
    "http://localhost:5000/api/admin/disputes?page=$i" \
    > /dev/null
done
```

## Integration Checklist

- [ ] Backend admin endpoints all return 200 status
- [ ] Frontend pages render without errors
- [ ] Auth guard prevents unauthorized access
- [ ] Search/filter functionality works
- [ ] Pagination loads correct data
- [ ] Actions (suspend, delete, verify) execute successfully
- [ ] Notifications send on resolution
- [ ] Mobile layout works properly
- [ ] All forms validate input
- [ ] Confirmation modals work

## Next Steps for Full Integration

1. **Connect On-Chain Contracts** - Call dispute resolution contracts
2. **Add Real Data** - Seed database with realistic test data
3. **Implement Reporting** - Add export/analytics features
4. **Set Up Monitoring** - Track admin actions and errors
5. **Write E2E Tests** - Automated testing with Cypress/Playwright
6. **Performance Optimization** - Index database queries
7. **Documentation** - Create admin user guide

## Support

For issues or questions about the implementation, refer to:
- `ADMIN_DASHBOARD_IMPLEMENTATION.md` - Full technical documentation
- `backend/controllers/adminController.js` - Endpoint implementations
- `frontend/src/app/admin/` - React component code
