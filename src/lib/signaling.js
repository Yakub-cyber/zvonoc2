const ICE_SERVERS = [
	// STUN без query‑параметров
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:global.stun.twilio.com:3478' },

	// можно добавить ещё гугловские
	// { urls: "stun:stun1.l.google.com:19302" },
	// { urls: "stun:stun2.l.google.com:19302" },
]
export function createSignaling(url, roomId) {
	const ws = new WebSocket(`${url}?room=${encodeURIComponent(roomId)}`)
	const listeners = new Set()

	ws.addEventListener('message', e => {
		try {
			const data = JSON.parse(e.data)
			listeners.forEach(fn => fn(data))
		} catch {}
	})

	return {
		on(fn) {
			listeners.add(fn)
			return () => listeners.delete(fn)
		},
		send(obj) {
			ws.readyState === 1
				? ws.send(JSON.stringify(obj))
				: ws.addEventListener('open', () => ws.send(JSON.stringify(obj)), {
						once: true,
				  })
		},
		ready: () =>
			new Promise(res =>
				ws.readyState === 1
					? res()
					: ws.addEventListener('open', res, { once: true })
			),
		close: () => ws.close(),
	}
}
