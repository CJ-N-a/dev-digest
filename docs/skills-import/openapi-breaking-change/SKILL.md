---
name: openapi-breaking-change
description: When the diff changes an OpenAPI document or a route schema, compare it with the previous version and report every change that breaks an existing client.
type: rubric
allowed-tools: Bash(./scripts/check.sh), Read, Grep
---

Treat the OpenAPI document (or the route schemas it is generated from) as a
promise to every client. A change is breaking when a client built against the old
spec would now send an invalid request or misread a response.

## Breaking — report as CRITICAL
- A path or operation removed, or its HTTP method changed.
- A path, query or header parameter added as `required: true`, renamed, removed,
  or its `schema.type` / `format` changed.
- A `requestBody` property added to `required`, or its type narrowed (smaller
  `enum`, lower `maxLength`, `additionalProperties: false` added).
- A response property removed, renamed, its type changed, or removed from
  `required` / made `nullable` when clients read it unconditionally.
- A success status code removed or replaced (`200` → `201`), or a documented error
  response removed.

## Risky — report as WARNING
- An `enum` value added to a response field (clients with exhaustive switches break).
- A default value changed, pagination introduced, or units changed under the same
  field name.
- A security scheme added to a previously public operation.

## Compatible — do not report
- New paths or operations, new optional parameters, new optional response fields,
  descriptions and examples.

## How to report
Cite the changed line of the spec or schema. Name the operation (`GET /orders/{id}`),
the old and new shape, and the client behaviour that breaks. See
`references/examples.md` in the original package for worked examples (not
imported: only this file becomes the skill body).
