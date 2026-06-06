// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Angshuman Nandy
const BASE = '/api/v1'

interface StreamTokenEvent {
  token: string
}

interface StreamDoneEvent {
  done: true
}

interface StreamErrorEvent {
  error: string
}

type StreamEvent = StreamTokenEvent | StreamDoneEvent | StreamErrorEvent

function isTokenEvent(e: StreamEvent): e is StreamTokenEvent {
  return 'token' in e
}

function isDoneEvent(e: StreamEvent): e is StreamDoneEvent {
  return 'done' in e && (e as StreamDoneEvent).done === true
}

function isErrorEvent(e: StreamEvent): e is StreamErrorEvent {
  return 'error' in e
}

/**
 * Stream a query response from the RAGman backend.
 *
 * POSTs to /api/v1/agents/:agentId/query with { question, stream: true }.
 * Reads the response as NDJSON-over-SSE:
 *   - Lines delimited by \n\n
 *   - Each line prefixed with "data: "
 *   - Each payload is a JSON object
 *
 * Callbacks:
 *   onToken  — called with each streamed token string
 *   onDone   — called when the stream signals completion
 *   onError  — called with an error message string on failure
 */
export async function streamQuery(
  agentId: string,
  question: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
  documentIds?: string[],
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${BASE}/agents/${agentId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        stream: true,
        ...(documentIds?.length ? { document_ids: documentIds } : {}),
      }),
    })
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Network error')
    return
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    onError(`API ${res.status}: ${text}`)
    return
  }

  if (!res.body) {
    onError('Response body is null — streaming not supported')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n')
      // Keep the last (potentially incomplete) chunk in the buffer
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const line = part.trim()
        if (!line) continue

        // Strip the "data: " SSE prefix
        const jsonStr = line.startsWith('data: ') ? line.slice(6) : line
        if (jsonStr === '[DONE]') {
          onDone()
          return
        }

        let event: StreamEvent
        try {
          event = JSON.parse(jsonStr) as StreamEvent
        } catch {
          // Ignore malformed events
          continue
        }

        if (isErrorEvent(event)) {
          onError(event.error)
          return
        } else if (isDoneEvent(event)) {
          onDone()
          return
        } else if (isTokenEvent(event)) {
          onToken(event.token)
        }
      }
    }

    // Drain any remaining buffer content
    const remaining = buffer.trim()
    if (remaining) {
      const jsonStr = remaining.startsWith('data: ') ? remaining.slice(6) : remaining
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          const event = JSON.parse(jsonStr) as StreamEvent
          if (isErrorEvent(event)) {
            onError(event.error)
            return
          } else if (isTokenEvent(event)) {
            onToken(event.token)
          }
        } catch {
          // Ignore
        }
      }
    }

    onDone()
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Stream read error')
  } finally {
    reader.releaseLock()
  }
}
