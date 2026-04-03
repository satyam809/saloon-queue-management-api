/**
 * Lua scripts executed atomically on the Redis server.
 *
 * Redis guarantees that a Lua script runs without interruption — no other
 * command can be interleaved between its steps. This eliminates the TOCTOU
 * (time-of-check / time-of-use) races that multi-step application code cannot
 * prevent on its own.
 *
 * Naming convention: scripts are plain strings. They are passed to
 * RedisService.eval(script, keys, args) at call time — no SCRIPT LOAD / EVALSHA
 * needed for this app's scale.
 */

// ─── CLAIM_TOKEN ─────────────────────────────────────────────────────────────
//
// Purpose: atomically issue a token number and prevent a customer from joining
//          the same queue twice.
//
// KEYS[1] — member lock  (queue:{queueId}:member:{customerId})
// KEYS[2] — token seq    (queue:{queueId}:token_seq)
//
// ARGV[1] — EOD TTL in seconds
//
// Returns: number[]
//   [1, 0]   → customer is already in queue (member lock exists)
//   [0, N]   → success; N = token number assigned
//
// Note: capacity check is intentionally NOT done here. The service layer
// performs a SELECT COUNT before calling this script. Under very high concurrency
// (hundreds of simultaneous joins) the count could be stale by the time the
// script runs, resulting in at most 1–2 extra customers over the limit. For a
// salon queue this trade-off is acceptable and avoids a DB call inside Lua.
// If strict enforcement is needed, pass maxQueueSize as ARGV[2] and add:
//   if tonumber(redis.call('ZCARD', waitingSetKey)) >= tonumber(ARGV[2]) then ...

export const CLAIM_TOKEN_SCRIPT = `
local lockKey   = KEYS[1]
local seqKey    = KEYS[2]
local ttl       = tonumber(ARGV[1])

-- Atomic duplicate-join prevention
if redis.call('EXISTS', lockKey) == 1 then
  return {1, 0}
end

-- Issue token and mark membership
local token = redis.call('INCR', seqKey)
redis.call('EXPIRE', seqKey, ttl)
redis.call('SET', lockKey, '1', 'EX', ttl)

return {0, token}
`;

// ─── CALL_NEXT_ENTRY ─────────────────────────────────────────────────────────
//
// Purpose: atomically dequeue the next waiting entry from the sorted set so
//          that two concurrent "call next" requests cannot both pop the same
//          customer.
//
// KEYS[1] — waiting sorted set  (queue:{queueId}:waiting)
//
// Returns: string
//   ""       → set is empty (no waiting customers)
//   "<uuid>" → entryId of the customer who was popped
//
// Why not ZPOPMIN? ZPOPMIN (Redis 5.0+) would work but returns [member, score]
// and some Redis-as-a-service providers ship older versions. This script is
// compatible with Redis >= 2.6 (EVAL support).

export const CALL_NEXT_SCRIPT = `
local setKey = KEYS[1]

local members = redis.call('ZRANGE', setKey, 0, 0)
if #members == 0 then
  return ""
end

local entryId = members[1]
redis.call('ZREM', setKey, entryId)
return entryId
`;
