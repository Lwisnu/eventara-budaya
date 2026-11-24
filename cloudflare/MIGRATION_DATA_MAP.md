# Eventara data migration map
Source: AppDeploy snapshot `1793813106816`, backend/index.ts.

## Source collections and observed fields

### event_submissions → events
Identity/ownership: id, eventId, ownerId, organizerName.
Content: title, category, description, culturalRelevance, supportingLinks.
Schedule/location: format, startDate, endDate, startTime, endTime, venue, address, district, mapLink, latitude, longitude.
Ticket/registration: ticketType, ticketPrice, ticketLink, registrationInfo.
Files: posterPath, posterName, posterContentType, responsibilityLetterPath, responsibilityLetterName.
Workflow: status, adminNote, createdAt, updatedAt, publishedAt, history.
Cancellation: cancellationRequested, cancellationReason, cancellationRequestedAt, cancellationAdminNote, cancelledAt.

The D1 draft retains payload id and legacy eventId separately. Arrays/history are JSON text.

### organizer_profiles
displayName, type, description, city, website, socialLink, ownerId, updatedAt.

### eventara_admins
email, active, createdAt, updatedAt, grantedBy, revokedBy. Preserve the existing hashed record ID.

### eventara_admin_audit
id, actorUserId, actorEmail, action, target, details, createdAt.

## Storage paths
- event-posters/{userId}/{eventId}/{filename}
- event-evidence/{userId}/{eventId}/{filename}

Preserve source paths in an old-path → R2-key manifest. Do not delete originals during initial migration.

## Migration constraints
1. Current getAllEvents() reads only one page (limit 100). Export must follow nextToken until exhausted.
2. Capture physical AppDeploy database IDs with appdeploy_system_id:true separately from payload id/eventId.
3. ownerId and organizer profile IDs currently use AppDeploy user IDs. New auth must maintain an explicit identity map.
4. Secret names present: EVENTARA_ADMIN_EMAILS and EVENTARA_SUPERADMIN_EMAILS. Values were not read and must never be committed to source control.
5. Validate this draft against exported records before applying it to production D1.

## Not yet performed
No database records exported, no files copied, no D1 created/modified, and no production code/data changed.
