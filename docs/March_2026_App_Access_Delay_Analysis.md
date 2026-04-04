# March 2026 App Access Delay Analysis

Based on analysis of 58 March tickets mentioning GitHub, Zendesk, Salesforce, and Gong

---

## 1. GONG TICKETS (20 tickets)

### PRIMARY DELAY CAUSES:

**✓ Additional Approval Required (Most Common)**
- "This application requires Additional Approval"
- Approval process initiated by IT, then waiting for manager/app owner approval
- Examples: ISD-39364, ISD-39362, ISD-39320

**✓ Customer Response Delays**
- Multiple follow-ups needed: "please let me know if you can access"
- 3-5 day delays waiting for user confirmation
- Example: ISD-39364 - Carlos followed up on 3/26, 3/27, 3/30, 4/1 before closure

**✓ Role/Permission Clarification**
- "What level of Gong access do you need? Listen or record?"
- Back-and-forth to determine Standard vs. Record access
- Example: ISD-39320 - had to clarify listen vs. record permissions

### SPECIFIC PATTERNS OBSERVED:
- Gong tickets typically resolved after approval + user confirmation
- Average 2-3 follow-up messages needed per ticket
- Okta tile provisioning quick, but validation takes 3-5 days

---

## 2. GITHUB TICKETS (10 tickets)

### PRIMARY DELAY CAUSES:

**✓ Complex Permission Structures**
- Multiple GitHub orgs (attentive-mobile, attentive-infosec)
- Team-based access requires finding right team owner
- Example: ISD-39127 - Hannah Houley needed infosec org access

**✓ Team Owner Approval Required**
- "Approvals are handled by individual team owners"
- Timing varies by who needs to sign off
- Had to chase approval in #infosec Slack channel

**✓ Troubleshooting Access Issues**
- User couldn't access specific repos (404 errors)
- Multiple attempts: "added you to Security Engineering GH Team"
- Had to copy another user's permissions as template

### SPECIFIC EXAMPLE:
**ISD-39127 (Hannah Houley):**
- 11 comments over multiple hours
- Added to wrong team initially, had to remove and re-add
- Needed to log in via Okta tile (not direct GitHub)
- Eventually resolved same day but 6+ hours of back-and-forth

---

## 3. SALESFORCE TICKETS (11 tickets)

### PRIMARY DELAY CAUSES:

**✓ Additional Approval Required**
- Similar to Gong: approval process bottleneck
- "Our IT support team has initiated the approval process"

**✓ Waiting for Customer Response**
- User confirmation needed after access granted
- Multi-day delays for validation

**✓ RevTech Team Coordination**
- Some Salesforce requests require RevTech team involvement
- Handoff adds time: "getting you setup with our Revtech team"
- Example: ISD-39375 (Mitch Ryan)

### SPECIFIC PATTERN:
- Quick initial response, then waiting on approval (1-2 days)
- Once approved, immediate provisioning
- Final validation can take another 1-2 days

---

## 4. ZENDESK TICKETS (6 tickets)

### PRIMARY DELAY CAUSES:

**✓ Manual Account Setup**
- "Accounts are set up manually, meaning IT has to create access"
- Cannot be fully automated

**✓ User Confusion / Training**
- Users unsure how to access Zendesk portal
- Provided link: attentive-internal-support.zendesk.com
- Example: ISD-39290 (Sean Price)

**✓ Longest Aging Despite Low Volume**
- Only 6 tickets but 103-hour average TTR
- Suggests process bottleneck, not workload issue

### SPECIFIC PATTERN:
- Users often don't know where Zendesk is located
- Manual provisioning takes longer than Okta-based apps
- Multi-day turnaround even for simple access requests

---

## SUMMARY OF ROOT CAUSES

### 1. APPROVAL BOTTLENECKS (Primary Driver)
- 12 tickets explicitly mentioned "Additional Approval"
- Multi-layer approval chains (IT initiates → Manager approves)
- No SLA on approval time from managers
- **Biggest impact: Gong, Salesforce**

### 2. CUSTOMER VALIDATION DELAYS
- Users don't respond to "can you access now?" messages
- 2-5 day delays waiting for confirmation
- IT cannot close ticket without user validation

### 3. MANUAL PROCESSES
- Zendesk requires manual account creation
- Some apps can't be fully automated via Okta
- Role assignment requires human judgment (Record vs. Listen)

### 4. COMPLEX PERMISSION MODELS
- **GitHub:** Multiple orgs, team-based access, individual repos
- **Gong:** Standard vs. Record vs. Pulse variants
- Requires back-and-forth to clarify correct access level

### 5. INTER-TEAM DEPENDENCIES
- RevTech for Salesforce
- InfoSec for GitHub
- App owners for role assignments
- Slack chasing needed to expedite

---

## RECOMMENDATIONS

1. **Streamline Approval Workflows**
   - Pre-approve common access requests by role
   - Set SLA expectations for manager approvals
   - Auto-approve for specific use cases

2. **Reduce Customer Validation Time**
   - Auto-close after 24h if user doesn't respond to "can you access?" question
   - Use status "Pending User Confirmation" separate from IT workload

3. **Automate Where Possible**
   - Zendesk API integration for account creation
   - Role-based access templates (e.g., "New CSM" = Gong Standard + Salesforce)

4. **Improve Documentation**
   - Zendesk portal location in onboarding docs
   - GitHub org structure guide for IT team
   - Gong permission level decision tree

5. **Clarify Requirements Upfront**
   - Form field: "What will you use Gong for?" → Auto-suggests Listen vs. Record
   - GitHub: "Which org/team do you need?" dropdown
   - Reduces back-and-forth messages
