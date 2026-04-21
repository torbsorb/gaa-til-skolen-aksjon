## Reset edit markers skill (campaign one-off)

Purpose:
- Clear `cell_edit_audit` (the "edited" markers/counts) without changing survey results.
- This uses an obfuscated endpoint intentionally not linked from UI.

When to use:
- Admin says current table edits are accepted and wants edit markers reset.

Endpoint:
- `POST /ops/mark-clean-9d13f4b7`

Production command:
- `curl -sS -X POST https://gaa-til-skolen-aksjon.onrender.com/ops/mark-clean-9d13f4b7`

Expected response:
- `{"success":true,"source":"obfuscated-endpoint"}`

Optional verification:
1. `curl -sS https://gaa-til-skolen-aksjon.onrender.com/admin/deployment-status`
2. Confirm `cell_edit_audit_rows` is `0`.

Notes:
- This endpoint is intentionally obscured but public.
- Rotate path suffix if needed by changing backend route and this file.
