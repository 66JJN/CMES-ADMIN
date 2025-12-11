# Database Schema Documentation

## CMES-ADMIN Database Models

### 1. AdminUser
Stores admin account information
```
- username: String (unique, required)
- password: String (required)
- role: "super_admin" | "admin" | "moderator"
- email: String
- permissions: Array of String
- lastLogin: Date
- isActive: Boolean
- createdAt: Date
- updatedAt: Date
```

### 2. Ranking
Stores donation ranking
```
- name: String (required, trim)
- points: Number (required)
- rank: Number (auto-calculated)
- avatar: String
- email: String
- createdAt: Date
- updatedAt: Date
```

### 3. GiftSetting
Stores gift product information
```
- giftId: String (unique, required)
- giftName: String
- description: String
- price: Number
- available: Boolean
- stock: Number
- image: String
- category: String
- minDonationAmount: Number
- createdAt: Date
- updatedAt: Date
```

### 4. CheckHistory
Stores donation verification history
```
- giftId: String
- giftName: String
- senderName: String (required)
- tableNumber: Number
- amount: Number (required)
- status: "verified" | "pending" | "rejected"
- approvalDate: Date
- approvedBy: String
- notes: String
- userId: ObjectId (ref: User)
- createdAt: Date
- updatedAt: Date
```

### 5. AdminReport
Stores admin-side reports/issues
```
- reportId: String (unique, required)
- title: String
- description: String
- category: "technical" | "payment" | "display" | "other"
- priority: "low" | "medium" | "high" | "critical"
- status: "open" | "in-progress" | "resolved" | "closed"
- senderName: String
- senderEmail: String
- senderPhone: String
- assignedTo: String
- resolvedAt: Date
- resolution: String
- attachments: Array of String
- createdAt: Date
- updatedAt: Date
```

### 6. Setting
Stores system configuration/settings
```
- key: String (unique, required)
- value: Mixed (any type)
- description: String
- type: "string" | "number" | "boolean" | "json"
- createdAt: Date
- updatedAt: Date
```

---

## Migration Instructions

```bash
cd backend
node migrate-complete.js
```

The script will:
1. Read existing JSON files
2. Create documents in MongoDB
3. Skip documents that already exist
4. Report success/failure for each record

After migration, you can safely delete the old JSON files.
