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
			if (ws.readyState === 1) ws.send(JSON.stringify(obj))
			else
				ws.addEventListener('open', () => ws.send(JSON.stringify(obj)), {
					once: true,
				})
		},
		ready: () =>
			new Promise(res => {
				if (ws.readyState === 1) res()
				else ws.addEventListener('open', res, { once: true })
			}),
		close: () => ws.close(),
	}
}
