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

/**
 * Atomically prevents duplicate queue joins and issues a unique token number.
 *
 * Steps performed inside a single atomic Lua execution:
 *  1. Check if the member lock key already exists (customer already joined).
 *  2. If it exists, return error code [1, 0] — no token issued.
 *  3. If absent, atomically increment the queue's token sequence counter.
 *  4. Set the member lock key with an end-of-day TTL to block future duplicates.
 *  5. Return success code [0, N] where N is the assigned token number.
 *
 * KEYS:
 *  - KEYS[1]: Member lock key   (queue:{queueId}:member:{customerId})
 *  - KEYS[2]: Token sequence key (queue:{queueId}:token_seq)
 *
 * ARGV:
 *  - ARGV[1]: TTL in seconds until end-of-day
 *
 * @returns {[number, number]} [errorCode, tokenNumber]
 *   - [1, 0]  customer already in queue
 *   - [0, N]  success, N = assigned token number
 */
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

/**
 * Atomically dequeues the next waiting entry from the Redis sorted set.
 *
 * Uses ZRANGE to peek at the lowest-score member (earliest join timestamp),
 * then ZREM to remove it. Both operations are part of the same atomic script,
 * so two concurrent "call next" requests cannot both receive the same entry.
 *
 * This is preferred over ZPOPMIN for broader Redis version compatibility
 * (works with Redis >= 2.6, whereas ZPOPMIN requires Redis 5.0+).
 *
 * KEYS:
 *  - KEYS[1]: Waiting sorted set key (queue:{queueId}:waiting)
 *             Members are entry UUIDs; scores are join timestamps (ms).
 *
 * @returns {string} The entryId UUID of the dequeued customer,
 *   or an empty string "" if no customers are waiting.
 */
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
